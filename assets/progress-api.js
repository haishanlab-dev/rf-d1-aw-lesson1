/**
 * Reading Future · Miles progress (Cloudflare Worker) + local prefs
 * Family key lives only in localStorage — never hardcode it here.
 */
(function (global) {
  'use strict';

  var API_BASE = 'https://rf-miles-progress.haishanlab.workers.dev';
  var STORAGE_KEY = 'rfMilesFamilyKey';
  var K_TEXT = 'rfTextSize';
  var K_FONT = 'rfFontHarmony';
  var K_NAME = 'rfLearnerName';
  var K_VOICE = 'rfVoice';

  var TEXT_SIZES = ['medium', 'large', 'xl'];
  var VOICES = ['en-GB', 'en-US'];
  var VOICE_LABELS = { 'en-GB': 'en-GB · Sonia', 'en-US': 'en-US · Jenny' };
  var DEFAULT_NAME = 'Miles';
  var DEFAULT_VOICE = 'en-GB';

  function getFamilyKey() {
    try {
      return (localStorage.getItem(STORAGE_KEY) || '').trim();
    } catch (e) {
      return '';
    }
  }

  function setFamilyKey(key) {
    var k = String(key || '').trim();
    try {
      if (k) localStorage.setItem(STORAGE_KEY, k);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {}
    return k;
  }

  /** Accept ?key= once, save, strip from URL (first-setup helper). */
  function consumeKeyFromQuery() {
    try {
      var u = new URL(location.href);
      var k = (u.searchParams.get('key') || '').trim();
      if (!k) return getFamilyKey();
      setFamilyKey(k);
      u.searchParams.delete('key');
      var next = u.pathname + (u.searchParams.toString() ? '?' + u.searchParams.toString() : '') + u.hash;
      history.replaceState(null, '', next);
      return k;
    } catch (e) {
      return getFamilyKey();
    }
  }

  function authHeaders() {
    var key = getFamilyKey();
    if (!key) return null;
    return {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    };
  }

  /**
   * fetch with a time limit and a few retries (F10).
   * Without a limit a stalled request on iPad Wi-Fi never settles, and because writes
   * run one at a time (enqueueWrite) every later save would wait behind it forever.
   * Retries only on network errors, timeouts, 408, 429 and 5xx. Every call here is safe
   * to repeat: progress PUT is an OR-merge, retell POST replaces the unit's latest file.
   * The time limit covers waiting for the response headers. A retell upload retries once
   * only, so a child is not left on "Saving…" for minutes.
   */
  var RETRY_DELAYS_MS = [1000, 3000];
  function isRetryableStatus(status) {
    return status === 408 || status === 429 || status >= 500;
  }
  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }
  function fetchOnce(url, opts, timeoutMs) {
    var ctrl = (typeof AbortController === 'function') ? new AbortController() : null;
    var o = {};
    for (var k in opts) o[k] = opts[k];
    if (ctrl) o.signal = ctrl.signal;
    var timer;
    var timeout = new Promise(function (_res, rej) {
      timer = setTimeout(function () {
        if (ctrl) { try { ctrl.abort(); } catch (e) {} }
        rej(new Error('timeout'));
      }, timeoutMs);
    });
    return Promise.race([fetch(url, o), timeout]).then(function (res) {
      clearTimeout(timer);
      return res;
    }, function (err) {
      clearTimeout(timer);
      throw err;
    });
  }
  function fetchWithRetry(url, opts, timeoutMs, maxRetries) {
    var attempt = 0;
    var retries = Math.min(maxRetries == null ? RETRY_DELAYS_MS.length : maxRetries, RETRY_DELAYS_MS.length);
    function run() {
      return fetchOnce(url, opts, timeoutMs).then(function (res) {
        if (isRetryableStatus(res.status) && attempt < retries) {
          return sleep(RETRY_DELAYS_MS[attempt++]).then(run);
        }
        return res;
      }, function (err) {
        if (attempt < retries) {
          return sleep(RETRY_DELAYS_MS[attempt++]).then(run);
        }
        throw err;
      });
    }
    return run();
  }
  var PROGRESS_TIMEOUT_MS = 10000;
  var RETELL_UPLOAD_TIMEOUT_MS = 60000;
  var RETELL_DOWNLOAD_TIMEOUT_MS = 30000;

  async function fetchProgress() {
    var headers = authHeaders();
    if (!headers) return null;
    var res = await fetchWithRetry(API_BASE + '/progress', { method: 'GET', headers: headers }, PROGRESS_TIMEOUT_MS);
    if (!res.ok) throw new Error('progress_get_' + res.status);
    return res.json();
  }

  async function putProgress(body) {
    var headers = authHeaders();
    if (!headers) return null;
    var res = await fetchWithRetry(API_BASE + '/progress', {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(body || {}),
    }, PROGRESS_TIMEOUT_MS);
    if (!res.ok) throw new Error('progress_put_' + res.status);
    return res.json();
  }

  var UNIT_IDS = ['unit1', 'unit2', 'unit3', 'unit4', 'scienceReview'];

  function isUnit(id) {
    return UNIT_IDS.indexOf(id) >= 0;
  }

  // One write at a time so a map-part PUT cannot race a session PUT on this iPad.
  var writeChain = Promise.resolve();
  function enqueueWrite(run) {
    var next = writeChain.then(run, run);
    writeChain = next.then(function () {}, function () {});
    return next;
  }

  function warnProgress(label, err) {
    try {
      console.warn('[RFProgress]', label, err && err.message);
    } catch (e) {}
  }

  /**
   * Soft-fail mark: PUT { completed: { [flag]: true } }.
   * No-op when family key missing. Never throws to callers.
   * Kept for older callers. New lessons use markSessionDone.
   */
  function markComplete(flag) {
    if (!flag || !isUnit(flag)) return Promise.resolve(null);
    if (!getFamilyKey()) return Promise.resolve(null);
    var completed = {};
    completed[flag] = true;
    return enqueueWrite(function () {
      return putProgress({ completed: completed });
    }).catch(function (err) {
      warnProgress('markComplete failed ' + flag, err);
      return null;
    });
  }

  /**
   * OR-merge one unit's footprint. Missing fields are left unchanged on the server.
   * patch: { sessionADone, sessionBDone, retellDone, part, completed }
   * `part` is 1–4. `completed` sets the whole-lesson star (never clears it).
   */
  function markFootprint(unitId, patch) {
    if (!isUnit(unitId)) return Promise.resolve(null);
    if (!getFamilyKey()) return Promise.resolve(null);
    patch = patch || {};
    var one = {};
    if (patch.sessionADone) one.sessionADone = true;
    if (patch.sessionBDone) one.sessionBDone = true;
    if (patch.retellDone) one.retellDone = true;
    if (Array.isArray(patch.goodAnswers) && patch.goodAnswers.length) one.goodAnswers = patch.goodAnswers.map(String);
    if (Array.isArray(patch.firstTry) && patch.firstTry.length) one.firstTry = patch.firstTry.map(String);
    var part = +patch.part;
    if (part >= 1 && part <= 4) {
      var parts = [false, false, false, false];
      parts[part - 1] = true;
      one.mapParts = parts;
    }
    var body = { footprints: {} };
    body.footprints[unitId] = one;
    if (patch.completed) {
      body.completed = {};
      body.completed[unitId] = true;
    }
    return enqueueWrite(function () {
      return putProgress(body);
    }).catch(function (err) {
      warnProgress('markFootprint failed ' + unitId, err);
      return null;
    });
  }

  var partMemo = Object.create(null);

  /** Map tap or natural play through a part. Deduped per page load; retries if the PUT failed. */
  function notePart(unitId, part) {
    var p = +part;
    if (!isUnit(unitId) || p < 1 || p > 4) return Promise.resolve(null);
    var k = unitId + ':' + p;
    if (partMemo[k]) return Promise.resolve(null);
    if (!getFamilyKey()) {
      partMemo[k] = 'nokey';
      return Promise.resolve(null);
    }
    partMemo[k] = 'pending';
    return markFootprint(unitId, { part: p }).then(function (res) {
      if (res) partMemo[k] = 'ok';
      else delete partMemo[k];
      return res;
    });
  }

  /**
   * End of a listening path.
   * Units 1–4: record that session. The whole-lesson star turns on only when both
   * sessions are stored (Worker derives it). Weather review is a single path, so
   * finishing it still sets completed — same moment as the old markComplete.
   */
  function markSessionDone(unitId, sess) {
    var patch = sess === 'B' ? { sessionBDone: true } : { sessionADone: true };
    if (unitId === 'scienceReview') patch.completed = true;
    return markFootprint(unitId, patch);
  }

  /** Local tally so the star count shows even before/without sync. */
  function localIds(k) { try { var v = JSON.parse(localStorage.getItem(k) || '{}'); return v && typeof v === 'object' ? v : {}; } catch (e) { return {}; } }
  function addLocalId(k, unitId, sid) {
    try { var v = localIds(k); var arr = Array.isArray(v[unitId]) ? v[unitId] : []; if (arr.indexOf(sid) < 0) arr.push(sid); v[unitId] = arr.slice(-120); localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
  }
  /** Parent tapped 👍 "good answer" on an open question (screen id like "s15"). */
  function noteGoodAnswer(unitId, sid) {
    if (!isUnit(unitId) || !sid) return Promise.resolve(null);
    addLocalId('rfGoodAnswers', unitId, String(sid));
    return markFootprint(unitId, { goodAnswers: [String(sid)] });
  }
  /** Closed question answered right on the first tap. */
  function noteFirstTry(unitId, sid) {
    if (!isUnit(unitId) || !sid) return Promise.resolve(null);
    addLocalId('rfFirstTry', unitId, String(sid));
    return markFootprint(unitId, { firstTry: [String(sid)] });
  }
  function localGoodAnswers() { return localIds('rfGoodAnswers'); }

  /** Child advanced past a retell (reveal + continue). Boolean only. */
  function noteRetell(unitId) {
    return markFootprint(unitId, { retellDone: true });
  }

  function extFromType(contentType) {
    var b = String(contentType || '').split(';')[0].trim().toLowerCase();
    if (b.indexOf('webm') >= 0) return 'webm';
    if (b.indexOf('wav') >= 0) return 'wav';
    if (b.indexOf('mpeg') >= 0 || b === 'audio/mp3') return 'mp3';
    return 'm4a';
  }

  function retellFilename(unitId, contentType) {
    return 'miles-' + unitId + '-retell.' + extFromType(contentType);
  }

  /**
   * Upload a retell blob. Null when there is no family key.
   * Throws on HTTP errors so the recorder can offer Save again.
   */
  function uploadRetell(unitId, blob, durationMs) {
    if (!isUnit(unitId) || !blob) return Promise.resolve(null);
    var headers = authHeaders();
    if (!headers) return Promise.resolve(null);
    headers['Content-Type'] = blob.type || 'application/octet-stream';
    if (durationMs != null && isFinite(durationMs)) {
      headers['X-Duration-Ms'] = String(Math.max(0, Math.round(durationMs)));
    }
    return enqueueWrite(function () {
      return fetchWithRetry(API_BASE + '/retell/' + encodeURIComponent(unitId), {
        method: 'POST',
        headers: headers,
        body: blob,
      }, RETELL_UPLOAD_TIMEOUT_MS, 1).then(function (res) {
        if (!res.ok) throw new Error('retell_post_' + res.status);
        return res.json();
      });
    });
  }

  function fetchRetellBlob(unitId) {
    if (!isUnit(unitId)) return Promise.resolve(null);
    var headers = authHeaders();
    if (!headers) return Promise.resolve(null);
    return fetchWithRetry(API_BASE + '/retell/' + encodeURIComponent(unitId), {
      method: 'GET',
      headers: { Authorization: headers.Authorization },
    }, RETELL_DOWNLOAD_TIMEOUT_MS).then(function (res) {
      if (res.status === 404) return null;
      if (!res.ok) throw new Error('retell_get_' + res.status);
      var ct = res.headers.get('Content-Type') || 'audio/mp4';
      return res.blob().then(function (blob) {
        var base = ct.split(';')[0];
        if (base && (!blob.type || blob.type === 'application/octet-stream')) {
          blob = new Blob([blob], { type: base });
        }
        return { blob: blob, contentType: ct, filename: retellFilename(unitId, ct) };
      });
    });
  }

  function emptyFootprint() {
    return { sessionADone: false, sessionBDone: false, mapParts: [false, false, false, false], retellDone: false };
  }

  /** Fill missing fields so old KV records still render. Does not invent audio. */
  function presentProgress(data) {
    var src = data || {};
    var completed = {};
    var footprints = {};
    var retells = {};
    UNIT_IDS.forEach(function (id) {
      var raw = src.footprints && src.footprints[id];
      var parts = [false, false, false, false];
      var mp = raw && raw.mapParts;
      if (Array.isArray(mp)) {
        for (var i = 0; i < 4; i++) parts[i] = !!mp[i];
      }
      var fp = {
        sessionADone: !!(raw && raw.sessionADone),
        sessionBDone: !!(raw && raw.sessionBDone),
        retellDone: !!(raw && raw.retellDone),
        mapParts: parts,
        goodAnswers: Array.isArray(raw && raw.goodAnswers) ? raw.goodAnswers.slice() : [],
        firstTry: Array.isArray(raw && raw.firstTry) ? raw.firstTry.slice() : [],
      };
      var done = !!(src.completed && src.completed[id]);
      if (id === 'scienceReview') done = done || fp.sessionADone;
      else done = done || (fp.sessionADone && fp.sessionBDone);
      completed[id] = done;
      footprints[id] = fp;
      var r = src.retells && src.retells[id];
      retells[id] = r && (r.recordedAt || r.contentType || r.bytes) ? r : null;
    });
    return {
      learner: src.learner || DEFAULT_NAME,
      completed: completed,
      footprints: footprints,
      retells: retells,
      unitsOpen: src.unitsOpen || 0,
      totalUnits: src.totalUnits || 16,
    };
  }

  function lsGet(k, fallback) {
    try {
      var v = localStorage.getItem(k);
      return v == null || v === '' ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function lsSet(k, v) {
    try {
      localStorage.setItem(k, String(v));
    } catch (e) {}
  }

  function getTextSize() {
    var v = String(lsGet(K_TEXT, 'large')).toLowerCase();
    return TEXT_SIZES.indexOf(v) >= 0 ? v : 'large';
  }

  function setTextSize(size) {
    var v = String(size || '').toLowerCase();
    if (TEXT_SIZES.indexOf(v) < 0) v = 'large';
    lsSet(K_TEXT, v);
    return v;
  }

  function cycleTextSize() {
    var cur = getTextSize();
    var i = TEXT_SIZES.indexOf(cur);
    var next = TEXT_SIZES[(i + 1) % TEXT_SIZES.length];
    return setTextSize(next);
  }

  function getFontHarmony() {
    return lsGet(K_FONT, '1') !== '0';
  }

  function setFontHarmony(on) {
    lsSet(K_FONT, on ? '1' : '0');
    return !!on;
  }

  function toggleFontHarmony() {
    return setFontHarmony(!getFontHarmony());
  }

  function getLearnerName() {
    var n = String(lsGet(K_NAME, DEFAULT_NAME)).trim();
    return n || DEFAULT_NAME;
  }

  function setLearnerName(name) {
    var n = String(name || '').trim().slice(0, 24);
    if (!n) n = DEFAULT_NAME;
    lsSet(K_NAME, n);
    return n;
  }

  function getVoice() {
    var v = String(lsGet(K_VOICE, DEFAULT_VOICE) || DEFAULT_VOICE).trim();
    return VOICES.indexOf(v) >= 0 ? v : DEFAULT_VOICE;
  }

  function setVoice(v) {
    var voice = String(v || DEFAULT_VOICE).trim();
    if (VOICES.indexOf(voice) < 0) voice = DEFAULT_VOICE;
    lsSet(K_VOICE, voice);
    return voice;
  }

  function cycleVoice() {
    var cur = getVoice();
    var i = VOICES.indexOf(cur);
    var next = VOICES[(i + 1) % VOICES.length];
    return setVoice(next);
  }

  function voiceLabel(v) {
    var key = v || getVoice();
    return VOICE_LABELS[key] || key;
  }

  function possessive(name) {
    var n = String(name || DEFAULT_NAME);
    if (/s$/i.test(n)) return n + '’';
    return n + '’s';
  }

  function getPrefs() {
    return {
      textSize: getTextSize(),
      fontHarmony: getFontHarmony(),
      learnerName: getLearnerName(),
      voice: getVoice(),
    };
  }

  function applyPrefs() {
    var root = document.documentElement;
    if (!root) return getPrefs();
    var prefs = getPrefs();
    root.setAttribute('data-text-size', prefs.textSize);
    root.setAttribute('data-font', prefs.fontHarmony ? 'nunito' : 'system');
    root.setAttribute('data-voice', prefs.voice);

    var name = prefs.learnerName;
    var poss = possessive(name);

    document.querySelectorAll('[data-learner-name]').forEach(function (el) {
      var mode = el.getAttribute('data-learner-name') || 'plain';
      if (mode === 'possessive') el.textContent = poss;
      else if (mode === 'journey') el.textContent = poss + ' weather journey';
      else if (mode === 'welldone') el.textContent = 'Well done, ' + name;
      else el.textContent = name;
    });

    document.querySelectorAll('.stat.miles').forEach(function (el) {
      var icon = el.querySelector('.ms');
      var label = name;
      el.textContent = '';
      if (icon) el.appendChild(icon);
      else {
        var span = document.createElement('span');
        span.className = 'ms';
        span.textContent = 'face';
        el.appendChild(span);
      }
      el.appendChild(document.createTextNode(' ' + label));
    });

    return prefs;
  }

  function applyDataAttrsOnly() {
    try {
      var root = document.documentElement;
      if (!root) return;
      var prefs = getPrefs();
      root.setAttribute('data-text-size', prefs.textSize);
      root.setAttribute('data-font', prefs.fontHarmony ? 'nunito' : 'system');
      root.setAttribute('data-voice', prefs.voice);
    } catch (e) {}
  }

  function bootApply() {
    try {
      applyPrefs();
    } catch (e) {}
  }

  // Attrs before first paint when this script is in <head>
  applyDataAttrsOnly();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApply);
  } else {
    bootApply();
  }

  global.RFProgress = {
    API_BASE: API_BASE,
    STORAGE_KEY: STORAGE_KEY,
    getFamilyKey: getFamilyKey,
    setFamilyKey: setFamilyKey,
    consumeKeyFromQuery: consumeKeyFromQuery,
    fetchProgress: fetchProgress,
    putProgress: putProgress,
    markComplete: markComplete,
    markFootprint: markFootprint,
    markSessionDone: markSessionDone,
    notePart: notePart,
    noteRetell: noteRetell,
    noteGoodAnswer: noteGoodAnswer,
    noteFirstTry: noteFirstTry,
    localGoodAnswers: localGoodAnswers,
    uploadRetell: uploadRetell,
    fetchRetellBlob: fetchRetellBlob,
    retellFilename: retellFilename,
    presentProgress: presentProgress,
    emptyFootprint: emptyFootprint,
    UNIT_IDS: UNIT_IDS,
    getTextSize: getTextSize,
    setTextSize: setTextSize,
    cycleTextSize: cycleTextSize,
    getFontHarmony: getFontHarmony,
    setFontHarmony: setFontHarmony,
    toggleFontHarmony: toggleFontHarmony,
    getLearnerName: getLearnerName,
    setLearnerName: setLearnerName,
    getVoice: getVoice,
    setVoice: setVoice,
    cycleVoice: cycleVoice,
    voiceLabel: voiceLabel,
    VOICES: VOICES,
    VOICE_LABELS: VOICE_LABELS,
    possessive: possessive,
    getPrefs: getPrefs,
    applyPrefs: applyPrefs,
    TEXT_SIZES: TEXT_SIZES,
    DEFAULT_NAME: DEFAULT_NAME,
  };
})(typeof window !== 'undefined' ? window : globalThis);
