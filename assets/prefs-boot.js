/** Apply text/font/voice prefs before paint (avoids size/font jump on refresh). */
(function () {
  try {
    var root = document.documentElement;
    var ts = (localStorage.getItem('rfTextSize') || 'large').trim();
    if (['medium', 'large', 'xl'].indexOf(ts) < 0) ts = 'large';
    var fh = localStorage.getItem('rfFontHarmony');
    var font = (fh === '0' || fh === 'false') ? 'system' : 'nunito';
    var voice = (localStorage.getItem('rfVoice') || 'en-GB').trim();
    if (voice !== 'en-US' && voice !== 'en-GB') voice = 'en-GB';
    root.setAttribute('data-text-size', ts);
    root.setAttribute('data-font', font);
    root.setAttribute('data-voice', voice);
  } catch (e) {}
})();

/** Miles splash — reuse top-left chrome: Material face icon + learner name. */
(function () {
  var STYLE_ID = 'milesSplashStyle';
  if (!document.getElementById(STYLE_ID)) {
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = [
      'html.miles-loading{background:#FBF6E9}',
      'html.miles-loading #wrap{visibility:hidden!important}',
      'html.miles-loading #milesSplash{visibility:visible!important}',
      '#milesSplash{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;',
      'background:#FBF6E9;transition:opacity .28s ease}',
      '#milesSplash .miles-splash-mark{display:inline-flex;align-items:center;gap:14px;',
      'font-family:var(--font-nunito,var(--font-harmony)),system-ui,-apple-system,"Segoe UI",sans-serif;',
      'font-weight:800;font-size:clamp(28px,5vw,44px);color:#1F2A44;line-height:1}',
      '#milesSplash .miles-splash-mark .ms{font-size:clamp(40px,7vw,56px);color:#3D7AB5;',
      'font-family:"Material Symbols Rounded",sans-serif;font-variation-settings:"FILL" 1,"wght" 500,"GRAD" 0,"opsz" 48;',
      'font-style:normal;font-weight:normal;line-height:1;display:inline-flex}',
      '#milesSplash.out{opacity:0;pointer-events:none}'
    ].join('');
    (document.head || document.documentElement).appendChild(css);
  }
  document.documentElement.classList.add('miles-loading');

  function assetBase() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i].src || '';
      var m = s.match(/^(.*\/)assets\/prefs-boot\.js(?:\?.*)?$/);
      if (m) return m[1] + 'assets/';
    }
    var path = location.pathname || '';
    if (path.indexOf('/progress/parent') >= 0) return '../../assets/';
    if (/\/(progress|unit\d+|book|science-review)(\/|$)/.test(path)) return '../assets/';
    return 'assets/';
  }

  function ensureIconFont() {
    var href = assetBase() + 'fonts/material-symbols.css';
    var links = document.getElementsByTagName('link');
    for (var i = 0; i < links.length; i++) {
      if ((links[i].href || '').indexOf('material-symbols') >= 0) return;
    }
    // calm-shell @imports it — still add direct link so splash icons work early
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    (document.head || document.documentElement).appendChild(link);
  }

  function learnerName() {
    try {
      var n = (localStorage.getItem('rfLearnerName') || 'Miles').trim();
      return n || 'Miles';
    } catch (e) { return 'Miles'; }
  }

  var done = false;
  function mount() {
    /* Slow first load: the 2.5 s fallback may already have revealed the page before
       DOMContentLoaded. Mounting the splash after that left it covering the lesson. */
    if (done || document.getElementById('milesSplash')) return;
    ensureIconFont();
    var el = document.createElement('div');
    el.id = 'milesSplash';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Loading');
    var mark = document.createElement('div');
    mark.className = 'miles-splash-mark';
    var icon = document.createElement('span');
    icon.className = 'ms';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = 'face';
    var name = document.createElement('span');
    name.className = 'miles-splash-name';
    name.textContent = learnerName();
    mark.appendChild(icon);
    mark.appendChild(name);
    el.appendChild(mark);
    document.body.appendChild(el);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  function removeSplash() {
    var el = document.getElementById('milesSplash');
    if (!el) return;
    el.classList.add('out');
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 320);
  }
  function enter() {
    /* Always clear splash once we've decided to enter — even if done was set by the
       2.5 s fallback before DOMContentLoaded mounted anything. mount() already refuses
       to create a splash after done=true; this covers any late node. */
    if (done) { removeSplash(); return; }
    done = true;
    document.documentElement.classList.remove('miles-loading');
    try { document.documentElement.style.visibility = ''; } catch (e) {}
    try { if (document.body) document.body.style.visibility = ''; } catch (e) {}
    var wrap = document.getElementById('wrap');
    if (wrap) wrap.style.visibility = '';
    removeSplash();
  }

  var started = Date.now();
  var minMs = 480;
  var fontsP = Promise.race([
    (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(function () {}) : Promise.resolve(),
    new Promise(function (r) { setTimeout(r, 1200); })
  ]);
  var loadP = new Promise(function (resolve) {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  });
  Promise.all([fontsP, loadP]).then(function () {
    var wait = Math.max(0, minMs - (Date.now() - started));
    setTimeout(enter, wait);
  });
  setTimeout(enter, 2500);
})();
