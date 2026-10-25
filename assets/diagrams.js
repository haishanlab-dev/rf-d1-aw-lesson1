/* Reading Future · live HTML diagrams (replace generated PNG/JPG diagrams).
   RFDiagram.apply(view, sc, state, unitId) swaps the <img> in .imgbox for an
   HTML+CSS diagram and picks a calm, staggered highlight for the screen being
   narrated. Animations restart on every render (jump / replay / ask→reveal),
   pause with the pause button, and are skipped for prefers-reduced-motion. */
(function () {
  'use strict';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  /* Noto Emoji (Google, Apache 2.0) – self-hosted under assets/illus/noto/ */
  var IBASE = (function () { var sc = document.currentScript && document.currentScript.src; return sc ? sc.replace(/[^\/]*$/, '') : 'assets/'; })();
  var PALE = { rabbit: 1, snowman: 1, cloud: 1, cloud_snow: 1, cloud_rain: 1, snowflake: 1, sun_cloud: 1 };
  function ill(name, cls, i) {
    return '<span class="ill' + (PALE[name] ? ' pale' : '') + (cls ? ' ' + cls : '') + '" style="--b:' + (i || 0) + '" aria-hidden="true"><img class="ill-i" src="' + IBASE + 'illus/noto/' + name + '.svg" alt="" draggable="false"></span>';
  }
  window.RFIllus = { html: ill };
  var MAP_COLORS = ['#4AA8E8', '#FFD84D', '#6CC08B', '#F28BA0'];
  var UNITS = {
    unit1: {
      main: 'Animals can help farmers know about the weather.',
      legs: [['stretch', 'their necks'], ['smell', 'the air'], ['eat', 'a lot'], ['get', 'very fat']],
      always: ['If rabbits eat a lot,', 'must winter be coming?'],
      scene: { l: ['rabbit', 'carrot'], r: ['cloud_snow', 'snowman'] }, topIll: ['farmer', 'cow'],
      binIll: { a: 'cloud_rain', b: 'snowman' },
      bins: { a: 'It will rain', b: 'Long, cold winter',
        aItems: ['Cows and horses smell the air.', 'Cows and horses stretch their necks.'],
        bItems: ['The rabbits are getting very fat.', 'The rabbits are eating a lot.'] }
    },
    unit2: { main: 'Kinds of clouds: not all clouds make rain.', always: ['If it is cloudy,', 'must it rain?'], scene: { l: ['cloud'], r: ['cloud_rain'] }, topIll: ['cloud', 'cloud_rain'] },
    unit3: { main: 'Weather from clouds: rain, snow, and hail.', always: ['If it is cold,', 'must it snow?'], scene: { l: ['thermometer'], r: ['cloud_snow'] }, topIll: ['cloud_rain', 'cloud_snow'] },
    unit4: { main: 'Raining fish! A tornado probably carried them.', always: ['Must it always be a tornado', 'when fish fall?'], scene: { l: ['fish'], r: ['tornado'] }, topIll: ['tornado', 'fish'] },
    scienceReview: {
      main: 'Animals can help farmers know about the weather.',
      legs: [['stretch', 'their necks'], ['smell', 'the air'], ['eat', 'a lot'], ['get', 'very fat']],
      always: ['If you see clouds,', 'must it rain?'], scene: { l: ['cloud'], r: ['cloud_rain'] }, topIll: ['farmer', 'cow'],
      story: ['Animals guess weather', 'Which clouds make rain?', 'Rain, snow, or hail?', 'Can fish fall too?']
    }
  };

  /* ---------- builders ---------- */
  function lns(arr, start) {
    return arr.map(function (l, k) { return '<span class="dg-ln' + (start < 0 ? '' : ' seq') + '" style="--i:' + (start + k) + '">' + esc(l) + '</span>'; }).join('<br>');
  }
  function mapDg(labels, foot, marks) {
    // marks[i]: '' | 'done' | 'next' | 'seq' | 'here'
    var h = '<div class="dg dg-map"><div class="dg-title">Lesson Map</div><div class="dg-row">';
    for (var i = 0; i < 4; i++) {
      var m = marks[i] || '';
      h += (i ? '<div class="dg-arrow" aria-hidden="true">▸</div>' : '') +
        '<' + (marks.tap ? 'button type="button" data-part="' + (i + 1) + '" aria-label="Go to part ' + (i + 1) + '"' : 'div') + ' class="dg-card dg-c' + i + (m ? ' is-' + m : '') + '" style="--c:' + MAP_COLORS[i] + ';--d:' + (marks.seqDelay ? marks.seqDelay(i) : 0) + 's">' +
        '<div class="dg-num">' + (i + 1) + '</div><div class="dg-lab">' + esc(labels[i]) + '</div>' +
        (m === 'done' ? '<div class="dg-check" aria-label="done">' + ill('check', 'ill-check', i) + '</div>' : '') + '</' + (marks.tap ? 'button' : 'div') + '>';
    }
    h += '</div>' + (foot ? '<div class="dg-foot">' + esc(foot) + '</div>' : '') + '</div>';
    return h;
  }
  function tableDg(u, mode) {
    // mode: top | legs | topLegs | blankAsk | fill | filledSeq
    var filled = mode === 'fill' || mode === 'filledSeq';
    var legs = u.legs || [['', ''], ['', ''], ['', ''], ['', '']];
    var h = '<div class="dg dg-table m-' + mode + '"><div class="dg-top">' + (u.topIll ? '<div class="dg-top-ill">' + u.topIll.map(function (n, k) { return ill(n, 'ill-top', k); }).join('') + '</div>' : '') + '<div class="dg-top-x"><div class="dg-top-t">Main Idea = table top</div>' +
      '<div class="dg-top-s">' + esc(u.main) + '</div></div></div><div class="dg-legs">';
    for (var i = 0; i < 4; i++) {
      h += '<div class="dg-legcol" style="--i:' + i + '"><div class="dg-post"></div><div class="dg-leg' + (filled ? ' is-filled' : '') + '">' +
        '<div class="dg-leg-t">Detail</div>' +
        (filled ? '<div class="dg-leg-x">' + esc(legs[i][0]) + '<br>' + esc(legs[i][1]) + '</div>' : '<div class="dg-q">?</div>') +
        '</div></div>';
    }
    h += '</div><div class="dg-foot">Details = table legs</div></div>';
    return h;
  }
  function skillsDg(mode) {
    return '<div class="dg dg-skills m-' + mode + '"><div class="dg-title">Two skills we will use today</div><div class="dg-row2">' +
      '<div class="dg-sk dg-sk1"><div class="dg-sk-h">' + ill('thinking', 'ill-sk', 0) + '<div class="dg-sk-t">Critical Thinking</div></div><div class="dg-sk-b">' + lns(['Ask questions.', 'Do not just believe.', 'Check the facts.'], mode === 'both' ? 1 : -1) + '</div><div class="dg-sk-q">“Is it always true?”</div></div>' +
      '<div class="dg-sk dg-sk2"><div class="dg-sk-h">' + ill('speaking', 'ill-sk', 1) + '<div class="dg-sk-t">Communication</div></div><div class="dg-sk-b">' + lns(['Share your ideas.', 'Listen to others.', 'Say it clearly.'], mode === 'both' ? 5 : 1) + '</div><div class="dg-sk-q">“Tell a friend.”</div></div>' +
      '</div></div>';
  }
  function sceneHtml(sc) {
    if (!sc) return '';
    var k = 0;
    function side(a) { return '<div class="dg-sc-side">' + a.map(function (n, j) { return ill(n, 'ill-sc' + (j ? ' ill-sm' : ''), k++); }).join('') + '</div>'; }
    return '<div class="dg-scene">' + side(sc.l) + '<div class="dg-sc-ar" aria-hidden="true"></div>' + ill('thinking', 'ill-sc ill-mid', k++) + '<div class="dg-sc-ar" aria-hidden="true"></div>' + side(sc.r) + '</div>';
  }
  function alwaysDg(lines, stamp, mode, scene) {
    return '<div class="dg dg-always m-' + mode + (scene ? ' has-scene' : '') + '">' + sceneHtml(scene) + '<div class="dg-al"><div class="dg-al-t dg-ln" style="--i:0">Is it always true?</div><div class="dg-al-b">' +
      lines.map(function (l, k) { return '<span class="dg-ln" style="--i:' + (k + 1) + '">' + esc(l) + '</span>'; }).join('<br>') +
      '</div><div class="dg-al-s"><span class="dg-ln" style="--i:' + (lines.length + 1) + '">Think carefully!</span></div>' +
      (stamp ? '<div class="dg-stamp">' + esc(stamp) + '</div>' : '') + '</div></div>';
  }
  function binsDg(b, mode, bi) {
    // mode: empty | fill (fly in) | filled (static)
    function col(cls, t, items, base, icon) {
      var h = '<div class="dg-bin ' + cls + (mode === 'empty' ? '' : ' is-filled') + '"><div class="dg-bin-h">' + (icon ? ill(icon, 'ill-bin', base) : '') + '<div class="dg-bin-t">' + esc(t) + '</div></div>';
      if (mode === 'empty') h += '<div class="dg-q">?</div>';
      else items.forEach(function (x, k) { h += '<div class="dg-bin-i" style="--i:' + (base + k) + '">' + esc(x) + '</div>'; });
      return h + '</div>';
    }
    return '<div class="dg dg-bins m-' + mode + '"><div class="dg-title">' + (mode === 'empty' ? 'Sort the sentences' : 'Sorted!') + '</div><div class="dg-row2">' +
      col('dg-bin-a', b.a, b.aItems, 0, bi && bi.a) + col('dg-bin-b', b.b, b.bItems, 2, bi && bi.b) + '</div></div>';
  }

  /* ---------- per-screen choice ---------- */
  function isEnd(sc) {
    if (!sc || !sc.map) return false;
    var zh = sc.zh || '';
    return zh === 'Session 1 done' || zh === 'Session 2 done' || zh === 'Great job!';
  }
  function pick(sc, state, unit) {
    var u = UNITS[unit] || UNITS.unit1;
    var img = state === 'reveal' && sc.rimg ? sc.rimg : sc.img;
    var zh = sc.zh || '';
    var end = isEnd(sc);
    if (img === 'map_all.png' || end) {
      var labels, foot = 'Session 1: parts 1–2 · Session 2: parts 3–4', marks = [];
      if (unit === 'scienceReview') {
        foot = '';
        if (zh === 'Weather Review' || zh === 'Great job!') labels = [1, 2, 3, 4].map(function (p) { return window.partLabel ? partLabel(p) : 'Part ' + p; });
        else labels = u.story;
      } else {
        labels = [1, 2, 3, 4].map(function (p) { return window.partLabel ? partLabel(p) : 'Part ' + p; });
      }
      if (zh === 'Session 1 done') { marks = ['done', 'done', 'next', '']; marks.seqDelay = function (i) { return 0.5 + i * 0.7; }; }
      else if (zh === 'Lesson Map' && sc.s === 'B') { marks = ['done', 'done', 'next', 'next2']; marks.seqDelay = function (i) { return i < 2 ? 0.3 : 0.8 + (i - 2) * 0.6; }; }
      else if (zh === 'Lesson Map' || zh === 'Weather Review') { marks = ['seq', 'seq', 'seq', 'seq']; marks.seqDelay = function (i) { return 0.6 + i * 1.1; }; }
      else if (zh === 'Great job!' || end) { marks = ['done', 'done', 'done', 'done']; marks.seqDelay = function (i) { return 0.4 + i * 0.6; }; }
      else { marks = ['seq', 'seq', 'seq', 'seq']; marks.seqDelay = function (i) { return (sc.type === 'retell' && state === 'reveal' ? 0.3 : 0.8) + i * 1.3; }; }
      marks.tap = !!sc.map;
      if (end) {
        labels = [1, 2, 3, 4].map(function (p) { return window.partLabel ? partLabel(p) : 'Part ' + p; });
        marks.tap = true;
        if (zh !== 'Session 1 done') {
          marks = ['done', 'done', 'done', 'done'];
          marks.seqDelay = function (i) { return 0.4 + i * 0.6; };
          marks.tap = true;
        }
        if (unit === 'scienceReview') foot = '';
      }
      return { html: mapDg(labels, foot, marks), what: end ? 'map:end' : 'map', map: !!sc.map || end, end: end };
    }
    if (img === 'table_blank.png' || img === 'table_filled.png') {
      var mode = 'topLegs';
      if (/^Main Idea/.test(zh)) mode = 'top';
      else if (/^Details?$/.test(zh)) mode = 'legs';
      else if (zh === 'Find the Legs') mode = state === 'reveal' ? 'fill' : 'blankAsk';
      else if (img === 'table_filled.png') mode = 'filledSeq';
      return { html: tableDg(u, mode), what: 'table:' + mode };
    }
    if (img === 'two_skills.jpg') {
      var m = zh === 'Tell a friend' ? 'comm' : 'both';
      return { html: skillsDg(m), what: 'skills:' + m };
    }
    if (img === 'always.jpg') {
      var lines = u.always, stamp = '';
      if (sc.type === 'pause' && sc.q && sc.q.length) lines = sc.q.filter(function (l) { return !/always true\?$/i.test(l); }).slice(0, 2);
      if (state === 'reveal' && sc.reveal && sc.reveal.length) stamp = sc.reveal[0];
      return { html: alwaysDg(lines, stamp, stamp ? 'stamp' : 'ask', u.scene), what: 'always' + (stamp ? ':stamp' : '') };
    }
    if ((img === 'bins_empty.jpg' || img === 'bins_filled.jpg') && u.bins) {
      var bm = img === 'bins_empty.jpg' ? 'empty' : (sc.type === 'pause' && state === 'reveal' ? 'fill' : 'filled');
      return { html: binsDg(u.bins, bm, u.binIll), what: 'bins:' + bm };
    }
    return null;
  }

  // Generated card/diagram + short text → stacked big centred visual.
  function chars(a) { return (a || []).reduce(function (n, l) { return n + String(l).length; }, 0); }
  function isShort(sc) {
    if (sc.type === 'normal') return (sc.body || []).length <= 3 && chars(sc.body) <= 100;
    if (sc.type === 'pause') return (sc.q || []).length <= 3 && (sc.reveal || []).length <= 3 && chars(sc.q) <= 90 && chars(sc.reveal) <= 90;
    return false;
  }
  function apply(view, sc, state, unit) {
    try {
      var box = view.querySelector('.imgbox'); if (!box) return null;
      var r = pick(sc, state, unit); if (!r) return null;
      box.classList.add('has-dg');
      box.innerHTML = r.html;
      var scr = view.querySelector('.screen');
      if (scr && (r.map || r.end)) {
        // The big map cards ARE the part buttons: drop the duplicate list, full-width row.
        var nav = view.querySelector('.panel .mapnav'); if (nav) nav.remove();
        scr.classList.add('stack', 'is-map');
        if (r.end) { scr.classList.add('is-end'); var pg = scr.querySelector('.prog'); if (pg) pg.remove(); }
        box.querySelectorAll('.dg-card[data-part]').forEach(function (b) {
          b.addEventListener('click', function (e) { e.stopPropagation(); try { if (window.jumpToPart) jumpToPart(+b.getAttribute('data-part')); } catch (_e) {} });
        });
      } else if (scr && !sc.map && isShort(sc)) scr.classList.add('stack');
      return r.what;
    } catch (e) { return null; }
  }

  var CSS = [
    '#view .imgbox.has-dg,#view .imgbox.has-ix{padding:0;background:transparent;border:0;box-shadow:none;border-radius:0;container-type:size;overflow:visible;}',
    '#view .screen.stack.is-map .content > .panel{order:1;}',
    '#view .screen.stack.is-map .content > .panel:empty{display:none;}',
    /* session-end: title, one full-width row of big map cards, foot line, buttons centred below */
    '#view .screen.is-end .dg-map > .dg-title{display:none;}',
    '#view .screen.is-end .dg-map{gap:3cqh;}',
    '#view .screen.is-end .dg-map .dg-row{gap:1.6cqw;}',
    '#view .screen.is-end .dg-card{max-width:24cqw;max-height:84cqh;aspect-ratio:.8;}',
    '#view .screen.is-end .dg-map .dg-arrow{font-size:clamp(12px,2.4cqw,24px);}',
    '#view .screen.is-end .content > .panel{align-items:center;text-align:center;}',
    '#view .screen.is-end .endrow{justify-content:center;width:100%;gap:clamp(10px,2vw,24px);padding:0 clamp(48px,8vw,120px) clamp(8px,2vh,20px);}',
    '#view .screen.is-end .endrow .endbtn{margin:0;}',
    '#view .screen.is-end .prog{display:none!important;}',
    '#view .screen.is-end .content{flex:1 1 auto;min-height:0;gap:clamp(6px,1.4cqh,16px);}',
    '#view .screen.is-end .content > .imgbox{flex:1 1 auto;min-height:0;width:100%;max-width:calc(100% - 2 * clamp(16px,4vw,56px));}',
    '#view .screen.is-end .content > .panel{flex:0 0 auto;padding-bottom:clamp(4px,1vh,12px);}',
    '.dg-card[data-part]{cursor:pointer;touch-action:manipulation;border:0;font-family:inherit;}',
    '.dg-card[data-part]:active{transform:translateY(3px) scale(.98);}',
    '.dg-art{display:contents;}',
    '.dg{width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2.6cqh;',
    ' font-family:inherit;color:#1F2A44;text-align:center;-webkit-user-select:none;user-select:none;}',
    '.dg-title{font-weight:800;font-size:clamp(14px,min(3cqw,8cqh),36px);color:#2B3445;}',
    '.dg-foot{font-weight:700;font-size:clamp(12px,min(2.4cqw,6.4cqh),28px);color:#3C4656;}',
    /* map */
    '.dg-map .dg-row{display:flex;align-items:center;justify-content:center;gap:1.4cqw;width:100%;flex:0 1 auto;}',
    '.dg-map .dg-arrow{color:#9AA3AD;font-size:clamp(12px,3cqw,26px);flex:0 0 auto;}',
    '.dg-card{position:relative;flex:1 1 0;max-width:23cqw;aspect-ratio:.72;max-height:68cqh;background:var(--c);border-radius:clamp(8px,2.4cqmin,20px);',
    ' display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2cqmin;padding:1.5cqmin;box-shadow:0 .8cqmin 0 rgba(0,0,0,.08);',
    ' transition:transform .3s ease;}',
    '.dg-num{font-weight:900;font-size:clamp(24px,min(9cqw,20cqh),96px);line-height:1;color:#2B3445;}',
    '.dg-lab{font-weight:700;font-size:clamp(12px,min(2.4cqw,6cqh),26px);line-height:1.2;color:#1F2A44;}',
    '.dg-c0 .dg-num,.dg-c0 .dg-lab,.dg-c2 .dg-num,.dg-c2 .dg-lab{color:#1B2A3A;}',
    '.dg-check{position:absolute;top:-3cqmin;right:-3cqmin;width:clamp(36px,min(10cqmin,14cqh),72px);height:clamp(36px,min(10cqmin,14cqh),72px);display:grid;place-items:center;z-index:2;}',
    '.dg-check .ill-check{--s:100%;width:100%;height:100%;}',
    '.dg-check .ill.pale::before{display:none;}',
    '.dg-check .ill > img.ill-i{filter:drop-shadow(0 2px 3px rgba(31,52,84,.28));}',
    '.dg-card.is-done{filter:saturate(.75);opacity:.88;}',
    '.dg-card.is-next,.dg-card.is-seq{box-shadow:0 0 0 .7cqmin #FFF4C2,0 0 0 1.4cqmin #E8C04A;}',
    '.dg-card.is-next2{opacity:.95;}',
    /* table */
    '.dg-table{gap:0;justify-content:stretch;}',
    '.dg-top{flex:0 0 auto;width:90%;background:#4AA8E8;color:#fff;border-radius:clamp(10px,3cqmin,26px);padding:2.2cqmin 3cqmin;box-shadow:0 .8cqmin 0 rgba(47,95,140,.18);}',
    '.dg-top-t{font-weight:800;font-size:clamp(15px,min(4.2cqw,10.5cqh),48px);}',
    '.dg-top-s{font-weight:600;font-size:clamp(12px,min(2.9cqw,7.4cqh),34px);margin-top:.6cqmin;opacity:.95;}',
    '.dg-legs{display:flex;justify-content:space-around;width:84%;flex:1 1 auto;min-height:0;}',
    '.dg-legcol{display:flex;flex-direction:column;align-items:center;width:21%;min-height:0;}',
    '.dg-post{flex:0 0 auto;width:2.4cqw;height:clamp(10px,12cqh,110px);background:#C98B4B;border-radius:0 0 4px 4px;}',
    '.dg-leg{flex:1 1 auto;min-height:0;max-height:min(46cqh,24cqw);width:100%;background:#fff;border:clamp(2px,.6cqmin,6px) solid #6CC08B;border-radius:clamp(8px,2cqmin,18px);',
    ' display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1cqmin;padding:1cqmin;}',
    '.dg-leg-t{font-weight:800;color:#3E9A5F;font-size:clamp(12px,min(2.6cqw,6.6cqh),30px);}',
    '.dg-leg .dg-q{font-weight:900;color:#6CC08B;font-size:clamp(18px,min(6cqw,15cqh),72px);line-height:1;}',
    '.dg-leg.is-filled{background:#6CC08B;}',
    '.dg-leg.is-filled .dg-leg-t{color:#fff;}',
    '.dg-leg-x{color:#fff;font-weight:700;font-size:clamp(12px,min(2.5cqw,6.2cqh),30px);line-height:1.25;}',
    '.dg-table .dg-foot{flex:0 0 auto;margin-top:2.4cqh;}',
    /* two skills */
    '.dg-row2{display:flex;gap:3cqw;width:92%;justify-content:center;flex:0 1 auto;}',
    '.dg-sk{flex:1 1 0;max-height:80cqh;border-radius:clamp(10px,2.6cqmin,24px);padding:3cqmin 2cqmin;display:flex;flex-direction:column;gap:2.4cqmin;justify-content:center;',
    ' box-shadow:0 .8cqmin 0 rgba(0,0,0,.08);transition:opacity .4s ease;}',
    '.dg-sk1{background:#4AA8E8;color:#fff;}',
    '.dg-sk2{background:#FFD84D;color:#2B3445;}',
    '.dg-sk-t{font-weight:800;font-size:clamp(15px,min(3.8cqw,11cqh),50px);}',
    '.dg-sk-b{font-weight:700;font-size:clamp(12px,min(2.9cqw,8.4cqh),38px);line-height:1.45;}',
    '.dg-sk-q{font-weight:600;font-size:clamp(12px,min(2.4cqw,6cqh),28px);opacity:.9;}',
    '.dg-skills.m-comm .dg-sk1{opacity:.45;}',
    /* always */
    '.dg-always .dg-al{position:relative;width:min(92%,190cqh);height:auto;min-height:66cqh;max-height:94cqh;justify-content:center;background:#F28BA0;color:#fff;border-radius:clamp(12px,3cqmin,28px);',
    ' padding:4cqmin 3cqmin;display:flex;flex-direction:column;gap:2.6cqmin;box-shadow:0 .8cqmin 0 rgba(0,0,0,.08);}',
    '.dg-al-t{font-weight:900;font-size:clamp(18px,min(5.6cqw,15cqh),72px);}',
    '.dg-al-b{font-weight:700;font-size:clamp(14px,min(4cqw,10.5cqh),52px);line-height:1.4;}',
    '.dg-al-s{font-weight:600;font-size:clamp(12px,min(2.8cqw,7.5cqh),36px);opacity:.92;}',
    '.dg-stamp{align-self:center;background:#4F9A6B;color:#fff;font-weight:900;font-size:clamp(14px,min(3.4cqw,8cqh),40px);',
    ' padding:1.4cqmin 3.4cqmin;border-radius:999px;border:3px solid #fff;box-shadow:0 4px 10px rgba(0,0,0,.15);}',
    /* bins */
    '.dg-bin{flex:1 1 0;min-height:52cqh;max-height:76cqh;border-radius:clamp(10px,2.6cqmin,24px);border:clamp(2px,.6cqmin,6px) solid;padding:3cqmin 2cqmin;',
    ' display:flex;flex-direction:column;gap:2.6cqmin;align-items:center;justify-content:flex-start;}',
    '.dg-bin-a{background:#E4F1FB;border-color:#4AA8E8;color:#2F7FC0;}',
    '.dg-bin-b{background:#FFF3D6;border-color:#E0A21B;color:#B07A0E;}',
    '.dg-bin.is-filled.dg-bin-a{background:#4AA8E8;color:#fff;}',
    '.dg-bin.is-filled.dg-bin-b{background:#E0A21B;color:#fff;}',
    '.dg-bin-t{font-weight:800;font-size:clamp(14px,min(3.6cqw,8.4cqh),42px);}',
    '.dg-bin .dg-q{font-weight:900;font-size:clamp(28px,min(8cqw,16cqh),96px);line-height:1;margin:auto 0;}',
    '.dg-bin-i{font-weight:700;font-size:clamp(12px,min(2.6cqw,6cqh),30px);line-height:1.3;background:rgba(255,255,255,.18);border-radius:12px;padding:1.2cqmin 1.8cqmin;}',

    /* illustrations (Noto Emoji, Apache 2.0) – never below ~56-64px */
    '.ill{--s:72px;position:relative;flex:0 0 auto;width:var(--s);height:var(--s);display:inline-grid;place-items:center;}',
    '#view .content > .imgbox .ill > img.ill-i,.ill > img.ill-i{width:100%;height:100%;object-fit:contain;border-radius:0;max-width:none;max-height:none;position:relative;}',
    '.ill.pale::before{content:"";position:absolute;inset:-6%;border-radius:50%;background:radial-gradient(circle at 50% 55%,rgba(74,140,200,.22) 0 58%,rgba(74,140,200,0) 71%);}',
    '.ill.pale > img.ill-i{filter:drop-shadow(0 2px 2px rgba(31,52,84,.30));}',
    '.dg-scene{flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:2.4cqw;width:100%;}',
    '.dg-sc-side{display:flex;align-items:flex-end;gap:.6cqw;}',
    '.ill-sc{--s:clamp(64px,min(34cqh,16cqw),210px);}',
    '.ill-sc.ill-sm{--s:clamp(56px,min(22cqh,11cqw),140px);}',
    '.ill-mid{--s:clamp(64px,min(28cqh,14cqw),170px);}',
    '.dg-sc-ar{width:clamp(30px,7cqw,90px);height:0;border-top:clamp(3px,.8cqh,6px) dashed #B9B2A6;position:relative;}',
    '.dg-sc-ar::after{content:"";position:absolute;right:-2px;top:calc(-1 * clamp(7px,1.8cqh,12px) - clamp(3px,.8cqh,6px) / 2);border:clamp(7px,1.8cqh,12px) solid transparent;border-left-color:#B9B2A6;border-right:0;}',
    '.dg-always.has-scene{gap:2.4cqh;}',
    '.dg-always.has-scene .dg-al{min-height:0;flex:0 1 auto;max-height:62cqh;padding:2.6cqmin 3cqmin;gap:1.6cqmin;}',
    '.dg-always.has-scene .dg-al-t{font-size:clamp(18px,min(5cqw,11cqh),64px);}',
    '.dg-always.has-scene .dg-al-b{font-size:clamp(14px,min(3.6cqw,8cqh),46px);line-height:1.3;}',
    '.dg-always.has-scene .dg-al-s{font-size:clamp(12px,min(2.6cqw,6cqh),32px);}',
    '@container (max-height:239px){.dg-scene{display:none}.dg-always.has-scene .dg-al{max-height:94cqh}}',
    '.dg-top{display:flex;align-items:center;gap:2.4cqw;}',
    '.dg-top-ill{display:flex;gap:.4cqw;flex:0 0 auto;}',
    '.ill-top{--s:clamp(56px,min(15cqh,8cqw),120px);}',
    '.dg-top .ill.pale::before{background:radial-gradient(circle at 50% 55%,rgba(255,255,255,.45) 0 58%,rgba(255,255,255,0) 71%);}',
    '.dg-top-x{flex:1 1 auto;min-width:0;}',
    '.dg-sk-h{display:flex;align-items:center;gap:1.6cqw;}',
    '.ill-sk{--s:clamp(56px,min(15cqh,8cqw),120px);}',
    '.dg-bin-h{display:flex;align-items:center;justify-content:center;gap:1.6cqw;}',
    '.ill-bin{--s:clamp(56px,min(18cqh,9cqw),130px);}',
    '.dg-bin.is-filled .ill.pale::before{background:radial-gradient(circle at 50% 55%,rgba(255,255,255,.5) 0 58%,rgba(255,255,255,0) 71%);}',
    '@keyframes illIn{0%{opacity:0;transform:translateY(14%) scale(.88)}60%{opacity:1;transform:translateY(-5%) scale(1.02)}100%{opacity:1;transform:none}}',
    '@keyframes illBob{0%,100%{transform:none}50%{transform:translateY(-4%)}}',
    '@media (prefers-reduced-motion:no-preference){.ill{animation:illIn .9s ease-out calc(.15s + var(--b) * .18s) both,illBob 3.2s ease-in-out calc(1.2s + var(--b) * .3s) 2;}}',

    /* ---------- motion (calm: slow eases, ≤3 repeats, no flashing) ---------- */
    '@keyframes dgGlow{0%,100%{box-shadow:0 .8cqmin 0 rgba(47,95,140,.18),0 0 0 0 rgba(232,192,74,0)}50%{box-shadow:0 .8cqmin 0 rgba(47,95,140,.18),0 0 0 1.6cqmin rgba(232,192,74,.55);transform:scale(1.025)}}',
    '@keyframes dgLift{0%{transform:none;box-shadow:none}45%{transform:translateY(-6%);box-shadow:0 0 0 1.2cqmin rgba(232,192,74,.6)}100%{transform:translateY(-2%);box-shadow:0 0 0 .9cqmin rgba(232,192,74,.45)}}',
    '@keyframes dgPost{0%{background:#C98B4B}50%{background:#E8C04A}100%{background:#D9A956}}',
    '@keyframes dgIn{0%{opacity:0;transform:translateY(-40%) scale(.85)}100%{opacity:1;transform:none}}',
    '@keyframes dgPop{0%{opacity:0;transform:scale(.2)}70%{opacity:1;transform:scale(1.15)}100%{opacity:1;transform:scale(1)}}',
    '@keyframes dgNext{0%,100%{transform:none}50%{transform:translateY(-4%) scale(1.04)}}',
    '@keyframes dgSeq{0%{transform:none;box-shadow:none}40%{transform:translateY(-5%) scale(1.04);box-shadow:0 0 0 .7cqmin #FFF4C2,0 0 0 1.6cqmin #E8C04A}100%{transform:none;box-shadow:0 0 0 .7cqmin #FFF4C2,0 0 0 1.4cqmin #E8C04A}}',
    '@keyframes dgSoft{0%{opacity:.35;transform:scale(.97)}100%{opacity:1;transform:none}}',
    '@keyframes dgStamp{0%{opacity:0;transform:scale(1.6) rotate(-8deg)}100%{opacity:1;transform:rotate(-3deg)}}',
    '@media (prefers-reduced-motion:no-preference){',
    ' .dg-card.is-seq{animation:dgSeq 1.1s ease-out var(--d) both;}',
    ' .dg-card.is-next{animation:dgSeq 1.1s ease-out var(--d) both,dgNext 2.4s ease-in-out calc(var(--d) + 1.1s) 3;}',
    ' .dg-card.is-done .dg-check{animation:dgPop .6s ease-out var(--d) both;}',
    ' .dg-table.m-top .dg-top,.dg-table.m-topLegs .dg-top,.dg-table.m-filledSeq .dg-top{animation:dgGlow 2.2s ease-in-out .6s 3;}',
    ' .dg-table.m-topLegs .dg-top,.dg-table.m-filledSeq .dg-top{animation-iteration-count:1;}',
    ' .dg-table.m-legs .dg-leg,.dg-table.m-topLegs .dg-leg,.dg-table.m-filledSeq .dg-leg,.dg-table.m-blankAsk .dg-leg{animation:dgLift 1s ease-out calc(var(--base,.6s) + var(--i) * .9s) both;}',
    ' .dg-table.m-legs .dg-post,.dg-table.m-topLegs .dg-post,.dg-table.m-filledSeq .dg-post{animation:dgPost 1s ease-out calc(var(--base,.6s) + var(--i) * .9s) both;}',
    ' .dg-table.m-topLegs,.dg-table.m-filledSeq{--base:2.8s;}',
    ' .dg-table.m-blankAsk .dg-q{animation:dgSoft 1.2s ease-out calc(.6s + var(--i) * .5s) both;}',
    ' .dg-table.m-blankAsk .dg-leg{animation-duration:1.2s;}',
    ' .dg-table.m-fill .dg-leg{animation:dgLift 1s ease-out calc(.5s + var(--i) * 1s) both;}',
    ' .dg-table.m-fill .dg-leg-x{animation:dgIn .8s ease-out calc(.5s + var(--i) * 1s) both;}',
    ' .dg-skills.m-both .dg-sk{animation:dgSoft 1s ease-out both;}',
    ' .dg-skills.m-both .dg-sk1{animation:dgLift 1.1s ease-out .6s both;}',
    ' .dg-skills.m-both .dg-sk2{animation:dgLift 1.1s ease-out 2.4s both;}',
    ' .dg-skills.m-comm .dg-sk2{animation:dgGlow 2.2s ease-in-out .5s 3;}',
    ' .dg-always.m-ask .dg-al{animation:dgGlow 2.4s ease-in-out .6s 2;}',
    ' .dg-always .dg-stamp{animation:dgStamp .7s ease-out .4s both;}',
    ' .dg-bins.m-empty .dg-q{animation:dgNext 2.4s ease-in-out .6s 3;}',
    ' .dg-bins.m-fill .dg-bin-i{animation:dgIn .8s ease-out calc(.5s + var(--i) * .9s) both;}',
    '}',
    '.dg-card.is-seq,.dg-card.is-next{z-index:1;}',
    '.dg-ln{display:inline-block;border-radius:.4em;padding:0 .25em;}',
    
    '@keyframes dgLn{0%{background:rgba(255,255,255,0);transform:none}45%{background:rgba(255,244,194,.55);transform:scale(1.04)}100%{background:rgba(255,255,255,0);transform:none}}',
    '@media (prefers-reduced-motion:no-preference){.dg-always .dg-ln,.dg-ln.seq{animation:dgLn 1.4s ease-in-out calc(.6s + var(--i) * 1.2s) both;}.dg-always.m-stamp .dg-ln{animation:none;}}',
    /* stacked pause screens: question + countdown / answer in one centred row */
    '#view .screen.stack .panel .q,#view .screen.stack .panel .rev{padding:clamp(6px,1.2vh,14px) clamp(12px,1.6vw,22px);}',
    '#view .screen.stack .panel .q .line,#view .screen.stack .panel .rev .line{display:inline;margin-right:.35em;}',
    '#view .screen.stack .panel .q.qecho .line{font-size:clamp(15px,min(1.9vw,3.2vh),24px);}',
    '#view .screen.stack .panel .cd{width:clamp(48px,9vh,84px);height:clamp(48px,9vh,84px);font-size:clamp(28px,6vh,52px);border-width:4px;margin:0;}',
    '#view .screen.stack .panel .pagehint{align-self:center;}',
    '#view .screen.stack .content:has(.cd) > .imgbox{max-height:none;}',
    'body:has(#pausebtn.is-paused) .dg,body:has(#pausebtn.is-paused) .dg *{animation-play-state:paused !important;}'
  ].join('\n');
  function injectCss() {
    if (document.getElementById('rf-dg-css')) return;
    var s = document.createElement('style'); s.id = 'rf-dg-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  injectCss();
  window.RFDiagram = { apply: apply, pick: pick, units: UNITS };
})();
