/**
 * Forced rest break for Miles.
 * After 20 min of visible app time → full-screen 10-min countdown. No close / skip / parent override.
 * Being away from the app for 10 min or more (same as a break) restarts the 20 min.
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
  var REAL = { learn: 'rfRest.learnSec', ends: 'rfRest.breakEndsAt', seen: 'rfRest.learnAt', len: BREAK_SEC };
  var KEYS = test ? { learn: 'rfRestTest.learnSec', ends: 'rfRestTest.breakEndsAt', seen: 'rfRestTest.learnAt' } : REAL;
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
    '#rfRestCue{position:fixed;left:50%;top:50%;z-index:2147483646;pointer-events:none;transform:translate(-50%,-50%) scale(.85);opacity:0;transition:opacity .35s ease,transform .35s ease;font-family:"Nunito","RFRestNunito",system-ui,-apple-system,sans-serif}',
    '#rfRestCue span{display:block;background:#fff;color:#3D7AB5;font-weight:800;font-size:clamp(26px,min(5vh,8vw),44px);padding:clamp(14px,2.4vh,24px) clamp(26px,4vw,48px);border-radius:28px;border:3px solid #CFE6D6;box-shadow:0 14px 40px rgba(31,42,68,.16);white-space:nowrap}',
    '#rfRestCue.on{opacity:1;transform:translate(-50%,-50%) scale(1)}',
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


  /* ---------- end-of-break chime (Web Audio synth, no files) ---------- */
  // A shared AudioContext is created/resumed on the first tap or key on any page (iPad Safari only lets
  // audio start inside a user gesture). It is ours alone, so the play() guard above never touches it.
  var actx = null, pendingChime = 0, chimeCount = 0, CHIME_KEY = 'rfRest.chimedFor';
  function getCtx() {
    if (actx) return actx;
    try { var AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); } catch (e) {}
    return actx;
  }
  function unlock() {
    var c = getCtx(); if (!c) return;
    try { if (c.state !== 'running' && c.resume) c.resume(); } catch (e) {}
    try { // a silent blip finishes the unlock on older iOS
      var b = c.createBuffer(1, 1, 22050), s = c.createBufferSource();
      s.buffer = b; s.connect(c.destination); s.start(0);
    } catch (e) {}
  }
  function synth(c) {
    // Gentle ascending bell arpeggio C5–E5–G5–C6 + soft sparkle; ~2.2 s, quiet master gain.
    var t0 = c.currentTime + 0.05;
    var master = c.createGain(); master.gain.value = 0.22;
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200;
    master.connect(lp); lp.connect(c.destination);
    var notes = [523.25, 659.25, 783.99, 1046.5];
    function bell(f, at, dur, vol) {
      [[1, 1], [2, 0.28], [3.01, 0.08]].forEach(function (pt) {
        var o = c.createOscillator(), g = c.createGain();
        o.type = 'sine'; o.frequency.value = f * pt[0];
        g.gain.setValueAtTime(0.0001, at);
        g.gain.exponentialRampToValueAtTime(vol * pt[1], at + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, at + dur / pt[0]);
        o.connect(g); g.connect(master);
        o.start(at); o.stop(at + dur + 0.05);
      });
    }
    for (var i = 0; i < notes.length; i++) bell(notes[i], t0 + i * 0.14, i === 3 ? 1.7 : 0.9, i === 3 ? 0.55 : 0.45);
    bell(1567.98, t0 + 0.62, 1.4, 0.16);
    bell(2093.0, t0 + 0.70, 1.2, 0.10);
  }
  function emit(state) {
    try { document.dispatchEvent(new CustomEvent('rfrestchime', { detail: { state: state, count: chimeCount } })); } catch (e) {}
  }
  function playChime() {
    var c = getCtx();
    if (!c) { pendingChime = 0; return; }
    function go() { if (!pendingChime) return; pendingChime = 0; chimeCount++; try { synth(c); } catch (e) {} emit('played'); }
    pendingChime = Date.now();
    if (c.state === 'running') { go(); return; }
    try {
      var r = c.resume && c.resume();
      if (r && r.then) r.then(function () { if (c.state === 'running') go(); }, function () {});
    } catch (e) {}
    // Blocked by autoplay (page reloaded during the break, no tap since): plays on the next tap instead.
    setTimeout(function () { if (pendingChime && c.state !== 'running') emit('pending'); }, 400);
  }
  function onGesture() {
    unlock();
    if (active && !musicOn && actx) { musicWanted = true; try { actx.resume().then(function () { if (actx.state === 'running' && musicWanted) beginMusic(actx); }, function () {}); } catch (e) {} if (actx.state === 'running') beginMusic(actx); }
    if (pendingChime && !active) {
      if (Date.now() - pendingChime > 5 * 60 * 1000) { pendingChime = 0; return; }
      var c = actx;
      if (c && c.state === 'running') { pendingChime = 0; chimeCount++; try { synth(c); } catch (e) {} emit('played-on-tap'); }
      else if (c && c.resume) { try { c.resume().then(function () { if (pendingChime && c.state === 'running') { pendingChime = 0; chimeCount++; synth(c); emit('played-on-tap'); } }, function () {}); } catch (e) {} }
    }
  }
  ['pointerdown', 'touchend', 'keydown', 'mousedown'].forEach(function (t) {
    window.addEventListener(t, onGesture, { capture: true, passive: true });
  });


  /* ---------- calm waiting music during the break (original, synthesized: no files, no licence) ---------- */
  // Slow music-box arpeggio over a soft pad, C-major pentatonic, 64 bpm, 4-bar loop (~15 s) scheduled
  // ahead with a look-ahead timer, so it loops seamlessly for the whole break. Low master volume.
  var MUSIC_VOL = 0.2, BPM = 64, musicOn = false, musicWanted = false, mGain = null, mTimer = 0, mNext = 0, mStep = 0, musicStarts = 0;
  var BEAT = 60 / BPM, EIGHTH = BEAT / 2;
  // bars: pad chord (Hz) + 8 eighth-note music-box notes (0 = rest)
  var C4 = 261.63, D4 = 293.66, E4 = 329.63, G4 = 392.0, A4 = 440.0, C5 = 523.25, D5 = 587.33, E5 = 659.25, G5 = 783.99, A3 = 220.0, G3 = 196.0;
  var BARS = [
    { pad: [130.81, 196.0, 329.63], mel: [C5, 0, G4, E4, G4, 0, E5, 0] },
    { pad: [110.0, 164.81, 261.63], mel: [A4, 0, E4, C4, E4, 0, C5, 0] },
    { pad: [146.83, 220.0, 293.66], mel: [D5, 0, A4, D4, G4, 0, A4, 0] },
    { pad: [98.0, 146.83, 293.66], mel: [G4, 0, D4, G4, E4, 0, D4, C4] }
  ];
  function mbox(c, f, at) {
    [[1, 1], [4.0, 0.12]].forEach(function (pt) {
      var o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = f * pt[0];
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(0.32 * pt[1], at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, at + (pt[0] > 1 ? 0.35 : 1.6));
      o.connect(g); g.connect(mGain); o.start(at); o.stop(at + 1.7);
    });
  }
  function pad(c, freqs, at, dur) {
    var lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.11, at + 1.2);
    g.gain.setValueAtTime(0.11, at + dur - 0.6);
    g.gain.linearRampToValueAtTime(0.0001, at + dur + 0.9); // overlaps next bar's attack: seamless
    lp.connect(g); g.connect(mGain);
    freqs.forEach(function (f) {
      [-4, 4].forEach(function (cents) {
        var o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.detune.value = cents;
        o.connect(lp); o.start(at); o.stop(at + dur + 1);
      });
    });
  }
  function schedule() {
    var c = actx; if (!c || !musicOn) return;
    while (mNext < c.currentTime + 1.2) {
      var bar = BARS[Math.floor(mStep / 8) % BARS.length], i = mStep % 8;
      if (i === 0) pad(c, bar.pad, mNext, BEAT * 4);
      if (bar.mel[i]) mbox(c, bar.mel[i], mNext);
      mNext += EIGHTH; mStep++;
    }
  }
  function beginMusic(c) {
    if (musicOn || !active || document.visibilityState === 'hidden') return;
    musicOn = true; musicWanted = false; musicStarts++;
    mGain = c.createGain();
    mGain.gain.setValueAtTime(0.0001, c.currentTime);
    mGain.gain.linearRampToValueAtTime(MUSIC_VOL, c.currentTime + 2);
    mGain.connect(c.destination);
    mNext = c.currentTime + 0.1; mStep = 0;
    schedule(); clearInterval(mTimer); mTimer = setInterval(schedule, 250);
    try { document.dispatchEvent(new CustomEvent('rfrestmusic', { detail: { on: true } })); } catch (e) {}
  }
  function startMusic() {
    if (musicOn || !active || document.visibilityState === 'hidden') return;
    var c = getCtx(); if (!c) return;
    musicWanted = true;
    if (c.state === 'running') { beginMusic(c); return; }
    try { var r = c.resume && c.resume(); if (r && r.then) r.then(function () { if (c.state === 'running' && musicWanted) beginMusic(c); }, function () {}); } catch (e) {}
    // still blocked (reloaded during the break, no tap yet) → onGesture starts it on the next tap
  }
  function stopMusic(fade) {
    musicWanted = false;
    if (!musicOn) return;
    musicOn = false;
    clearInterval(mTimer); mTimer = 0;
    var g = mGain, c = actx; mGain = null;
    try {
      var t = c.currentTime;
      g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(Math.max(g.gain.value, 0.0001), t);
      g.gain.linearRampToValueAtTime(0.0001, t + fade);
      setTimeout(function () { try { g.disconnect(); } catch (e) {} }, fade * 1000 + 1800);
    } catch (e) {}
    try { document.dispatchEvent(new CustomEvent('rfrestmusic', { detail: { on: false } })); } catch (e) {}
  }

  var cueTimer = 0;
  function showCue() {
    try {
      injectCss();
      var old = document.getElementById('rfRestCue'); if (old && old.parentNode) old.parentNode.removeChild(old);
      var q = document.createElement('div');
      q.id = 'rfRestCue'; q.setAttribute('role', 'status'); q.setAttribute('aria-live', 'polite');
      q.innerHTML = '<span>Let\u2019s learn again! \u2728</span>';
      host().appendChild(q);
      requestAnimationFrame(function () { requestAnimationFrame(function () { q.classList.add('on'); }); });
      clearTimeout(cueTimer);
      cueTimer = setTimeout(function () {
        q.classList.remove('on');
        setTimeout(function () { if (q.parentNode) q.parentNode.removeChild(q); }, 500);
      }, 2200);
    } catch (e) {}
  }
  /** Called when THIS page sees the countdown finish. Chime + cue once per break (shared across tabs). */
  function breakEnded(end, wasMusic) {
    if (document.visibilityState === 'hidden') return; // the visible tab/page does it
    var k = String(end || 0);
    if (end && lsGet(CHIME_KEY) === k) return;
    lsSet(CHIME_KEY, k);
    showCue();
    setTimeout(playChime, wasMusic ? 1000 : 0); // after the waiting music has faded out
  }

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
    startMusic();
    try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {}
    requestAnimationFrame(function () { requestAnimationFrame(function () { if (ov) ov.classList.add('on'); }); });
    try { document.dispatchEvent(new CustomEvent('rfrestbreak', { detail: { on: true, endsAt: end } })); } catch (e) {}
  }
  function hide() {
    if (!active) return;
    var endedAt = endsAt, wasMusic = musicOn;
    stopMusic(1.0);
    active = false;
    clearInert();
    document.documentElement.classList.remove('rf-resting');
    var o = ov;
    if (o) {
      try { numEl.textContent = '0:00'; ringEl.setAttribute('stroke-dashoffset', ringLen.toFixed(2)); } catch (e) {}
      o.classList.remove('on');
      hideTimer = setTimeout(function () { if (o.parentNode) o.parentNode.removeChild(o); }, 650);
    }
    ov = null;
    try { document.dispatchEvent(new CustomEvent('rfrestbreak', { detail: { on: false } })); } catch (e) {}
    if (endedAt && Date.now() >= endedAt - 1500) breakEnded(endedAt, wasMusic);
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
      // Time away from the app that is at least as long as a break counts as a rest:
      // start the 20 minutes again instead of carrying over minutes from an earlier session.
      var seen = +lsGet(KEYS.seen) || 0;
      var learned = (!seen || now - seen >= BREAK_SEC * 1000) ? d : (+lsGet(KEYS.learn) || 0) + d;
      lsSet(KEYS.seen, now);
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
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') stopMusic(0.3);
    last = Date.now(); tick();
    if (active && document.visibilityState === 'visible') startMusic();
  });
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
    testMode: test,
    chimeCount: function () { return chimeCount; },
    chimePending: function () { return !!pendingChime; },
    musicOn: function () { return musicOn; },
    musicStarts: function () { return musicStarts; }
  };
})();
