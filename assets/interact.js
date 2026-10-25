/* Reading Future · tap-choice, drag-to-sort and parent 👍 for lesson pause screens.
   Hooks used by the lesson page:
     RFInteract.mount(view, sc, state, unit)  – after every render()
     RFInteract.begin(id)                     – question narration finished; enable taps
     RFInteract.holding()                     – wait()/countdown freeze while true
     RFInteract.resolved()                    – countdown may stop early
     RFInteract.settle(id, isLive)            – before reveal: explain if he tried but did not finish
   Untouched screens behave exactly as before. */
(function () {
  'use strict';
  var D = window.RF_IX || { units: {} };
  var BASE = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/interact\.js.*$/, '') : 'assets/';
  })();
  function fnv(t) { var h = 0x811c9dc5; for (var i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }
  function voice() { try { return (window.RFProgress && RFProgress.getVoice && RFProgress.getVoice()) === 'en-US' ? 'en-US' : 'en-GB'; } catch (e) { return 'en-GB'; } }
  function clipUrl(t) { return BASE + 'voice/' + voice() + '/fb/' + fnv(t) + '.mp3'; }
  /* perf: play feedback from memory when it was prefetched on mount (no gap after a tap) */
  function playUrl(t) { var u = clipUrl(t); try { return window.RFAssets ? RFAssets.media(u) : u; } catch (e) { return u; } }
  var warmedLeads = {};
  function warmClips(cfg) {
    if (!window.RFAssets || !cfg) return;
    var texts = [];
    (cfg.rows || [cfg]).forEach(function (r) {
      ['why', 'hint', 'explain', 'ask'].forEach(function (k) { if (r[k]) texts.push(r[k]); });
      if (cfg.kind === 'rows' && !r.ask && r.options) texts.push((r.label ? r.label.replace(/___/g, 'blank') + ' ' : '') + 'Tap ' + r.options.join(', or ') + '.'); /* = askRow() line */
    });
    (cfg.cards || []).forEach(function (c) { if (c.why) texts.push(c.why); if (c.hint) texts.push(c.hint); });
    var v = voice(), first = [];
    if (!warmedLeads[v]) {
      warmedLeads[v] = 1;
      first = (D.praise || []).slice(); /* said first after a right tap */
      ['hintLead', 'explainLead', 'parentPraise', 'sortDone'].forEach(function (k) { (D[k] || []).forEach(function (t) { texts.push(t); }); });
    }
    texts.forEach(function (t) { RFAssets.queue('media', clipUrl(t)); });
    first.reverse().forEach(function (t) { RFAssets.queue('media', clipUrl(t), true); });
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }
  var rot = { praise: 0, hintLead: 0, explainLead: 0, parentPraise: 0, sortDone: 0 };
  function next(k) { var a = D[k] || ['']; var v = a[rot[k] % a.length]; rot[k]++; return v; }
  function rate() { try { return typeof RATE !== 'undefined' && RATE > 1 ? 4 : 1; } catch (e) { return 1; } }

  /* ---------- speech ---------- */
  var fx = null, speaking = 0, ducked = null, tok = 0, finCur = null;
  function player() { if (!fx) { fx = new Audio(); fx.preload = 'auto'; fx.setAttribute('playsinline', ''); } return fx; }
  function sayOne(text, my) {
    return new Promise(function (res) {
      if (!text || my !== tok) return res();
      var a = player(), done = false, t;
      function fin() { if (done) return; done = true; clearTimeout(t); if (finCur === fin) finCur = null; a.onended = a.onerror = null; res(); }
      finCur = fin;
      var est = Math.max(900, text.length * 70) / rate() + 600;
      t = setTimeout(fin, est + 2500);
      a.onended = fin; a.onerror = function () { clearTimeout(t); t = setTimeout(fin, est); };
      try { a.src = playUrl(text); a.playbackRate = rate(); var p = a.play(); if (p && p.catch) p.catch(function () { clearTimeout(t); t = setTimeout(fin, est); }); } catch (e) { clearTimeout(t); t = setTimeout(fin, est); }
    });
  }
  /** Stop whatever feedback is talking (a new tap always wins). */
  function hush() { tok++; try { if (fx) fx.pause(); } catch (e) {} if (finCur) finCur(); }
  /** Say lines in order and show them in the bubble. Pauses lesson narration if it is playing. */
  function say(lines, bubble, tone) {
    hush();
    var my = tok;
    var state = cur; /* ignore if cancel()/remount raced past this say */
    lines = lines.filter(Boolean);
    if (bubble) { bubble.textContent = lines.join(' '); bubble.className = 'ix-say show' + (tone ? ' ' + tone : ''); }
    speaking++;
    var au = document.getElementById('au');
    if (au && !au.paused && !ducked) { ducked = au; try { au.pause(); } catch (e) {} }
    var p = Promise.resolve();
    lines.forEach(function (l) { p = p.then(function () { if (cur !== state || my !== tok) return; return sayOne(l, my); }); });
    return p.then(function () {
      if (cur !== state) { speaking = Math.max(0, speaking - 1); return; }
      speaking--;
      if (!speaking && ducked) { var d = ducked; ducked = null; try { if (!isPaused()) d.play().catch(function () {}); } catch (e) {} }
    });
  }
  function isPaused() { try { return typeof paused !== 'undefined' && paused; } catch (e) { return false; } }

  /* ---------- state per render ---------- */
  var BIN_ILL = { rain: 'cloud_rain', winter: 'snowman', high: 'sun_cloud', low: 'cloud', storm: 'storm', rs: ['cloud_rain', 'snowflake'], snow: 'snowflake', cloudy: 'cloud', sunny: 'sun' };
  function binIll(id, cls) {
    var v = BIN_ILL[id]; if (!v || !window.RFIllus) return '';
    if (typeof v === 'string') return RFIllus.html(v, cls, 0);
    return '<span class="ix-ill2">' + v.map(function (n, j) { return RFIllus.html(n, cls + (j ? ' ill-2b' : ' ill-2a'), j); }).join('') + '</span>';
  }
  var dragAbort = null;
  var cur = null; // { sc, unit, cfg, state, live, engagedAt, done, tries, ... }
  function now() { return Date.now(); }
  function touch() { if (cur) cur.lastTouch = now(); }
  function holding() {
    if (!cur) return false;
    if (speaking > 0 || cur.dragging) return true;
    if (cur.engaged && !cur.done && now() - cur.lastTouch < (cur.cfg && cur.cfg.kind === 'sort' ? 12000 : 8000)) return true;
    return false;
  }
  function resolved() { return !!(cur && cur.done && !speaking); }

  /* ---------- choice / rows ---------- */
  function choiceRowHtml(r, ri) {
    var h = '<div class="ix-row" data-row="' + ri + '">' + (r.label != null ? '<div class="ix-lab">' + (r.label ? esc(r.label) : (ri + 1) + '.') + '</div>' : '') + '<div class="ix-opts">';
    r.options.forEach(function (o, k) { h += '<button type="button" class="ix-opt ix-c' + (k % 3) + '" data-k="' + k + '">' + esc(o) + '</button>'; });
    return h + '</div></div>';
  }
  function equalizeOptWidth(box) {
    var opts = box.querySelectorAll('.ix-opt');
    if (!opts.length) return;
    // Batch write → batch read → batch restore (avoid write/read thrash per option).
    var i, max = 0;
    for (i = 0; i < opts.length; i++) {
      opts[i].style.width = 'auto';
      opts[i].style.minWidth = '0';
    }
    for (i = 0; i < opts.length; i++) max = Math.max(max, opts[i].offsetWidth);
    // room for longest word on this screen (e.g. necks / smell / dangerous)
    var w = Math.max(max, 96) + 4;
    box.style.setProperty('--ix-btn-w', w + 'px');
    for (i = 0; i < opts.length; i++) { opts[i].style.width = ''; opts[i].style.minWidth = ''; }
  }
  function setActiveRow(box, rows, idx) {
    cur.rowIdx = idx;
    var els = box.querySelectorAll('.ix-row');
    for (var i = 0; i < els.length; i++) {
      els[i].classList.toggle('is-active', i === idx);
      els[i].classList.toggle('is-locked', i > idx && !cur.rows[i].done);
      els[i].classList.toggle('is-ahead', i > idx && !cur.rows[i].done);
    }
  }
  function askRow(rows, idx, bubble) {
    var state = cur;
    var r = rows[idx];
    var line = r.ask || ((r.label ? r.label.replace(/___/g, 'blank') + ' ' : '') + 'Tap ' + r.options.join(', or ') + '.');
    return say([line], bubble, 'ask').then(function () { if (cur !== state) return; touch(); });
  }
  function afterRowDone(rows, bubble) {
    var state = cur;
    var all = cur.rows.every(function (x) { return x.done; });
    if (all && rows.length > 1 && cur.rows.every(function (x) { return x.tries === 0; })) note('firstTry');
    if (all) { finish(); touch(); return; }
    var nextIdx = cur.rows.findIndex(function (x) { return !x.done; });
    if (nextIdx < 0) { finish(); touch(); return; }
    cur.box.classList.add('ix-wait'); // lock while next prompt speaks
    setActiveRow(cur.box, rows, nextIdx);
    askRow(rows, nextIdx, bubble).then(function () {
      if (cur !== state) return;
      cur.box.classList.remove('ix-wait');
      touch();
    });
  }
  function mountChoice(panel, cfg) {
    var rows = cfg.kind === 'rows' ? cfg.rows : [{ label: null, options: cfg.options, answer: cfg.answer, ask: cfg.ask, why: cfg.why, hint: cfg.hint, explain: cfg.explain }];
    var box = document.createElement('div');
    var stepped = cfg.kind === 'rows' && rows.length > 1;
    box.className = 'ix-choices ix-wait' + (cfg.kind === 'rows' ? ' is-rows' : '') + (stepped ? ' is-step' : '');
    box.innerHTML = rows.map(choiceRowHtml).join('') + '<div class="ix-say" aria-live="polite"></div>';
    var cd = panel.querySelector('.cd'), q = panel.querySelector('.q');
    if (q && cd) { var qr = document.createElement('div'); qr.className = 'ix-qrow'; panel.insertBefore(qr, q); qr.appendChild(q); qr.appendChild(cd); }
    panel.appendChild(box);
    if (cfg.kind === 'rows') panel.classList.add('ix-has-rows');
    cur.rows = rows.map(function () { return { tries: 0, done: false }; });
    cur.box = box;
    cur.stepped = stepped;
    cur.rowIdx = 0;
    equalizeOptWidth(box);
    if (stepped) setActiveRow(box, rows, 0);
    var bubble = box.querySelector('.ix-say');
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.ix-opt'); if (!b || box.classList.contains('ix-wait')) return;
      var rowEl = b.closest('.ix-row'), ri = +rowEl.getAttribute('data-row'), r = rows[ri], st = cur.rows[ri];
      if (st.done) return;
      if (stepped && ri !== cur.rowIdx) return; // only current line
      cur.engaged = true; touch();
      var k = +b.getAttribute('data-k');
      if (k === r.answer) {
        st.done = true; b.classList.add('ix-ok'); rowEl.classList.add('is-done');
        if (st.tries === 0 && rows.length === 1) note('firstTry');
        if (stepped) box.classList.add('ix-wait');
        var stateOk = cur;
        say([next('praise'), r.why], bubble, 'ok').then(function () {
          if (cur !== stateOk) return;
          if (stepped) afterRowDone(rows, bubble);
          else { if (cur.rows.every(function (x) { return x.done; })) finish(); touch(); }
        });
      } else {
        st.tries++;
        b.classList.remove('ix-shake'); void b.offsetWidth; b.classList.add('ix-shake', 'ix-no');
        if (st.tries >= 2) {
          st.done = true; showAnswer(rowEl, r);
          if (stepped) box.classList.add('ix-wait');
          var stateEx = cur;
          say([next('explainLead'), r.explain], bubble, 'explain').then(function () {
            if (cur !== stateEx) return;
            if (stepped) afterRowDone(rows, bubble);
            else { if (cur.rows.every(function (x) { return x.done; })) finish(); touch(); }
          });
        } else { var stateHint = cur; say([next('hintLead'), r.hint], bubble, 'hint').then(function () { if (cur !== stateHint) return; touch(); }); }
      }
    });
  }
  function showAnswer(rowEl, r) {
    rowEl.classList.add('is-done');
    var bs = rowEl.querySelectorAll('.ix-opt');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('ix-answer', i === r.answer);
  }
  function finish() { if (cur && !cur.done) { cur.done = true; if (cur.box) cur.box.classList.add('is-finished'); } }

  /* ---------- sort (pointer events; tap-select fallback) ---------- */
  function cardHtml(c, k) {
    var m = /^([a-z])\.\s*(.*)$/.exec(c.t), lt = m ? m[1] + '.' : '', tx = m ? m[2] : c.t;
    return '<div class="ix-slot"><div class="ix-card ix-k' + (k % 4) + (c.ill ? ' has-ill' : '') + '" data-k="' + k + '" role="button" tabindex="0" aria-label="' + esc(c.t) + '">' +
      (lt ? '<small class="ix-lt">' + esc(lt) + '</small>' : '') + '<span class="ix-tx">' + esc(tx) + '</span>' +
      (c.ill && window.RFIllus ? RFIllus.html(c.ill, 'ill-card', k) : '') + '</div></div>';
  }
  function sortBoardHtml(cfg, interactive, hint) {
    // Mockup standard: one hint line, a row of solid sentence cards (dashed slots stay behind),
    // and the lower half split into illustrated target scenes with a white-pill name.
    var V = cfg.visual;
    var h = '<div class="ix-sort' + (interactive ? ' is-live ix-wait' : ' is-intro') + ' n' + cfg.bins.length + ' c' + cfg.cards.length + (V ? ' has-vis' : '') + '">';
    if (hint) h += '<div class="ix-hint">' + esc(hint) + '</div>';
    h += '<div class="ix-main">';
    if (V) {
      // the picture the answer depends on stays on screen, as large as possible
      h += '<div class="ix-vis">' + (V.key ? '<img class="ix-key" src="' + BASE + V.key + '" alt="Weather key">' : '') +
        '<div class="ix-map"><img src="' + BASE + V.map + '" alt="Map">';
      cfg.cards.forEach(function (c, k) { if (c.spot) h += '<span class="ix-spot" data-k="' + k + '" style="left:' + c.spot[0] + '%;top:' + c.spot[1] + '%"></span>'; });
      h += '</div></div>';
    }
    h += '<div class="ix-play"><div class="ix-tray">';
    cfg.cards.forEach(function (c, k) { h += cardHtml(c, k); });
    h += '</div><div class="ix-bins">';
    cfg.bins.forEach(function (b) { var n = cfg.cards.filter(function (c) { return c.bin === b.id; }).length || 1; h += '<div class="ix-bin t-' + b.tone + '" data-bin="' + b.id + '" style="--n:' + n + '"><div class="ix-bin-in"></div><div class="ix-bin-art">' + binIll(b.id, 'ill-ixbin') + '</div><div class="ix-bin-t">' + esc(b.label) + '</div></div>'; });
    return h + '</div></div></div><div class="ix-say" aria-live="polite"></div></div>';
  }
  function mountSort(box, cfg) {
    box.classList.add('has-ix');
    box.innerHTML = sortBoardHtml(cfg, true, cfg.prompt);
    var board = box.querySelector('.ix-sort');
    cur.box = board; cur.cards = cfg.cards.map(function () { return { tries: 0, placed: false }; });
    var bubble = board.querySelector('.ix-say'), sel = null;
    function binAt(x, y) {
      var bins = board.querySelectorAll('.ix-bin');
      for (var i = 0; i < bins.length; i++) { var r = bins[i].getBoundingClientRect(); if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return bins[i]; }
      return null;
    }
    function place(cardEl, binEl, k) {
      var st = cur.cards[k]; st.placed = true;
      cardEl.classList.remove('ix-sel'); cardEl.classList.add('is-placed');
      binEl.querySelector('.ix-bin-in').appendChild(cardEl);
      binEl.classList.remove('ix-glow'); void binEl.offsetWidth; binEl.classList.add('ix-glow');
      var sp = board.querySelector('.ix-spot[data-k="' + k + '"]');
      if (sp) { sp.classList.remove('ix-ping'); sp.classList.add('on'); sp.innerHTML = binIll(cfg.cards[k].bin, 'ill-spot'); }
    }
    function ping(k) { var sp = board.querySelector('.ix-spot[data-k="' + k + '"]'); if (sp && !sp.classList.contains('on')) { sp.classList.remove('ix-ping'); void sp.offsetWidth; sp.classList.add('ix-ping'); } }
    function attempt(cardEl, binEl) {
      var k = +cardEl.getAttribute('data-k'), c = cfg.cards[k], st = cur.cards[k];
      if (st.placed) return;
      cur.engaged = true; touch();
      if (binEl.getAttribute('data-bin') === c.bin) {
        place(cardEl, binEl, k);
        var all = cur.cards.every(function (x) { return x.placed; });
        var lines = [next('praise'), c.why];
        if (all) lines.push(next('sortDone'));
        say(lines, bubble, 'ok').then(function () { if (all) { board.classList.add('is-done'); if (cur.cards.every(function (x) { return x.tries === 0; })) note('firstTry'); finish(); } touch(); });
      } else {
        st.tries++;
        cardEl.classList.remove('ix-sel', 'ix-shake'); void cardEl.offsetWidth; cardEl.classList.add('ix-shake');
        if (st.tries >= 2) {
          var right = board.querySelector('.ix-bin[data-bin="' + c.bin + '"]');
          place(cardEl, right, k);
          var all2 = cur.cards.every(function (x) { return x.placed; });
          say([next('explainLead'), c.why], bubble, 'explain').then(function () { if (all2) { board.classList.add('is-done'); finish(); } touch(); });
        } else { ping(k); var stateHint = cur; say([next('hintLead'), c.hint], bubble, 'hint').then(function () { if (cur !== stateHint) return; touch(); }); }
      }
    }
    cur.autoPlaceRest = function () {
      var lines = [];
      board.querySelectorAll('.ix-tray .ix-card').forEach(function (el) {
        var k = +el.getAttribute('data-k'); var right = board.querySelector('.ix-bin[data-bin="' + cfg.cards[k].bin + '"]');
        place(el, right, k); lines.push(cfg.cards[k].why);
      });
      board.classList.add('is-done');
      return lines;
    };
    // pointer drag
    var drag = null;
    /* F7: lets cancel() drop an in-flight drag (ghost + pointer capture) when the lesson skips screens */
    dragAbort = function () {
      var d = drag; drag = null; if (!d) return;
      try { if (d.el.hasPointerCapture && d.el.hasPointerCapture(d.id)) d.el.releasePointerCapture(d.id); } catch (_e) {}
      if (d.ghost) { try { d.ghost.remove(); } catch (_e) {} }
      d.el.classList.remove('is-lifted');
      board.querySelectorAll('.ix-bin').forEach(function (b) { b.classList.remove('ix-over'); });
    };
    board.addEventListener('pointerdown', function (e) {
      var el = e.target.closest && e.target.closest('.ix-card');
      if (!el || el.classList.contains('is-placed') || board.classList.contains('ix-wait')) return;
      e.preventDefault();
      var r = el.getBoundingClientRect();
      drag = { el: el, id: e.pointerId, x0: e.clientX, y0: e.clientY, dx: e.clientX - r.left, dy: e.clientY - r.top, moved: false, ghost: null, w: r.width, h: r.height };
      try { el.setPointerCapture(e.pointerId); } catch (_e) {}
      cur.dragging = true; touch();
    });
    board.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var mx = e.clientX - drag.x0, my = e.clientY - drag.y0;
      if (!drag.moved && Math.abs(mx) + Math.abs(my) > 8) {
        drag.moved = true;
        var g = drag.el.cloneNode(true); g.classList.add('ix-ghost'); g.style.width = drag.w + 'px'; g.style.height = drag.h + 'px'; var cs = getComputedStyle(drag.el); ['fontSize','fontFamily','fontWeight','lineHeight','paddingTop','paddingRight','paddingBottom','paddingLeft'].forEach(function (k) { g.style[k] = cs[k]; }); g.style.boxSizing = 'border-box';
        document.body.appendChild(g); drag.ghost = g; drag.el.classList.add('is-lifted');
      }
      if (drag.ghost) {
        drag.ghost.style.transform = 'translate(' + (e.clientX - drag.dx) + 'px,' + (e.clientY - drag.dy) + 'px) rotate(-5deg)';
        var over = binAt(e.clientX, e.clientY);
        board.querySelectorAll('.ix-bin').forEach(function (b) { b.classList.toggle('ix-over', b === over); });
      }
      touch();
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null; if (cur) cur.dragging = false;
      if (!board.isConnected) { if (d.ghost) d.ghost.remove(); return; }
      board.querySelectorAll('.ix-bin').forEach(function (b) { b.classList.remove('ix-over'); });
      if (d.ghost) {
        var bin = e && e.type === 'pointerup' ? binAt(e.clientX, e.clientY) : null;
        d.ghost.remove(); d.el.classList.remove('is-lifted');
        if (bin) attempt(d.el, bin);
      } else if (e && e.type === 'pointerup') {
        // tap: select / deselect
        if (sel && sel !== d.el) sel.classList.remove('ix-sel');
        sel = d.el.classList.toggle('ix-sel') ? d.el : null;
        if (sel) board.classList.add('has-sel'); else board.classList.remove('has-sel');
      }
      touch();
    }
    board.addEventListener('pointerup', end);
    board.addEventListener('pointercancel', end);
    board.addEventListener('click', function (e) {
      var bin = e.target.closest && e.target.closest('.ix-bin');
      if (bin && sel && !sel.classList.contains('is-placed')) { var s = sel; sel = null; board.classList.remove('has-sel'); attempt(s, bin); }
    });
  }

  /* ---------- parent 👍 ---------- */
  var gaDone = Object.create(null);
  function mountParent(screen) {
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ix-parent'; b.setAttribute('aria-label', 'Parent: good answer');
    var key = cur.unit + ':' + cur.sc.i;
    b.innerHTML = gaDone[key] ? '⭐ Saved' : '👍 Good answer';
    if (gaDone[key]) b.classList.add('is-saved');
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      if (b.classList.contains('is-saved')) return;
      gaDone[key] = true; b.classList.add('is-saved'); b.innerHTML = '⭐ Saved';
      stars(screen);
      try { if (window.RFProgress && RFProgress.noteGoodAnswer) RFProgress.noteGoodAnswer(cur.unit, 's' + cur.sc.i); } catch (_e) {}
      say([next('parentPraise')], null);
    });
    screen.appendChild(b);
  }
  function stars(screen) {
    var w = document.createElement('div'); w.className = 'ix-stars'; w.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 7; i++) { var s = document.createElement('span'); s.textContent = '★'; s.style.setProperty('--i', i); w.appendChild(s); }
    screen.appendChild(w); setTimeout(function () { w.remove(); }, 2600);
  }

  function note(kind) {
    if (!cur || cur.noted) return; cur.noted = true;
    try { if (kind === 'firstTry' && window.RFProgress && RFProgress.noteFirstTry) RFProgress.noteFirstTry(cur.unit, 's' + cur.sc.i); } catch (e) {}
  }

  /* ---------- public ---------- */
  function cfgFor(unit, sc) { var u = (D.units || {})[unit] || {}; return u[sc.i] || null; }
  function mount(view, sc, state, unit) {
    try {
      var prev = cur;
      cur = { sc: sc, unit: unit, state: state, cfg: cfgFor(unit, sc), lastTouch: 0 };
      if (prev && prev.sc === sc && state === 'reveal') { cur.wasEngaged = prev.engaged; }
      var screen = view.querySelector('.screen'), panel = view.querySelector('#panel'), box = view.querySelector('.imgbox');
      if (!screen) return;
      var cfg = cur.cfg;
      if (cfg && state !== 'reveal') { try { warmClips(cfg); } catch (e) {} }
      if (cfg && cfg.kind === 'sortIntro' && box) {
        var ref = cfgFor(unit, { i: cfg.ref });
        if (ref) {
          box.classList.add('has-ix'); box.innerHTML = sortBoardHtml(ref, false, cfg.hint || 'Drag each card to the right box.');
          // the cards already show the sentences: one short hint instead of repeating them
          screen.classList.add('stack', 'is-sort', 'scene');
          if (panel) panel.innerHTML = '';
        }
        return;
      }
      if (sc.type === 'pause' && cfg && state === 'ask') {
        if (cfg.kind === 'sort' && box) {
          mountSort(box, cfg); screen.classList.add('stack', 'is-sort', 'scene');
          // the hint line sits on the board; spoken feedback goes in the bottom panel
          var qq = panel && panel.querySelector('.q');
          if (qq) qq.remove();
          var sayEl = box.querySelector('.ix-say');
          if (panel && sayEl) panel.insertBefore(sayEl, panel.firstChild);
        }
        else if ((cfg.kind === 'choice' || cfg.kind === 'rows') && panel) mountChoice(panel, cfg);
        screen.classList.add('ix-on');
        return;
      }
      if ((sc.type === 'pause' && !cfg) || sc.type === 'retell') mountParent(screen);
    } catch (e) { /* never break the lesson */ }
  }
  function begin() {
    if (!cur || !cur.box) return;
    var state = cur;
    var root = cur.box.closest('.ix-sort') || cur.box;
    // Multi-blank choice: speak the current line first, then unlock only that row.
    if (cur.stepped && cur.cfg && cur.cfg.kind === 'rows') {
      var rows = cur.cfg.rows;
      var bubble = cur.box.querySelector('.ix-say');
      setActiveRow(cur.box, rows, cur.rowIdx || 0);
      askRow(rows, cur.rowIdx || 0, bubble).then(function () {
        if (cur !== state) return;
        cur.box.classList.remove('ix-wait');
        root.classList.remove('ix-wait');
        touch();
      });
      return;
    }
    cur.box.classList.remove('ix-wait');
    root.classList.remove('ix-wait');
  }
  function settle(id, live) {
    if (!cur || !cur.cfg || !cur.engaged || cur.done) return Promise.resolve();
    var bubble = cur.box && cur.box.querySelector('.ix-say');
    var lines = [next('explainLead')];
    if (cur.cfg.kind === 'sort') { lines = lines.concat(cur.autoPlaceRest ? cur.autoPlaceRest().slice(0, 2) : []); }
    else {
      var rows = cur.cfg.kind === 'rows' ? cur.cfg.rows : [cur.cfg];
      cur.box.querySelectorAll('.ix-row').forEach(function (rowEl, ri) {
        if (!cur.rows[ri].done) { cur.rows[ri].done = true; showAnswer(rowEl, rows[ri]); lines.push(rows[ri].explain); }
      });
    }
    finish();
    return say(lines, bubble, 'explain').then(function () { return new Promise(function (r) { setTimeout(r, 400 / rate()); }); });
  }

  var CSS = [
    '.ix-choices{display:flex;flex-direction:column;gap:clamp(8px,1.4vh,14px);align-self:stretch;flex-shrink:0;}',
    '.ix-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;}',
    '.ix-lab{font-weight:800;font-size:clamp(16px,min(2vw,3.4vh),24px);color:#3C4656;flex:1 1 100%;}',
    '.ix-choices.is-rows .ix-row{flex-wrap:nowrap;}',
    '.ix-choices.is-rows .ix-lab{flex:1 1 40%;min-width:0;font-size:clamp(14px,min(1.7vw,3vh),20px);}',
    '.ix-choices.is-rows .ix-opts{flex:0 0 auto;flex-wrap:nowrap;gap:clamp(8px,1.2vw,14px);}',
    '.ix-choices.is-rows .ix-opt{flex:0 0 var(--ix-btn-w,7.5em);width:var(--ix-btn-w,7.5em);min-width:var(--ix-btn-w,7.5em);box-sizing:border-box;}',
    /* one blank at a time: dim locked lines; highlight the active row */
    '.ix-choices.is-step .ix-row.is-ahead,.ix-choices.is-step .ix-row.is-locked{opacity:.38;pointer-events:none;}',
    '.ix-choices.is-step .ix-row.is-active{opacity:1;position:relative;}',
    '.ix-choices.is-step .ix-row.is-active .ix-lab{color:#1F2A44;}',
    '.ix-choices.is-step .ix-row.is-done{opacity:.9;}',
    '.ix-choices.is-step .ix-row.is-active .ix-opts{filter:none;}',
    '.ix-say.ask{color:#2F5F8C;}',
    '.ix-qrow{display:flex;align-items:center;gap:clamp(8px,1.2vw,16px);flex-shrink:0;}',
    '.ix-qrow .q{flex:1 1 auto;min-width:0;}',
    '.ix-qrow .cd{flex:0 0 auto;}',
    '#view .content > .panel.ix-has-rows{max-width:58%;min-width:50%;}',
    '.ix-opts{display:flex;flex-wrap:wrap;gap:clamp(8px,1.2vw,14px);flex:1 1 auto;}',
    '.ix-opt{min-height:64px;min-width:120px;flex:1 1 0;padding:8px 16px;border-radius:18px;font-family:inherit;font-weight:800;',
    ' font-size:clamp(20px,min(2.4vw,4.2vh),30px);color:#1F2A44;background:#fff;border:3px solid var(--oc,#3D7AB5);border-bottom-width:7px;',
    ' cursor:pointer;touch-action:manipulation;transition:background .25s ease,border-color .25s ease,opacity .3s ease,transform .15s ease;}',
    '.ix-c0{--oc:#3D7AB5;} .ix-c1{--oc:#C9A63A;} .ix-c2{--oc:#7A6BB0;}',
    '.ix-opt:active{transform:translateY(2px);border-bottom-width:4px;}',
    '.ix-wait .ix-opt,.ix-sort.ix-wait .ix-card{opacity:.55;pointer-events:none;}',
    '.ix-opt.ix-ok,.ix-opt.ix-answer{background:#4F9A6B;border-color:#3E7A54;color:#fff;}',
    '.ix-row.is-done .ix-opt:not(.ix-ok):not(.ix-answer){opacity:.4;}',
    '.ix-opt.ix-no{border-color:#D4C6AE;color:#8A93A3;}',
    '@keyframes ixShake{0%,100%{transform:none}20%{transform:translateX(-7px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(2px)}}',
    '.ix-shake{animation:ixShake .5s ease-in-out;}',
    '.ix-say{min-height:0;font-weight:800;font-size:clamp(16px,min(2vw,3.4vh),24px);line-height:1.25;color:#2F5F8C;opacity:0;transition:opacity .3s ease;}',
    '.ix-say.show{opacity:1;}',
    '.ix-say.ok{color:#3E7A54;} .ix-say.hint{color:#9A6B12;} .ix-say.explain{color:#2F5F8C;}',
    '.panel.ix-has-rows .q .line:not(:first-child){display:none;}',
    /* when choices are on screen, the countdown circle sits small beside them */
    '.screen.ix-on .panel .cd{width:clamp(48px,8vh,72px);height:clamp(48px,8vh,72px);font-size:clamp(26px,5vh,42px);border-width:4px;margin:0 auto;}',
    '.ix-sort{--g:min(2cqw,2.6cqh);--cw:min(23cqw,300px);--ca:.615;--chh:min(calc(var(--cw) * var(--ca)),30cqh);width:100%;height:100%;display:flex;flex-direction:column;gap:min(2.2cqh,18px);text-align:left;}',
    '.ix-sort.c3{--cw:min(27cqw,320px);--ca:.5;}',
    '.ix-card:not(.has-ill){justify-content:center;align-items:center;text-align:center;}',
    '.ix-map > img,.ix-vis .ix-key{mix-blend-mode:multiply;}',
    '.ix-hint{flex:0 0 auto;font-weight:700;font-size:clamp(16px,min(1.9vw,3.2vh),24px);line-height:1.25;color:#5B6675;padding:0 1cqw;}',
    '.ix-main{flex:1 1 auto;min-height:0;display:flex;gap:2.4cqw;align-items:stretch;}',
    '.ix-play{flex:1 1 auto;min-width:0;min-height:0;display:flex;flex-direction:column;gap:min(3.4cqh,30px);}',
    '.ix-tray{flex:0 0 auto;display:flex;justify-content:center;gap:var(--g);}',
    '.ix-slot{position:relative;flex:0 0 auto;width:var(--cw);height:var(--chh);border-radius:clamp(14px,calc(var(--chh) * .16),26px);border:3px dashed rgba(43,52,64,.19);}',
    '.ix-card{position:absolute;inset:-3px;border-radius:inherit;padding:.62em .72em;display:flex;flex-direction:column;justify-content:flex-start;align-items:flex-start;text-align:left;font-weight:900;font-size:clamp(15px,min(calc(var(--cw) * .1),calc(var(--chh) * .19)),30px);line-height:1.18;color:#fff;background:var(--kc);box-shadow:0 6px 0 rgba(0,0,0,.13);text-shadow:0 1px 0 rgba(0,0,0,.1);touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none;transition:transform .25s ease,box-shadow .25s ease,opacity .2s ease;overflow:hidden;}',
    '.ix-card .ix-lt{display:block;font-size:.64em;opacity:.88;margin-bottom:.2em;}',
    '.ix-card .ix-tx{display:block;max-width:100%;}',
    '.ix-card.has-ill .ix-tx{padding-right:1.5em;}',
    '.ix-card .ill-card{--s:2.1em;position:absolute;right:.45em;bottom:.35em;}',
    '.ix-k0{--kc:#E35D6A;} .ix-k1{--kc:#3D7AB5;} .ix-k2{--kc:#4F9A6B;} .ix-k3{--kc:#D9A23A;}',
    '.ix-card.ix-sel{transform:translateY(-6px) rotate(-2deg);box-shadow:0 0 0 4px #FFF4C2,0 0 0 8px #E8C04A,0 12px 22px rgba(43,52,64,.2);z-index:2;}',
    '.ix-card.is-lifted{opacity:.12!important;}',
    '.ix-card.ix-ghost{position:fixed;inset:auto;left:0;top:0;z-index:90;pointer-events:none;box-shadow:0 18px 30px rgba(43,52,64,.25);transition:none;margin:0;max-width:none!important;}',
    '.ix-wait .ix-opt,.ix-sort.ix-wait .ix-card{opacity:.8;pointer-events:none;}',
    '.ix-sort.is-intro .ix-card{cursor:default;}',
    '.ix-bins{flex:1 1 auto;min-height:0;display:grid;grid-template-columns:repeat(2,1fr);gap:0 1.4cqw;}',
    '.ix-sort.n3 .ix-bins{grid-template-columns:repeat(3,1fr);}',
    '.ix-sort.n4 .ix-bins{grid-template-columns:repeat(2,1fr);gap:1.6cqh 1.4cqw;}',
    '.ix-bin{position:relative;min-width:0;min-height:0;border-radius:clamp(16px,2.4cqw,30px);background:linear-gradient(var(--bb0),var(--bb));display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:min(1.4cqh,12px);padding:min(2cqh,16px) 1cqw min(2.4cqh,20px);transition:box-shadow .3s ease,transform .3s ease;}',
    '.ix-bin.t-blue{--bc:#3D7AB5;--bb0:rgba(61,122,181,.03);--bb:rgba(61,122,181,.2);} .ix-bin.t-gold{--bc:#B0861A;--bb0:rgba(232,192,74,.04);--bb:rgba(232,192,74,.28);} .ix-bin.t-green{--bc:#3E8A5B;--bb0:rgba(79,154,107,.03);--bb:rgba(79,154,107,.22);} .ix-bin.t-gray{--bc:#5B6675;--bb0:rgba(91,102,117,.04);--bb:rgba(91,102,117,.24);}',
    '.ix-bin-in{flex:1 1 auto;min-height:0;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:min(1.4cqh,12px);}',
    '.ix-bin-in:empty::before{content:"";display:block;width:min(86%,300px);height:clamp(36px,9cqh,70px);border-radius:18px;border:3px dashed var(--bc);opacity:.35;}',
    '.ix-bin-art{flex:0 0 auto;display:flex;justify-content:center;}',
    '.ill-ixbin{--s:clamp(52px,min(24cqh,14cqw),180px);}',
    '.ix-sort.n3 .ill-ixbin{--s:clamp(52px,min(22cqh,11cqw),160px);}',
    '.ix-bin-t{flex:0 0 auto;max-width:100%;font-weight:900;font-size:clamp(16px,min(2.7cqw,5.4cqh),34px);line-height:1.15;text-align:center;color:var(--bc);background:#fff;border-radius:999px;padding:.24em .85em;box-shadow:0 2px 0 rgba(43,52,64,.06);}',
    '.ix-bin-in .ix-card{position:relative;inset:auto;display:inline-flex;flex-direction:row;align-items:center;gap:.3em;max-width:100%;font-size:clamp(14px,min(1.8cqw,3.6cqh),22px);line-height:1.2;padding:.5em .9em;border-radius:.9em;box-shadow:0 0 0 4px #fff,0 0 0 7px #4F9A6B;cursor:default;overflow:visible;flex:0 0 auto;}',
    '.ix-bin-in .ix-card .ix-lt{display:inline;font-size:1em;opacity:1;margin:0;}',
    '.ix-bin-in .ix-card .ix-tx{padding:0;}',
    '.ix-bin-in .ix-card .ill-card{display:none;}',
    '.ix-bin-in .ix-card::after{content:"\\2713";font-weight:900;margin-left:.15em;}',
    '.ix-bin.ix-over{box-shadow:inset 0 0 0 4px var(--bc);transform:scale(1.015);}',
    '.ix-sort.has-sel .ix-bin{box-shadow:inset 0 0 0 3px var(--bc);}',
    '@keyframes ixGlow{0%{box-shadow:0 0 0 0 rgba(232,192,74,0)}40%{box-shadow:0 0 0 10px rgba(232,192,74,.55)}100%{box-shadow:0 0 0 0 rgba(232,192,74,0)}}',
    '.ix-bin.ix-glow{animation:ixGlow 1.1s ease-out;}',
    '@keyframes ixParty{0%{transform:none}50%{transform:translateY(-6px) scale(1.04)}100%{transform:none}}',
    '.ix-sort.is-done .ix-bin-art{animation:ixParty 1.2s ease-in-out 2;}',
    '.ix-sort .ix-say{text-align:center;}',
    '.ix-sort.has-vis{--cw:min(14cqw,220px);--ca:.5;}',
    '.ix-sort.has-vis .ix-main{flex-direction:row;align-items:center;}',
    '.ix-vis{flex:0 0 auto;height:100%;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.4cqh;}',
    '#view .content > .imgbox img.ix-key,#view .imgbox .ix-key{display:block;height:14cqh;width:auto;max-width:100%;border-radius:10px;object-fit:contain;}',
    '.ix-map{position:relative;flex:0 0 auto;height:min(72cqh,calc(44cqw * 438 / 418));aspect-ratio:418/438;width:auto;}',
    '#view .content > .imgbox .ix-map > img,#view .imgbox .ix-map > img{display:block;width:100%;height:100%;object-fit:contain;border-radius:14px;}',
    '.ix-spot{position:absolute;width:clamp(40px,10cqh,84px);height:clamp(40px,10cqh,84px);transform:translate(-50%,-50%);border-radius:50%;display:grid;place-items:center;pointer-events:none;}',
    '.ix-spot.on{background:rgba(255,255,255,.94);box-shadow:0 0 0 4px #E8C04A;animation:ixPop .6s ease-out both;}',
    '.ix-spot .ill-spot{--s:80%;}',
    '.ix-spot .ix-ill2 .ill{--s:clamp(22px,5cqh,44px);}',
    '.ix-spot.ix-ping{animation:ixPing 1.4s ease-out 2;}',
    '@keyframes ixPing{0%{box-shadow:0 0 0 0 rgba(232,192,74,.95)}100%{box-shadow:0 0 0 clamp(18px,5cqh,40px) rgba(232,192,74,0)}}',
    '@keyframes ixPop{0%{transform:translate(-50%,-50%) scale(.3);opacity:0}70%{transform:translate(-50%,-50%) scale(1.12);opacity:1}100%{transform:translate(-50%,-50%)}}',
    '.ix-sort.has-vis .ix-play{height:100%;justify-content:center;}',
    '.ix-sort.has-vis .ix-tray{flex-wrap:wrap;}',
    '.ix-sort.has-vis .ix-card{justify-content:center;align-items:center;text-align:center;font-size:clamp(15px,min(calc(var(--cw) * .14),calc(var(--chh) * .3)),30px);}',
    '.ix-sort.has-vis .ix-bins{flex:1 1 auto;}',
    '.ix-sort.has-vis .ill-ixbin{--s:clamp(40px,min(13cqh,7cqw),96px);}',
    '.ix-sort.has-vis .ix-bin-t{font-size:clamp(14px,min(1.9cqw,4.2cqh),26px);}',
    '.ix-sort.has-vis .ix-bin-in:empty::before{height:clamp(30px,7cqh,52px);}',
    '@container (max-height:430px){.ill-ixbin,.ix-sort.n3 .ill-ixbin{--s:clamp(44px,min(17cqh,12cqw),120px);}.ix-bin-in:empty::before{height:clamp(28px,7cqh,44px);}}',
    '@container (max-aspect-ratio:1/1){.ix-sort{--cw:30cqw;}.ix-sort.c4 .ix-tray{display:grid;grid-template-columns:repeat(2,auto);justify-content:center;}.ix-sort.c4{--cw:44cqw;--chh:min(calc(44cqw * .6),15cqh);}.ix-sort.c3{--cw:30cqw;--chh:min(calc(30cqw * .72),20cqh);}.ill-ixbin,.ix-sort.n3 .ill-ixbin{--s:clamp(48px,min(16cqh,22cqw),150px);}.ix-sort.n3 .ill-ixbin{--s:clamp(44px,min(14cqh,20cqw),120px);}.ix-sort.n3 .ix-bin-t{font-size:clamp(14px,4cqw,26px);padding:.2em .5em;}}',
    '@container (max-aspect-ratio:5/4){.ix-sort.has-vis .ix-main{flex-direction:column;align-items:stretch;}.ix-sort.has-vis .ix-vis{height:auto;flex:1 1 0;min-height:0;width:100%;}.ix-sort.has-vis .ix-map{height:auto;flex:1 1 0;min-height:0;max-width:100%;}.ix-sort.has-vis .ix-play{height:auto;flex:0 0 auto;}.ix-sort.has-vis{--cw:22cqw;--chh:min(11cqw,8cqh);}.ix-sort.has-vis .ix-tray{display:flex;flex-wrap:nowrap;}.ix-sort.has-vis .ix-bins{flex:0 0 auto;}.ix-sort.has-vis .ill-ixbin{--s:clamp(36px,min(8cqh,12cqw),64px);}.ix-sort.has-vis .ix-bin{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"art t" "art in";align-items:center;gap:4px 10px;padding:8px 12px;}.ix-sort.has-vis .ix-bin-art{grid-area:art;}.ix-sort.has-vis .ix-bin-t{grid-area:t;justify-self:start;}.ix-sort.has-vis .ix-bin-in{grid-area:in;min-height:38px;align-items:flex-start;justify-content:center;}.ix-sort.has-vis .ix-bin-in:empty::before{height:32px;width:100%;}.ix-sort.has-vis .ix-card{padding:.3em;font-size:clamp(13px,min(4cqw,3.4cqh),24px);}.ix-sort.has-vis #x{} .ix-sort.has-vis .ix-key{height:10cqh;}}',
    '@media (prefers-reduced-motion:reduce){.ix-spot.on,.ix-spot.ix-ping{animation:none}.ix-shake,.ix-bin.ix-glow,.ix-sort.is-done .ix-bin-art{animation:none}.ix-stars span{animation-duration:.01s}.ix-card{transition:none}}',
    /* parent assist: small, quiet, bottom-left (pause FAB is bottom-right) */
    '.ix-parent{position:absolute;left:clamp(10px,1.6vw,20px);bottom:clamp(8px,1.4vh,16px);z-index:6;font-family:inherit;font-weight:700;font-size:13px;',
    ' color:#5A6578;background:rgba(255,253,248,.85);border:1.5px solid #E2D6C2;border-radius:999px;padding:6px 12px;min-height:34px;opacity:.7;cursor:pointer;touch-action:manipulation;}',
    '.ix-parent:active{opacity:1;} .ix-parent.is-saved{opacity:.6;color:#9A6B12;cursor:default;}',
    '.ix-stars{position:absolute;left:clamp(16px,2vw,28px);bottom:clamp(30px,5vh,50px);z-index:7;pointer-events:none;width:1px;height:1px;}',
    '.ix-stars span{position:absolute;left:0;top:0;color:#E8C04A;font-size:22px;opacity:0;animation:ixStar 2.2s ease-out calc(var(--i) * .08s) forwards;}',
    '@keyframes ixStar{0%{opacity:0;transform:translate(0,0) scale(.4)}25%{opacity:1}100%{opacity:0;transform:translate(calc((var(--i) - 3) * 26px),-120px) scale(1.1)}}',
    '.ix-ill2{display:inline-flex;align-items:flex-end;}',
    '.ix-ill2 .ill.ill-2b{width:calc(var(--s) * .62);height:calc(var(--s) * .62);margin-left:-10%;}',
    '#view .panel:has(.ix-say.show) .q{display:none;}',
    '#view .panel .ix-say{flex:0 1 auto;text-align:center;}',
    '#view .panel .ix-say:not(.show){display:none;}',
    '@media (prefers-reduced-motion:reduce){.ix-spot.on,.ix-spot.ix-ping{animation:none}.ix-shake,.ix-bin.ix-glow,.ix-sort.is-done .ix-bin{animation:none}.ix-stars span{animation-duration:.01s}}',
    'body:has(#pausebtn.is-paused) .ix-stars span{animation-play-state:paused;}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'rf-ix-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);

  /** Abort in-flight feedback / drag when the lesson skips screens (←/→). */
  function cancel() {
    ducked = null; /* clear first so hush() can never resume the old screen's narration */
    hush();
    speaking = 0;
    try { if (dragAbort) dragAbort(); } catch (e) {}
    dragAbort = null;
    try {
      document.querySelectorAll('.ix-ghost').forEach(function (g) { g.remove(); });
      document.querySelectorAll('.ix-card.is-lifted').forEach(function (el) { el.classList.remove('is-lifted'); });
      document.querySelectorAll('.ix-bin.ix-over').forEach(function (b) { b.classList.remove('ix-over'); });
    } catch (e) {}
    cur = null;
  }

  window.RFInteract = { mount: mount, begin: begin, cancel: cancel, holding: holding, resolved: resolved, settle: settle, cfgFor: cfgFor, _state: function () { return cur; }, clipUrl: clipUrl, fnv: fnv };
})();
