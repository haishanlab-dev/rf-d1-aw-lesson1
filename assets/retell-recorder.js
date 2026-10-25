/**
 * Retell recorder for lesson pages.
 * iPad Safari: MediaRecorder prefers audio/mp4 (AAC). That file plays on iPad.
 * Audio is uploaded with the family key. No key / offline → soft message, lesson still continues.
 */
(function (global) {
  'use strict';

  var MAX_MS = 60000;
  var rec = null;
  var chunks = [];
  var blob = null;
  var blobUrl = '';
  var stream = null;
  var unitId = '';
  var startedAt = 0;
  var durationMs = 0;
  var capTimer = 0;
  var tickTimer = 0;
  var generation = 0;
  var saving = false;
  var saved = false;
  var mime = '';

  var CSS = [
    /* No yellow frame — prompt + equal-width Record|Continue side by side */
    '.retell-box{margin-top:8px;background:transparent;border:0;border-radius:0;',
    'padding:0;display:flex;flex-direction:column;gap:10px;align-self:stretch;',
    'position:sticky;bottom:0;z-index:3;box-shadow:none;}',
    '.content:has(.retell-box) .imgbox{flex:0 1 32%;max-height:36%;}',
    '.panel:has(.retell-box){justify-content:flex-start;}',
    '.retell-box .rt-status{font-size:clamp(14px,1.8vw,18px);font-weight:700;color:#5a6a7a;line-height:1.3;text-align:center;}',
    '.retell-box .rt-actions{display:flex;flex-direction:row;align-items:stretch;gap:10px;width:100%;}',
    '.retell-box .rt-actions > .rt-rec,',
    '.retell-box .rt-actions > .rt-stop,',
    '.retell-box .rt-actions > .contbtn{flex:1 1 0;width:0;min-width:0;justify-content:center;align-self:stretch;}',
    '.retell-box .rt-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:center;}',
    '.retell-box button{font-family:inherit;font-weight:800;border-radius:999px;border:none;',
    'padding:10px 14px;min-height:48px;font-size:clamp(16px,2vw,22px);cursor:pointer;touch-action:manipulation;',
    'display:inline-flex;align-items:center;justify-content:center;gap:6px;}',
    '.retell-box button[disabled]{opacity:.55;cursor:default;}',
    '.retell-box .rt-rec,.retell-box .rt-stop{background:#E35D6A;color:#fff;}',
    '.retell-box .rt-actions > .contbtn{margin:0;width:auto;}',
    '.retell-box .rt-play{background:var(--blue,#3D7AB5);color:#fff;}',
    '.retell-box .rt-save{background:var(--green,#4F9A6B);color:#fff;}',
    '.retell-box .rt-again{background:#fff;color:var(--blue,#3D7AB5);border:2px solid var(--blue,#3D7AB5);}',
    '.retell-box audio{width:100%;height:32px;}',
  ].join('');

  function injectCss() {
    if (document.getElementById('rf-retell-css')) return;
    var s = document.createElement('style');
    s.id = 'rf-retell-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function pickMime() {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
    var types = ['audio/mp4', 'audio/mp4;codecs=mp4a.40.2', 'audio/aac', 'audio/webm;codecs=opus', 'audio/webm'];
    for (var i = 0; i < types.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(types[i])) return types[i];
      } catch (e) {}
    }
    return '';
  }

  function stopTracks() {
    if (!stream) return;
    try {
      stream.getTracks().forEach(function (t) { t.stop(); });
    } catch (e) {}
    stream = null;
  }

  function clearTimers() {
    if (capTimer) clearTimeout(capTimer);
    if (tickTimer) clearInterval(tickTimer);
    capTimer = 0;
    tickTimer = 0;
  }

  function revokeUrl() {
    if (blobUrl) {
      try { URL.revokeObjectURL(blobUrl); } catch (e) {}
      blobUrl = '';
    }
  }

  function boxEl() {
    return document.querySelector('.retell-box');
  }

  function setStatus(text) {
    var box = boxEl();
    if (!box) return;
    var el = box.querySelector('.rt-status');
    if (el) el.textContent = text;
  }

  function fmt(ms) {
    var s = Math.max(0, Math.round(ms / 1000));
    var m = Math.floor(s / 60);
    var r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  function syncUi() {
    var box = boxEl();
    if (!box) return;
    var recording = !!(rec && rec.state === 'recording');
    var hasBlob = !!blob;
    box.querySelector('.rt-rec').hidden = recording || hasBlob;
    box.querySelector('.rt-stop').hidden = !recording;
    box.querySelector('.rt-play').hidden = !hasBlob || recording;
    box.querySelector('.rt-again').hidden = !hasBlob || recording;
    box.querySelector('.rt-save').hidden = !hasBlob || recording;
    box.querySelector('.rt-save').disabled = saving || saved;
    box.querySelector('.rt-save').textContent = saved ? 'Saved' : (saving ? 'Saving…' : 'Save');
    var timer = box.querySelector('.rt-timer');
    timer.hidden = !recording;
    if (recording) timer.textContent = fmt(Date.now() - startedAt);
    var audio = box.querySelector('audio');
    if (hasBlob && !recording) {
      if (!blobUrl) blobUrl = URL.createObjectURL(blob);
      if (audio.src !== blobUrl) audio.src = blobUrl;
      audio.hidden = false;
    } else {
      audio.hidden = true;
    }
  }

  function finishBlob(gen, type) {
    if (gen !== generation) return;
    if (startedAt) durationMs = Date.now() - startedAt;
    clearTimers();
    stopTracks();
    rec = null;
    if (!chunks.length) {
      blob = null;
      setStatus('Nothing was recorded. Tap Record to try again.');
      syncUi();
      return;
    }
    var useType = type || mime || 'audio/mp4';
    blob = new Blob(chunks, { type: useType });
    chunks = [];
    saved = false;
    revokeUrl();
    setStatus('Tap Play to hear you. Save keeps it for your other iPad.');
    syncUi();
  }

  function stopRecording() {
    if (!rec || rec.state !== 'recording') return Promise.resolve(false);
    var gen = generation;
    var current = rec;
    return new Promise(function (resolve) {
      var settled = false;
      function done() {
        if (settled) return;
        settled = true;
        resolve(true);
      }
      var prev = current.onstop;
      current.onstop = function (ev) {
        if (prev) prev(ev);
        done();
      };
      try {
        if (current.requestData) current.requestData();
        current.stop();
      } catch (e) {
        done();
      }
      setTimeout(done, 1500);
    });
  }

  function discard() {
    generation++;
    clearTimers();
    var current = rec;
    rec = null;
    chunks = [];
    blob = null;
    saved = false;
    saving = false;
    durationMs = 0;
    if (current && current.state === 'recording') {
      try { current.onstop = null; current.stop(); } catch (e) {}
    }
    stopTracks();
    revokeUrl();
    var box = boxEl();
    if (box) box.remove();
  }

  async function startRecording() {
    if (rec && rec.state === 'recording') return;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      setStatus("This browser can't record. You can still continue.");
      return;
    }
    try {
      var au = document.getElementById('au');
      if (au && !au.paused) au.pause();
    } catch (e) {}
    var genWait = generation;
    // iPad Safari cannot show the microphone permission pop-up while an element is fullscreen,
    // so getUserMedia just hangs. Leave fullscreen first (tabs reappear; Play re-enters it).
    var fsEl = document.fullscreenElement || document.webkitFullscreenElement;
    var gumPromise = navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    if (fsEl) {
      try {
        var ex = document.exitFullscreen || document.webkitExitFullscreen;
        if (ex) { var px = ex.call(document); if (px && px.catch) px.catch(function () {}); }
      } catch (e) {}
    }
    setStatus('Getting the microphone ready… If iPad asks, tap Allow.');
    var slowTimer = setTimeout(function () {
      if (genWait === generation && !rec) setStatus('Still waiting for the microphone. Tap Allow if you see it, or check Settings › Safari › Microphone.');
    }, 6000);
    try {
      stream = await gumPromise;
    } catch (e) {
      clearTimeout(slowTimer);
      var name = e && e.name;
      setStatus(name === 'NotAllowedError'
        ? 'Microphone is not allowed. A grown-up can turn it on in Settings › Safari › Microphone. You can still continue.'
        : 'Microphone is off. You can still continue.');
      return;
    }
    clearTimeout(slowTimer);
    if (genWait !== generation) {
      stopTracks();
      return;
    }
    mime = pickMime();
    chunks = [];
    blob = null;
    saved = false;
    revokeUrl();
    var gen = generation;
    try {
      rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (e) {
      stopTracks();
      setStatus("This browser can't record. You can still continue.");
      return;
    }
    mime = rec.mimeType || mime || 'audio/mp4';
    rec.ondataavailable = function (ev) {
      if (gen !== generation) return;
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };
    rec.onstop = function () {
      var type = (rec && rec.mimeType) || mime;
      finishBlob(gen, type);
    };
    startedAt = Date.now();
    durationMs = 0;
    try {
      rec.start(250);
    } catch (e) {
      try { rec.start(); } catch (e2) {
        stopTracks();
        rec = null;
        setStatus("This browser can't record. You can still continue.");
        return;
      }
    }
    setStatus('Listening… tap Stop when you are done.');
    syncUi();
    tickTimer = setInterval(syncUi, 250);
    capTimer = setTimeout(function () {
      stopRecording();
    }, MAX_MS);
  }

  function playPreview() {
    var box = boxEl();
    if (!box || !blob) return;
    var audio = box.querySelector('audio');
    if (!blobUrl) blobUrl = URL.createObjectURL(blob);
    audio.src = blobUrl;
    audio.hidden = false;
    var p = audio.play();
    if (p && p.catch) p.catch(function () {});
  }

  function again() {
    var audio = boxEl() && boxEl().querySelector('audio');
    if (audio) {
      try { audio.pause(); } catch (e) {}
    }
    blob = null;
    chunks = [];
    saved = false;
    saving = false;
    revokeUrl();
    setStatus('Tap Record and tell it in your words.');
    syncUi();
  }

  async function save() {
    if (!blob || saving || saved) return;
    var RF = global.RFProgress;
    if (!RF || !RF.getFamilyKey || !RF.getFamilyKey()) {
      setStatus('A grown-up connects this iPad in Parent settings before speaking can be saved.');
      return;
    }
    if (!RF.uploadRetell) {
      setStatus("Couldn't save just now. Try Save again.");
      return;
    }
    saving = true;
    syncUi();
    setStatus('Saving…');
    try {
      var res = await RF.uploadRetell(unitId, blob, durationMs || (blob.size ? null : 0));
      if (!res) {
        saving = false;
        setStatus('A grown-up connects this iPad in Parent settings before speaking can be saved.');
        syncUi();
        return;
      }
      saving = false;
      saved = true;
      setStatus('Saved. Your other iPad can play this.');
      syncUi();
    } catch (e) {
      saving = false;
      syncUi();
      setStatus("Couldn't save just now. Try Save again.");
    }
  }

  function mount(panel, id) {
    if (!panel) return;
    injectCss();
    if (id) unitId = id;
    var cont = panel.querySelector('.contbtn');
    var existing = panel.querySelector('.retell-box');
    if (existing) {
      if (cont && existing.contains(cont)) panel.appendChild(cont);
      existing.remove();
    }
    var box = document.createElement('div');
    box.className = 'retell-box';
    box.innerHTML = [
      '<div class="rt-status">Tap Record and tell it in your words.</div>',
      '<div class="rt-actions">',
      '<button type="button" class="rt-rec"><span class="ms" style="font-size:20px">mic</span> Record</button>',
      '<button type="button" class="rt-stop" hidden><span class="ms" style="font-size:20px">stop</span> Stop</button>',
      '</div>',
      '<div class="rt-row">',
      '<span class="rt-timer" hidden>0:00</span>',
      '<button type="button" class="rt-play" hidden><span class="ms" style="font-size:20px">play_arrow</span> Play</button>',
      '<button type="button" class="rt-again" hidden>Again</button>',
      '<button type="button" class="rt-save" hidden>Save</button>',
      '</div>',
      '<audio playsinline preload="auto" hidden></audio>',
    ].join('');
    box.addEventListener('click', function (ev) { ev.stopPropagation(); });
    box.querySelector('.rt-rec').onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); startRecording(); };
    box.querySelector('.rt-stop').onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); stopRecording(); };
    box.querySelector('.rt-play').onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); playPreview(); };
    box.querySelector('.rt-again').onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); again(); };
    box.querySelector('.rt-save').onclick = function (ev) { ev.preventDefault(); ev.stopPropagation(); save(); };
    panel.appendChild(box);
    // Continue sits beside Record/Stop, equal width
    if (cont) box.querySelector('.rt-actions').appendChild(cont);
    try { box.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
    if (rec && rec.state === 'recording') setStatus('Listening… tap Stop when you are done.');
    else if (saved) setStatus('Saved. Your other iPad can play this.');
    else if (blob) setStatus('Tap Play to hear you. Save keeps it for your other iPad.');
    syncUi();
  }

  global.RFRetell = {
    mount: mount,
    discard: discard,
    stopIfRecording: stopRecording,
    pickMime: pickMime,
  };
})(typeof window !== 'undefined' ? window : globalThis);
