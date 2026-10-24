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

  async function fetchProgress() {
    var headers = authHeaders();
    if (!headers) return null;
    var res = await fetch(API_BASE + '/progress', { method: 'GET', headers: headers });
    if (!res.ok) throw new Error('progress_get_' + res.status);
    return res.json();
  }

  async function putProgress(body) {
    var headers = authHeaders();
    if (!headers) return null;
    var res = await fetch(API_BASE + '/progress', {
      method: 'PUT',
      headers: headers,
      body: JSON.stringify(body || {}),
    });
    if (!res.ok) throw new Error('progress_put_' + res.status);
    return res.json();
  }

  /**
   * Soft-fail mark: PUT { completed: { [flag]: true } }.
   * No-op when family key missing. Never throws to callers.
   */
  function markComplete(flag) {
    if (!flag) return Promise.resolve(null);
    if (!getFamilyKey()) return Promise.resolve(null);
    var completed = {};
    completed[flag] = true;
    return putProgress({ completed: completed }).catch(function (err) {
      try {
        console.warn('[RFProgress] markComplete failed', flag, err && err.message);
      } catch (e) {}
      return null;
    });
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
    root.setAttribute('data-font', prefs.fontHarmony ? 'harmony' : 'system');
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
      root.setAttribute('data-font', prefs.fontHarmony ? 'harmony' : 'system');
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
