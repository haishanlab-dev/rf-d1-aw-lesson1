/**
 * Reading Future · Miles progress (Cloudflare Worker)
 * Family key lives only in localStorage — never hardcode it here.
 */
(function (global) {
  'use strict';

  var API_BASE = 'https://rf-miles-progress.haishanlab.workers.dev';
  var STORAGE_KEY = 'rfMilesFamilyKey';

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

  global.RFProgress = {
    API_BASE: API_BASE,
    STORAGE_KEY: STORAGE_KEY,
    getFamilyKey: getFamilyKey,
    setFamilyKey: setFamilyKey,
    consumeKeyFromQuery: consumeKeyFromQuery,
    fetchProgress: fetchProgress,
    putProgress: putProgress,
    markComplete: markComplete,
  };
})(typeof window !== 'undefined' ? window : globalThis);
