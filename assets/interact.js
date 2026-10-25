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
      try { a.src = clipUrl(text); a.playbackRate = rate(); var p = a.play(); if (p && p.catch) p.catch(function () { clearTimeout(t); t = setTimeout(fin, est); }); } catch (e) { clearTimeout(t); t = setTimeout(fin, est); }
    });
  }
  /** Stop whatever feedback is talking (a new tap always wins). */
  function hush() { tok++; try { if (fx) fx.pause(); } catch (e) {} if (finCur) finCur(); }
  /** Say lines in order and show them in the bubble. Pauses lesson narration if it is playing. */
  function say(lines, bubble, tone) {
    hush();
    var my = tok;
    lines = lines.filter(Boolean);
    if (bubble) { bubble.textContent = lines.join(' '); bubble.className = 'ix-say show' + (tone ? ' ' + tone : ''); }
    speaking++;
    var au = document.getElementById('au');
    if (au && !au.paused && !ducked) { ducked = au; try { au.pause(); } catch (e) {} }
    var p = Promise.resolve();
    lines.forEach(function (l) { p = p.then(function () { return sayOne(l, my); }); });
    return p.then(function () {
      speaking--;
      if (!speaking && ducked) { var d = ducked; ducked = null; try { if (!isPaused()) d.play().catch(function () {}); } catch (e) {} }
    });
  }
  function isPaused() { try { return typeof paused !== 'undefined' && paused; } catch (e) { return false; } }

  /* ---------- state per render ---------- */
  var BIN_ILL = { rain: 'cloud_rain', winter: 'snowman', high: 'sun_cloud', low: 'cloud', storm: 'storm', rs: 'cloud_snow', snow: 'snowflake', cloudy: 'cloud', sunny: 'sun' };
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
  function mountChoice(panel, cfg) {
    var rows = cfg.kind === 'rows' ? cfg.rows : [{ label: null, options: cfg.options, answer: cfg.answer, why: cfg.why, hint: cfg.hint, explain: cfg.explain }];
    var box = document.createElement('div');
    box.className = 'ix-choices ix-wait' + (cfg.kind === 'rows' ? ' is-rows' : '');
    box.innerHTML = rows.map(choiceRowHtml).join('') + '<div class="ix-say" aria-live="polite"></div>';
    var cd = panel.querySelector('.cd'), q = panel.querySelector('.q');
    if (q && cd) { var qr = document.createElement('div'); qr.className = 'ix-qrow'; panel.insertBefore(qr, q); qr.appendChild(q); qr.appendChild(cd); }
    panel.appendChild(box);
    if (cfg.kind === 'rows') panel.classList.add('ix-has-rows');
    cur.rows = rows.map(function () { return { tries: 0, done: false }; });
    cur.box = box;
    var bubble = box.querySelector('.ix-say');
    box.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.ix-opt'); if (!b || box.classList.contains('ix-wait')) return;
      var rowEl = b.closest('.ix-row'), ri = +rowEl.getAttribute('data-row'), r = rows[ri], st = cur.rows[ri];
      if (st.done) return;
      cur.engaged = true; touch();
      var k = +b.getAttribute('data-k');
      if (k === r.answer) {
        st.done = true; b.classList.add('ix-ok'); rowEl.classList.add('is-done');
        if (st.tries === 0 && rows.length === 1) note('firstTry');
        var all = cur.rows.every(function (x) { return x.done; });
        if (all && rows.length > 1 && cur.rows.every(function (x) { return x.tries === 0; })) note('firstTry');
        say([next('praise'), r.why], bubble, 'ok').then(function () { if (all) finish(); touch(); });
      } else {
        st.tries++;
        b.classList.remove('ix-shake'); void b.offsetWidth; b.classList.add('ix-shake', 'ix-no');
        if (st.tries >= 2) { st.done = true; showAnswer(rowEl, r); var all2 = cur.rows.every(function (x) { return x.done; }); say([next('explainLead'), r.explain], bubble, 'explain').then(function () { if (all2) finish(); touch(); }); }
        else say([next('hintLead'), r.hint], bubble, 'hint').then(touch);
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
  function sortBoardHtml(cfg, interactive) {
    var h = '<div class="ix-sort' + (interactive ? ' is-live ix-wait' : ' is-intro') + ' n' + cfg.bins.length + '"><div class="ix-tray">';
    cfg.cards.forEach(function (c, k) { h += '<div class="ix-card ix-k' + (k % 4) + '" data-k="' + k + '" role="button" tabindex="0">' + esc(c.t) + '</div>'; });
    h += '</div><div class="ix-bins">';
    cfg.bins.forEach(function (b) { h += '<div class="ix-bin t-' + b.tone + '" data-bin="' + b.id + '"><div class="ix-bin-h">' + (BIN_ILL[b.id] && window.RFIllus ? RFIllus.html(BIN_ILL[b.id], 'ill-ixbin', 0) : '') + '<div class="ix-bin-t">' + esc(b.label) + '</div></div><div class="ix-bin-in"></div></div>'; });
    return h + '</div><div class="ix-say" aria-live="polite"></div></div>';
  }
  function mountSort(box, cfg) {
    box.classList.add('has-ix');
    box.innerHTML = sortBoardHtml(cfg, true);
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
    }
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
        } else say([next('hintLead'), c.hint], bubble, 'hint').then(touch);
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
        drag.ghost.style.transform = 'translate(' + (e.clientX - drag.dx) + 'px,' + (e.clientY - drag.dy) + 'px) rotate(-2deg)';
        var over = binAt(e.clientX, e.clientY);
        board.querySelectorAll('.ix-bin').forEach(function (b) { b.classList.toggle('ix-over', b === over); });
      }
      touch();
    });
    function end(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      var d = drag; drag = null; cur.dragging = false;
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
      if (cfg && cfg.kind === 'sortIntro' && box) {
        var ref = cfgFor(unit, { i: cfg.ref });
        if (ref) { box.classList.add('has-ix'); box.innerHTML = sortBoardHtml(ref, false); }
        return;
      }
      if (sc.type === 'pause' && cfg && state === 'ask') {
        if (cfg.kind === 'sort' && box) { mountSort(box, cfg); screen.classList.add('stack'); }
        else if ((cfg.kind === 'choice' || cfg.kind === 'rows') && panel) mountChoice(panel, cfg);
        screen.classList.add('ix-on');
        return;
      }
      if ((sc.type === 'pause' && !cfg) || sc.type === 'retell') mountParent(screen);
    } catch (e) { /* never break the lesson */ }
  }
  function begin() {
    if (!cur || !cur.box) return;
    cur.box.classList.remove('ix-wait');
    var root = cur.box.closest('.ix-sort') || cur.box; root.classList.remove('ix-wait');
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
    '.ix-choices.is-rows .ix-opts{flex:0 1 auto;flex-wrap:nowrap;}',
    '.ix-choices.is-rows .ix-opt{min-width:96px;flex:0 1 auto;}',
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
    /* sort board */

    '.ix-sort{width:100%;height:100%;display:flex;flex-direction:column;gap:2.4cqh;}',
    '.ix-tray{display:flex;flex-wrap:wrap;justify-content:center;gap:1.6cqh 1.6cqw;min-height:calc(64px + 1cqh);}',
    '.ix-card{min-height:64px;display:flex;align-items:center;justify-content:center;text-align:center;padding:6px 14px;border-radius:16px;',
    ' font-weight:800;font-size:clamp(18px,min(3cqw,8cqh),32px);line-height:1.15;color:#1F2A44;background:#fff;border:3px solid var(--kc);border-bottom-width:6px;',
    ' touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none;transition:transform .25s ease,box-shadow .25s ease,opacity .2s ease;flex:0 1 auto;max-width:48%;}',
    '.ix-k0{--kc:#E07A5F;background:#FDEEE9;} .ix-k1{--kc:#3D7AB5;background:#E6F0FA;} .ix-k2{--kc:#7A6BB0;background:#EFECF8;} .ix-k3{--kc:#4F9A6B;background:#E7F4EC;}',
    '.ix-card.ix-sel{transform:translateY(-4px);box-shadow:0 0 0 4px #FFF4C2,0 0 0 8px #E8C04A;}',
    '.ix-card.is-lifted{opacity:.25;}',
    '.ix-ghost{position:fixed;left:0;top:0;z-index:90;pointer-events:none;box-shadow:0 12px 24px rgba(0,0,0,.18);transition:none;margin:0;max-width:none !important;}',
    '.ix-bins{flex:1 1 auto;min-height:0;display:flex;gap:2cqw;}',
    '.ix-bin{flex:1 1 0;min-width:0;border-radius:20px;border:4px dashed var(--bc);background:var(--bb);display:flex;flex-direction:column;align-items:center;gap:1.4cqh;padding:1.6cqh 1cqw;transition:box-shadow .3s ease,transform .3s ease;}',
    '.ix-bin.t-blue{--bc:#3D7AB5;--bb:#F3F8FC;} .ix-bin.t-gold{--bc:#C9A63A;--bb:#FFF8E6;} .ix-bin.t-green{--bc:#4F9A6B;--bb:#F1F9F3;} .ix-bin.t-gray{--bc:#6B7785;--bb:#F6F6F4;}',
    '.ix-bin-h{display:flex;align-items:center;justify-content:center;gap:1.2cqw;flex:0 0 auto;max-width:100%;}',
    '.ill-ixbin{--s:clamp(56px,min(16cqh,8cqw),120px);}',
    '.ix-sort.n3 .ix-bin-h,.ix-sort.n4 .ix-bin-h{flex-direction:column;gap:.6cqh;text-align:center;}',
    '.ix-sort.n4 .ill-ixbin{--s:clamp(56px,min(14cqh,7cqw),110px);}',
    '.ix-bin-t{font-weight:900;font-size:clamp(16px,min(2.8cqw,7cqh),32px);color:var(--bc);}',
    '.ix-bin-in{display:flex;flex-direction:column;gap:1cqh;align-items:stretch;width:100%;min-height:0;}',
    '.ix-bin-in .ix-card{max-width:none;min-height:0;font-size:clamp(15px,min(2.2cqw,5.4cqh),22px);line-height:1.2;padding:6px 12px;border-radius:999px;border-width:2px;border-bottom-width:2px;border-left-width:8px;background:#fff;cursor:default;justify-content:flex-start;text-align:left;box-shadow:0 2px 0 rgba(0,0,0,.06);}',
    '.ix-bin.ix-over{box-shadow:0 0 0 6px rgba(232,192,74,.55);transform:scale(1.02);}',
    '@keyframes ixGlow{0%{box-shadow:0 0 0 0 rgba(232,192,74,0)}40%{box-shadow:0 0 0 10px rgba(232,192,74,.55)}100%{box-shadow:0 0 0 0 rgba(232,192,74,0)}}',
    '.ix-bin.ix-glow{animation:ixGlow 1.1s ease-out;}',
    '.ix-sort.has-sel .ix-bin{border-style:solid;}',
    '.ix-sort .ix-say{text-align:center;}',
    '.ix-sort.is-intro .ix-card{cursor:default;}',
    '.ix-sort.n3 .ix-card,.ix-sort.n4 .ix-card{max-width:31%;}',
    '@keyframes ixParty{0%{transform:none}50%{transform:translateY(-6px) scale(1.03)}100%{transform:none}}',
    '.ix-sort.is-done .ix-bin{animation:ixParty 1.2s ease-in-out 2;border-style:solid;}',
    /* parent assist: small, quiet, bottom-left (pause FAB is bottom-right) */
    '.ix-parent{position:absolute;left:clamp(10px,1.6vw,20px);bottom:clamp(8px,1.4vh,16px);z-index:6;font-family:inherit;font-weight:700;font-size:13px;',
    ' color:#5A6578;background:rgba(255,253,248,.85);border:1.5px solid #E2D6C2;border-radius:999px;padding:6px 12px;min-height:34px;opacity:.7;cursor:pointer;touch-action:manipulation;}',
    '.ix-parent:active{opacity:1;} .ix-parent.is-saved{opacity:.6;color:#9A6B12;cursor:default;}',
    '.ix-stars{position:absolute;left:clamp(16px,2vw,28px);bottom:clamp(30px,5vh,50px);z-index:7;pointer-events:none;width:1px;height:1px;}',
    '.ix-stars span{position:absolute;left:0;top:0;color:#E8C04A;font-size:22px;opacity:0;animation:ixStar 2.2s ease-out calc(var(--i) * .08s) forwards;}',
    '@keyframes ixStar{0%{opacity:0;transform:translate(0,0) scale(.4)}25%{opacity:1}100%{opacity:0;transform:translate(calc((var(--i) - 3) * 26px),-120px) scale(1.1)}}',
    '@media (prefers-reduced-motion:reduce){.ix-shake,.ix-bin.ix-glow,.ix-sort.is-done .ix-bin{animation:none}.ix-stars span{animation-duration:.01s}}',
    'body:has(#pausebtn.is-paused) .ix-stars span{animation-play-state:paused;}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'rf-ix-css'; st.textContent = CSS; (document.head || document.documentElement).appendChild(st);

  window.RFInteract = { mount: mount, begin: begin, holding: holding, resolved: resolved, settle: settle, cfgFor: cfgFor, _state: function () { return cur; }, clipUrl: clipUrl, fnv: fnv };
})();
