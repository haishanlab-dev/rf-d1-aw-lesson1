/** Apply text/font/voice prefs before paint (avoids size/font jump on refresh). */
(function () {
  try {
    var root = document.documentElement;
    var ts = (localStorage.getItem('rfTextSize') || 'large').trim();
    if (['medium', 'large', 'xl'].indexOf(ts) < 0) ts = 'large';
    var fh = localStorage.getItem('rfFontHarmony');
    var font = (fh === '0' || fh === 'false') ? 'system' : 'harmony';
    var voice = (localStorage.getItem('rfVoice') || 'en-GB').trim();
    if (voice !== 'en-US' && voice !== 'en-GB') voice = 'en-GB';
    root.setAttribute('data-text-size', ts);
    root.setAttribute('data-font', font);
    root.setAttribute('data-voice', voice);
  } catch (e) {}
})();

/** Miles splash — show logo while fonts/resources settle, then enter page. */
(function () {
  var STYLE_ID = 'milesSplashStyle';
  if (!document.getElementById(STYLE_ID)) {
    var css = document.createElement('style');
    css.id = STYLE_ID;
    css.textContent = [
      'html.miles-loading{background:#FBF6E9}',
      'html.miles-loading #wrap{visibility:hidden!important}',
      'html.miles-loading body{visibility:hidden}',
      'html.miles-loading #milesSplash{visibility:visible!important}',
      '#milesSplash{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;',
      'background:#FBF6E9;transition:opacity .28s ease}',
      '#milesSplash img{width:min(300px,56vw);max-width:360px;height:auto;display:block}',
      '#milesSplash.out{opacity:0;pointer-events:none}'
    ].join('');
    (document.head || document.documentElement).appendChild(css);
  }
  document.documentElement.classList.add('miles-loading');

  function assetBase() {
    var scripts = document.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i].src || '';
      var m = s.match(/^(.*\/)?assets\/prefs-boot\.js(?:\?.*)?$/);
      if (m) return (m[1] || '') + 'assets/';
    }
    // fallback by path depth
    var path = location.pathname || '';
    if (path.indexOf('/progress/parent') >= 0) return '../../assets/';
    if (path.indexOf('/progress') >= 0 || path.indexOf('/unit') >= 0 || path.indexOf('/book') >= 0 || path.indexOf('/science-review') >= 0) return '../assets/';
    return 'assets/';
  }

  function mount() {
    if (document.getElementById('milesSplash')) return;
    var el = document.createElement('div');
    el.id = 'milesSplash';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-label', 'Loading');
    var img = document.createElement('img');
    img.alt = 'Miles';
    img.width = 300;
    img.height = 80;
    img.src = assetBase() + 'brand/miles-logo.png';
    el.appendChild(img);
    document.body.appendChild(el);
  }

  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  var done = false;
  function enter() {
    if (done) return;
    done = true;
    document.documentElement.classList.remove('miles-loading');
    var el = document.getElementById('milesSplash');
    if (!el) return;
    el.classList.add('out');
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 320);
  }

  var started = Date.now();
  var minMs = 480;
  var fontsP = (document.fonts && document.fonts.ready) ? document.fonts.ready.catch(function () {}) : Promise.resolve();
  var loadP = new Promise(function (resolve) {
    if (document.readyState === 'complete') resolve();
    else window.addEventListener('load', resolve);
  });
  Promise.all([fontsP, loadP]).then(function () {
    var wait = Math.max(0, minMs - (Date.now() - started));
    setTimeout(enter, wait);
  });
  setTimeout(enter, 4500);
})();
