/**
 * Forced rest break for Miles.
 * After 20 min of visible app time → full-screen 10-min countdown. No close / skip / parent override.
 * State lives in localStorage (survives refresh, navigation, closing the tab). Break end is a wall-clock
 * timestamp, so the 10 minutes keep running while the app is closed.
 * QA only: ?restTest=1 → 20 s learn / 15 s break, separate counters, sticky for this tab (?restTest=0 clears).
 */
(function () {
  'use strict';
  if (window.RFRestBreak) return;

  var LEARN_SEC = 20 * 60, BREAK_SEC = 10 * 60, PREFIX = 'rfRest.';
  var test = false;
  try {
    var qp = new URLSearchParams(location.search).get('restTest');
    if (qp === '1') sessionStorage.setItem('rfRestTest', '1');
    else if (qp === '0') sessionStorage.removeItem('rfRestTest');
    test = sessionStorage.getItem('rfRestTest') === '1';
  } catch (e) {}
  if (test) { LEARN_SEC = 20; BREAK_SEC = 15; }
  var REAL = { learn: 'rfRest.learnSec', ends: 'rfRest.breakEndsAt', len: BREAK_SEC };
  var KEYS = test ? { learn: 'rfRestTest.learnSec', ends: 'rfRestTest.breakEndsAt' } : REAL;
  REAL.len = 10 * 60;

  // Parent settings is still locked during a break, but parent time there does not count as learning.
  var COUNTS = !/\/progress\/parent(\/|$)/.test(location.pathname || '');

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }

  /** Returns active break end (ms) or 0. Clamps if the device clock moved backwards. */
  function activeEnd(keys, len) {
    var now = Date.now(), end = +lsGet(keys.ends) || 0;
    if (!end) return 0;
    if (end > now + len * 1000 + 2000) { end = now + len * 1000; lsSet(keys.ends, end); }
    if (now >= end) { lsDel(keys.ends); lsSet(keys.learn, 0); return 0; }
    return end;
  }
  function currentEnd() {
    var e = activeEnd(KEYS, BREAK_SEC);
    if (!e && test) e = activeEnd(REAL, REAL.len); // QA mode never hides a real break
    return e;
  }

  var active = false, endsAt = 0, ov = null, numEl = null, ringEl = null, ringLen = 0, totalMs = BREAK_SEC * 1000;
  var inerted = [], media = typeof Set === 'function' ? new Set() : null;

  /* ---------- assets ---------- */
  function assetBase() {
    var s = document.currentScript && document.currentScript.src;
    var m = s && s.match(/^(.*\/)assets\/rest-break\.js/);
    if (m) return m[1] + 'assets/';
    var p = location.pathname || '';
    if (p.indexOf('/progress/parent') >= 0) return '../../assets/';
    if (/\/(progress|unit\d+|book|science-review|voice)(\/|$)/.test(p)) return '../assets/';
    return 'assets/';
  }
  var BASE = assetBase();

  var css = [
    '@font-face{font-family:"RFRestNunito";src:url("' + BASE + 'fonts/Nunito-800.woff2") format("woff2");font-weight:800;font-display:swap}',
    '@font-face{font-family:"RFRestNunito";src:url("' + BASE + 'fonts/Nunito-700.woff2") format("woff2");font-weight:700;font-display:swap}',
    'html.rf-resting,html.rf-resting body{overflow:hidden!important;overscroll-behavior:none!important;touch-action:none!important}',
    '#rfRestBreak{position:fixed!important;inset:0!important;z-index:2147483647!important;display:flex;align-items:center;justify-content:center;',
    'background:rgba(251,246,233,.97);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);',
    'font-family:"Nunito","RFRestNunito",system-ui,-apple-system,"Segoe UI",sans-serif;color:#1F2A44;',
    'opacity:0;transition:opacity .6s ease;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;',
    'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left);box-sizing:border-box;margin:0;width:100vw;height:100vh;height:100dvh;cursor:default}',
    '#rfRestBreak.on{opacity:1}',
    '#rfRestBreak .rb-card{display:flex;flex-direction:column;align-items:center;text-align:center;gap:clamp(8px,2vh,20px);',
    'background:#fff;border:3px solid #E6DCC3;border-radius:32px;box-shadow:0 18px 50px rgba(31,42,68,.12);',
    'padding:clamp(20px,4vh,44px) clamp(24px,5vw,64px);max-width:min(92vw,640px);box-sizing:border-box}',
    '#rfRestBreak .rb-illu{width:clamp(64px,12vh,110px);height:clamp(64px,12vh,110px);display:block;animation:rbBreath 5s ease-in-out infinite}',
    '#rfRestBreak h1{margin:0;font-weight:800;font-size:clamp(26px,min(5vh,8vw),46px);line-height:1.15;color:#3D7AB5}',
    '#rfRestBreak .rb-ring{position:relative;width:clamp(150px,min(32vh,56vw),270px);height:clamp(150px,min(32vh,56vw),270px)}',
    '#rfRestBreak .rb-ring svg{width:100%;height:100%;transform:rotate(-90deg);display:block}',
    '#rfRestBreak .rb-num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
    'font-weight:800;font-size:clamp(40px,min(9vh,15vw),76px);font-variant-numeric:tabular-nums;letter-spacing:.02em;color:#1F2A44}',
    '#rfRestBreak p{margin:0;font-weight:700;font-size:clamp(20px,3.2vh,30px);line-height:1.3;color:#1F2A44}',
    '#rfRestBreak p.rb-sub{font-size:clamp(16px,2.4vh,22px);color:#4F9A6B;display:flex;align-items:center;justify-content:center;gap:8px}',
    '#rfRestBreak p.rb-sub img{width:1.4em;height:1.4em}',
    '@keyframes rbBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}',
    '@media (prefers-reduced-motion:reduce){#rfRestBreak .rb-illu{animation:none}}'
  ].join('');

  function injectCss() {
    if (document.getElementById('rfRestBreakStyle')) return;
    var st = document.createElement('style');
    st.id = 'rfRestBreakStyle'; st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }

  function build() {
    var R = 54, C = 2 * Math.PI * R; ringLen = C;
    var d = document.createElement('div');
    d.id = 'rfRestBreak';
    d.setAttribute('role', 'alertdialog');
    d.setAttribute('aria-modal', 'true');
    d.setAttribute('aria-labelledby', 'rfRestTitle');
    d.innerHTML =
      '<div class="rb-card">' +
        '<img class="rb-illu" src="' + BASE + 'illus/noto/lotus.svg" alt="" draggable="false">' +
        '<h1 id="rfRestTitle">Time for a rest, Miles!</h1>' +
        '<div class="rb-ring" aria-hidden="true"><svg viewBox="0 0 120 120">' +
          '<circle cx="60" cy="60" r="' + R + '" fill="none" stroke="#EFE7D2" stroke-width="10"/>' +
          '<circle class="rb-arc" cx="60" cy="60" r="' + R + '" fill="none" stroke="#4F9A6B" stroke-width="10" stroke-linecap="round" ' +
          'stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="0"/></svg>' +
          '<div class="rb-num" role="timer" aria-live="off">10:00</div></div>' +
        '<p>Look far away and stretch.</p>' +
        '<p class="rb-sub"><img src="' + BASE + 'illus/noto/herb.svg" alt="" draggable="false">We can learn again when the clock gets to 0.</p>' +
      '</div>';
    numEl = d.querySelector('.rb-num');
    ringEl = d.querySelector('.rb-arc');
    return d;
  }

  function host() {
    var fs = document.fullscreenElement || document.webkitFullscreenElement;
    if (fs && fs.tagName !== 'VIDEO' && fs.tagName !== 'IMG') return fs;
    return document.body || document.documentElement;
  }
  function place() {
    if (!ov) return;
    var h = host();
    if (ov.parentNode !== h) h.appendChild(ov);
    applyInert();
  }
  function clearInert() {
    for (var i = 0; i < inerted.length; i++) {
      var r = inerted[i];
      try { if (!r.inert) r.el.inert = false; if (!r.aria) r.el.removeAttribute('aria-hidden'); } catch (e) {}
    }
    inerted = [];
  }
  function applyInert() {
    clearInert();
    if (!ov || !document.body) return;
    var node = ov;
    while (node && node.parentNode && node !== document.documentElement) {
      var p = node.parentNode, kids = p.children || [];
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (k === node || /^(SCRIPT|STYLE|LINK|HEAD)$/.test(k.tagName)) continue;
        inerted.push({ el: k, inert: !!k.inert, aria: k.hasAttribute('aria-hidden') });
        try { k.inert = true; k.setAttribute('aria-hidden', 'true'); } catch (e) {}
      }
      node = p;
    }
  }

  function fmt(ms) {
    var s = Math.max(0, Math.ceil(ms / 1000)), m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }
  function paint() {
    if (!ov) return;
    var left = Math.max(0, endsAt - Date.now());
    var t = fmt(left);
    if (numEl.textContent !== t) numEl.textContent = t;
    var frac = Math.min(1, left / totalMs);
    ringEl.setAttribute('stroke-dashoffset', (ringLen * (1 - frac)).toFixed(2));
    ov.setAttribute('data-left', String(Math.ceil(left / 1000)));
  }

  /* ---------- stop everything that makes sound ---------- */
  function hush() {
    try {
      var pb = document.getElementById('pausebtn');
      if (pb && document.body && document.body.classList.contains('playing') &&
          !pb.classList.contains('is-paused') && typeof pb.onclick === 'function') {
        pb.onclick.call(pb, { preventDefault: function () {}, stopPropagation: function () {} });
      }
    } catch (e) {}
    try { if (window.RFRetell && RFRetell.stopIfRecording) RFRetell.stopIfRecording(); } catch (e) {}
    try { if (window.RFReading && RFReading.stop) RFReading.stop(); } catch (e) {}
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    try {
      var els = document.querySelectorAll('audio,video');
      for (var i = 0; i < els.length; i++) { try { els[i].pause(); } catch (e) {} }
      if (media) media.forEach(function (m) { try { m.pause(); } catch (e) {} });
    } catch (e) {}
  }
  // Any play() during the break is refused (covers new Audio() objects not in the DOM).
  try {
    var MP = window.HTMLMediaElement && HTMLMediaElement.prototype, origPlay = MP && MP.play;
    if (origPlay) {
      MP.play = function () {
        if (media) { media.add(this); }
        if (active) {
          try { this.pause(); } catch (e) {}
          return Promise.reject(new Error('rest-break'));
        }
        return origPlay.apply(this, arguments);
      };
    }
  } catch (e) {}

  /* ---------- input lock ---------- */
  function block(e) {
    if (!active) return;
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  }
  ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick',
   'touchstart', 'touchmove', 'touchend', 'touchcancel', 'keydown', 'keyup', 'keypress', 'wheel', 'contextmenu',
   'gesturestart', 'gesturechange', 'dragstart', 'selectstart', 'submit', 'input', 'beforeinput', 'focusin']
    .forEach(function (t) {
      window.addEventListener(t, block, { capture: true, passive: false });
      document.addEventListener(t, block, { capture: true, passive: false });
    });

  /* ---------- show / hide ---------- */
  var hideTimer = 0;
  function show(end) {
    endsAt = end;
    totalMs = (end - Date.now() > BREAK_SEC * 1000 + 1500) ? 10 * 60 * 1000 : BREAK_SEC * 1000;
    if (active) { paint(); place(); return; }
    active = true;
    clearTimeout(hideTimer);
    injectCss();
    document.documentElement.classList.add('rf-resting');
    if (!ov) ov = build();
    place();
    paint();
    hush();
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (ov) ov.classList.add('on'); }); });
    try { document.dispatchEvent(new CustomEvent('rfrestbreak', { detail: { on: true, endsAt: end } })); } catch (e) {}
  }
  function hide() {
    if (!active) return;
    active = false;
    clearInert();
    document.documentElement.classList.remove('rf-resting');
    var o = ov;
    if (o) {
      o.classList.remove('on');
      hideTimer = setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 650);
    }
    ov = null;
    try { document.dispatchEvent(new CustomEvent('rfrestbreak', { detail: { on: false } })); } catch (e) {}
  }

  /* ---------- clock ---------- */
  var last = Date.now();
  function tick() {
    var now = Date.now();
    var end = currentEnd();
    if (end) { show(end); last = now; return; }
    if (active) hide();
    if (COUNTS && document.visibilityState === 'visible') {
      var d = Math.min(Math.max(now - last, 0), 3000) / 1000;
      var learned = (+lsGet(KEYS.learn) || 0) + d;
      if (learned >= LEARN_SEC) {
        var e2 = now + BREAK_SEC * 1000;
        lsSet(KEYS.ends, e2); lsSet(KEYS.learn, 0);
        show(e2);
      } else {
        lsSet(KEYS.learn, Math.round(learned * 10) / 10);
      }
    }
    last = now;
  }

  function onFs() { if (active) place(); }
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);
  document.addEventListener('visibilitychange', function () { last = Date.now(); tick(); });
  window.addEventListener('pageshow', function () { last = Date.now(); tick(); });
  window.addEventListener('storage', function (e) { if (!e.key || e.key.indexOf('rfRest') === 0) tick(); });

  function boot() { injectCss(); tick(); if (active) place(); }
  var first = currentEnd();
  if (first) { injectCss(); show(first); } // before body exists: overlay sits on <html> until DOM is ready
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setInterval(function () { tick(); if (active) paint(); }, 1000);
  setInterval(function () { if (active) paint(); }, 250);

  window.RFRestBreak = {
    active: function () { return active; },
    learnedSec: function () { return +lsGet(KEYS.learn) || 0; },
    endsAt: function () { return endsAt; },
    testMode: test
  };
})();
