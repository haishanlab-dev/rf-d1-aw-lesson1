/* Reading Future · live HTML diagrams (replace generated PNG/JPG diagrams).
   RFDiagram.apply(view, sc, state, unitId) swaps the <img> in .imgbox for an
   HTML+CSS diagram and picks a calm, staggered highlight for the screen being
   narrated. Animations restart on every render (jump / replay / ask→reveal),
   pause with the pause button, and are skipped for prefers-reduced-motion. */
(function () {
  'use strict';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var MAP_COLORS = ['#4AA8E8', '#FFD84D', '#6CC08B', '#F28BA0'];
  var UNITS = {
    unit1: {
      main: 'Animals can help farmers know about the weather.',
      legs: [['stretch', 'their necks'], ['smell', 'the air'], ['eat', 'a lot'], ['get', 'very fat']],
      always: ['If rabbits eat a lot,', 'must winter be coming?'],
      bins: { a: 'It will rain', b: 'Long, cold winter',
        aItems: ['Cows and horses smell the air.', 'Cows and horses stretch their necks.'],
        bItems: ['The rabbits are getting very fat.', 'The rabbits are eating a lot.'] }
    },
    unit2: { main: 'Kinds of clouds: not all clouds make rain.', always: ['If it is cloudy,', 'must it rain?'] },
    unit3: { main: 'Weather from clouds: rain, snow, and hail.', always: ['If it is cold,', 'must it snow?'] },
    unit4: { main: 'Raining fish! A tornado probably carried them.', always: ['Must it always be a tornado', 'when fish fall?'] },
    scienceReview: {
      main: 'Animals can help farmers know about the weather.',
      legs: [['stretch', 'their necks'], ['smell', 'the air'], ['eat', 'a lot'], ['get', 'very fat']],
      always: ['If you see clouds,', 'must it rain?'],
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
        '<div class="dg-card dg-c' + i + (m ? ' is-' + m : '') + '" style="--c:' + MAP_COLORS[i] + ';--d:' + (marks.seqDelay ? marks.seqDelay(i) : 0) + 's">' +
        '<div class="dg-num">' + (i + 1) + '</div><div class="dg-lab">' + esc(labels[i]) + '</div>' +
        (m === 'done' ? '<div class="dg-check" aria-label="done">✓</div>' : '') + '</div>';
    }
    h += '</div>' + (foot ? '<div class="dg-foot">' + esc(foot) + '</div>' : '') + '</div>';
    return h;
  }
  function tableDg(u, mode) {
    // mode: top | legs | topLegs | blankAsk | fill | filledSeq
    var filled = mode === 'fill' || mode === 'filledSeq';
    var legs = u.legs || [['', ''], ['', ''], ['', ''], ['', '']];
    var h = '<div class="dg dg-table m-' + mode + '"><div class="dg-top"><div class="dg-top-t">Main Idea = table top</div>' +
      '<div class="dg-top-s">' + esc(u.main) + '</div></div><div class="dg-legs">';
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
      '<div class="dg-sk dg-sk1"><div class="dg-sk-t">Critical Thinking</div><div class="dg-sk-b">' + lns(['Ask questions.', 'Do not just believe.', 'Check the facts.'], mode === 'both' ? 1 : -1) + '</div><div class="dg-sk-q">“Is it always true?”</div></div>' +
      '<div class="dg-sk dg-sk2"><div class="dg-sk-t">Communication</div><div class="dg-sk-b">' + lns(['Share your ideas.', 'Listen to others.', 'Say it clearly.'], mode === 'both' ? 5 : 1) + '</div><div class="dg-sk-q">“Tell a friend.”</div></div>' +
      '</div></div>';
  }
  function alwaysDg(lines, stamp, mode) {
    return '<div class="dg dg-always m-' + mode + '"><div class="dg-al"><div class="dg-al-t dg-ln" style="--i:0">Is it always true?</div><div class="dg-al-b">' +
      lines.map(function (l, k) { return '<span class="dg-ln" style="--i:' + (k + 1) + '">' + esc(l) + '</span>'; }).join('<br>') +
      '</div><div class="dg-al-s"><span class="dg-ln" style="--i:' + (lines.length + 1) + '">Think carefully!</span></div>' +
      (stamp ? '<div class="dg-stamp">' + esc(stamp) + '</div>' : '') + '</div></div>';
  }
  function binsDg(b, mode) {
    // mode: empty | fill (fly in) | filled (static)
    function col(cls, t, items, base) {
      var h = '<div class="dg-bin ' + cls + (mode === 'empty' ? '' : ' is-filled') + '"><div class="dg-bin-t">' + esc(t) + '</div>';
      if (mode === 'empty') h += '<div class="dg-q">?</div>';
      else items.forEach(function (x, k) { h += '<div class="dg-bin-i" style="--i:' + (base + k) + '">' + esc(x) + '</div>'; });
      return h + '</div>';
    }
    return '<div class="dg dg-bins m-' + mode + '"><div class="dg-title">' + (mode === 'empty' ? 'Sort the sentences' : 'Sorted!') + '</div><div class="dg-row2">' +
      col('dg-bin-a', b.a, b.aItems, 0) + col('dg-bin-b', b.b, b.bItems, 2) + '</div></div>';
  }

  /* ---------- per-screen choice ---------- */
  function pick(sc, state, unit) {
    var u = UNITS[unit] || UNITS.unit1;
    var img = state === 'reveal' && sc.rimg ? sc.rimg : sc.img;
    var zh = sc.zh || '';
    if (img === 'map_all.png') {
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
      else if (zh === 'Great job!') { marks = ['done', 'done', 'done', 'done']; marks.seqDelay = function (i) { return 0.4 + i * 0.6; }; }
      else { marks = ['seq', 'seq', 'seq', 'seq']; marks.seqDelay = function (i) { return (sc.type === 'retell' && state === 'reveal' ? 0.3 : 0.8) + i * 1.3; }; }
      return { html: mapDg(labels, foot, marks), what: 'map' };
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
      return { html: alwaysDg(lines, stamp, stamp ? 'stamp' : 'ask'), what: 'always' + (stamp ? ':stamp' : '') };
    }
    if ((img === 'bins_empty.jpg' || img === 'bins_filled.jpg') && u.bins) {
      var bm = img === 'bins_empty.jpg' ? 'empty' : (sc.type === 'pause' && state === 'reveal' ? 'fill' : 'filled');
      return { html: binsDg(u.bins, bm), what: 'bins:' + bm };
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
      if (scr && !sc.map && isShort(sc)) scr.classList.add('stack');
      return r.what;
    } catch (e) { return null; }
  }

  var CSS = [
    '.imgbox.has-dg{padding:clamp(8px,1.4vw,18px);background:#F7FBFF;container-type:size;}',
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
    '.dg-check{position:absolute;top:-2cqmin;right:-2cqmin;width:clamp(22px,8cqmin,48px);height:clamp(22px,8cqmin,48px);border-radius:50%;',
    ' background:#4F9A6B;color:#fff;font-weight:900;font-size:clamp(14px,5cqmin,30px);display:grid;place-items:center;border:3px solid #fff;',
    ' box-shadow:0 2px 6px rgba(0,0,0,.18);}',
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
