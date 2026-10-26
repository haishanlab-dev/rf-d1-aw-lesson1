/**
 * Miles RF progress API — Cloudflare Worker + KV + R2
 *
 * Auth: Authorization: Bearer <FAMILY_KEY>  (Worker secret, never in the repo)
 * CORS: lesson origins (GitHub Pages + english.milesden.com)
 *
 * Bindings (see wrangler.jsonc):
 *   PROGRESS_KV    — existing miles:progress JSON
 *   RETELL_BUCKET  — R2 bucket for retell audio (binding name, not a public URL)
 *   FAMILY_KEY     — secret (`wrangler secret put FAMILY_KEY`)
 *
 * Routes:
 *   GET/PUT /progress
 *   POST    /retell/:unitId     raw audio body
 *   GET     /retell/:unitId     stream latest audio (Range supported)
 */
import {
  MAX_AUDIO_BYTES,
  UNITS,
  mergeProgress,
  normalizeStored,
  parseByteRange,
  parseDurationMs,
  publicView,
  recordRetell,
  resolveAudioType,
  retellFilename,
  retellObjectKey,
} from './progress-model.js';

const ALLOW_ORIGINS = [
  'https://haishanlab-dev.github.io',
  'https://english.milesden.com',
  'http://localhost:8787',
  'http://127.0.0.1:8787',
];

const KV_KEY = 'miles:progress';

function corsHeaders(origin) {
  const o = ALLOW_ORIGINS.includes(origin) ? origin : ALLOW_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Duration-Ms, Range',
    'Access-Control-Expose-Headers': 'Accept-Ranges, Content-Range, Content-Length, Content-Disposition, Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(origin) },
  });
}

function unauthorized(origin) {
  return json({ error: 'unauthorized' }, 401, origin);
}

async function verifyBearer(provided, expected) {
  if (!expected || !provided) return false;
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  if (typeof crypto.subtle.timingSafeEqual === 'function') {
    return crypto.subtle.timingSafeEqual(a, b);
  }
  const ba = new Uint8Array(a);
  const bb = new Uint8Array(b);
  let out = 0;
  for (let i = 0; i < ba.length; i++) out |= ba[i] ^ bb[i];
  return out === 0;
}

async function checkAuth(req, env) {
  const h = req.headers.get('Authorization') || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m || !env.FAMILY_KEY) return false;
  return verifyBearer(m[1].trim(), String(env.FAMILY_KEY));
}

function unitFromPath(pathname) {
  const m = /^\/retell\/([A-Za-z0-9]+)$/.exec(pathname);
  if (!m) return '';
  return UNITS.includes(m[1]) ? m[1] : '';
}

async function readStored(env) {
  const raw = await env.PROGRESS_KV.get(KV_KEY, 'json');
  return normalizeStored(raw);
}

async function writeStored(env, stored) {
  await env.PROGRESS_KV.put(KV_KEY, JSON.stringify(stored));
}

async function readBounded(request) {
  const declared = Number(request.headers.get('Content-Length') || '');
  if (Number.isFinite(declared) && declared > MAX_AUDIO_BYTES) return { error: 'too_large' };
  const buf = await request.arrayBuffer();
  if (buf.byteLength > MAX_AUDIO_BYTES) return { error: 'too_large' };
  if (buf.byteLength < 32) return { error: 'empty' };
  return { buf };
}

async function handleRetellPost(request, env, origin, unitId) {
  if (!env.RETELL_BUCKET) {
    console.log(JSON.stringify({ msg: 'retell_bucket_missing' }));
    return json({ error: 'storage_unavailable' }, 503, origin);
  }
  const read = await readBounded(request);
  if (read.error === 'too_large') return json({ error: 'too_large' }, 413, origin);
  if (read.error) return json({ error: 'empty' }, 400, origin);

  const contentType = resolveAudioType(request.headers.get('Content-Type'), new Uint8Array(read.buf));
  if (!contentType) return json({ error: 'unsupported_type' }, 415, origin);

  const key = retellObjectKey(unitId, contentType);
  const now = new Date().toISOString();
  const durationMs = parseDurationMs(request.headers.get('X-Duration-Ms'));
  const filename = retellFilename(unitId, contentType);

  await env.RETELL_BUCKET.put(key, read.buf, {
    httpMetadata: {
      contentType,
      contentDisposition: 'inline; filename="' + filename + '"',
    },
    customMetadata: { unitId, recordedAt: now },
  });

  const prev = await readStored(env);
  const { stored, oldKey } = recordRetell(prev, unitId, {
    key,
    contentType,
    recordedAt: now,
    durationMs,
    bytes: read.buf.byteLength,
  });
  await writeStored(env, stored);
  if (oldKey) {
    try {
      await env.RETELL_BUCKET.delete(oldKey);
    } catch (err) {
      console.log(JSON.stringify({ msg: 'retell_delete_old_failed', unitId }));
    }
  }
  console.log(JSON.stringify({ msg: 'retell_saved', unitId, bytes: read.buf.byteLength, contentType }));
  return json(publicView(stored), 200, origin);
}

async function handleRetellGet(request, env, origin, unitId) {
  if (!env.RETELL_BUCKET) return json({ error: 'storage_unavailable' }, 503, origin);
  const stored = await readStored(env);
  const meta = stored.retells && stored.retells[unitId];
  if (!meta || !meta.key) return json({ error: 'not_found' }, 404, origin);

  const head = await env.RETELL_BUCKET.head(meta.key);
  if (!head) return json({ error: 'not_found' }, 404, origin);

  const size = head.size;
  const parsed = parseByteRange(request.headers.get('Range'), size);
  if (parsed && parsed.unsatisfiable) {
    return new Response(null, {
      status: 416,
      headers: {
        ...corsHeaders(origin),
        'Content-Range': 'bytes */' + size,
        'Accept-Ranges': 'bytes',
      },
    });
  }

  const obj = await env.RETELL_BUCKET.get(meta.key, parsed ? { range: { offset: parsed.offset, length: parsed.length } } : undefined);
  if (!obj || !obj.body) return json({ error: 'not_found' }, 404, origin);

  const headers = new Headers(corsHeaders(origin));
  if (typeof obj.writeHttpMetadata === 'function') obj.writeHttpMetadata(headers);
  headers.set('Content-Type', meta.contentType || 'audio/mp4');
  headers.set('Accept-Ranges', 'bytes');
  headers.set('Cache-Control', 'private, no-store');
  const filename = retellFilename(unitId, meta.contentType);
  const download = new URL(request.url).searchParams.get('download') === '1';
  headers.set('Content-Disposition', (download ? 'attachment' : 'inline') + '; filename="' + filename + '"');

  if (parsed) {
    headers.set('Content-Range', 'bytes ' + parsed.offset + '-' + parsed.end + '/' + size);
    headers.set('Content-Length', String(parsed.length));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('Content-Length', String(size));
  return new Response(obj.body, { status: 200, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const retellUnit = unitFromPath(url.pathname);
    const isRetell = url.pathname.startsWith('/retell/');
    const isProgress = url.pathname === '/progress' || url.pathname === '/';

    if (!isProgress && !isRetell) return json({ error: 'not_found' }, 404, origin);
    if (isRetell && !retellUnit) return json({ error: 'not_found' }, 404, origin);
    if (!(await checkAuth(request, env))) return unauthorized(origin);

    try {
      if (isRetell && request.method === 'POST') return await handleRetellPost(request, env, origin, retellUnit);
      if (isRetell && request.method === 'GET') return await handleRetellGet(request, env, origin, retellUnit);
      if (isRetell) return json({ error: 'method_not_allowed' }, 405, origin);

      if (request.method === 'GET') {
        const stored = await readStored(env);
        return json(publicView(stored), 200, origin);
      }

      if (request.method === 'PUT') {
        let body;
        try {
          body = await request.json();
        } catch {
          return json({ error: 'invalid_json' }, 400, origin);
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          return json({ error: 'invalid_json' }, 400, origin);
        }
        const prev = await readStored(env);
        const now = new Date().toISOString();
        const next = mergeProgress(prev, body, now);
        await writeStored(env, next);
        return json(publicView(next), 200, origin);
      }

      return json({ error: 'method_not_allowed' }, 405, origin);
    } catch (err) {
      console.log(JSON.stringify({ msg: 'progress_error', error: err && err.name ? err.name : 'error' }));
      return json({ error: 'server_error' }, 500, origin);
    }
  },
};
