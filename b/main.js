(function () {
  var nav = document.querySelector('[data-nav]');
  var mbar = document.querySelector('.mbar');
  var card = document.querySelector('.book-card');
  function onScroll() {
    nav.classList.toggle('is-solid', window.scrollY > 10);
    // Mobile booking bar appears once the hero booking card has scrolled away
    if (mbar && card) mbar.classList.toggle('is-on', card.getBoundingClientRect().bottom < 0);
  }
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  // Room chooser: accessible tabs (click + arrow keys)
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-chooser] [role="tab"]'));
  function select(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { select(t); });
    t.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') n = tabs[0];
      if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); select(n, true); }
    });
  });
})();
