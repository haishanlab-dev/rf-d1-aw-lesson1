/* Reading Future · Listen-and-Read as real HTML (rounded white box).
   RFReading.apply(view, sc, state, unit) — replaces page-screenshot crops.
   Read-along: sentence highlight timed by character length × screen narration. */
(function () {
  'use strict';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

  var PASS = {
    unit1: {
      vocab: ['know', 'when', 'necks', 'air', 'rabbits', 'fat'],
      photo: { p1: 'horse_p11.jpg', p2: 'horse_p11.jpg', p3: 'rabbit_big.jpg', all: 'horse_p11.jpg' },
      paras: [
        { id: 'p1', sents: ['Farmers need to know about the weather.', 'Their farms need it!', 'Animals can help.'] },
        { id: 'p2', sents: ['Cows and horses know when it will rain.', 'They stretch their necks.', 'They smell the air.', 'Then the farmer knows it will rain.'] },
        { id: 'p3', sents: ['Winter is coming.', 'The rabbits are eating a lot.', 'They are getting very fat.', 'Then the farmer knows it will be a long, cold winter.', 'How do the animals know?'] }
      ]
    },
    unit2: {
      vocab: ['storm', 'cloudy', 'tall', 'sky', 'top', 'all'],
      photo: { p1: 'cloudy.jpg', p2: 'cloudy.jpg', p3: 'cloudy.jpg', p4: 'storm_cloud.jpg', all: 'storm_cloud.jpg' },
      paras: [
        { id: 'p1', sents: ["It's cloudy outside.", 'But will it rain?', 'Not all clouds make rain.'] },
        { id: 'p2', sents: ['Some clouds are high.', 'They are thin and long.', 'They do not make rain.'] },
        { id: 'p3', sents: ['Other clouds are low.', 'They are white and fluffy.', 'They do not make rain.'] },
        { id: 'p4', sents: ['Storm clouds are dark and gray.', 'They are very big and tall.', 'Their bottoms are low in the sky, and their tops are high.', 'These clouds make rain!'] }
      ]
    },
    unit3: {
      vocab: ['snow', 'become', 'fall', 'warm', 'dangerous', 'happen'],
      photo: { p1: null, p2: null, p3: 'snow_photo.jpg', all: 'snow_photo.jpg' },
      paras: [
        { id: 'p1', sents: ['Clouds are made of water.', 'In the end, this water falls down to the earth as rain.'] },
        { id: 'p2', sents: ['Rain happens when it is warm or hot.', 'Rain falls as drops of water.', 'Snow happens when it is cold.', 'Snow falls as flakes of ice.'] },
        { id: 'p3', sents: ['Hail happens when it is cold or warm.', 'Water moves up and down inside the storm clouds.', 'It becomes ice.', 'Hail falls as balls of ice.', 'It can be dangerous.'] }
      ]
    },
    unit4: {
      vocab: ['surprised', 'tornadoes', 'tornado', 'winds', 'into', 'carry', 'probably'],
      photo: { p1: 'fish_road.jpg', p2: 'fish_road.jpg', p3: null, p4: 'fish_road.jpg', all: 'fish_road.jpg' },
      paras: [
        { id: 'p1', sents: ['Rain falls from the sky.', 'Snow falls from the sky.', 'In 2014, fish fell from the sky.', 'It was in Sri Lanka.'] },
        { id: 'p2', sents: ['People there were surprised.', 'Fish were falling on their homes.', 'How could this happen?'] },
        { id: 'p3', sents: ['Tornadoes are strong winds.', 'They pick up things and move them into the sky.', 'A tornado can carry things far.', 'A tornado over water can pick up fish.'] },
        { id: 'p4', sents: ['Is this what happened?', 'Probably!'] }
      ]
    }
  };

  function focusIds(sc) {
    var en = (sc.en || '').toLowerCase();
    var m = /part\s*(\d)/.exec(en);
    if (m) return ['p' + m[1]];
    if (sc.zh === 'Listen and Read') return ['p1'];
    return null; // all paras equally visible (Think / Retell / Recap)
  }

  var IBASE = (function () { var sc = document.currentScript && document.currentScript.src; return sc ? sc.replace(/[^\/]*$/, '') : 'assets/'; })();
  function imgSrc(name) {
    try { if (typeof IMGS !== 'undefined' && IMGS && IMGS[name]) return IMGS[name]; } catch (e) {}
    return IBASE + 'img/' + name;
  }

  function markVocab(text, vocab) {
    if (!vocab || !vocab.length) return esc(text);
    var re = new RegExp('\\b(' + vocab.map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }).join('|') + ')\\b', 'gi');
    return esc(text).replace(re, '<span class="rd-v">$1</span>');
  }

  /* Each word in its own span so read-along can grow the word being read. */
  function wordsHtml(text, vocab) {
    var vs = (vocab || []).map(function (w) { return w.toLowerCase(); });
    return String(text).split(/\s+/).filter(Boolean).map(function (tok) {
      var core = tok.toLowerCase().replace(/[^a-z0-9']/g, '');
      return '<span class="rd-w' + (vs.indexOf(core) >= 0 ? ' rd-v' : '') + '">' + esc(tok) + '</span>';
    }).join(' ');
  }

  function buildHtml(pass, focus, photoName) {
    var h = '<div class="rd-box' + (photoName ? ' has-photo' : '') + '" role="document">';
    if (photoName) h += '<div class="rd-media"><img class="rd-photo" src="' + imgSrc(photoName) + '" alt=""></div>';
    h += '<div class="rd-body">';
    var si = 0;
    pass.paras.forEach(function (p) {
      var on = !focus || focus.indexOf(p.id) >= 0;
      h += '<p class="rd-p' + (on ? ' is-focus' : ' is-dim') + '" data-pid="' + p.id + '">';
      p.sents.forEach(function (s) {
        h += '<span class="rd-s" data-si="' + (si++) + '">' + wordsHtml(s, pass.vocab) + '</span> ';
      });
      h += '</p>';
    });
    return h + '</div></div>';
  }

  function flatSents(pass, focus) {
    var out = [];
    pass.paras.forEach(function (p) {
      if (focus && focus.indexOf(p.id) < 0) return;
      p.sents.forEach(function (s) { out.push(s); });
    });
    return out;
  }

  var alongTok = 0, alongTimer = null;

  function clearDock(root) {
    try { (root || document).querySelectorAll('.rd-w.is-dock').forEach(function (el) { el.classList.remove('is-dock', 'is-now'); el.style.transform = ''; }); } catch (e) {}
  }
  function stopAlong() {
    alongTok++;
    if (alongTimer) { clearInterval(alongTimer); alongTimer = null; }
    try { document.querySelectorAll('.rd-s.is-on').forEach(function (el) { el.classList.remove('is-on'); }); } catch (e) {}
    clearDock();
  }

  /* ---- word timings (assets/voice/<voice>/<slug>/words.json, built by tools/build_word_times.py) ---- */
  var wordsCache = {};
  function loadWords(url) {
    if (!wordsCache[url]) {
      wordsCache[url] = fetch(url, { cache: 'force-cache' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; });
    }
    return wordsCache[url];
  }
  function norm(w) { return String(w).toLowerCase().replace(/[^a-z0-9]/g, ''); }
  /* Match each word on screen to a spoken word (in order); fill gaps by spreading time evenly. */
  function alignTimes(disp, spoken) {
    var n = disp.length, out = new Array(n), j = 0;
    for (var i = 0; i < n; i++) {
      var want = norm(disp[i]), win = i === 0 ? 60 : 6;
      for (var k = j; k < Math.min(spoken.length, j + win); k++) {
        if (norm(spoken[k][2]) === want) { out[i] = [spoken[k][0], spoken[k][1]]; j = k + 1; break; }
      }
    }
    var first = -1;
    for (i = 0; i < n; i++) if (out[i]) { first = i; break; }
    if (first < 0) return null;
    for (i = 0; i < n; i++) {
      if (out[i]) continue;
      var a = i - 1; while (a >= 0 && !out[a]) a--;
      var b = i + 1; while (b < n && !out[b]) b++;
      var t0 = a >= 0 ? out[a][1] : Math.max(0, out[first][0] - 0.4 * (first - i));
      var t1 = b < n ? out[b][0] : t0 + 0.4 * (b - a);
      var steps = (b < n ? b : n) - a;
      var s = t0 + (t1 - t0) * (i - a) / Math.max(1, steps);
      out[i] = [s, s + Math.max(0.15, (t1 - t0) / Math.max(1, steps))];
    }
    return out;
  }

  /* Dock-style grow: the word being read grows most, its neighbours a little.
     Words on the same line slide apart by exactly the extra width, so nothing overlaps;
     the line is nudged back inside the box if it would spill over an edge. */
  var DOCK = [1.42, 1.16, 1.05];
  /* ?rdmode=color (or localStorage rfReadMode='color'): the word only changes colour, no grow. */
  function paintDock(words, cur, body) {
    words.forEach(function (el) { if (el.classList.contains('is-dock')) { el.classList.remove('is-dock', 'is-now'); el.style.transform = ''; } });
    if (cur < 0) return;
    var top = words[cur].offsetTop, line = [];
    for (var i = 0; i < words.length; i++) if (Math.abs(words[i].offsetTop - top) < 4) line.push(i);
    var base = {};
    line.forEach(function (k) { var d = Math.abs(k - cur); base[k] = d < DOCK.length ? DOCK[d] - 1 : 0; });
    // room = space left/right of the line inside the text box (the box has side padding for this)
    var first = words[line[0]], last = words[line[line.length - 1]];
    var room = (first.offsetLeft) + (body.clientWidth - (last.offsetLeft + last.offsetWidth));
    var need = 0; line.forEach(function (k) { need += base[k] * words[k].offsetWidth; });
    var f = need > room && need > 0 ? Math.max(0, room / need) : 1;  // shrink the grow if a full line cannot make room
    var sc = {}, ex = {};
    line.forEach(function (k) { sc[k] = 1 + base[k] * f; ex[k] = (sc[k] - 1) * words[k].offsetWidth; });
    var sh = {}; sh[cur] = 0;
    var ci = line.indexOf(cur), acc = ex[cur] / 2;
    for (i = ci + 1; i < line.length; i++) { var k2 = line[i]; sh[k2] = acc + ex[k2] / 2; acc += ex[k2]; }
    acc = ex[cur] / 2;
    for (i = ci - 1; i >= 0; i--) { var k3 = line[i]; sh[k3] = -(acc + ex[k3] / 2); acc += ex[k3]; }
    var lo = Infinity, hi = -Infinity;
    line.forEach(function (k) {
      var l = words[k].offsetLeft + sh[k] - ex[k] / 2, r = words[k].offsetLeft + words[k].offsetWidth + sh[k] + ex[k] / 2;
      if (l < lo) lo = l; if (r > hi) hi = r;
    });
    var nudge = 0;
    if (hi > body.clientWidth) nudge = body.clientWidth - hi;
    if (lo + nudge < 0) nudge = -lo;
    line.forEach(function (k) {
      if (sc[k] === 1 && Math.abs(sh[k] + nudge) < 0.5) return;
      words[k].classList.add('is-dock');
      if (k === cur) words[k].classList.add('is-now');
      words[k].style.transform = 'translateX(' + (sh[k] + nudge).toFixed(1) + 'px) scale(' + sc[k].toFixed(3) + ')';
    });
  }

  function startAlong(box, sc, sents) {
    stopAlong();
    if (!sents.length) return;
    var my = ++alongTok;
    var reduce = false;
    try { reduce = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    if (reduce) return;
    var weights = sents.map(function (s) { return Math.max(8, s.length); });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var dur = Math.max(2, Number(sc.dn) || 10);
    // leave a short lead-in for "Miles, turn to page…" on Part 1 screens
    var lead = /part\s*1/i.test(sc.en || '') ? Math.min(3.2, dur * 0.28) : 0.35;
    var speak = Math.max(1.5, dur - lead);
    var map = [];
    box.querySelectorAll('.rd-s').forEach(function (el) { if (!el.closest('.rd-p.is-dim')) map.push(el); });
    var words = [], wordSent = [];
    map.forEach(function (el, si) { el.querySelectorAll('.rd-w').forEach(function (w) { words.push(w); wordSent.push(si); }); });
    var body = box.querySelector('.rd-body');
    var key = '%02d_n'.replace('%02d', (sc.i < 10 ? '0' : '') + sc.i);
    var times = null, timesFor = '', lastWord = -2;
    function paint(i) {
      map.forEach(function (el, k) { el.classList.toggle('is-on', k === i); });
    }
    var au = document.getElementById('au');
    alongTimer = setInterval(function () {
      if (my !== alongTok) return;
      if (au && !au.paused && isFinite(au.currentTime) && au.currentTime > 0.05) {
        var src = (au.currentSrc || au.src || '').split('?')[0];
        var dir = src.replace(/[^\/]*$/, '');
        if (dir && timesFor !== dir) {
          timesFor = dir; times = null;
          loadWords(dir + 'words.json').then(function (d) {
            if (my !== alongTok || timesFor !== dir || !d || !d[key]) return;
            times = alignTimes(words.map(function (w) { return w.textContent; }), d[key]);
          });
        }
        var t = au.currentTime;
        if (times) {
          var cw = -1;
          if (t >= times[0][0] - 0.05 && t <= times[times.length - 1][1] + 0.35) {
            for (var w = 0; w < times.length; w++) { if (times[w][0] - 0.05 <= t) cw = w; else break; }
          }
          if (cw !== lastWord) { lastWord = cw; paintDock(words, cw, body); paint(cw >= 0 ? wordSent[cw] : -1); }
          return;
        }
        // no timings: sentence highlight from text length
        if (t < lead) { paint(-1); return; }
        var u = Math.min(1, (t - lead) / speak);
        var acc = 0, idx = map.length - 1;
        for (var i = 0; i < weights.length; i++) {
          acc += weights[i] / sum;
          if (u <= acc) { idx = i; break; }
        }
        paint(idx);
      } else if (au && au.ended) {
        paint(-1); clearDock(box); stopAlong();
      }
    }, 50);
  }

  function shouldHandle(sc) {
    if (!sc) return false;
    if (sc.zh === 'Listen and Read') return true;
    // Story Recap → diagrams text scene (summary + glyphs). Think/Retell keep the reading box as context.
    if (sc.zh === 'Story Recap') return false;
    var img = sc.img || '';
    if (/^reading_p\d+\.jpg$/i.test(img)) return true;
    return false;
  }

  function photoFor(pass, focus, sc) {
    var ph = pass.photo || {};
    if (sc && sc.photo) return sc.photo; // per-screen photo set in the lesson data
    if (focus && focus.length === 1 && ph[focus[0]] !== undefined) return ph[focus[0]];
    // companion photo from the screen itself when it is a photo (not the page crop)
    var img = sc.img || '';
    if (img && !/^reading_p/i.test(img) && /\.(jpg|png)$/i.test(img) && img !== 'fish_road.jpg') return img;
    if (img === 'fish_road.jpg') return null; // animation lives elsewhere; keep box text-only or skip conflict
    return ph.all || null;
  }

  function apply(view, sc, state, unit) {
    try {
      if (!shouldHandle(sc)) return null;
      var pass = PASS[unit] || PASS.unit1;
      if (!pass) return null;
      var box = view.querySelector('.imgbox'); if (!box) return null;
      var focus = focusIds(sc);
      // Story Recap / Think / Retell on reading page: show all paras, focus none special (all readable)
      if (sc.zh !== 'Listen and Read') focus = null;
      var photo = photoFor(pass, focus, sc);
      // U4 Listen parts that used fish_road: keep HTML box; photo optional null (fish scene is separate)
      if (sc.zh === 'Listen and Read' && sc.img === 'fish_road.jpg') photo = null;
      if (sc.zh === 'Listen and Read' && sc.img === 'title_p22.jpg') photo = null;

      box.classList.add('has-dg', 'has-rd');
      box.innerHTML = buildHtml(pass, focus, photo);
      var scr = view.querySelector('.screen');
      if (scr) scr.classList.add('stack', 'is-read');
      // drop duplicate side lines for normal Listen and Read
      var panel = view.querySelector('#panel') || view.querySelector('.panel');
      if (panel && sc.type === 'normal' && sc.zh === 'Listen and Read') {
        panel.innerHTML = '<div class="line hint">Listen and follow the words.</div>';
      }
      if (sc.zh === 'Listen and Read') {
        var sents = flatSents(pass, focus);
        startAlong(box, sc, sents);
      } else {
        stopAlong();
      }
      return 'reading';
    } catch (e) { return null; }
  }

  var CSS = [
    '#view .imgbox.has-rd{display:flex;align-items:center;justify-content:center;padding:clamp(2px,.6cqh,8px) clamp(2px,.8cqw,10px);width:100%;}',
    '.rd-box{position:relative;width:100%;height:min(100%,98cqh);max-width:none;background:#fff;border-radius:clamp(16px,2.4cqmin,28px);',
    ' box-shadow:0 8px 28px rgba(31,42,68,.10),0 1px 0 rgba(31,42,68,.04);padding:clamp(10px,min(1.8cqw,2.4cqh),22px);',
    ' overflow:hidden;container-type:size;display:flex;flex-direction:row;align-items:stretch;gap:clamp(12px,2.4cqw,28px);}',
    '.rd-box:not(.has-photo){flex-direction:column;}',
    /* TRUE 50/50: photo | text inside white box */
    '.rd-box.has-photo{display:grid;grid-template-columns:1fr 1fr;gap:clamp(12px,2.4cqw,28px);align-items:stretch;}',
    '.rd-media{min-width:0;min-height:0;display:flex;align-items:stretch;height:100%;}',
    '.rd-photo,.rd-box.has-photo .rd-photo{width:100%!important;height:100%!important;min-height:min(70cqh,420px)!important;max-height:none!important;object-fit:cover!important;object-position:center!important;border-radius:var(--r-photo, clamp(16px, 2.2vw, 24px))!important;filter:none!important;float:none!important;margin:0!important;display:block;}',
    '#view .content > .imgbox.has-rd img.rd-photo,#view .imgbox img.rd-photo{width:100%!important;height:100%!important;max-height:none!important;object-fit:cover!important;border-radius:var(--r-photo, clamp(16px, 2.2vw, 24px))!important;filter:none!important;float:none!important;margin:0!important;}',
    '.rd-body{min-width:0;overflow:auto;font-family:inherit;color:#1F2A44;font-weight:700;font-size:clamp(17px,min(2.8cqw,5.2cqh),34px);line-height:1.45;text-align:left;display:flex;flex-direction:column;justify-content:center;}',
    '.rd-p{margin:0 0 0.75em;} .rd-p:last-child{margin-bottom:0;}',
    '.rd-p.is-dim{opacity:.34;}.rd-p.is-dim .rd-v{opacity:.85;}',
    '.rd-p.is-focus{opacity:1;}',
    '.rd-s{padding:0;}',
    /* Sentence being read: no box; its words get a coloured outline (moves and grows with each word). */
    '.rd-s.is-on .rd-w,.rd-s.is-on .rd-v{color:#7C3AED;}',
    '.rd-v{color:#2F7FC0;font-weight:900;}',
    '.rd-w{display:inline-block;line-height:1.15;transform-origin:50% 55%;transition:transform .22s cubic-bezier(.3,.7,.3,1),color .22s ease;will-change:transform;}',
    '.rd-s.is-on .rd-w.is-now,.rd-w.is-now{color:#EA580C;}',
    '.rd-body{position:relative;line-height:1.7;overflow-x:hidden;padding-inline:1em;}',
    '#view .screen.is-read .content > .panel .line.hint{color:#2F5F8C;font-weight:800;}',
    /* narrow / portrait: stack only when two columns would crush text */
    '@container (max-width:520px){.rd-box.has-photo{display:flex;flex-direction:column;}.rd-media{flex:0 0 auto;width:100%;height:min(34cqh,240px);}.rd-photo{min-height:0!important;}.rd-body{font-size:clamp(16px,min(4.4cqw,5.2cqh),28px);justify-content:flex-start;}}',
    '@container (max-aspect-ratio:4/5){.rd-box.has-photo{display:flex;flex-direction:column;}.rd-media{flex:0 0 auto;width:100%;height:min(32cqh,220px);}.rd-photo{min-height:0!important;}}',
    '@media (prefers-reduced-motion:reduce){.rd-s,.rd-w{transition:none}}'
  ].join('\n');
  var st = document.createElement('style'); st.id = 'rf-rd-css'; st.textContent = CSS;
  (document.head || document.documentElement).appendChild(st);

  window.RFReading = { apply: apply, stop: stopAlong, _pass: PASS };
})();
