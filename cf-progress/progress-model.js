/**
 * Pure progress + retell metadata helpers.
 * KV stores internal retell object keys. Public JSON never includes them.
 */

export const UNITS = ['unit1', 'unit2', 'unit3', 'unit4', 'scienceReview'];

export const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

const AUDIO_EXT = {
  'audio/mp4': '.m4a',
  'audio/m4a': '.m4a',
  'audio/x-m4a': '.m4a',
  'audio/aac': '.m4a',
  'video/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/webm': '.webm',
  'audio/wav': '.wav',
  'audio/wave': '.wav',
  'audio/x-wav': '.wav',
};

export function emptyFootprint() {
  return {
    sessionADone: false,
    sessionBDone: false,
    mapParts: [false, false, false, false],
    retellDone: false,
  };
}

export function baseType(contentType) {
  return String(contentType || '').split(';')[0].trim().toLowerCase();
}

export function extensionForType(contentType) {
  return AUDIO_EXT[baseType(contentType)] || '';
}

/** Magic-byte sniff when the browser omits a codec type. iPad Safari is audio/mp4 (ftyp). */
export function sniffAudio(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || []);
  if (b.length >= 12) {
    const brand = String.fromCharCode(b[4], b[5], b[6], b[7]);
    if (brand === 'ftyp') return 'audio/mp4';
  }
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'audio/webm';
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'audio/wav';
  if (b.length >= 3 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'audio/mpeg';
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return 'audio/mpeg';
  return '';
}

export function resolveAudioType(contentType, bytes) {
  const declared = baseType(contentType);
  if (AUDIO_EXT[declared]) return declared === 'video/mp4' ? 'audio/mp4' : declared;
  const sniffed = sniffAudio(bytes);
  if (AUDIO_EXT[sniffed]) return sniffed === 'video/mp4' ? 'audio/mp4' : sniffed;
  return '';
}

export function retellObjectKey(unitId, contentType) {
  const ext = extensionForType(contentType);
  if (!ext || UNITS.indexOf(unitId) < 0) return '';
  return 'retells/' + unitId + '/latest' + ext;
}

export function retellFilename(unitId, contentType) {
  const ext = (extensionForType(contentType) || '.m4a').slice(1);
  return 'miles-' + unitId + '-retell.' + ext;
}

export function parseDurationMs(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(120000, Math.round(n));
}

function normalizeParts(raw) {
  const out = [false, false, false, false];
  if (Array.isArray(raw)) {
    const numeric = raw.length > 0 && raw.every((v) => typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)));
    if (numeric) {
      for (const n of raw) {
        const p = Number(n);
        if (p >= 1 && p <= 4) out[p - 1] = true;
      }
      return out;
    }
    for (let i = 0; i < 4; i++) out[i] = !!raw[i];
    return out;
  }
  if (raw && typeof raw === 'object') {
    for (let p = 1; p <= 4; p++) {
      if (raw[p] || raw[String(p)]) out[p - 1] = true;
    }
  }
  return out;
}

export function normalizeFootprint(raw) {
  const base = emptyFootprint();
  if (!raw || typeof raw !== 'object') return base;
  base.sessionADone = !!raw.sessionADone;
  base.sessionBDone = !!raw.sessionBDone;
  base.retellDone = !!raw.retellDone;
  base.mapParts = normalizeParts(raw.mapParts);
  return base;
}

function orFootprint(prev, incoming) {
  const a = normalizeFootprint(prev);
  if (incoming == null) return a;
  const b = normalizeFootprint(incoming);
  return {
    sessionADone: a.sessionADone || b.sessionADone,
    sessionBDone: a.sessionBDone || b.sessionBDone,
    retellDone: a.retellDone || b.retellDone,
    mapParts: a.mapParts.map((v, i) => !!(v || b.mapParts[i])),
  };
}

function countOpen(completed) {
  let n = 0;
  for (const id of UNITS) if (completed[id]) n++;
  return n;
}

function copyRetell(raw) {
  if (!raw || typeof raw !== 'object' || !raw.key) return null;
  return {
    key: String(raw.key),
    contentType: baseType(raw.contentType) || 'audio/mp4',
    recordedAt: raw.recordedAt || null,
    durationMs: typeof raw.durationMs === 'number' ? raw.durationMs : null,
    bytes: typeof raw.bytes === 'number' ? raw.bytes : null,
  };
}

/**
 * Merge a PUT body onto the stored record.
 * Booleans only ever turn on. Omitted footprints/retells stay as stored.
 * `completed` is the whole lesson: explicit true, already true, or both sessions done.
 * Retell object keys are never taken from the client body.
 */
export function mergeProgress(prev, body, nowIso) {
  const base = prev && typeof prev === 'object' ? prev : {};
  const patch = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const completed = {};
  const footprints = {};
  const retells = {};
  for (const id of UNITS) {
    const fp = orFootprint(base.footprints && base.footprints[id], patch.footprints ? patch.footprints[id] : null);
    footprints[id] = fp;
    const prevC = !!(base.completed && base.completed[id]);
    const bodyC = !!(patch.completed && patch.completed[id]);
    const both = fp.sessionADone && fp.sessionBDone;
    completed[id] = prevC || bodyC || both;
  }
  for (const id of UNITS) {
    retells[id] = copyRetell(base.retells && base.retells[id]);
  }
  const soft = typeof patch.softStreakDays === 'number' ? patch.softStreakDays : (base.softStreakDays || 0);
  const next = {
    learner: 'Miles',
    totalUnits: 16,
    completed,
    footprints,
    retells,
    softStreakDays: soft,
    lastActiveAt: nowIso,
    updatedAt: nowIso,
  };
  next.unitsOpen = countOpen(completed);
  return next;
}

export function normalizeStored(raw) {
  const base = raw && typeof raw === 'object' ? raw : {};
  const next = mergeProgress(base, {}, base.updatedAt || null);
  next.lastActiveAt = base.lastActiveAt || null;
  next.updatedAt = base.updatedAt || null;
  if (!raw) {
    next.softStreakDays = 0;
  }
  return next;
}

export function recordRetell(stored, unitId, meta) {
  const base = normalizeStored(stored);
  const prev = base.retells[unitId];
  const oldKey = prev && prev.key && prev.key !== meta.key ? prev.key : null;
  base.retells[unitId] = {
    key: meta.key,
    contentType: meta.contentType,
    recordedAt: meta.recordedAt,
    durationMs: meta.durationMs,
    bytes: meta.bytes,
  };
  base.updatedAt = meta.recordedAt;
  base.lastActiveAt = meta.recordedAt;
  return { stored: base, oldKey };
}

export function publicView(stored) {
  const src = stored && typeof stored === 'object' ? stored : normalizeStored(null);
  const retells = {};
  for (const id of UNITS) {
    const r = src.retells && src.retells[id];
    if (r && r.key) {
      retells[id] = {
        contentType: r.contentType || 'audio/mp4',
        recordedAt: r.recordedAt || null,
        durationMs: typeof r.durationMs === 'number' ? r.durationMs : null,
        bytes: typeof r.bytes === 'number' ? r.bytes : null,
      };
    } else {
      retells[id] = null;
    }
  }
  const completed = {};
  const footprints = {};
  for (const id of UNITS) {
    completed[id] = !!(src.completed && src.completed[id]);
    footprints[id] = normalizeFootprint(src.footprints && src.footprints[id]);
  }
  return {
    learner: 'Miles',
    unitsOpen: typeof src.unitsOpen === 'number' ? src.unitsOpen : countOpen(completed),
    totalUnits: 16,
    completed,
    footprints,
    retells,
    softStreakDays: src.softStreakDays || 0,
    lastActiveAt: src.lastActiveAt || null,
    updatedAt: src.updatedAt || null,
  };
}

/** Inclusive byte range. `null` if the header is absent or not a single range. */
export function parseByteRange(header, size) {
  if (!header || !size) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start;
  let end;
  if (m[1] === '') {
    const n = Number(m[2]);
    if (!Number.isFinite(n) || n <= 0) return null;
    start = Math.max(0, size - n);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Number(m[2]);
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) {
    return { unsatisfiable: true };
  }
  end = Math.min(end, size - 1);
  return { offset: start, length: end - start + 1, end };
}
