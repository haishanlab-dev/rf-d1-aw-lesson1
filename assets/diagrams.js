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
  var PALE = { rabbit: 1, snowman: 1, cloud: 1, cloud_snow: 1, cloud_rain: 1, snowflake: 1, sun_cloud: 1, wind_face: 1, up_arrow: 1, alarm_clock: 1, leaf_wind: 1 };
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

  /* v3 illustrated scenes (mockup standard). e: [name, left%, top%, width%, rotateDeg] inside a cluster box */
  var SCENES = {
    unit1: { l: { e: [['rabbit', 14, 0, 64], ['carrot', 70, 50, 26, -18], ['carrot', 0, 60, 20, 24], ['leafy_green', 46, 64, 22]], lab: 'eats a lot' },
             r: { e: [['cloud_snow', 8, -4, 66], ['snowman', 40, 40, 46], ['snowflake', 84, 22, 16, 12], ['snowflake', 0, 62, 12]], lab: 'winter?' },
             q: 'If rabbits eat a lot, must winter be coming?', key: 'must' },
    unit2: { l: { e: [['cloud', 6, 4, 66], ['cloud', 52, 40, 44]], lab: 'cloudy' },
             r: { e: [['cloud_rain', 10, 0, 74], ['cloud_rain', 64, 52, 30, 6]], lab: 'rain?' },
             q: 'If it is cloudy, must it rain?', key: 'must' },
    unit3: { l: { e: [['thermometer', 22, 0, 58], ['cloud', 62, 52, 36]], lab: 'cold' },
             r: { e: [['cloud_snow', 8, -4, 66], ['snowman', 44, 40, 44], ['snowflake', 0, 58, 14, -10]], lab: 'snow?' },
             q: 'If it is cold, must it snow?', key: 'must' },
    unit4: { l: { e: [['fish', 8, 2, 46, -28], ['fish', 50, 24, 42, 18], ['fish', 18, 54, 38, -8]], lab: 'fish fall' },
             r: { e: [['tornado', 14, -2, 70], ['fish', 66, 18, 26, 30]], lab: 'tornado?' },
             q: 'Must it always be a tornado when fish fall?', key: 'always' },
    scienceReview: { l: { e: [['cloud', 6, 4, 66], ['cloud', 52, 40, 44]], lab: 'clouds' },
             r: { e: [['cloud_rain', 10, 0, 74], ['cloud_rain', 64, 52, 30, 6]], lab: 'rain?' },
             q: 'If you see clouds, must it rain?', key: 'must' }
  };
  function sxEl(e, b) {
    return '<span class="sx-e" style="left:' + e[1] + '%;top:' + e[2] + '%;width:' + e[3] + '%;' + (e[4] ? 'transform:rotate(' + e[4] + 'deg);' : '') + '">' + ill(e[0], 'ill-sx', b) + '</span>';
  }
  function sxCluster(c, b0, side) {
    return '<div class="sx-side sx-' + side + '"><div class="sx-cl">' + c.e.map(function (e, j) { return sxEl(e, b0 + j); }).join('') + '</div>' +
      (c.lab ? '<div class="sx-lab" style="--i:' + (side === 'l' ? 1 : 3) + '">' + esc(c.lab) + '</div>' : '') + '</div>';
  }
  function sxQ(sx) {
    var t = esc(sx.q), k = sx.key;
    return k ? t.replace(new RegExp('\\b(' + k + ')\\b', 'i'), '<em>$1</em>') : t;
  }
  function alwaysScene(sx, mode) {
    return '<div class="dg sx sx-always m-' + mode + '">' +
      '<div class="sx-row">' + sxCluster(sx.l, 0, 'l') + '<div class="sx-ar" aria-hidden="true"></div>' +
      '<div class="sx-side sx-m"><div class="sx-cl sx-clm">' + sxEl(['thinking', 0, 6, 100], 4) + sxEl(['question', 66, -30, 44, 14], 5) + '</div></div>' +
      '<div class="sx-ar" aria-hidden="true"></div>' + sxCluster(sx.r, 6, 'r') + '</div></div>';
  }

  function tableScene(u, mode, unit) {
    // Drawn wooden table: the farmer & cow stand on the top (main idea), each leg is a post
    // with a white-pill label (Detail ? / the detail).
    var filled = mode === 'fill' || mode === 'filledSeq';
    var legs = u.legs || [['', ''], ['', ''], ['', ''], ['', '']];
    var tops = u.topIll || ['farmer', 'cow'];
    var h = '<div class="dg sx sx-table m-' + mode + '"><div class="sx-tb">' +
      '<div class="sx-tb-ill">' + tops.map(function (n, k) { return '<span class="sx-tb-i sx-tb-i' + k + '">' + ill(n, 'ill-sx', k) + '</span>'; }).join('') + '</div>' +
      '<div class="sx-top"><span class="sx-tag">Main idea</span><span class="sx-top-s">' + esc(u.main) + '</span></div><div class="sx-legs">';
    for (var i = 0; i < 4; i++) {
      h += '<div class="sx-leg" style="--i:' + i + '"><div class="sx-post"></div><div class="sx-lab sx-leg-l' + (filled ? ' is-filled' : '') + '" style="--i:' + (i + 2) + '">' +
        (filled ? esc(legs[i][0]) + ' ' + esc(legs[i][1]) : 'Detail <b>?</b>') + '</div></div>';
    }
    return h + '</div></div></div>';
  }
  function skillsScene(mode) {
    function grp(cls, ills, name, lines, base) {
      return '<div class="sx-sk ' + cls + '"><div class="sx-cl sx-sk-cl">' + ills.map(function (e, j) { return sxEl(e, base + j); }).join('') + '</div>' +
        '<div class="sx-lab sx-sk-t">' + esc(name) + '</div><div class="sx-sk-b">' + lns(lines, base + 1) + '</div></div>';
    }
    var ct = grp('sx-sk1', [['thinking', 14, 6, 66], ['question', 70, -6, 30, 14]], 'Critical Thinking', ['Ask questions.', 'Do not just believe.', 'Check the facts.'], 0);
    var cm = grp('sx-sk2', [['speaking', 0, 8, 58], ['child', 56, 26, 44]], 'Communication', ['Share your ideas.', 'Listen to others.', 'Say it clearly.'], mode === 'both' ? 4 : 0);
    return '<div class="dg sx sx-skills m-' + mode + '"><div class="sx-sk-row">' + (mode === 'comm' ? cm : ct + cm) + '</div></div>';
  }

  function fishRainScene() {
    // Waterspout lifts fish from the sea → fish fall onto roofs. Pure CSS/Noto, light weight.
    var fish = '';
    var falls = [[12, 8, 1.1, 0], [28, 22, .9, .4], [46, 4, 1.2, .2], [62, 18, .85, .7], [78, 10, 1.05, .3], [88, 28, .75, .55]];
    falls.forEach(function (f, i) {
      fish += '<span class="fr-fish fr-fall" style="left:' + f[0] + '%;--d:' + f[1] + '%;--s:' + f[2] + ';--w:' + f[3] + 's">' + ill('fish', 'ill-sx', i) + '</span>';
    });
    return '<div class="dg sx sx-fish">' +
      '<div class="fr-sky" aria-hidden="true"></div><div class="fr-sea" aria-hidden="true"></div>' +
      '<div class="fr-spout" aria-hidden="true"><span class="fr-spout-core"></span></div>' +
      '<div class="fr-lift">' +
        '<span class="fr-fish fr-up" style="--x:42%;--w:0s">' + ill('fish', 'ill-sx', 10) + '</span>' +
        '<span class="fr-fish fr-up" style="--x:50%;--w:.35s">' + ill('fish', 'ill-sx', 11) + '</span>' +
        '<span class="fr-fish fr-up" style="--x:58%;--w:.7s">' + ill('fish', 'ill-sx', 12) + '</span>' +
      '</div>' +
      '<div class="fr-town" aria-hidden="true"><span class="fr-roof r1"></span><span class="fr-roof r2"></span><span class="fr-roof r3"></span></div>' +
      '<div class="fr-fallbox">' + fish + '</div>' +
      '<div class="fr-torn">' + ill('tornado', 'ill-sx', 20) + '</div></div>';
  }

  /* ---------- builders ---------- */
  function lns(arr, start) {
    return arr.map(function (l, k) { return '<span class="dg-ln' + (start < 0 ? '' : ' seq') + '" style="--i:' + (start + k) + '">' + esc(l) + '</span>'; }).join('<br>');
  }
  var MAP_ILLS = ['sun_cloud', 'speaking', 'thinking', 'child'];
  function mapCard(i, label, m, marks) {
    return '<' + (marks.tap ? 'button type="button" data-part="' + (i + 1) + '" aria-label="Go to part ' + (i + 1) + '"' : 'div') +
      ' class="dg-card dg-c' + i + (m ? ' is-' + m : '') + '" style="--c:' + MAP_COLORS[i] + ';--d:' + (marks.seqDelay ? marks.seqDelay(i) : 0) + 's" data-sess="' + (i < 2 ? '1' : '2') + '">' +
      '<div class="dg-num">' + (i + 1) + '</div><div class="dg-lab">' + esc(label) + '</div>' +
      '<div class="dg-card-ill" aria-hidden="true">' + ill(MAP_ILLS[i], 'ill-map', i) + '</div>' +
      (m === 'done' ? '<div class="dg-check" aria-label="done">' + ill('check', 'ill-check', i) + '</div>' : '') +
      '</' + (marks.tap ? 'button' : 'div') + '>';
  }
  function mapDg(labels, foot, marks) {
    // One continuous 4-card row + two session labels under cols 1–2 / 3–4 (no nested halves).
    var labs = (foot && typeof foot === 'object') ? foot : { s1: 'Session 1 · Parts 1–2', s2: 'Session 2 · Parts 3–4' };
    var h = '<div class="dg dg-map">';
    h += '<div class="dg-map-row">';
    h += mapCard(0, labels[0], marks[0], marks);
    h += '<div class="dg-arrow" aria-hidden="true">▸</div>';
    h += mapCard(1, labels[1], marks[1], marks);
    h += '<div class="dg-arrow dg-arrow-mid" aria-hidden="true">▸</div>';
    h += mapCard(2, labels[2], marks[2], marks);
    h += '<div class="dg-arrow" aria-hidden="true">▸</div>';
    h += mapCard(3, labels[3], marks[3], marks);
    h += '</div>';
    h += '<div class="dg-map-foots">';
    h += '<div class="dg-sess-lab" data-sess="1">' + esc(labs.s1 || '') + '</div>';
    h += '<div class="dg-sess-lab" data-sess="2">' + esc(labs.s2 || '') + '</div>';
    h += '</div></div>';
    return h;
  }
  function tableDg(u, mode) {
    // mode: top | legs | topLegs | blankAsk | fill | filledSeq
    // Self-explanatory drawing: icons stand on the table top ("Main idea" + sentence),
    // four wide legs ("Detail"). No repeated captions – the one hint line is in the panel.
    var filled = mode === 'fill' || mode === 'filledSeq';
    var legs = u.legs || [['', ''], ['', ''], ['', ''], ['', '']];
    var h = '<div class="dg dg-table m-' + mode + '">' +
      (u.topIll ? '<div class="dg-top-ill">' + u.topIll.map(function (n, k) { return ill(n, 'ill-top', k); }).join('') + '</div>' : '') +
      '<div class="dg-top"><div class="dg-top-t">Main idea</div><div class="dg-top-s">' + esc(u.main) + '</div></div><div class="dg-legs">';
    for (var i = 0; i < 4; i++) {
      h += '<div class="dg-legcol" style="--i:' + i + '"><div class="dg-post"></div><div class="dg-leg' + (filled ? ' is-filled' : '') + '">' +
        '<div class="dg-leg-t">Detail</div>' +
        (filled ? '<div class="dg-leg-x">' + esc(legs[i][0]) + ' ' + esc(legs[i][1]) + '</div>' : '<div class="dg-q">?</div>') +
        '</div></div>';
    }
    return h + '</div></div>';
  }
  function skillsDg(mode) {
    // Plain coloured text columns with a big Noto icon each (not cards).
    var ct = '<div class="dg-sk dg-sk1"><div class="dg-sk-h">' + ill('thinking', 'ill-sk', 0) + '<div class="dg-sk-t">Critical Thinking</div></div><div class="dg-sk-b">' + lns(['Ask questions.', 'Do not just believe.', 'Check the facts.'], 1) + '</div></div>';
    var cm = '<div class="dg-sk dg-sk2"><div class="dg-sk-h">' + ill('speaking', 'ill-sk', 1) + '<div class="dg-sk-t">Communication</div></div><div class="dg-sk-b">' + lns(['Share your ideas.', 'Listen to others.', 'Say it clearly.'], mode === 'both' ? 5 : 1) + '</div></div>';
    return '<div class="dg dg-skills m-' + mode + '"><div class="dg-row2">' + (mode === 'comm' ? cm : ct + cm) + '</div></div>';
  }
  function sceneHtml(sc) {
    if (!sc) return '';
    var k = 0;
    function side(a) { return '<div class="dg-sc-side">' + a.map(function (n, j) { return ill(n, 'ill-sc' + (j ? ' ill-sm' : ''), k++); }).join('') + '</div>'; }
    return '<div class="dg-scene">' + side(sc.l) + '<div class="dg-sc-ar" aria-hidden="true"></div>' + ill('thinking', 'ill-sc ill-mid', k++) + '<div class="dg-sc-ar" aria-hidden="true"></div>' + side(sc.r) + '</div>';
  }
  function alwaysDg(lines, mode, scene) {
    // Big illustration row; optional question as rose text (no pink block).
    return '<div class="dg dg-always m-' + mode + (scene ? ' has-scene' : '') + (lines.length ? '' : ' no-text') + '">' + sceneHtml(scene) +
      (lines.length ? '<div class="dg-al"><div class="dg-al-b">' + lines.map(function (l, k) { return '<span class="dg-ln" style="--i:' + (k + 1) + '">' + esc(l) + '</span>'; }).join('<br>') + '</div></div>' : '') +
      '</div>';
  }
  function binsDg(b, mode, bi) {
    // mode: empty | fill (fly in) | filled (static)
    function col(cls, t, items, base, icon) {
      var h = '<div class="dg-bin ' + cls + (mode === 'empty' ? '' : ' is-filled') + '"><div class="dg-bin-h">' + (icon ? ill(icon, 'ill-bin', base) : '') + '<div class="dg-bin-t">' + esc(t) + '</div></div>';
      if (mode === 'empty') h += '<div class="dg-q">?</div>';
      else items.forEach(function (x, k) { h += '<div class="dg-bin-i" style="--i:' + (base + k) + '">' + esc(x) + '</div>'; });
      return h + '</div>';
    }
    return '<div class="dg dg-bins m-' + mode + '"><div class="dg-row2">' +
      col('dg-bin-a', b.a, b.aItems, 0, bi && bi.a) + col('dg-bin-b', b.b, b.bItems, 2, bi && bi.b) + '</div></div>';
  }


  /* ---------- Reading Skills pages (textbook scans → HTML) ----------
     Charts: book word bank + chart (Main idea/Details · KWL · First→Last), blanks numbered 1–3
     to match the tap rows in the panel; reveal fills the blanks. Quick Check: picture tiles in
     the same order as the tap buttons (the panel already has the question + words). */
  var CHARTS = {
    'chart_p16.jpg': { kind: 'mi', bank: ['Cloudy', 'fluffy', 'Storm', 'all'], rows: [
      { tag: 'Main Idea', main: true, p: ['Not ', { n: 1, a: 'all' }, ' clouds make rain.'] },
      { tag: 'Detail 1', p: ['Some clouds are high. They are thin and long. They don\u2019t make rain.'] },
      { tag: 'Detail 2', p: ['Other clouds are low. They are white and ', { n: 2, a: 'fluffy' }, '. They don\u2019t make rain.'] },
      { tag: 'Detail 3', p: [{ n: 3, a: 'Storm' }, ' clouds are dark and gray. These clouds make rain!'] }] },
    'chart_p20.jpg': { kind: 'kwl', bank: ['Drop', 'Snow', 'happens', 'dangerous'], rows: [
      { tag: 'What I Know', p: ['Rain ', { n: 1, a: 'happens' }, ' when it\u2019s warm.'] },
      { tag: 'What I Want to Know', p: ['When does other weather happen?'] },
      { tag: 'What I Learned', p: [{ n: 2, a: 'Snow' }, ' happens when it\u2019s cold.', '\n', 'Hail happens when it\u2019s cold or warm. It can be ', { n: 3, a: 'dangerous' }, '.'] }] },
    'chart_p24.jpg': { kind: 'seq', bank: ['fish', 'surprised', 'sky', 'tornado'], rows: [
      { tag: 'First', p: ['A ', { n: 1, a: 'tornado' }, ' picked up fish.'] },
      { tag: 'Next', p: ['It moved the fish into the ', { n: 2, a: 'sky' }, '.'] },
      { tag: 'Then', p: ['The tornado carried the fish far.'] },
      { tag: 'Last', p: ['People in Sri Lanka were ', { n: 3, a: 'surprised' }, ' when the fish fell on their homes.'] }] }
  };
  var QCHECK = {
    // tiles follow the tap-button order in interact-data.js (answer read from there when present)
    'readskills_p15.jpg': { skill: 'Main Idea & Details', answer: 1, tiles: [{ e: ['cloud', 'cloud'] }, { e: ['storm', 'cloud_rain'] }] },
    'readskills_p19.jpg': { skill: 'Activating Prior Knowledge', answer: 1, tiles: [{ e: ['cloud_rain'] }, { drops: true }] },
    'readskills_p23.jpg': { skill: 'Retelling', answer: 0, tiles: [{ e: ['fish', 'fish'], sky: true }, { e: ['cloud_snow', 'snowflake'] }] }
  };
  function chartDg(c, mode) {
    var rev = mode === 'reveal', bi = 0, used = {};
    c.rows.forEach(function (r) { r.p.forEach(function (x) { if (x && x.a) used[x.a] = 1; }); });
    function para(parts) {
      var out = '', glue = '';
      parts.forEach(function (x) {
        if (x === '\n') { out += '<br>'; return; }
        if (typeof x === 'string') {
          // keep a blank and the punctuation right after it on one line
          var m = glue ? /^([.,!?\u2019]+)([\s\S]*)$/.exec(x) : null;
          if (glue) { out += '<span class="ch-nw">' + glue + (m ? esc(m[1]) : '') + '</span>'; glue = ''; x = m ? m[2] : x; }
          out += esc(x); return;
        }
        if (glue) { out += glue; }
        var k = bi++;
        glue = '<span class="ch-blank' + (rev ? ' is-filled' : '') + '" data-n="' + x.n + '" style="--k:' + k + '">' +
          '<span class="ch-n">' + x.n + '</span><span class="ch-a">' + (rev ? esc(x.a) : '') + '</span></span>';
      });
      return out + glue;
    }
    var h = '<div class="dg ch ch-' + c.kind + ' m-' + (rev ? 'reveal' : 'ask') + '">';
    h += '<div class="ch-bank">' + c.bank.map(function (w, k) {
      return '<span class="ch-w' + (rev ? (used[w] ? ' is-used' : ' is-extra') : '') + '" style="--k:' + k + '">' + esc(w) + '</span>';
    }).join('') + '</div>';
    h += '<div class="ch-body">';
    c.rows.forEach(function (r, i) {
      h += (c.kind === 'seq' && i ? '<div class="ch-arrow" aria-hidden="true" style="--i:' + i + '"></div>' : '') +
        '<div class="ch-row' + (r.main ? ' is-main' : '') + '" style="--i:' + i + '"><div class="ch-tag">' + esc(r.tag) + '</div>' +
        '<div class="ch-t">' + para(r.p) + '</div></div>';
    });
    h += '</div><div class="ch-hint">One word is extra.</div></div>';
    return h;
  }
  function qcDg(q, mode, answer) {
    var rev = mode === 'reveal';
    var h = '<div class="dg qc m-' + (rev ? 'reveal' : 'ask') + '"><div class="qc-skill">' + esc(q.skill) + '</div><div class="qc-row">';
    q.tiles.forEach(function (t, k) {
      var art = '';
      if (t.drops) art = '<span class="qc-drops" aria-hidden="true"><i></i><i></i><i></i></span>';
      else art = t.e.map(function (n, j) { return '<span class="qc-e' + (t.sky ? ' qc-fall qc-fall' + j : '') + '">' + ill(n, 'ill-qc' + (j ? ' ill-qc2' : ''), k * 2 + j) + '</span>'; }).join('');
      h += '<div class="qc-tile qc-t' + k + (rev ? (k === answer ? ' is-right' : ' is-off') : '') + '" data-k="' + k + '" style="--k:' + k + '">' +
        (t.sky ? '<span class="qc-cloud">' + ill('cloud', 'ill-qc ill-qcc', 9) + '</span>' : '') +
        '<div class="qc-art">' + art + '</div>' +
        '<span class="qc-tick" aria-hidden="true">\u2713</span></div>';
    });
    return h + '</div></div>';
  }
  function ixAnswer(unit, sc, dflt) {
    try { var c = window.RF_IX.units[unit][sc.i]; if (c && c.kind === 'choice') return c.answer; } catch (e) {}
    return dflt;
  }
  // Mirror the tap rows / buttons in the panel onto the drawing (fill a blank / tick a tile).
  function linkIx(view, box, r) {
    var pn = view.querySelector('#panel'); if (!pn || !window.MutationObserver) return;
    var mo = new MutationObserver(function () {
      if (!box.isConnected) { mo.disconnect(); return; }
      if (r.chart) {
        pn.querySelectorAll('.ix-row.is-done').forEach(function (row) {
          var n = (+row.getAttribute('data-row')) + 1;
          var b = box.querySelector('.ch-blank[data-n="' + n + '"]');
          if (b && !b.classList.contains('is-filled')) {
            var a = null; r.chart.rows.forEach(function (rr) { rr.p.forEach(function (x) { if (x && x.n === n) a = x.a; }); });
            b.querySelector('.ch-a').textContent = a || ''; b.classList.add('is-filled', 'is-live');
            box.querySelectorAll('.ch-w').forEach(function (w) { if (w.textContent === a) w.classList.add('is-used'); });
          }
        });
      } else if (r.qc) {
        var ok = pn.querySelector('.ix-opt.ix-ok,.ix-opt.ix-answer');
        if (ok) {
          var k = +ok.getAttribute('data-k');
          box.querySelectorAll('.qc-tile').forEach(function (t) { var me = +t.getAttribute('data-k') === k; t.classList.toggle('is-right', me); t.classList.toggle('is-off', !me); });
          box.querySelector('.qc').classList.add('is-live');
        }
      }
    });
    mo.observe(pn, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
  }

  /* ---------- per-screen choice ---------- */
  function isEnd(sc) {
    if (!sc || !sc.map) return false;
    var zh = sc.zh || '';
    var en = sc.en || '';
    return zh === 'Session 1 done' || zh === 'Session 2 done' || zh === 'Great job!';
  }
  function pick(sc, state, unit) {
    var u = UNITS[unit] || UNITS.unit1;
    var img = state === 'reveal' && sc.rimg ? sc.rimg : sc.img;
    var zh = sc.zh || '';
    var en = sc.en || '';
    var end = isEnd(sc);
    if (img === 'map_all.png' || end) {
      var labels, foot = { s1: 'Session 1 · Parts 1–2', s2: 'Session 2 · Parts 3–4' }, marks = [];
      if (unit === 'scienceReview') {
        foot = { s1: 'Parts 1–2', s2: 'Parts 3–4' };
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
        if (unit === 'scienceReview') foot = { s1: 'Parts 1–2', s2: 'Parts 3–4' };
      }
      return { html: mapDg(labels, foot, marks), what: end ? 'map:end' : 'map', map: !!sc.map || end, end: end };
    }

    // ---- Textbook crop → HTML text + Noto/photo (no page scans) ----
    if (zh === 'Warm-Up' || /^warmup_/i.test(img)) {
      return { html: textScene(warmBody(unit), { photo: warmPhoto(unit), tip: warmHint(unit) }), what: 'tx:warm', hint: '', scene: true };
    }
    if (zh === 'Academic Objectives' || /^ao_/i.test(img)) {
      var ao = (sc.body && sc.body.length) ? sc.body : ['Common kinds of weather', 'Unusual kinds of weather', 'How weather affects the places we live'];
      return { html: textScene(ao, { ills: ['sun', 'cloud_rain', 'storm', 'snowflake'], hero: true }), what: 'tx:ao', hint: '', scene: true };
    }
    if (zh === 'New Words' || zh === 'Word Bank' || /^newwords_/i.test(img)) {
      return { html: textScene(null, { chips: wordsChips(unit) }), what: 'tx:words', hint: 'Look, say, and remember.', scene: true };
    }
    if (zh === 'Story Recap') {
      var rcIll = unit === 'unit3' ? ['cloud_rain', 'snowflake', 'storm'] : (unit === 'unit4' ? ['fish', 'tornado', 'cloud_rain'] : ['cow', 'horse', 'farmer']);
      return { html: textScene(sc.body && sc.body.length ? sc.body : ['Remember the story'], { ills: rcIll, hero: true }), what: 'tx:recap', hint: '', scene: true };
    }
    if (zh === 'Weather & Animals' || zh === 'Cloud Spotting' || zh === 'Europe Weather' || zh === 'News Report' || (/^project_/i.test(img) && sc.type === 'normal')) {
      var pIll = unit === 'unit2' ? ['cloud', 'storm', 'sun_cloud'] : (unit === 'unit3' ? ['cloud_rain', 'cloud_snow', 'sun'] : (unit === 'unit4' ? ['fish', 'tornado', 'speaking'] : ['cow', 'horse', 'farmer']));
      var pBody = (sc.body && sc.body.length) ? sc.body : ['Project time!'];
      return { html: textScene(pBody, { ills: pIll, hero: true }), what: 'tx:project', hint: 'Get ready to try it.', scene: true };
    }
    if (/^project_/i.test(img)) {
      var pIllB = unit === 'unit2' ? ['cloud', 'speaking'] : (unit === 'unit3' ? ['cloud_rain', 'speaking'] : (unit === 'unit4' ? ['fish', 'speaking'] : ['cow', 'rabbit', 'speaking']));
      return { html: textScene([], { ills: pIllB, hero: true }), what: 'tx:projectbg', scene: true };
    }
    if (zh === 'Retell Skill') {
      return { html: textScene(sc.body && sc.body.length ? sc.body : ['First → Next → Then → Last'], { ills: ['speaking', 'thinking', 'child'], hero: true }), what: 'tx:retellskill', hint: '', scene: true };
    }
    // Lesson / unit title openers (and SR unit review cards that used title crops)
    if (/^title_p/i.test(img) || /^unit\d+_title_/i.test(img) || (unit === 'scienceReview' && /^Unit\s*\d$/i.test(zh) && sc.type === 'normal')) {
      if (sc.type === 'normal') {
        var tBody = (sc.body && sc.body.length) ? sc.body : [zh || 'Lesson'];
        // Lesson openers: real hero photo (image-led). SR unit review cards keep short body under photo.
        return { html: textScene(tBody, { photo: titlePhoto(unit, sc), hero: true }), what: 'tx:title', hint: '', scene: true };
      }
      // pause screens that used a title crop as decoration → soft Noto backdrop, keep Q in panel
      return { html: textScene([], { photo: titlePhoto(unit, sc), hero: true }), what: 'tx:titlebg', hint: undefined, scene: true };
    }
    if (/^opener_/i.test(img) && sc.type !== 'normal') {
      return { html: textScene([], { photo: titlePhoto(unit), hero: true }), what: 'tx:opener', scene: true };
    }
    if (/^vocabreview_/i.test(img)) {
      return { html: textScene([], { ills: ['thinking', 'check', 'rabbit'] }), what: 'tx:vocab', scene: true };
    }
    if (/^rc_p/i.test(img)) {
      return { html: textScene([], { ills: ['thinking', 'check'] }), what: 'tx:rc', scene: true };
    }

    if (CHARTS[img]) {
      var chm = state === 'reveal' ? 'reveal' : 'ask';
      return { html: chartDg(CHARTS[img], chm), what: 'chart:' + chm, chart: CHARTS[img], wide: 'dg-chart', noStack: true };
    }
    if (QCHECK[img]) {
      var qm = state === 'reveal' ? 'reveal' : 'ask';
      return { html: qcDg(QCHECK[img], qm, ixAnswer(unit, sc, QCHECK[img].answer)), what: 'qc:' + qm, qc: QCHECK[img], wide: 'dg-qcheck', noStack: true };
    }
    if (img === 'table_blank.png' || img === 'table_filled.png') {
      // Short definition tips → sticky prop; table drawing stays for Table Top & Legs / Find the Legs
      if (sc.type === 'normal' && /^Main Idea/.test(zh) && !/comprehension|chart|reading/i.test(zh+en)) {
        return { html: tipProp(sc.body && sc.body.length ? sc.body : ['Main idea = what the WHOLE story is about'], 'yellow'), what: 'tip:main', hint: '', scene: true };
      }
      if (sc.type === 'normal' && /^Details?$/.test(zh)) {
        return { html: tipProp(sc.body && sc.body.length ? sc.body : ['Detail = one little fact'], 'mint'), what: 'tip:detail', hint: '', scene: true };
      }
      var mode = 'topLegs';
      if (/^Main Idea/.test(zh)) mode = 'top';
      else if (/^Details?$/.test(zh)) mode = 'legs';
      else if (zh === 'Find the Legs') mode = state === 'reveal' ? 'fill' : 'blankAsk';
      else if (img === 'table_filled.png') mode = 'filledSeq';
      var th;
      if (sc.type === 'normal') th = mode === 'filledSeq' ? 'Details hold up the main idea.' : (mode === 'topLegs' ? 'Legs hold up the top!' : (sc.body || [])[(sc.body || []).length - 1] || '');
      else if (state === 'reveal') th = 'These details hold up the top!';
      return { html: tableScene(u, mode, unit), what: 'table:' + mode, hint: th, scene: true };
    }
    if (img === 'two_skills.jpg') {
      var m = zh === 'Tell a friend' ? 'comm' : 'both';
      if (m === 'both' && sc.type === 'normal') {
        return { html: tipProp(sc.body && sc.body.length ? sc.body : ['Critical Thinking = ask and check', 'Communication = share and listen'], 'blue'), what: 'tip:skills', hint: '', scene: true };
      }
      var sh = m === 'comm' ? (sc.body || []).filter(function (l) { return !/speak clearly|listen/i.test(l); }).join(' ') : '';
      return { html: skillsScene(m), what: 'skills:' + m, hint: sh, scene: true };
    }
    if (img === 'always.jpg') {
      // Tip screen (Critical Thinking definition) → sticky prop; pause ask/reveal keeps the scene
      if (sc.type === 'normal') {
        return { html: tipProp(sc.body && sc.body.length ? sc.body : ['Do not just believe.', 'Ask questions.', 'Check the facts.'], 'pink'), what: 'tip:always', hint: '', scene: true };
      }
      var sx = SCENES[unit] || SCENES.unit1;
      var amode = state === 'reveal' ? 'stamp' : 'ask';
      return { html: alwaysScene(sx, amode), what: 'always:' + state, scene: true,
        sceneQ: sxQ(sx), sub: '',
        ans: (sc.reveal || []).filter(function (l) { return !/smart/i.test(l); }).join(' ') };
    }
    if (img === 'fish_road.jpg') {
      var fh = sc.type === 'normal' ? ((sc.body || []).join(' ') || 'Fish fell from the sky!') : undefined;
      return { html: fishRainScene(), what: 'fish:rain', hint: fh, scene: true };
    }
    if ((img === 'bins_empty.jpg' || img === 'bins_filled.jpg') && u.bins) {

      var bm = img === 'bins_empty.jpg' ? 'empty' : (sc.type === 'pause' && state === 'reveal' ? 'fill' : 'filled');
      return { html: binsDg(u.bins, bm, u.binIll), what: 'bins:' + bm, hint: bm === 'fill' ? 'All sorted!' : undefined };
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

  var mapTok = 0;
  // Char-proportional positions of "Part 1…" / "Part 3…" / closing tap hint in each map narration.
  var MAP_TIMING = {
    'unit1:1': [0.36, 0.54, 0.64], 'unit1:18': [null, 0.23, 0.81],
    'unit2:1': [0.40, 0.62, 0.77], 'unit2:14': [null, 0.26, 0.79],
    'unit3:1': [0.32, 0.57, 0.74], 'unit3:13': [null, 0.18, 0.75],
    'unit4:1': [0.26, 0.47, 0.80], 'unit4:14': [null, 0.26, 0.85],
    'scienceReview:0': [0.25, 0.50, 0.73]
  };
  function mapSessHighlight(box, sc, what, unit) {
    var root = box.querySelector('.dg-map'); if (!root) return;
    var my = ++mapTok;
    function setGroup(g) {
      if (root._g === g) return; root._g = g;
      root.classList.remove('lit-s1', 'lit-s2');
      if (g === 1) root.classList.add('lit-s1');
      else if (g === 2) root.classList.add('lit-s2');
    }
    var zh = sc.zh || '';
    if (zh === 'Session 1 done') { setGroup(2); return; }
    if (what === 'map:end' || zh === 'Great job!') { setGroup(0); return; }
    var tm = MAP_TIMING[unit + ':' + sc.i] || (sc.s === 'B' ? [null, 0.2, 0.8] : [0.35, 0.55, 0.75]);
    var dur = Math.max(3, Number(sc.dn) || 12);
    var au = document.getElementById('au');
    var t0 = null;               // wall clock at the real 'playing' event of THIS screen's clip
    var shown = Date.now();
    function rate() { return (au && au.playbackRate > 0) ? au.playbackRate : 1; }
    var viaAudio = false;
    function onPlay() { if (my === mapTok) viaAudio = true, t0 = Date.now() - (au && au.currentTime ? au.currentTime * 1000 / rate() : 0); }
    if (au) { au.addEventListener('playing', onPlay); au.addEventListener('seeked', onPlay); if (!au.paused && au.currentTime > 0) onPlay(); }
    var iv = setInterval(function () {
      if (my !== mapTok || !root.isConnected) { clearInterval(iv); if (au) { au.removeEventListener('playing', onPlay); au.removeEventListener('seeked', onPlay); } return; }
      var f;
      var d = (au && isFinite(au.duration) && au.duration > 0.5) ? au.duration : dur;
      if (t0 != null && au && !au.paused && au.currentTime > 0.05) f = au.currentTime / d;   // real playback clock
      else if (t0 != null) f = (viaAudio && au && au.paused && !au.ended) ? null : (Date.now() - t0) * rate() / (d * 1000); // iOS stuck currentTime → wall clock since playing
      else if (Date.now() - shown > 2500) { t0 = Date.now() - 2500; f = 2.5 * rate() / dur; }  // no audio event (muted/QA) → wall clock
      else f = 0;
      if (f == null) return; // paused: hold current state
      var g = 0;
      if (tm[0] != null && f >= tm[0] && f < tm[1]) g = 1;
      else if (tm[1] != null && f >= tm[1] && f < tm[2]) g = 2;
      if (viaAudio && au && au.ended) g = 0;
      setGroup(g);
      if (f > 1.15) { clearInterval(iv); if (au) { au.removeEventListener('playing', onPlay); au.removeEventListener('seeked', onPlay); } }
    }, 90);
  }


  function imgSrc(name) {
    try { if (typeof IMGS !== 'undefined' && IMGS && IMGS[name]) return IMGS[name]; } catch (e) {}
    return IBASE + 'img/' + name;
  }
  // Crop-replacement: real HTML text + Noto scene (or rounded HD photo). No page scans.
  function textScene(lines, opts) {
    opts = opts || {};
    var ills = opts.ills || [];
    var photo = opts.photo || null;
    var chips = opts.chips || null; // [{w,ill}] for New Words
    var hero = !!opts.hero; // image-led: big centered glyphs, text secondary below
    var tip = opts.tip || ''; // inline tip in the text column (Warm-Up "Next: …")
    var body;
    if (chips && chips.length) {
      body = '<div class="tx-chips">' + chips.map(function (c, i) {
        return '<div class="tx-chip">' + (c.ill ? ill(c.ill, 'ill-tx', i) : '') +
          '<span class="tx-chip-w">' + esc(c.w) + '</span></div>';
      }).join('') + '</div>';
    } else {
      body = '<div class="tx-lines">' + (lines || []).map(function (l) {
        return '<div class="tx-line">' + esc(l) + '</div>';
      }).join('') + (tip ? '<div class="tx-tip">' + esc(tip) + '</div>' : '') + '</div>';
    }
    var side = '';
    if (photo) {
      side = '<img class="tx-photo" src="' + imgSrc(photo) + '" alt="">';
    } else if (ills.length) {
      side = '<div class="tx-ills" aria-hidden="true">' + ills.map(function (n, i) {
        return ill(n, hero ? 'ill-tx ill-hero' : 'ill-tx', i);
      }).join('') + '</div>';
    }
    // Title hero with photo: large centered photo + secondary text below.
    if (hero && photo && !chips) {
      return '<div class="dg sx tx-stage is-hero is-photo-hero">' +
        '<div class="tx-hero">' +
        '<div class="tx-side"><img class="tx-photo tx-photo-hero" src="' + imgSrc(photo) + '" alt=""></div>' +
        body + '</div></div>';
    }
    // Noto hero (rare — prefer photos on inform screens)
    if (hero && !photo && !chips) {
      return '<div class="dg sx tx-stage is-hero">' +
        '<div class="tx-hero">' + (side ? '<div class="tx-side">' + side + '</div>' : '') + body + '</div></div>';
    }
    // Warm-Up etc: left photo | right text (~50/50)
    return '<div class="dg sx tx-stage' + (photo ? ' has-photo' : '') + '">' +
      '<div class="tx-row' + (photo ? ' has-photo' : '') + '">' + (side ? '<div class="tx-side">' + side + '</div>' : '') + body + '</div></div>';
  }
  function warmBody(unit) {
    // Full useful book wording (kid-friendly). Answer-question lives on the next Big Question screen.
    if (unit === 'unit2') return ['Clouds are made of water.', 'Clouds do not always mean rain.', 'Only some clouds are rain clouds.'];
    if (unit === 'unit3') return ['Clouds give rain when it is warm.', 'Snow when it is cold.', 'Hail too — from water changing temperature.'];
    if (unit === 'unit4') return ['Rain, snow, and ice fall from the sky.', 'Did you know fish can fall too?'];
    return ['The weather changes often.', 'It can be sunny one day and rainy the next.', 'People use technology to guess the weather.', 'But animals can guess the weather, too.'];
  }
  function warmPhoto(unit) {
    if (unit === 'unit2') return 'warm_u2.jpg';
    if (unit === 'unit3') return 'warm_u3.jpg';
    if (unit === 'unit4') return 'warm_u4.jpg';
    return 'warm_l1.jpg';
  }
  function titlePhoto(unit, sc) {
    if (unit === 'scienceReview' && sc) {
      // SR unit review cards: each card shows its own unit's title photo
      var m = /\bUnit\s*(\d)\b/i.exec(sc.zh || '') || /^unit(\d)_title_/i.exec(sc.img || '');
      var n = m ? +m[1] : ({ 'title_p14.jpg': 2, 'title_p18.jpg': 3, 'title_p22.jpg': 4 })[sc.img] || 0;
      if (n === 1) return 'horse_p11.jpg'; // caption is cows & horses → horse photo, not the dog
      if (n >= 2 && n <= 4) return 'title_u' + n + '.jpg';
    }
    if (unit === 'unit2') return 'title_u2.jpg';
    if (unit === 'unit3') return 'title_u3.jpg';
    if (unit === 'unit4') return 'title_u4.jpg';
    if (unit === 'scienceReview') return 'title_u2.jpg';
    return 'title_l1.jpg';
  }
  function warmHint(unit) {
    if (unit === 'unit2') return 'Next: How do you know when it will rain?';
    if (unit === 'unit3') return 'Next: How do you know if it will rain or snow?';
    if (unit === 'unit4') return 'Next: What things can fall from the sky?';
    return 'Next: How can animals guess the weather?';
  }
  function wordsChips(unit) {
    /* Each chip icon must literally depict the word (or a strong everyday association
       a 7-year-old gets). Noto Emoji SVGs under assets/illus/noto/. */
    if (unit === 'unit2') return [
      { w: 'storm', ill: 'storm' }, { w: 'cloudy', ill: 'cloud' }, { w: 'tall', ill: 'giraffe' },
      { w: 'sky', ill: 'sun_cloud' }, { w: 'top', ill: 'up_arrow' }, { w: 'all', ill: 'hundred' }
    ];
    if (unit === 'unit3') return [
      { w: 'snow', ill: 'snowflake' }, { w: 'become', ill: 'sparkles' }, { w: 'fall', ill: 'cloud_rain' },
      { w: 'warm', ill: 'sun' }, { w: 'dangerous', ill: 'warning' }, { w: 'happen', ill: 'exclamation' }
    ];
    if (unit === 'unit4') return [
      { w: 'into', ill: 'inbox' }, { w: 'carry', ill: 'flexed_biceps' }, { w: 'wind', ill: 'leaf_wind' },
      { w: 'tornado', ill: 'tornado' }, { w: 'surprised', ill: 'astonished' }, { w: 'probably', ill: 'thinking' }
    ];
    if (unit === 'scienceReview') return [
      { w: 'tornado', ill: 'tornado' }, { w: 'wind', ill: 'leaf_wind' }, { w: 'carry', ill: 'flexed_biceps' },
      { w: 'surprised', ill: 'astonished' }, { w: 'probably', ill: 'thinking' }, { w: 'into', ill: 'inbox' }
    ];
    return [
      { w: 'neck', ill: 'giraffe' }, { w: 'air', ill: 'wind_face' }, { w: 'rabbit', ill: 'rabbit' },
      { w: 'fat', ill: 'carrot' }, { w: 'know', ill: 'light_bulb' }, { w: 'when', ill: 'alarm_clock' }
    ];
  }
  function isCropImg(img) {
    return /^(warmup_|ao_|newwords_|project_|title_p|unit\d+_title_|reading_p|opener_|vocabreview_|rc_p)/i.test(img || '');
  }

  function tipProp(lines, tone) {
    // Neon sticky + red binder clip. Short tip text only.
    var body = (lines || []).map(function (l) { return '<div class="tip-line">' + esc(l) + '</div>'; }).join('');
    return '<div class="dg sx tip-stage">' +
      '<div class="tip-prop tip-' + (tone || 'yellow') + '">' +
      '<div class="tip-clip" aria-hidden="true"><span class="tip-clip-bar"></span><span class="tip-clip-wire"></span></div>' +
      '<div class="tip-note">' + body + '</div></div></div>';
  }

  function apply(view, sc, state, unit) {
    try {
      try { if (window.RFReading && RFReading.apply(view, sc, state, unit)) return 'reading'; } catch (_r) {}
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
        try { mapSessHighlight(box, sc, r.what, unit); } catch (_h) {}
      } else if (scr && !sc.map && !r.noStack && (isShort(sc) || r.hint !== undefined)) scr.classList.add('stack');
      if (r.wide && scr) scr.classList.add(r.wide);
      if (r.chart || r.qc) {
        if (r.chart && state !== 'reveal') {
          // the sentences live in the chart; the panel keeps the book instruction above the numbered tap rows
          var qa = view.querySelector('#panel .q'); if (qa) qa.innerHTML = '<div class="line">Complete the chart.</div>';
        }
        if (r.chart && state === 'reveal') {
          // chart now shows every sentence: keep just the instruction + numbered answers
          var pc = view.querySelector('#panel');
          var qe2 = pc && pc.querySelector('.q.qecho'); if (qe2) qe2.innerHTML = '<div class="line">Complete the chart.</div>';
          var rv2 = pc && pc.querySelector('.rev');
          if (rv2) rv2.innerHTML = (sc.reveal || []).map(function (a, k) { return '<div class="line ch-ansl"><span class="ch-n">' + (k + 1) + '</span>' + esc(a) + '</div>'; }).join('');
        }
        if (state !== 'reveal') try { linkIx(view, box, r); } catch (_l) {}
      }
      if (r.scene && scr) scr.classList.add('stack', 'scene');
      if (r.sceneQ) {
        var pq = view.querySelector('#panel') || view.querySelector('.panel');
        if (pq) {
          var qline = '<div class="line sx-qline">' + r.sceneQ + '</div>';
          if (sc.type === 'normal') pq.innerHTML = '<div class="q sx-q">' + qline + '</div>' + (r.sub ? '<div class="line hint sx-sub">' + esc(r.sub) + '</div>' : '');
          else {
            var q0 = pq.querySelector('.q'); if (q0) { q0.innerHTML = qline; q0.classList.add('sx-q'); }
            var rv0 = pq.querySelector('.rev');
            if (rv0) { rv0.classList.add('sx-rev'); rv0.innerHTML = '<div class="sx-ans"><span class="sx-tick" aria-hidden="true">\u2713</span><span class="line">' + esc(r.ans) + '</span></div>'; }
          }
        }
      }
      if (r.hint !== undefined) {
        var pn = view.querySelector('#panel') || view.querySelector('.panel');
        if (pn) {
          if (sc.type === 'normal') pn.innerHTML = r.hint ? '<div class="line hint">' + esc(r.hint) + '</div>' : '';
          else {
            var rv = pn.querySelector('.rev');
            if (rv && r.hint && r.scene) {
              rv.classList.add('sx-rev'); rv.innerHTML = '<div class="sx-ans"><span class="sx-tick" aria-hidden="true">\u2713</span><span class="line">' + esc(r.hint) + '</span></div>';
              var qe = pn.querySelector('.q.qecho'); if (qe) { qe.classList.add('sx-q'); qe.innerHTML = '<div class="line sx-qline sx-qsm">' + esc((sc.q || []).join(' ')) + '</div>'; }
            } else if (rv && r.hint) rv.innerHTML = '<div class="line">' + esc(r.hint) + '</div>';
          }
        }
      }
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
    '#view .screen.is-end .dg-map .dg-row{gap:clamp(18px,3.2cqw,44px);}',
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
    '.dg-map .dg-row{display:flex;align-items:center;justify-content:center;gap:clamp(18px,3.2cqw,44px);width:100%;flex:0 1 auto;}',
    '.dg-map .dg-arrow{color:#9AA3AD;font-size:clamp(12px,3cqw,26px);flex:0 0 auto;}',
    '.dg-card{position:relative;flex:1 1 0;max-width:23cqw;aspect-ratio:.72;max-height:68cqh;background:var(--c);border-radius:clamp(8px,2.4cqmin,20px);',
    ' display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2cqmin;padding:1.5cqmin;box-shadow:0 .8cqmin 0 rgba(0,0,0,.08);',
    ' transition:transform .3s ease;}',
    '.dg-num{font-weight:900;font-size:clamp(24px,min(9cqw,20cqh),96px);line-height:1;color:#2B3445;}',
    '.dg-lab{font-weight:700;font-size:clamp(12px,min(2.4cqw,6cqh),26px);line-height:1.2;color:#1F2A44;}',
    '.dg-c0 .dg-num,.dg-c0 .dg-lab,.dg-c2 .dg-num,.dg-c2 .dg-lab{color:#1B2A3A;}',
    '.dg-check{position:absolute;top:clamp(10px,2.4cqmin,18px);right:clamp(10px,2.4cqmin,18px);width:clamp(26px,min(7.5cqmin,11cqh),52px);height:clamp(26px,min(7.5cqmin,11cqh),52px);display:grid;place-items:center;z-index:2;pointer-events:none;}',
    '.dg-check .ill-check{--s:100%;width:100%;height:100%;}',
    '.dg-check .ill.pale::before{display:none;}',
    '.dg-check .ill > img.ill-i{filter:drop-shadow(0 2px 3px rgba(31,52,84,.28));}',
    '.dg-card.is-done{filter:saturate(.75);opacity:.88;}',
    '.dg-card.is-next,.dg-card.is-seq{box-shadow:0 0 0 .45cqmin #FFF4C2,0 0 0 1cqmin #E8C04A;}',
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
    '@keyframes dgSeq{0%{transform:none;box-shadow:none}40%{transform:translateY(-5%) scale(1.04);box-shadow:0 0 0 .45cqmin #FFF4C2,0 0 0 1.15cqmin #E8C04A}100%{transform:none;box-shadow:0 0 0 .45cqmin #FFF4C2,0 0 0 1cqmin #E8C04A}}',
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
    'body:has(#pausebtn.is-paused) .dg,body:has(#pausebtn.is-paused) .dg *{animation-play-state:paused !important;}',
    /* ===== v2: de-card (only interactive things are cards), no repeats, big pictures ===== */
    /* stacked screens: title top, picture fills the middle, the one hint/prompt line at the bottom */
    '#view .screen.stack .content > .panel{order:1;}',
    '#view .screen.stack .content{justify-content:space-between;}',
    '#view .screen.stack .content > .imgbox{flex:1 1 0;min-height:0;}',
    '#view .screen.stack .panel .line.hint{color:#2F5F8C;font-weight:800;}',
    /* always: big Noto row + rose question text */
    '.dg-always,.dg-always.has-scene{gap:3cqh;justify-content:center;}',
    '.dg-always .dg-al,.dg-always.has-scene .dg-al{background:none;box-shadow:none;border-radius:0;padding:0;min-height:0;max-height:none;width:auto;color:#C2415E;flex:0 0 auto;animation:none!important;}',
    '.dg-always .dg-al-b,.dg-always.has-scene .dg-al-b{font-weight:900;font-size:clamp(20px,min(4.6cqw,10cqh),60px);line-height:1.2;color:#C2415E;}',
    '.dg-scene{gap:2cqw;flex:0 1 auto;}',
    '.ill-sc{--s:clamp(64px,min(46cqh,20cqw),240px);}',
    '.ill-sc.ill-sm{--s:clamp(56px,min(32cqh,14cqw),170px);}',
    '.ill-mid{--s:clamp(64px,min(38cqh,17cqw),200px);}',
    '.dg-always.no-text .ill-sc{--s:clamp(64px,min(64cqh,21cqw),280px);}',
    '.dg-always.no-text .ill-sc.ill-sm{--s:clamp(56px,min(44cqh,15cqw),200px);}',
    '.dg-always.no-text .ill-mid{--s:clamp(64px,min(52cqh,18cqw),240px);}',
    '@container (max-height:239px){.dg-scene{display:flex}}',
    '@container (max-aspect-ratio:1/1){',
    ' .dg-scene{flex-direction:column;gap:1.4cqh;}',
    ' .dg-sc-ar{width:0;height:clamp(18px,4cqh,48px);border-top:0;border-left:clamp(3px,.8cqw,6px) dashed #B9B2A6;}',
    ' .dg-sc-ar::after{right:auto;top:auto;bottom:-4px;left:calc(-1 * clamp(7px,2cqw,12px) - clamp(3px,.8cqw,6px) / 2);border:clamp(7px,2cqw,12px) solid transparent;border-top-color:#B9B2A6;border-bottom:0;}',
    ' .ill-sc{--s:clamp(64px,min(17cqh,36cqw),220px);}',
    ' .ill-sc.ill-sm{--s:clamp(56px,min(12cqh,26cqw),160px);}',
    ' .ill-mid{--s:clamp(64px,min(14cqh,30cqw),190px);}',
    ' .dg-always.no-text .ill-sc{--s:clamp(64px,min(20cqh,40cqw),240px);}',
    ' .dg-always.no-text .ill-sc.ill-sm{--s:clamp(56px,min(14cqh,28cqw),170px);}',
    ' .dg-always.no-text .ill-mid{--s:clamp(64px,min(16cqh,32cqw),200px);}',
    ' .dg-always .dg-al-b{font-size:clamp(20px,min(7cqw,5cqh),48px);}',
    '}',
    /* highlight = text colour pulse + soft underline (no card glow) */
    '@keyframes dgLn{0%{box-shadow:inset 0 0 0 rgba(232,192,74,0);transform:none}45%{box-shadow:inset 0 -.22em 0 rgba(232,192,74,.75);transform:scale(1.04)}100%{box-shadow:inset 0 -.12em 0 rgba(232,192,74,.35);transform:none}}',
    '.dg-ln{border-radius:0;padding:0 .1em;}',
    /* two skills: plain coloured text + big icons, no blocks */
    '.dg-skills .dg-row2{width:96%;gap:5cqw;align-items:flex-start;flex:0 1 auto;}',
    '.dg-skills .dg-sk{background:none!important;box-shadow:none!important;border-radius:0;padding:0;max-height:none;gap:2cqh;align-items:center;text-align:center;justify-content:flex-start;}',
    '.dg-skills.m-both .dg-sk2{border-left:3px dashed #E3DCCD;padding-left:5cqw;}',
    '.dg-skills .dg-sk-h{flex-direction:column;gap:1.4cqh;}',
    '.dg-skills .ill-sk{--s:clamp(64px,min(40cqh,16cqw),220px);}',
    '.dg-skills.m-comm .ill-sk{--s:clamp(64px,min(48cqh,26cqw),260px);}',
    '.dg-skills .dg-sk1 .dg-sk-t{color:#2F7FC0;}',
    '.dg-skills .dg-sk2 .dg-sk-t{color:#B07A0E;}',
    '.dg-skills .dg-sk-t{font-weight:900;font-size:clamp(18px,min(4cqw,9cqh),54px);}',
    '.dg-skills .dg-sk-b{color:#1F2A44;font-size:clamp(15px,min(3cqw,6.6cqh),40px);line-height:1.4;}',
    '.dg-skills.m-comm .dg-sk-b{font-size:clamp(16px,min(4cqw,8cqh),46px);}',
    '@container (max-aspect-ratio:1/1){.dg-skills.m-both .dg-row2{flex-direction:column;align-items:center;gap:3cqh;}.dg-skills.m-both .dg-sk2{border-left:0;padding-left:0;border-top:3px dashed #E3DCCD;padding-top:3cqh;}.dg-skills .ill-sk{--s:clamp(64px,min(16cqh,34cqw),180px);}.dg-skills .dg-sk-t{font-size:clamp(18px,min(7cqw,4.4cqh),40px);}.dg-skills .dg-sk-b{font-size:clamp(15px,min(5.4cqw,3.4cqh),30px);}}',
    '@media (prefers-reduced-motion:no-preference){.dg-skills.m-both .dg-sk,.dg-skills.m-both .dg-sk1,.dg-skills.m-both .dg-sk2,.dg-skills.m-comm .dg-sk2{animation:dgSoft 1s ease-out both!important;}}',
    /* table: icons stand on a coloured table top (drawing), 4 wide legs */
    '.dg-table{gap:0;justify-content:center;}',
    '.dg-table .dg-top-ill{display:flex;gap:2cqw;justify-content:center;flex:0 0 auto;margin-bottom:-1cqh;position:relative;z-index:1;}',
    '.dg-table .ill-top{--s:clamp(64px,min(26cqh,14cqw),190px);}',
    '.dg-table .dg-top{display:block;flex:0 0 auto;width:96%;text-align:center;padding:1.6cqh 3cqw;}',
    '.dg-table .dg-top-t{font-weight:900;font-size:clamp(15px,min(3cqw,6.4cqh),38px);opacity:.9;}',
    '.dg-table .dg-top-s{font-weight:800;font-size:clamp(16px,min(3.4cqw,7.4cqh),44px);margin-top:.4cqh;}',
    '.dg-table .dg-legs{width:96%;flex:1 1 auto;min-height:0;max-height:52cqh;justify-content:space-between;gap:2cqw;}',
    '.dg-table .dg-legcol{width:auto;flex:1 1 0;min-width:0;}',
    '.dg-table .dg-post{width:clamp(8px,2cqw,24px);height:clamp(10px,7cqh,60px);}',
    '.dg-table .dg-leg{flex:1 1 auto;max-height:none;min-height:clamp(56px,16cqh,140px);padding:1.4cqh 1cqw;gap:.6cqh;}',
    '.dg-table .dg-leg-t{font-size:clamp(13px,min(2.4cqw,5.4cqh),30px);}',
    '.dg-table .dg-leg .dg-q{font-size:clamp(22px,min(5cqw,12cqh),72px);}',
    '.dg-table .dg-leg-x{font-size:clamp(14px,min(2.7cqw,6.4cqh),34px);line-height:1.2;}',
    '@container (max-aspect-ratio:1/1){.dg-table .ill-top{--s:clamp(64px,min(14cqh,26cqw),170px);}.dg-table .dg-top-s{font-size:clamp(15px,min(5cqw,3.6cqh),32px);}.dg-table .dg-legs{display:grid;grid-template-columns:1fr 1fr;gap:2cqh 4cqw;max-height:none;flex:0 1 auto;}.dg-table .dg-leg{min-height:clamp(56px,10cqh,120px);}.dg-table .dg-leg-t{font-size:clamp(13px,min(4cqw,3cqh),26px);}.dg-table .dg-leg-x{font-size:clamp(14px,min(4.6cqw,3.2cqh),28px);}}',
    '@media (prefers-reduced-motion:no-preference){.dg-table .dg-leg{animation-name:dgRise!important;}}',
    '@keyframes dgRise{0%{transform:none}45%{transform:translateY(-6%)}100%{transform:none}}',
    /* prompt / answer text: plain coloured text on the page, no boxes */
    '#view .panel .q,#view .panel .q.qecho,#view .panel .rev{background:none!important;border:0!important;box-shadow:none!important;border-radius:0!important;padding:0!important;}',
    '#view .panel .q .line{color:#2F5F8C;font-weight:800;}',
    '#view .panel .q.qecho .line{color:#7A8594;font-weight:700;}',
    '#view .panel .rev .line{color:#2E7D4F;font-weight:900;}',
    '#view .screen.stack .panel{row-gap:.4em;}',
    /* Noto icons sit bare on the background: no backing disc, no drop-shadow */
    '.ill::before,.ill.pale::before{content:none!important;display:none!important;}',
    '.ill > img.ill-i,.ill.pale > img.ill-i,.dg-check .ill > img.ill-i{filter:none!important;}',
    /* table: legs sized to their content (wide, not tall); icons take the spare height */
    '.dg-table .dg-legs{flex:0 1 auto;max-height:none;}',
    '.dg-table .dg-leg{flex:0 0 auto;min-height:clamp(56px,15cqh,130px);}',
    '.dg-table .ill-top{--s:clamp(64px,min(34cqh,17cqw),230px);}',
    '.dg-table .dg-post{height:clamp(12px,9cqh,80px);}',
    '.dg-table{gap:0;}',
    '@container (max-aspect-ratio:1/1){.dg-table .ill-top{--s:clamp(64px,min(20cqh,34cqw),200px);}.dg-always .dg-al-b br{display:none;}.ill-sc{--s:clamp(64px,min(20cqh,38cqw),230px);}.ill-mid{--s:clamp(64px,min(16cqh,30cqw),190px);}.ill-sc.ill-sm{--s:clamp(56px,min(15cqh,28cqw),170px);}}',
    '@container (max-aspect-ratio:1/1){.dg-skills.m-both .dg-sk2{border-top:0!important;padding-top:0!important;}.dg-map .dg-row{flex-wrap:wrap;gap:3cqw;}.dg-map .dg-arrow{display:none;}.dg-map .dg-card{flex:0 0 44cqw;max-width:44cqw;aspect-ratio:1.15;max-height:none;}.dg-map .dg-num{font-size:clamp(28px,min(12cqw,9cqh),80px);}.dg-map .dg-lab{font-size:clamp(14px,min(4.4cqw,3.4cqh),26px);}}',
    '.sx{position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:visible;}',
    /* Decorative half-circle hills removed per Haishan — keep cream page only */
    '.sx-hill,.sx-hill2,.fr-ground{display:none!important;}',
    '.sx-always{--u:min(1.02cqw,2.7cqh);}',
    '.sx-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:calc(var(--u) * 1.4);}',
    '.sx-side{display:flex;flex-direction:column;align-items:center;gap:calc(var(--u) * 1.4);flex:0 0 auto;}',
    '.sx-cl{position:relative;width:calc(var(--u) * 30);height:calc(var(--u) * 26);}',
    '.sx-clm{width:calc(var(--u) * 15);height:calc(var(--u) * 17);}',
    '.sx-m{margin-bottom:calc(var(--u) * 5);}',
    '.sx-e{position:absolute;display:block;}',
    '.sx-e .ill-sx{--s:100%;width:100%;height:auto;aspect-ratio:1/1;display:block;}',
    '.sx-lab{font-weight:900;font-size:clamp(14px,calc(var(--u) * 2.3),30px);line-height:1.2;color:#2B3440;background:#fff;border-radius:999px;padding:.28em .85em;box-shadow:0 2px 0 rgba(43,52,64,.08);white-space:nowrap;}',
    '.sx-ar{flex:0 0 auto;width:calc(var(--u) * 8);height:0;border-top:max(3px,calc(var(--u) * .55)) dashed rgba(43,52,64,.33);position:relative;margin-bottom:calc(var(--u) * 5);}',
    '.sx-ar::after{content:"";position:absolute;right:calc(var(--u) * -1.2);top:calc(var(--u) * -1.5);border-left:calc(var(--u) * 1.8) solid rgba(43,52,64,.47);border-top:calc(var(--u) * 1.2) solid transparent;border-bottom:calc(var(--u) * 1.2) solid transparent;}',
    '@media (prefers-reduced-motion:no-preference){.sx-lab{animation:sxLab .7s ease-out calc(.5s + var(--i) * .35s) both;}.sx-always.m-ask .sx-r .sx-lab{animation:sxLab .7s ease-out 1.6s both,sxPulse 2.4s ease-in-out 2.4s 2;}}',
    '@keyframes sxLab{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:none}}',
    '@keyframes sxPulse{0%,100%{box-shadow:0 2px 0 rgba(43,52,64,.08)}50%{box-shadow:0 0 0 6px rgba(61,122,181,.18)}}',
    '@container (max-width:640px) or (max-aspect-ratio:1/1){.sx-always{--u:min(1.3cqw,2.7cqh);}.sx-always .sx-ar{display:none;}.sx-clm{width:calc(var(--u) * 12);height:calc(var(--u) * 13);}}',
    '#view .screen.scene .content > .panel{flex-direction:column;flex-wrap:nowrap;align-items:flex-start;justify-content:flex-start;text-align:left;row-gap:clamp(6px,1.2vh,14px);padding-left:clamp(12px,3.6vw,48px);}',
    '#view .screen.scene .panel .q.sx-q{padding:0!important;background:none;border:0;box-shadow:none;}',
    '#view .screen.scene .panel .sx-qline,#view .screen.scene .panel .q.qecho .sx-qline{font-weight:900;font-size:clamp(20px,min(3.3vw,5.4vh),40px);line-height:1.2;color:#2B3440;text-align:left;}',
    '#view .screen.scene .panel .sx-qline em{font-style:normal;color:#3D7AB5;}',
    '#view .screen.scene .panel .sx-sub{font-weight:700;font-size:clamp(15px,min(1.9vw,3.2vh),22px);color:#5B6675;text-align:left;}',
    '#view .screen.scene .panel .rev.sx-rev{padding:0!important;background:none;border:0;}',
    '.sx-ans{display:inline-flex;align-items:center;gap:.5em;background:#4F9A6B;color:#fff;font-weight:800;font-size:clamp(17px,min(2.6vw,4.4vh),30px);line-height:1.2;padding:.42em 1em .42em .45em;border-radius:.8em;}',
    '#view .screen.scene .panel .sx-ans .line{font-size:inherit;color:#fff;font-weight:800;margin:0;line-height:1.2;text-align:left;}',
    '.sx-tick{width:1.45em;height:1.45em;border-radius:50%;background:#fff;color:#4F9A6B;display:grid;place-items:center;font-weight:900;flex:0 0 auto;}',
    '#view .screen.scene .panel .pagehint{text-align:left;margin:0;}',
    '#view .screen.scene .panel .cd{align-self:center;}',
    '.sx-table{--u:min(1cqw,1.85cqh);}',
    '.sx-tb{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;width:calc(var(--u) * 84);}',
    '.sx-tb-ill{display:flex;align-items:flex-end;justify-content:center;gap:calc(var(--u) * 6);height:calc(var(--u) * 22);margin-bottom:calc(var(--u) * -1.2);}',
    '.sx-tb-i{display:block;width:calc(var(--u) * 21);}',
    '.sx-tb-i1{width:calc(var(--u) * 19);}',
    '.sx-tb-i .ill-sx{--s:100%;width:100%;height:auto;aspect-ratio:1/1;display:block;}',
    '.sx-top{position:relative;width:100%;background:linear-gradient(#D7A066,#BC7F42);border-radius:calc(var(--u) * 1.4);padding:calc(var(--u) * 2.6) calc(var(--u) * 3) calc(var(--u) * 1.8);box-shadow:0 calc(var(--u) * .7) 0 #9A6532;color:#fff;text-align:center;transition:opacity .4s ease;}',
    '.sx-tag{position:absolute;left:50%;top:0;transform:translate(-50%,-55%);font-weight:900;font-size:clamp(13px,calc(var(--u) * 2),24px);color:#9A6532;background:#fff;border-radius:999px;padding:.2em .8em;white-space:nowrap;box-shadow:0 2px 0 rgba(43,52,64,.08);}',
    '.sx-top-s{display:block;font-weight:900;font-size:clamp(16px,calc(var(--u) * 2.8),38px);line-height:1.2;text-shadow:0 1px 0 rgba(0,0,0,.15);}',
    '.sx-legs{display:flex;justify-content:space-between;width:92%;transition:opacity .4s ease;}',
    '.sx-leg{display:flex;flex-direction:column;align-items:center;width:23%;min-width:0;}',
    '.sx-post{width:calc(var(--u) * 2.6);height:calc(var(--u) * 11);background:linear-gradient(90deg,#C88A4C,#A86E36);border-radius:0 0 calc(var(--u) * .8) calc(var(--u) * .8);}',
    '.sx-leg-l{margin-top:calc(var(--u) * -.4);max-width:100%;white-space:normal;text-align:center;font-size:clamp(14px,calc(var(--u) * 2.2),28px);}',
    '.sx-leg-l b{color:#3E8A5B;}',
    '.sx-leg-l.is-filled{color:#fff;background:#4F9A6B;box-shadow:0 2px 0 #377550;}',
    '.sx-table.m-top .sx-legs{opacity:.4;}',
    '.sx-table.m-legs .sx-top{opacity:.55;}',
    '@media (prefers-reduced-motion:no-preference){.sx-table.m-top .sx-top,.sx-table.m-topLegs .sx-top{animation:sxGlow 2.2s ease-in-out .8s 2;}.sx-table.m-legs .sx-leg-l,.sx-table.m-blankAsk .sx-leg-l{animation:sxLab .7s ease-out calc(.5s + var(--i) * .3s) both,sxPulse 2.2s ease-in-out calc(1.8s + var(--i) * .2s) 2;}}',
    '@keyframes sxGlow{0%,100%{box-shadow:0 calc(var(--u) * .7) 0 #9A6532}50%{box-shadow:0 calc(var(--u) * .7) 0 #9A6532,0 0 0 calc(var(--u) * 1) rgba(232,192,74,.45)}}',
    '@container (max-aspect-ratio:1/1){.sx-table{--u:min(1.12cqw,1.9cqh);}.sx-legs{width:100%;}.sx-leg{width:24.5%;}.sx-leg-l{padding:.25em .4em;font-size:clamp(13px,calc(var(--u) * 2.6),24px);}}',
    '.sx-skills{--u:min(1cqw,2.3cqh);}',
    '.sx-sk-row{position:relative;z-index:1;display:flex;align-items:flex-start;justify-content:center;gap:calc(var(--u) * 8);}',
    '.sx-sk{display:flex;flex-direction:column;align-items:center;gap:calc(var(--u) * 1.6);width:calc(var(--u) * 40);}',
    '.sx-sk-cl{width:calc(var(--u) * 30);height:calc(var(--u) * 22);}',
    '.sx-sk-t{font-size:clamp(16px,calc(var(--u) * 3),38px);}',
    '.sx-sk1 .sx-sk-t{color:#2F7FC0;} .sx-sk2 .sx-sk-t{color:#B07A0E;}',
    '.sx-sk-b{font-weight:800;font-size:clamp(15px,calc(var(--u) * 2.4),30px);line-height:1.45;color:#2B3440;text-align:center;}',
    '.sx-skills.m-comm{--u:min(1.3cqw,2.4cqh);}',
    '@container (max-aspect-ratio:1/1){.sx-skills{--u:min(1.25cqw,1.3cqh);}.sx-sk-row{gap:calc(var(--u) * 4);}.sx-skills.m-comm{--u:min(2cqw,1.8cqh);}}',
    '#view .screen.scene .panel .sx-qline.sx-qsm{font-size:clamp(18px,min(2.6vw,4.4vh),32px);}',
    '.sx-fish{--u:min(1cqw,2.2cqh);overflow:hidden;}',
    '.fr-sky{position:absolute;inset:0 0 38% 0;background:linear-gradient(#9EC9E8 0%,#D6EAF7 55%,#FBF6EC 100%);pointer-events:none;}',
    '.fr-sea{position:absolute;left:0;right:48%;bottom:0;height:32%;background:linear-gradient(#4AA8E8,#2F7FC0);border-radius:40% 60% 0 0/30% 40% 0 0;pointer-events:none;}',
    '.fr-town{position:absolute;right:4%;bottom:14%;display:flex;align-items:flex-end;gap:calc(var(--u)*1.4);z-index:2;}',
    '.fr-roof{display:block;background:#C97B5A;border-radius:calc(var(--u)*.4) calc(var(--u)*.4) 0 0;position:relative;}',
    '.fr-roof::after{content:"";position:absolute;left:-8%;right:-8%;top:calc(var(--u)*-1.6);height:calc(var(--u)*2.2);background:#8B3A2A;clip-path:polygon(50% 0,100% 100%,0 100%);}',
    '.fr-roof.r1{width:calc(var(--u)*10);height:calc(var(--u)*8);}',
    '.fr-roof.r2{width:calc(var(--u)*14);height:calc(var(--u)*11);}',
    '.fr-roof.r3{width:calc(var(--u)*9);height:calc(var(--u)*7);}',
    '.fr-spout{position:absolute;left:28%;bottom:28%;width:calc(var(--u)*18);height:calc(var(--u)*42);z-index:3;pointer-events:none;}',
    '.fr-spout-core{position:absolute;inset:0;background:linear-gradient(rgba(255,255,255,.55),rgba(74,168,232,.35) 40%,rgba(47,127,192,.5));clip-path:polygon(42% 0,58% 0,78% 100%,22% 100%);border-radius:40%;animation:frSpout 4.5s ease-in-out infinite;}',
    '.fr-torn{position:absolute;left:32%;bottom:22%;width:calc(var(--u)*14);z-index:4;}',
    '.fr-torn .ill-sx{--s:100%;width:100%;height:auto;aspect-ratio:1/1;display:block;filter:drop-shadow(0 4px 8px rgba(31,52,84,.2));}',
    '.fr-lift{position:absolute;left:0;right:0;bottom:30%;height:50%;z-index:5;pointer-events:none;}',
    '.fr-fish{position:absolute;width:calc(var(--u)*6);display:block;}',
    '.fr-fish .ill-sx{--s:100%;width:100%;height:auto;aspect-ratio:1/1;display:block;}',
    '.fr-up{left:var(--x);bottom:0;animation:frUp 4.5s ease-in-out var(--w) infinite;}',
    '.fr-fallbox{position:absolute;inset:0 0 12% 35%;z-index:6;pointer-events:none;}',
    '.fr-fall{top:var(--d);animation:frFall 3.6s linear var(--w) infinite;transform:scale(var(--s));}',
    '@keyframes frSpout{0%,100%{transform:scaleX(.85) scaleY(.95);opacity:.85}50%{transform:scaleX(1.05) scaleY(1.05);opacity:1}}',
    '@keyframes frUp{0%{transform:translateY(10%) rotate(-20deg);opacity:0}15%{opacity:1}55%{transform:translateY(-160%) rotate(25deg);opacity:1}70%,100%{transform:translateY(-180%) rotate(40deg);opacity:0}}',
    '@keyframes frFall{0%{transform:translateY(-20%) rotate(-15deg) scale(var(--s));opacity:0}10%{opacity:1}85%{opacity:1}100%{transform:translateY(120%) rotate(35deg) scale(var(--s));opacity:0}}',
    '@media (prefers-reduced-motion:reduce){.fr-spout-core,.fr-up,.fr-fall{animation:none}.fr-up{transform:translateY(-80%) rotate(10deg);opacity:1}.fr-fall{top:35%;opacity:1;transform:rotate(12deg) scale(var(--s))}}',
    '@container (max-aspect-ratio:1/1){.sx-fish{--u:min(1.4cqw,2cqh);}.fr-sea{right:35%;}.fr-town{right:2%;bottom:12%;}}',
    '.dg-map{display:flex;flex-direction:column;justify-content:center;align-items:stretch;gap:0;width:100%;height:100%;max-height:100%;padding:0;box-sizing:border-box;overflow:visible;}',
    '.dg-map-row{display:flex;align-items:center;justify-content:center;gap:clamp(18px,3.2cqw,44px);width:100%;flex:1 1 auto;min-height:0;}',
    /* Width-driven cards: equal flex share of row; height from aspect-ratio; cap so foots always fit */
    '.dg-map-row .dg-card{flex:1 1 0;width:0;min-width:0;aspect-ratio:.82;height:auto;max-height:min(64cqh,calc(100% - 0px));}',
    '.dg-map-foots{display:grid;grid-template-columns:1fr 1fr;width:100%;flex:0 0 auto;margin-top:1em;gap:clamp(18px,3.2cqw,44px);}',
    '.dg-map .dg-num{font-size:clamp(28px,min(7cqw,11cqh),80px);}',
    '.dg-map .dg-lab{font-size:clamp(13px,min(2.3cqw,3.6cqh),26px);}',
    '.dg-map .dg-card .ill-map{--s:clamp(36px,min(12cqh,9cqw),88px);}',
    'body.playing:not(.fs) .dg-map-row .dg-card{max-height:min(52cqh,100%);aspect-ratio:.88;}',
    'body.playing:not(.fs) .dg-map-foots{margin-top:.65em;}',
    '.dg-arrow-mid{align-self:center;}',
    '.dg-map-glyphs{display:flex;justify-content:space-around;align-items:flex-end;width:100%;margin-top:1.6cqh;min-height:clamp(36px,10cqh,72px);pointer-events:none;}',
    '.dg-map-g{display:grid;place-items:center;flex:1 1 0;}',
    '.ill-map{--s:clamp(36px,min(9cqh,7cqw),72px);}',
    '.dg-sess-lab{margin:0;text-align:left;font-weight:700;font-size:clamp(12px,min(2.4cqw,5.5cqh),26px);color:#3C4656;line-height:1.25;padding-left:0.15em;min-height:1.25em;}',
    '.dg-map .dg-card{transition:box-shadow .35s ease,filter .35s ease;}',
    '.dg-map.lit-s1 .dg-sess-lab[data-sess="1"],',
    '.dg-map.lit-s2 .dg-sess-lab[data-sess="2"]{color:#2F5F8C;font-weight:800;}',
    '.dg-map.lit-s1 .dg-card[data-sess="2"],.dg-map.lit-s1 .dg-sess-lab[data-sess="2"],',
    '.dg-map.lit-s2 .dg-card[data-sess="1"],.dg-map.lit-s2 .dg-sess-lab[data-sess="1"]{opacity:.72;}',
    '#view .screen.is-end .dg-map-glyphs{display:none;}',
    '#view .screen.is-end .dg-sess-lab{margin-top:.6em;}',
    '@container (max-aspect-ratio:1/1){',
    '  .dg-map-row{flex-wrap:wrap;gap:2.4cqh 2cqw;}',
    '  .dg-arrow,.dg-arrow-mid{display:none;}',
    '  .dg-map-row .dg-card{flex:0 0 44cqw;max-width:44cqw;aspect-ratio:1.1;max-height:none;}',
    '  .ill-map{--s:clamp(32px,min(8cqh,12cqw),64px);}',
    '}',
    '.dg-card{justify-content:center;padding:clamp(10px,2.4cqmin,20px) clamp(8px,2cqmin,16px);gap:clamp(6px,1.6cqmin,14px);}',
    '.dg-card .dg-card-ill{margin-top:0;display:grid;place-items:center;width:100%;flex:0 0 auto;}',
    '.dg-card .ill-map{--s:clamp(36px,min(14cqh,9cqw),88px);}',
    /* Map glyphs must stay visible: illIn+both with --b:3 left card 4 at opacity:0 during delay */
    '.dg-card .ill,.dg-card .ill-map{animation:none!important;opacity:1!important;transform:none!important;}',
    '.dg-map-glyphs{display:none!important;}',
    '#view .screen.is-end .dg-card .ill-map{--s:clamp(28px,min(10cqh,6cqw),64px);}',
    '@container (max-aspect-ratio:1/1){.dg-card .ill-map{--s:clamp(32px,min(10cqh,14cqw),72px);}.dg-arrow-mid{margin-bottom:0;}}',
    '.tx-stage{justify-content:center;padding:clamp(4px,1cqh,10px) clamp(2px,.6cqw,8px);width:100%;}',
    '.tx-stage.is-hero{justify-content:center;align-items:center;}',
    '.tx-hero{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(14px,3.2cqh,36px);width:100%;height:100%;max-height:100%;padding:clamp(4px,1cqh,12px) clamp(8px,2cqw,24px);box-sizing:border-box;}',
    '.tx-hero .tx-side{flex:0 0 auto;width:100%;display:flex;justify-content:center;}',
    '.tx-hero .tx-ills{display:flex;flex-wrap:nowrap;align-items:center;justify-content:center;gap:clamp(8px,2cqmin,24px);max-width:min(96cqw,1100px);width:100%;}',
    '.tx-hero .ill-hero,.ill-tx.ill-hero{--s:clamp(56px,min(24cqh,calc((92cqw - 72px)/4)),180px);flex:0 0 auto;width:var(--s);height:var(--s);min-width:0;}',
    '.tx-hero .tx-lines{flex:0 0 auto;width:min(92cqw,820px);text-align:center;align-items:center;gap:clamp(4px,1cqh,10px);}',
    '.tx-hero .tx-line{font-size:clamp(18px,min(3cqw,4.6cqh),34px);text-align:center;}',
    '@container (max-aspect-ratio:5/4){.tx-hero .ill-hero,.ill-tx.ill-hero{--s:clamp(48px,min(18cqh,calc((90cqw - 60px)/4)),140px);}.tx-hero{gap:clamp(10px,2.4cqh,24px);}}',

    '.tx-row{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;gap:clamp(12px,2.4cqw,32px);width:100%;max-width:none;max-height:100%;padding:0 clamp(4px,1cqw,12px);}',
    '.tx-lines{flex:1 1 0;min-width:0;display:flex;flex-direction:column;justify-content:center;gap:clamp(6px,1.4cqh,14px);text-align:left;}',
    '.tx-line{font-weight:800;font-size:clamp(18px,min(3.2cqw,5.6cqh),36px);line-height:1.35;color:#1F2A44;}',
    '.tx-chips{flex:1 1 0;min-width:0;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:clamp(8px,1.6cqmin,16px);align-content:center;}',
    '.tx-chip{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:clamp(4px,1cqh,10px);background:#fff;border-radius:clamp(14px,2cqmin,22px);padding:clamp(10px,2cqh,18px) clamp(8px,1.5cqw,14px);box-shadow:0 6px 16px rgba(31,42,68,.10);}',
    '.tx-chip-w{font-weight:800;font-size:clamp(16px,min(2.8cqw,4.8cqh),28px);color:#1F2A44;}',
    '.tx-side{flex:0 0 auto;display:flex;align-items:center;justify-content:center;}',
    '.tx-ills{display:flex;flex-wrap:nowrap;align-items:center;justify-content:center;gap:clamp(6px,1.5cqmin,14px);max-width:min(42cqw,340px);}',
    '.ill-tx{--s:clamp(52px,min(16cqh,12cqw),120px);}',
    '.tx-photo{width:min(42cqw,380px);height:min(78cqh,520px);max-height:min(78cqh,520px);object-fit:cover;object-position:center;border-radius:var(--r-photo, clamp(16px,2.2vw,24px));box-shadow:0 10px 24px rgba(31,42,68,.14);}',
    '.tx-stage.has-photo .tx-row.has-photo{display:grid;grid-template-columns:1fr 1fr;gap:clamp(16px,3cqw,40px);align-items:stretch;height:100%;}',
    '.tx-row.has-photo .tx-side{min-width:0;display:flex;height:100%;}',
    '.tx-row.has-photo .tx-photo{width:100%;height:100%;max-height:min(82cqh,560px);object-fit:cover;object-position:center;border-radius:var(--r-photo, clamp(16px,2.2vw,24px));box-shadow:0 10px 24px rgba(31,42,68,.14);}',
    '.tx-row.has-photo .tx-lines{justify-content:center;text-align:left;min-width:0;}',
    '.tx-row.has-photo .tx-line{font-size:clamp(18px,min(3.2cqw,5.4cqh),38px);}',
    '.tx-photo-hero{width:min(72cqw,720px);height:min(52cqh,420px);object-fit:cover;object-position:center;border-radius:var(--r-photo, clamp(16px,2.2vw,24px));box-shadow:0 12px 28px rgba(31,42,68,.16);}',
    '.tx-stage.is-photo-hero .tx-hero{gap:clamp(12px,2.8cqh,28px);}',
    /* Photo-hero (title / Big Question): caption under centered photo is centered */
    '.tx-stage.is-photo-hero .tx-lines{text-align:center;align-items:center;}',
    '.tx-stage.is-photo-hero .tx-line{text-align:center;}',
    /* Big Question / titlebg: panel caption under centered photo is centered (not flush-left to photo) */
    '#view .screen.scene.stack:has(.tx-stage.is-photo-hero) .content > .panel,#view .screen.stack:has(.tx-stage.is-photo-hero) .content > .panel{align-items:center;justify-content:flex-start;text-align:center;padding-left:clamp(12px,3.6vw,48px);padding-right:clamp(12px,3.6vw,48px);}',
    '#view .screen.scene.stack:has(.tx-stage.is-photo-hero) .panel .q,#view .screen.scene.stack:has(.tx-stage.is-photo-hero) .panel .rev,#view .screen.stack:has(.tx-stage.is-photo-hero) .panel .q,#view .screen.stack:has(.tx-stage.is-photo-hero) .panel .rev{text-align:center;align-self:center;}',
    '#view .screen.scene.stack:has(.tx-stage.is-photo-hero) .panel .q .line,#view .screen.scene.stack:has(.tx-stage.is-photo-hero) .panel .rev .line{text-align:center;}',
    '#view .screen.scene.stack:has(.tx-stage.is-photo-hero) .panel .pagehint{text-align:center;align-self:center;}',
    '#view .screen.scene.stack:has(.tx-stage.is-photo-hero) .panel .sx-qline,#view .screen.scene.stack:has(.tx-stage.is-photo-hero) .panel .q.qecho .sx-qline{text-align:center;}',
    /* Warm-Up tip: sits in right text column, same left edge as body */
    '.tx-tip{margin-top:clamp(10px,2.2cqh,22px);font-weight:800;font-size:clamp(16px,min(2.8cqw,4.6cqh),28px);line-height:1.35;color:#2F5F8C;text-align:left;align-self:stretch;}',
    '.tx-row.has-photo .tx-tip{text-align:left;}',
    '@container (max-aspect-ratio:5/4){.tx-row.has-photo{display:flex;flex-direction:column;}.tx-row.has-photo .tx-side{width:100%;height:min(36cqh,260px);}.tx-row.has-photo .tx-photo{max-height:36cqh;height:100%;}.tx-photo-hero{width:min(90cqw,560px);height:min(34cqh,280px);}}',

    '@container (max-aspect-ratio:5/4){.tx-row{flex-direction:column;gap:clamp(8px,2cqh,18px);}.tx-ills{max-width:90%;}.ill-tx{--s:clamp(40px,min(12cqh,14cqw),88px);}.tx-photo{width:min(78cqw,320px);max-height:32cqh;}.tx-chips{grid-template-columns:repeat(2,minmax(0,1fr));width:100%;}.tx-line{font-size:clamp(16px,min(4.2cqw,5cqh),28px);}}',
    '.tip-stage{justify-content:center;}',
    '.tip-prop{position:relative;z-index:1;width:min(78cqw,520px);transform:rotate(-3.5deg);filter:drop-shadow(0 14px 22px rgba(31,42,68,.18));}',
    '.tip-clip{position:absolute;left:50%;top:-18px;transform:translateX(-50%);width:54px;height:42px;z-index:2;}',
    '.tip-clip-bar{position:absolute;left:50%;top:0;transform:translateX(-50%);width:46px;height:18px;background:linear-gradient(#E25555,#C43B3B);border-radius:5px 5px 3px 3px;box-shadow:inset 0 1px 0 rgba(255,255,255,.25);}',
    ".tip-clip-bar::before{content:'';position:absolute;left:50%;top:4px;transform:translateX(-50%);width:10px;height:10px;border-radius:50%;background:#FBF6E9;box-shadow:inset 0 0 0 2px #9A2A2A;}",
    '.tip-clip-wire{position:absolute;left:50%;top:14px;transform:translateX(-50%);width:38px;height:26px;border:3px solid #C43B3B;border-top:0;border-radius:0 0 10px 10px;background:transparent;}',
    '.tip-note{background:#FFE566;color:#1F2A44;border-radius:18px;padding:clamp(28px,6cqh,48px) clamp(22px,4cqw,40px) clamp(24px,5cqh,40px);',
    ' text-align:center;font-weight:800;font-size:clamp(20px,min(3.6cqw,6.2cqh),40px);line-height:1.35;}',
    '.tip-yellow .tip-note{background:#FFE566;}',
    '.tip-mint .tip-note{background:#C8F0D4;}',
    '.tip-pink .tip-note{background:#FFC4D6;}',
    '.tip-blue .tip-note{background:#CDE4F8;}',
    '.tip-line{margin:0.15em 0;}',
    '@media (prefers-reduced-motion:reduce){.tip-prop{transform:none}}',
    '@container (max-aspect-ratio:1/1){.tip-prop{width:min(88cqw,520px);transform:rotate(-2deg);}.tip-note{font-size:clamp(18px,min(5.2cqw,5cqh),34px);}}',
    '.dg-map.lit-s1 .dg-card[data-sess="1"],.dg-map.lit-s2 .dg-card[data-sess="2"]{z-index:2;box-shadow:0 0 0 .8cqmin #FFF4C2,0 0 0 2cqmin #E8C04A,0 10px 22px rgba(201,154,34,.35);animation:dgWiggle .9s ease-in-out infinite;}',
    '.dg-map.lit-s1 .dg-card[data-part="2"],.dg-map.lit-s2 .dg-card[data-part="4"]{animation-delay:.15s;}',
    '@keyframes dgWiggle{0%,100%{transform:rotate(0) scale(1.03)}25%{transform:rotate(-2.5deg) scale(1.05)}75%{transform:rotate(2.5deg) scale(1.05)}}',
    '@media (prefers-reduced-motion:reduce){.dg-map.lit-s1 .dg-card[data-sess="1"],.dg-map.lit-s2 .dg-card[data-sess="2"]{animation:none;transform:none;box-shadow:0 0 0 .8cqmin #FFF4C2,0 0 0 2.2cqmin #E8C04A;}}',
    /* ---------- Reading Skills charts + Quick Check (book scans → HTML) ---------- */
    '.ch{gap:2.4cqh;justify-content:center;padding:.6cqh .6cqw;box-sizing:border-box;}',
    '.ch-bank{display:flex;flex-wrap:wrap;justify-content:center;gap:1cqh 1.8cqw;flex:0 0 auto;}',
    '.ch-w{font-weight:800;font-size:clamp(18px,min(3.8cqw,6.2cqh),38px);line-height:1.2;color:#2F5F8C;background:rgba(61,122,181,.13);border-radius:999px;padding:.24em .95em;transition:background .4s ease,color .4s ease,opacity .4s ease;}',
    '.ch-w.is-used{background:#4F9A6B;color:#fff;}',
    '.ch-w.is-extra{opacity:.45;text-decoration:line-through;text-decoration-thickness:2px;}',
    '.ch-body{display:flex;flex-direction:column;gap:1.4cqh;width:100%;flex:0 1 auto;min-height:0;}',
    '.ch-row{display:flex;align-items:stretch;border-radius:clamp(10px,2.2cqmin,20px);overflow:hidden;background:rgba(74,168,232,.12);}',
    '.ch-tag{flex:0 0 22%;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:900;font-size:clamp(16px,min(3.1cqw,5.4cqh),34px);line-height:1.15;padding:.4em .45em;background:#CFE6F7;color:#2F7FC0;}',
    '.ch-row.is-main .ch-tag,.ch-seq .ch-tag,.ch-kwl .ch-tag{background:#4AA8E8;color:#fff;}',
    '.ch-t{flex:1 1 0;min-width:0;padding:.45em .75em;font-weight:700;font-size:clamp(17px,min(3.5cqw,6.2cqh),38px);line-height:1.32;color:#1F2A44;text-align:left;}',
    '.ch-blank{display:inline-flex;align-items:center;gap:.25em;min-width:4.4em;border-bottom:.14em solid #2F7FC0;padding:0 .15em .05em;margin:0 .08em;line-height:1.15;vertical-align:baseline;}',
    '.ch-n{display:inline-grid;place-items:center;flex:0 0 auto;width:1.4em;height:1.4em;border-radius:50%;background:#2F7FC0;color:#fff;font-weight:900;font-size:.72em;line-height:1;}',
    '.ch-a{font-weight:900;color:#2E7D4F;}',
    '.ch-blank.is-filled{border-bottom-color:#4F9A6B;}',
    '.ch-blank.is-filled .ch-n{background:#4F9A6B;}',
    '.ch-hint{flex:0 0 auto;font-weight:800;color:#5B6675;font-size:clamp(15px,min(2.6cqw,4.4cqh),28px);}',
    '.ch-kwl .ch-body{flex-direction:row;align-items:stretch;gap:1.4cqw;}',
    '.ch-kwl .ch-row{flex-direction:column;flex:1 1 0;min-width:0;}',
    '.ch-kwl .ch-row:nth-child(3){flex:1.45 1 0;}',
    '.ch-kwl .ch-tag{flex:0 0 auto;min-height:3.2em;}',
    '.ch-kwl .ch-t{display:flex;align-items:center;}',
    '.ch-kwl .ch-t{font-size:clamp(16px,min(3.2cqw,5.8cqh),34px);}',
    '.ch-kwl .ch-blank{min-width:3.4em;}',
    '.ch-nw{white-space:nowrap;}',
    '.ch-kwl .ch-t{display:block;align-self:stretch;padding-top:1em;}',
    '.ch-seq .ch-body{gap:0;}',
    '.ch-arrow{position:relative;width:22%;height:clamp(14px,3.4cqh,30px);flex:0 0 auto;}',
    '.ch-arrow::before{content:"";position:absolute;left:50%;top:0;bottom:30%;width:clamp(5px,1cqw,9px);transform:translateX(-50%);background:#2F7FC0;}',
    '.ch-arrow::after{content:"";position:absolute;left:50%;bottom:0;transform:translateX(-50%);border-left:clamp(8px,1.8cqw,15px) solid transparent;border-right:clamp(8px,1.8cqw,15px) solid transparent;border-top:clamp(7px,1.6cqh,13px) solid #2F7FC0;}',
    '@keyframes chIn{0%{opacity:0;transform:translateY(10px)}100%{opacity:1;transform:none}}',
    '@keyframes chLit{0%,100%{box-shadow:0 0 0 0 rgba(232,192,74,0)}45%{box-shadow:0 0 0 .5cqmin #FFF4C2,0 0 0 1.1cqmin rgba(232,192,74,.8)}}',
    '@keyframes chPulse{0%,100%{transform:none}50%{transform:scale(1.22)}}',
    '@media (prefers-reduced-motion:no-preference){',
    ' .ch .ch-w{animation:chIn .6s ease-out calc(.3s + var(--k) * .22s) both;}',
    ' .ch.m-ask .ch-row,.ch.m-ask .ch-arrow{animation:chIn .7s ease-out calc(1.3s + var(--i) * .75s) both,chLit 1.4s ease-in-out calc(1.6s + var(--i) * .75s) 1;}',
    ' .ch.m-ask .ch-arrow{animation:chIn .7s ease-out calc(1.1s + var(--i) * .75s) both;}',
    ' .ch.m-ask .ch-blank .ch-n{animation:chPulse 1.2s ease-in-out calc(4.6s + var(--k) * .6s) 2;}',
    ' .ch.m-ask .ch-hint{animation:chIn .6s ease-out 4.4s both;}',
    ' .ch.m-reveal .ch-row,.ch.m-reveal .ch-arrow{animation:chIn .5s ease-out calc(.1s + var(--i) * .15s) both;}',
    ' .ch.m-reveal .ch-blank .ch-a,.ch-blank.is-live .ch-a{display:inline-block;animation:dgPop .6s ease-out calc(.8s + var(--k) * .9s) both;}',
    ' .ch-blank.is-live .ch-a{animation-delay:0s;}',
    '}',
    /* chart screens: drawing gets the width; panel = instruction + numbered tap rows (no repeated sentences) */
    '#view .screen.dg-chart .content > .panel{min-width:0;max-width:40%;}',
    '#view .screen.dg-chart .content > .panel.ix-has-rows{min-width:0;max-width:40%;}',
    '#view .screen.dg-chart .panel .q .line:not(:first-child){display:none;}',
    '#view .screen.dg-chart .ix-choices{counter-reset:chr;}',
    '#view .screen.dg-chart .ix-choices.is-rows .ix-row{counter-increment:chr;flex-wrap:nowrap;}',
    '#view .screen.dg-chart .ix-choices.is-rows .ix-lab{flex:0 0 auto;font-size:0;line-height:0;}',
    '#view .screen.dg-chart .ix-choices.is-rows .ix-lab::before{content:counter(chr);display:inline-grid;place-items:center;width:clamp(30px,2.6vw,40px);height:clamp(30px,2.6vw,40px);border-radius:50%;background:#2F7FC0;color:#fff;font-size:clamp(17px,1.8vw,24px);font-weight:900;line-height:1;}',
    '#view .screen.dg-chart .ix-choices.is-rows .ix-row.is-done .ix-lab::before{background:#4F9A6B;}',
    '#view .screen.dg-chart .panel .rev{display:flex;flex-wrap:wrap;gap:.3em 1em;}',
    '#view .screen.dg-chart .panel .rev .line.ch-ansl{display:inline-flex;align-items:center;gap:.35em;margin:0;}',
    '#view .screen.dg-chart .panel .rev .ch-n{background:#4F9A6B;font-size:.7em;}',
    '@container (max-aspect-ratio:1/1){.ch-kwl .ch-body{flex-direction:column;}.ch-kwl .ch-tag{min-height:0;}.ch-kwl .ch-t{padding-top:.45em;}}',
    /* Quick Check: picture tiles in tap-button order */
    '.qc{gap:3.2cqh;}',
    '.qc-skill{flex:0 0 auto;font-weight:900;font-size:clamp(18px,min(3.4cqw,6cqh),36px);color:#D9821A;}',
    '.qc-row{display:flex;justify-content:center;align-items:center;gap:5cqw;width:100%;flex:0 1 auto;min-height:0;}',
    '.qc-tile{position:relative;flex:0 1 40cqw;width:40cqw;max-width:66cqh;aspect-ratio:1/1;border-radius:clamp(16px,4cqmin,36px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1cqh;',
    ' background:rgba(61,122,181,.10);border:clamp(3px,.7cqmin,6px) solid rgba(61,122,181,.38);box-sizing:border-box;transition:opacity .45s ease,background .45s ease,border-color .45s ease;}',
    '.qc-t1{background:rgba(201,166,58,.12);border-color:rgba(201,166,58,.5);}',
    '.qc-art{display:flex;align-items:flex-end;justify-content:center;gap:1.2cqw;}',
    '.ill-qc{--s:clamp(72px,min(34cqh,19cqw),240px);}',
    '.ill-qc.ill-qc2{--s:clamp(56px,min(24cqh,14cqw),170px);}',
    '.ill-qc.ill-qcc{--s:clamp(56px,min(20cqh,13cqw),160px);}',
    '.qc-e{display:inline-grid;place-items:center;}',
    '.qc-fall0{transform:rotate(-28deg);}',
    '.qc-fall1{transform:rotate(22deg);margin-bottom:6cqh;}',
    '.qc-drops{display:flex;align-items:flex-end;gap:clamp(10px,2.4cqw,28px);padding-bottom:2cqh;}',
    '.qc-drops i{display:block;width:clamp(30px,min(10cqh,6.4cqw),70px);aspect-ratio:1/1;border-radius:0 50% 50% 50%;transform:rotate(45deg);background:linear-gradient(135deg,#BFE6FB,#4AA8E8 55%,#2F7FC0);}',
    '.qc-drops i:nth-child(2){width:clamp(40px,min(15cqh,9cqw),100px);margin-bottom:3cqh;}',
    '.qc-tick{position:absolute;top:-5%;right:-5%;width:clamp(38px,10cqmin,70px);height:clamp(38px,10cqmin,70px);border-radius:50%;background:#4F9A6B;color:#fff;display:grid;place-items:center;font-weight:900;font-size:clamp(20px,5cqmin,38px);opacity:0;transform:scale(.3);transition:opacity .3s ease,transform .3s ease;}',
    '.qc-tile.is-right{background:rgba(79,154,107,.16);border-color:#4F9A6B;}',
    '.qc-tile.is-right .qc-tick{opacity:1;transform:none;}',
    '.qc-tile.is-off{opacity:.38;}',
    '@keyframes qcLit{0%,100%{transform:none;box-shadow:0 0 0 0 rgba(232,192,74,0)}45%{transform:scale(1.04);box-shadow:0 0 0 .7cqmin #FFF4C2,0 0 0 1.6cqmin rgba(232,192,74,.85)}}',
    '@media (prefers-reduced-motion:no-preference){',
    ' .qc .qc-skill{animation:chIn .6s ease-out .2s both;}',
    ' .qc.m-ask .qc-tile{animation:chIn .7s ease-out calc(.4s + var(--k) * .5s) both,qcLit 1.4s ease-in-out calc(1.8s + var(--k) * 1.5s) 1;}',
    ' .qc.m-reveal .qc-tile.is-right{animation:qcLit 1.4s ease-in-out .5s 1;}',
    ' .qc.m-reveal .qc-tile.is-right .qc-tick,.qc.is-live .qc-tile.is-right .qc-tick{animation:dgPop .6s ease-out .4s both;}',
    ' .qc.is-live .qc-tile.is-right .qc-tick{animation-delay:0s;}',
    '}',
    '@container (max-aspect-ratio:1/1){.qc-row{gap:3cqw;}.qc-tile{flex:0 1 46cqw;width:46cqw;}}',
    /* title/opener hero photo: fit the stage with its caption (calm-shell's imgbox img 100%/100% made it overflow) */
    '#view .content > .imgbox .tx-stage.is-photo-hero .tx-hero > .tx-side{flex:1 1 0;min-height:0;height:auto;align-items:center;}',
    '#view .content > .imgbox .tx-stage.is-photo-hero img.tx-photo-hero{width:auto;max-width:100%;height:100%;max-height:100%;aspect-ratio:3/2;object-fit:cover;}',
    '#view .content > .imgbox .tx-stage.is-photo-hero .tx-lines{flex:0 0 auto;}',
  ].join('\n');
  function injectCss() {
    if (document.getElementById('rf-dg-css')) return;
    var s = document.createElement('style'); s.id = 'rf-dg-css'; s.textContent = CSS;
    (document.head || document.documentElement).appendChild(s);
  }
  injectCss();
  window.RFDiagram = { apply: apply, pick: pick, units: UNITS };
})();
