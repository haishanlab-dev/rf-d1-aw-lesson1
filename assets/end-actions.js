/* RF end-of-session action buttons (ea1). Shared by L1 + units + science-review. */
(function (global) {
  'use strict';

  var NEXT = {
    unit1: './unit2/',
    unit2: '../unit3/',
    unit3: '../unit4/',
    unit4: '../science-review/'
    // scienceReview: no next — My progress stretches alone
  };

  function base(unit) {
    return unit === 'unit1' ? './' : '../';
  }

  function ms(name) {
    return '<span class="ms" aria-hidden="true">' + name + '</span>';
  }

  function exitFs() {
    try {
      var d = document;
      if (d.fullscreenElement && d.exitFullscreen) d.exitFullscreen();
      else if (d.webkitFullscreenElement && d.webkitExitFullscreen) d.webkitExitFullscreen();
    } catch (_e) {}
    try {
      document.body.classList.remove('fs');
    } catch (_e2) {}
  }

  function go(url) {
    exitFs();
    try {
      location.href = url;
    } catch (_e) {}
  }

  /**
   * @param {HTMLElement} panel
   * @param {{ unit: string, isFinal: boolean, onRestart: function, onSession2?: function }} opts
   */
  function mount(panel, opts) {
    if (!panel || !opts) return;
    var unit = opts.unit || 'unit1';
    var isFinal = !!opts.isFinal;
    var root = document.createElement('div');
    root.className = 'endrow' + (isFinal ? ' endrow-final' : ' endrow-sess');

    if (isFinal) {
      var row1 = document.createElement('div');
      row1.className = 'endrow-primary';
      var nextUrl = NEXT[unit];
      if (nextUrl) {
        var nextBtn = document.createElement('button');
        nextBtn.type = 'button';
        nextBtn.className = 'endbtn end-next';
        nextBtn.innerHTML = ms('arrow_forward') + ' Next lesson';
        nextBtn.onclick = function () { go(nextUrl); };
        row1.appendChild(nextBtn);
      }
      var progBtn = document.createElement('button');
      progBtn.type = 'button';
      progBtn.className = 'endbtn end-progress' + (nextUrl ? '' : ' end-alone');
      progBtn.innerHTML = ms('insights') + ' My progress';
      progBtn.onclick = function () { go(base(unit) + 'progress/'); };
      row1.appendChild(progBtn);
      root.appendChild(row1);

      var row2 = document.createElement('div');
      row2.className = 'endrow-secondary';
      var homeBtn = document.createElement('button');
      homeBtn.type = 'button';
      homeBtn.className = 'endlink';
      homeBtn.innerHTML = ms('home') + ' Home';
      homeBtn.onclick = function () { go(base(unit)); };
      row2.appendChild(homeBtn);
      var restartBtn = document.createElement('button');
      restartBtn.type = 'button';
      restartBtn.className = 'endlink';
      restartBtn.innerHTML = ms('replay') + ' Start again';
      restartBtn.onclick = function () {
        if (typeof opts.onRestart === 'function') opts.onRestart();
      };
      row2.appendChild(restartBtn);
      root.appendChild(row2);
    } else {
      var sessRow = document.createElement('div');
      sessRow.className = 'endrow-primary endrow-sess-only';
      if (typeof opts.onSession2 === 'function') {
        var s2 = document.createElement('button');
        s2.type = 'button';
        s2.className = 'endbtn end-session2';
        s2.innerHTML = 'Session 2 ' + ms('arrow_forward');
        s2.onclick = function () { opts.onSession2(); };
        sessRow.appendChild(s2);
      }
      root.appendChild(sessRow);
      var sessSec = document.createElement('div');
      sessSec.className = 'endrow-secondary';
      var restartOnly = document.createElement('button');
      restartOnly.type = 'button';
      restartOnly.className = 'endlink';
      restartOnly.innerHTML = ms('replay') + ' Start again';
      restartOnly.onclick = function () {
        if (typeof opts.onRestart === 'function') opts.onRestart();
      };
      sessSec.appendChild(restartOnly);
      root.appendChild(sessSec);
    }

    panel.appendChild(root);
  }

  global.RFEndActions = { mount: mount, NEXT: NEXT };
})(typeof window !== 'undefined' ? window : this);
