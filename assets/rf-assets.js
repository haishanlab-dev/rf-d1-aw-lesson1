/* RFAssets — lesson media loader (as1).
   Lesson pages used to inline every photo and en-GB narration clip as base64 (4–9 MB
   per HTML). They now reference cached files; this helper keeps the old "everything
   is already here" feel:
     RFAssets.media(url)        → blob: URL if the clip/photo is already fetched, else url
                                  (and starts fetching it). Narration then starts from
                                  memory, like the old data: URIs.
     RFAssets.fetchMedia(url)   → Promise<blob URL> (keeps ≤ MAX blobs, least recently used dropped)
     RFAssets.image(url)        → Promise that resolves once the image is fetched+decoded
     RFAssets.ready(urls, ms)   → wait (max ms) until those images are decoded, so a new
                                  screen never paints with an empty image box.
     RFAssets.idle(fn)          → run fn when the main thread is idle.
   No behaviour of its own: every call is a best-effort cache; on any failure the
   caller falls back to the plain URL. */
(function () {
  'use strict';
  if (window.RFAssets) return;
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/rf-assets\.js.*$/, '') : 'assets/';
  })();
  var MAX = 150;   // ≈ a whole lesson of clips (~5 MB); the old inline base64 kept all of it in memory too
  var blobs = {};      // url -> blob URL
  var pending = {};    // url -> Promise<blob URL|null>
  var order = [];      // LRU of urls with blobs
  var imgs = {};       // url -> Promise (decoded)
  var keep = [];       // decoded Image objects (keeps them in memory cache)

  function abs(u) { try { return new URL(u, location.href).href; } catch (e) { return u; } }
  function isData(u) { return /^(data|blob):/i.test(u || ''); }

  function touch(k) { var i = order.indexOf(k); if (i >= 0) order.splice(i, 1); order.push(k); }
  function evict() {
    while (order.length > MAX) {
      var k = order.shift();
      var b = blobs[k]; delete blobs[k];
      /* never revoke the clip that is playing right now */
      var au = document.getElementById('au');
      if (b && !(au && au.src === b)) { try { URL.revokeObjectURL(b); } catch (e) {} }
    }
  }
  function fetchMedia(url) {
    if (!url || isData(url) || !window.fetch || !window.URL || !URL.createObjectURL) return Promise.resolve(null);
    var k = abs(url);
    if (blobs[k]) { touch(k); return Promise.resolve(blobs[k]); }
    if (pending[k]) return pending[k];
    var p = pending[k] = fetch(k, { credentials: 'same-origin' }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.blob();
    }).then(function (b) {
      delete pending[k];
      if (!b || !b.size) return null;
      var u = URL.createObjectURL(b);
      blobs[k] = u; touch(k); evict();
      return u;
    }).catch(function () { delete pending[k]; return null; });
    return p;
  }
  function media(url) {
    if (!url || isData(url)) return url;
    var k = abs(url);
    if (blobs[k]) { touch(k); return blobs[k]; }
    fetchMedia(url);
    return url;
  }
  /* Fetch + decode an image once; later <img src=url> paints from memory cache. */
  function image(url) {
    if (!url) return Promise.resolve();
    var k = abs(url);
    if (imgs[k]) return imgs[k];
    var im = new Image();
    im.decoding = 'async';
    var p = imgs[k] = new Promise(function (res) {
      var done = false;
      function ok() { if (done) return; done = true; keep.push(im); if (keep.length > 120) keep.shift(); res(true); }
      function bad() { if (done) return; done = true; delete imgs[k]; res(false); }
      im.onload = function () {
        if (im.decode) im.decode().then(ok, ok); else ok();
      };
      im.onerror = bad;
    });
    im.src = url;
    return p;
  }
  function ready(urls, ms) {
    urls = (urls || []).filter(Boolean);
    if (!urls.length) return Promise.resolve();
    var all = Promise.all(urls.map(image));
    return Promise.race([all, new Promise(function (r) { setTimeout(r, ms == null ? 1500 : ms); })]);
  }
  /* Sequential low-priority queue so prefetch never competes with what is on screen. */
  var q = [], running = 0, CONC = 2;
  function pump() {
    while (running < CONC && q.length) {
      var job = q.shift();
      running++;
      job().then(function () { running--; pump(); }, function () { running--; pump(); });
    }
  }
  function queue(kind, url, front) {
    if (!url || isData(url)) return;
    var k = abs(url);
    if (kind === 'img' && imgs[k]) return;
    if (kind === 'media' && (blobs[k] || pending[k])) return;
    var job = kind === 'img' ? function () { return image(url); } : function () { return fetchMedia(url); };
    if (front) q.unshift(job); else q.push(job);
    pump();
  }
  function idle(fn) {
    if (window.requestIdleCallback) requestIdleCallback(fn, { timeout: 2000 });
    else setTimeout(fn, 200);
  }
  /* Noto illustrations used by diagrams / rest break: warm them once so icons never pop in. */
  var NOTO = ['alarm_clock','astonished','carrot','check','child','cloud','cloud_rain','cloud_snow','cow','exclamation','farmer','fish','flexed_biceps','giraffe','herb','horse','hundred','inbox','leaf_wind','leafy_green','light_bulb','lotus','question','rabbit','snowflake','snowman','sparkles','speaking','storm','sun','sun_cloud','thermometer','thinking','tornado','up_arrow','warning','wind_face'];
  function warmNoto() { NOTO.forEach(function (n) { queue('img', BASE + 'illus/noto/' + n + '.svg'); }); }

  window.RFAssets = { media: media, fetchMedia: fetchMedia, image: image, ready: ready, queue: queue, idle: idle, warmNoto: warmNoto, base: BASE, _blobs: blobs };
})();
