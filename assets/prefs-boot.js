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
