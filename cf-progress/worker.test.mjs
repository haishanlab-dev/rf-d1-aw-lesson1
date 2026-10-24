import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import worker from './worker.js';
import {
  mergeProgress,
  normalizeStored,
  parseByteRange,
  publicView,
  resolveAudioType,
  retellObjectKey,
} from './progress-model.js';

const KEY = 'family-test-key';

function makeKv() {
  const m = new Map();
  return {
    async get(key, type) {
      if (!m.has(key)) return null;
      const v = m.get(key);
      return type === 'json' ? JSON.parse(v) : v;
    },
    async put(key, val) { m.set(key, val); },
    raw() { return m.has('miles:progress') ? JSON.parse(m.get('miles:progress')) : null; },
  };
}

function makeR2() {
  const objects = new Map();
  return {
    objects,
    async put(key, body, opts) {
      const bytes = body instanceof ArrayBuffer ? new Uint8Array(body) : new Uint8Array(body);
      objects.set(key, { bytes, httpMetadata: (opts && opts.httpMetadata) || {}, customMetadata: (opts && opts.customMetadata) || {} });
    },
    async head(key) {
      const o = objects.get(key);
      if (!o) return null;
      return { size: o.bytes.byteLength, key, httpMetadata: o.httpMetadata };
    },
    async get(key, opts) {
      const o = objects.get(key);
      if (!o) return null;
      let offset = 0;
      let length = o.bytes.byteLength;
      if (opts && opts.range) {
        offset = opts.range.offset || 0;
        length = opts.range.length != null ? opts.range.length : o.bytes.byteLength - offset;
      }
      const slice = o.bytes.slice(offset, offset + length);
      return {
        key,
        size: o.bytes.byteLength,
        body: new Blob([slice]).stream(),
        httpMetadata: o.httpMetadata,
        writeHttpMetadata(headers) {
          if (o.httpMetadata.contentType) headers.set('Content-Type', o.httpMetadata.contentType);
        },
      };
    },
    async delete(key) { objects.delete(key); },
  };
}

function envWith() {
  return { FAMILY_KEY: KEY, PROGRESS_KV: makeKv(), RETELL_BUCKET: makeR2() };
}

function call(env, method, path, { body, headers, raw } = {}) {
  const h = new Headers(headers || {});
  if (!h.has('Authorization') && headers?.Authorization !== null) {
    // default auth unless explicitly omitted via auth:false — handled by caller
  }
  const init = { method, headers: h };
  if (raw != null) init.body = raw;
  else if (body != null) init.body = JSON.stringify(body);
  return worker.fetch(new Request('https://rf.example' + path, init), env);
}

function authed(env, method, path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + KEY);
  if (opts.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  return call(env, method, path, { ...opts, headers });
}

test('GET without a key is rejected', async () => {
  const env = envWith();
  const res = await call(env, 'GET', '/progress', { headers: {} });
  assert.equal(res.status, 401);
});

test('empty GET fills footprints and null retells', async () => {
  const env = envWith();
  const res = await authed(env, 'GET', '/progress');
  const data = await res.json();
  assert.equal(res.status, 200);
  for (const id of ['unit1', 'unit2', 'unit3', 'unit4', 'scienceReview']) {
    assert.equal(data.completed[id], false);
    assert.deepEqual(data.footprints[id].mapParts, [false, false, false, false]);
    assert.equal(data.footprints[id].sessionADone, false);
    assert.equal(data.retells[id], null);
  }
  assert.equal(JSON.stringify(data).includes('retells/'), false);
});

test('old KV record without new fields still reads', async () => {
  const env = envWith();
  await env.PROGRESS_KV.put('miles:progress', JSON.stringify({
    learner: 'Miles',
    completed: { unit1: true, unit2: false },
    softStreakDays: 2,
    lastActiveAt: '2020-01-01T00:00:00.000Z',
  }));
  const res = await authed(env, 'GET', '/progress');
  const data = await res.json();
  assert.equal(data.completed.unit1, true);
  assert.equal(data.completed.unit3, false);
  assert.equal(data.footprints.unit1.sessionADone, false);
  assert.equal(data.retells.unit2, null);
  assert.equal(data.softStreakDays, 2);
  assert.equal(data.lastActiveAt, '2020-01-01T00:00:00.000Z');
});

test('old completed:true is kept when a later footprint PUT omits it', async () => {
  const env = envWith();
  let res = await authed(env, 'PUT', '/progress', { body: { completed: { unit1: true } } });
  let data = await res.json();
  assert.equal(data.completed.unit1, true);
  assert.equal(data.footprints.unit1.sessionADone, false);

  res = await authed(env, 'PUT', '/progress', {
    body: { footprints: { unit1: { sessionADone: true, mapParts: [true, false, false, false] } } },
  });
  data = await res.json();
  assert.equal(data.completed.unit1, true);
  assert.equal(data.footprints.unit1.sessionADone, true);
  assert.deepEqual(data.footprints.unit1.mapParts, [true, false, false, false]);
});

test('whole-lesson star turns on only when both sessions are stored', async () => {
  const env = envWith();
  let res = await authed(env, 'PUT', '/progress', {
    body: { footprints: { unit2: { sessionADone: true } } },
  });
  let data = await res.json();
  assert.equal(data.completed.unit2, false);
  assert.equal(data.footprints.unit2.sessionADone, true);

  res = await authed(env, 'PUT', '/progress', {
    body: { footprints: { unit2: { sessionBDone: true, mapParts: [false, false, true, false] } } },
  });
  data = await res.json();
  assert.equal(data.footprints.unit2.sessionADone, true);
  assert.equal(data.footprints.unit2.sessionBDone, true);
  assert.equal(data.completed.unit2, true);
  assert.deepEqual(data.footprints.unit2.mapParts, [false, false, true, false]);
});

test('map parts OR together and retellDone does not turn off', async () => {
  const env = envWith();
  await authed(env, 'PUT', '/progress', { body: { footprints: { unit3: { mapParts: [true, false, false, false], retellDone: true } } } });
  const res = await authed(env, 'PUT', '/progress', { body: { footprints: { unit3: { mapParts: [false, false, false, true], retellDone: false } } } });
  const data = await res.json();
  assert.deepEqual(data.footprints.unit3.mapParts, [true, false, false, true]);
  assert.equal(data.footprints.unit3.retellDone, true);
});

test('science review session end can still set the whole-lesson star', async () => {
  const env = envWith();
  const res = await authed(env, 'PUT', '/progress', {
    body: { footprints: { scienceReview: { sessionADone: true } }, completed: { scienceReview: true } },
  });
  const data = await res.json();
  assert.equal(data.completed.scienceReview, true);
  assert.equal(data.footprints.scienceReview.sessionBDone, false);
  assert.equal(data.unitsOpen, 1);
});

test('PUT does not wipe a stored retell', async () => {
  const env = envWith();
  const audio = new Uint8Array(64);
  audio.set([0, 0, 0, 24, 102, 116, 121, 112], 0); // ftyp
  let res = await authed(env, 'POST', '/retell/unit1', {
    raw: audio,
    headers: { 'Content-Type': 'audio/mp4', 'X-Duration-Ms': '4200' },
  });
  assert.equal(res.status, 200);
  let data = await res.json();
  assert.equal(data.retells.unit1.contentType, 'audio/mp4');
  assert.equal(data.retells.unit1.durationMs, 4200);
  assert.equal(data.retells.unit1.bytes, 64);
  assert.equal(Object.hasOwn(data.retells.unit1, 'key'), false);

  res = await authed(env, 'PUT', '/progress', { body: { footprints: { unit1: { retellDone: true } } } });
  data = await res.json();
  assert.equal(data.footprints.unit1.retellDone, true);
  assert.equal(data.retells.unit1.bytes, 64);
  const stored = env.PROGRESS_KV.raw();
  assert.equal(stored.retells.unit1.key, 'retells/unit1/latest.m4a');
});

test('GET audio streams bytes and honors Range', async () => {
  const env = envWith();
  const audio = new Uint8Array(80);
  for (let i = 0; i < audio.length; i++) audio[i] = i + 1;
  audio.set([0, 0, 0, 24, 102, 116, 121, 112], 0);
  await authed(env, 'POST', '/retell/unit4', { raw: audio, headers: { 'Content-Type': 'audio/mp4' } });

  const full = await authed(env, 'GET', '/retell/unit4');
  assert.equal(full.status, 200);
  assert.equal(full.headers.get('Content-Type'), 'audio/mp4');
  assert.match(full.headers.get('Content-Disposition'), /inline; filename="miles-unit4-retell.m4a"/);
  assert.equal(full.headers.get('Access-Control-Allow-Origin'), 'https://haishanlab-dev.github.io');
  const bytes = new Uint8Array(await full.arrayBuffer());
  assert.equal(bytes.length, 80);
  assert.equal(bytes[10], 11);

  const part = await authed(env, 'GET', '/retell/unit4', { headers: { Range: 'bytes=4-7' } });
  assert.equal(part.status, 206);
  assert.equal(part.headers.get('Content-Range'), 'bytes 4-7/80');
  const slice = new Uint8Array(await part.arrayBuffer());
  assert.deepEqual(Array.from(slice), [102, 116, 121, 112]);
});

test('a new format replaces the object and drops the previous key', async () => {
  const env = envWith();
  const mp4 = new Uint8Array(40);
  mp4.set([0, 0, 0, 20, 102, 116, 121, 112], 0);
  await authed(env, 'POST', '/retell/unit1', { raw: mp4, headers: { 'Content-Type': 'audio/mp4' } });
  assert.ok(env.RETELL_BUCKET.objects.has('retells/unit1/latest.m4a'));

  const webm = new Uint8Array(40);
  webm.set([0x1a, 0x45, 0xdf, 0xa3], 0);
  const res = await authed(env, 'POST', '/retell/unit1', { raw: webm, headers: { 'Content-Type': 'audio/webm' } });
  const data = await res.json();
  assert.equal(data.retells.unit1.contentType, 'audio/webm');
  assert.equal(env.RETELL_BUCKET.objects.has('retells/unit1/latest.m4a'), false);
  assert.ok(env.RETELL_BUCKET.objects.has('retells/unit1/latest.webm'));
});

test('rejects unknown units, empty audio, huge audio, and bad types', async () => {
  const env = envWith();
  assert.equal((await authed(env, 'POST', '/retell/nope', { raw: new Uint8Array(40), headers: { 'Content-Type': 'audio/mp4' } })).status, 404);
  assert.equal((await authed(env, 'POST', '/retell/unit1', { raw: new Uint8Array(8), headers: { 'Content-Type': 'audio/mp4' } })).status, 400);
  const big = new Uint8Array(4 * 1024 * 1024 + 1);
  assert.equal((await authed(env, 'POST', '/retell/unit1', { raw: big, headers: { 'Content-Type': 'audio/mp4' } })).status, 413);
  const junk = new Uint8Array(40);
  assert.equal((await authed(env, 'POST', '/retell/unit1', { raw: junk, headers: { 'Content-Type': 'text/plain' } })).status, 415);
});

test('sniffs ftyp when the type header is generic', () => {
  const bytes = new Uint8Array(32);
  bytes.set([0, 0, 0, 24, 102, 116, 121, 112], 0);
  assert.equal(resolveAudioType('application/octet-stream', bytes), 'audio/mp4');
  assert.equal(retellObjectKey('unit1', 'audio/mp4'), 'retells/unit1/latest.m4a');
  assert.equal(resolveAudioType('audio/mp4;codecs=mp4a.40.2', bytes), 'audio/mp4');
});

test('parseByteRange', () => {
  assert.deepEqual(parseByteRange('bytes=0-', 10), { offset: 0, length: 10, end: 9 });
  assert.deepEqual(parseByteRange('bytes=2-4', 10), { offset: 2, length: 3, end: 4 });
  assert.equal(parseByteRange('bytes=9-4', 10).unsatisfiable, true);
  assert.equal(parseByteRange(null, 10), null);
});

test('merge keeps unknown client retell keys out of storage', () => {
  const prev = normalizeStored({
    retells: { unit1: { key: 'retells/unit1/latest.m4a', contentType: 'audio/mp4', bytes: 10, recordedAt: 't', durationMs: 1 } },
  });
  const next = mergeProgress(prev, { retells: { unit1: null }, footprints: { unit1: { sessionBDone: true } } }, 'now');
  assert.equal(next.retells.unit1.key, 'retells/unit1/latest.m4a');
  assert.equal(next.footprints.unit1.sessionBDone, true);
  assert.equal(publicView(next).retells.unit1.key, undefined);
});

test('lesson pages instrument footprints and retell', () => {
  const pages = [
    ['index.html', 'unit1', 'assets/'],
    ['unit2/index.html', 'unit2', '../assets/'],
    ['unit3/index.html', 'unit3', '../assets/'],
    ['unit4/index.html', 'unit4', '../assets/'],
    ['science-review/index.html', 'scienceReview', '../assets/'],
  ];
  for (const [file, unit, prefix] of pages) {
    const html = fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');
    assert.match(html, new RegExp("var RF_UNIT='" + unit + "'"));
    assert.ok(html.includes(prefix + 'retell-recorder.js'));
    assert.ok(html.includes('RFProgress.notePart(RF_UNIT, sc.part)'));
    assert.ok(html.includes('RFProgress.noteRetell(RF_UNIT)'));
    assert.ok(html.includes('RFProgress.markSessionDone(RF_UNIT, start.s)'));
    assert.ok(html.includes('RFRetell.mount'));
    assert.equal(html.includes("markComplete('" + unit + "')"), false);
  }
});

test('options preflight allows the pages origin', async () => {
  const env = envWith();
  const res = await worker.fetch(new Request('https://rf.example/retell/unit1', {
    method: 'OPTIONS',
    headers: { Origin: 'https://haishanlab-dev.github.io' },
  }), env);
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://haishanlab-dev.github.io');
  assert.match(res.headers.get('Access-Control-Allow-Headers'), /X-Duration-Ms/);
});
