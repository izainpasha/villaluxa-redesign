/* Villa Luxa — shared motion layer for both concepts.
 * GSAP 3.13 (ScrollTrigger, SplitText) for entrances, Lenis for smooth scrolling.
 * Everything is skipped when the visitor prefers reduced motion.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !window.gsap || !window.ScrollTrigger) { root.classList.remove('js-motion'); return; }

  var gsap = window.gsap;
  var ST = window.ScrollTrigger;
  var Split = window.SplitText;
  gsap.registerPlugin(ST);
  if (Split) gsap.registerPlugin(Split);

  /* ---------- Lenis smooth scroll, driven by GSAP's ticker ---------- */
  var lenis = null;
  if (window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    // In-page anchors glide to their target, clearing the fixed/sticky header
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="#"]');
      if (!a) return;
      var id = a.getAttribute('href');
      if (id.length < 2) return;
      var target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      var nav = document.querySelector('[data-nav]');
      var offset = id === '#top' ? 0 : -((nav ? nav.offsetHeight : 0) + 12);
      lenis.scrollTo(id === '#top' ? 0 : target, { offset: offset, duration: 1.4 });
      if (target.tabIndex < 0 && id !== '#top') target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    });

    // Freeze page scroll while the booking panel is open (the panel itself scrolls natively)
    document.addEventListener('vl:booking-open', function () { lenis.stop(); });
    document.addEventListener('vl:booking-close', function () { lenis.start(); });
  }

  /* ---------- helpers ---------- */
  var claimed = [];
  function isClaimed(el) {
    for (var i = 0; i < claimed.length; i++) {
      var c = claimed[i];
      if (c === el || c.contains(el) || el.contains(c)) return true;
    }
    return false;
  }
  function pick(selector) {
    return gsap.utils.toArray(selector).filter(function (el) {
      if (isClaimed(el) || el.closest('.hero')) return false;
      return true;
    });
  }
  function claim(list) { claimed.push.apply(claimed, list); return list; }

  /* ---------- hero intro: one orchestrated moment ---------- */
  function heroIntro() {
    var hero = document.querySelector('.hero');
    if (!hero) return;
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: function () { root.classList.remove('js-motion'); } });
    var title = hero.querySelector('.hero-title, h1');
    var lead = gsap.utils.toArray(hero.querySelectorAll('.hero-kicker, .hero-place'));
    var rest = gsap.utils.toArray(hero.querySelectorAll('.hero-sub, .hero-lede, .qb, .book-card, .hero-alt'));

    tl.fromTo(lead, { autoAlpha: 0, y: 14 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0);

    if (title && Split) {
      var split = Split.create(title, { type: 'lines', mask: 'lines' });
      gsap.set(title, { autoAlpha: 1 });
      tl.from(split.lines, { yPercent: 110, duration: 1.15, stagger: 0.09, ease: 'power4.out', onComplete: function () { split.revert(); } }, 0.1);
    } else if (title) {
      tl.fromTo(title, { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1 }, 0.1);
    }
    tl.fromTo(rest, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.9, stagger: 0.1 }, 0.5);

    // Concept A: the video settles in
    var video = hero.querySelector('.hero-video');
    if (video) tl.fromTo(video, { scale: 1.12 }, { scale: 1, duration: 2.6, ease: 'power2.out' }, 0);

    // Concept B: arch photo unveils, tiles and inset photo follow
    var art = hero.querySelector('.hero-art');
    if (art) {
      gsap.set(art, { autoAlpha: 1 });
      var arch = art.querySelector('.arch');
      var tiles = art.querySelector('.hero-tiles');
      var round = art.querySelector('.hero-round');
      var quote = art.querySelector('.hero-quote');
      if (tiles) tl.fromTo(tiles, { autoAlpha: 0, y: 40 }, { autoAlpha: 0.9, y: 0, duration: 1.2 }, 0.2);
      if (arch) tl.fromTo(arch, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.3, ease: 'power4.inOut', clearProps: 'clipPath' }, 0.25);
      if (arch) tl.fromTo(arch.querySelector('img'), { scale: 1.25 }, { scale: 1, duration: 1.8, ease: 'power3.out' }, 0.25);
      if (round) tl.fromTo(round, { autoAlpha: 0, scale: 0.6 }, { autoAlpha: 1, scale: 1, duration: 1, ease: 'back.out(1.6)' }, 0.85);
      if (quote) tl.fromTo(quote, { autoAlpha: 0, y: 30, rotate: -3 }, { autoAlpha: 1, y: 0, rotate: 0, duration: 0.9 }, 1.0);
    }
  }

  /* ---------- scroll entrances ---------- */
  function headings(selector) {
    pick(selector).forEach(function (el) {
      claim([el]);
      if (Split) {
        var split = Split.create(el, { type: 'lines', mask: 'lines' });
        gsap.from(split.lines, {
          yPercent: 105, duration: 1.05, stagger: 0.08, ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 86%', once: true },
          onComplete: function () { split.revert(); },
        });
      } else {
        gsap.from(el, { autoAlpha: 0, y: 30, duration: 0.9, scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
      }
    });
  }

  function images(selector) {
    pick(selector).forEach(function (el) {
      claim([el]);
      var img = el.tagName === 'IMG' ? null : el.querySelector('img');
      var tl = gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
      tl.fromTo(el, { autoAlpha: 0, y: 50 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'power3.out' }, 0);
      if (img) tl.fromTo(img, { scale: 1.18 }, { scale: 1, duration: 1.7, ease: 'power3.out' }, 0);
    });
  }

  function groups(selectors) {
    selectors.forEach(function (selector) {
      var items = claim(pick(selector));
      if (!items.length) return;
      gsap.set(items, { autoAlpha: 0, y: 34 });
      ST.batch(items, {
        start: 'top 90%',
        once: true,
        onEnter: function (batch) {
          gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.85, stagger: 0.09, ease: 'power3.out', overwrite: true });
        },
      });
    });
  }

  function fades(selector) {
    pick(selector).forEach(function (el) {
      claim([el]);
      gsap.from(el, { autoAlpha: 0, y: 22, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
    });
  }

  function parallax(selector, from, to) {
    gsap.utils.toArray(selector).forEach(function (el) {
      gsap.fromTo(el, from, Object.assign({ ease: 'none', scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } }, to));
    });
  }

  function scrollEntrances() {
    // Order matters: groups and images claim their elements first so nothing animates twice.
    groups([
      '.proof-in > li', '.facts > div', '.kv > div', '.room-body', '.direct-list > li', '.direct ul > li',
      '.pkg-grid > .pkg', '.tour-rows > .tour-row', '.tour-grid > .tcard', '.extra-grid > li', '.extras ul > li',
      '.quote-grid > figure', '.rv-cols > figure', '.walk > li', '.route > li', '.arrive > div', '.how > div',
      '.faq-list > details', '.faq-cols > details', '.ch-tabs > [role="tab"]',
    ]);
    images('.capsule, .room-pic, .house-grid figure, .ch-panel:not([hidden])');
    headings('.display, .chapter h2, .direct h2, .extras h2, .closer h2, .feature-quote p');
    fades([
      '.chapter-label', '.chapter-row > p', '.sec-head > p', '.intro-copy > p', '.hg-text > p',
      '.direct-grid > div > p', '.tours-hero-copy p', '.faq-grid > div > p', '.faq-grid > div > .btn',
      '.cta-row', '.rv-foot', '.tours-more', '.faq-more', '.extras-cta', '.direct .btn',
      '.address', '.addr', '.fine', '.verified', '.fq-mono', '.feature-quote figcaption',
      '.closer p', '.closer-cta', '.closer-in > img', '.closer-card',
    ].join(','));

    // Gentle depth on the big photographs and the signature patterns
    parallax('.tours-hero img', { yPercent: -8 }, { yPercent: 8 });
    parallax('.checker', { backgroundPositionX: '0px' }, { backgroundPositionX: '240px' });
    parallax('.tileband', { backgroundPositionX: '0px' }, { backgroundPositionX: '-360px' });
    parallax('.hero-tiles', { yPercent: 0 }, { yPercent: -10 });
    parallax('.closer', { backgroundPositionY: '0px' }, { backgroundPositionY: '-120px' });
  }

  /* ---------- interactive moments ---------- */
  // Concept B room chooser: the newly selected room settles in
  document.addEventListener('click', function (e) {
    var tab = e.target.closest('[data-chooser] [role="tab"]');
    if (!tab) return;
    var panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (!panel || panel.hidden) return;
    gsap.fromTo(panel.querySelector('img'), { scale: 1.08, autoAlpha: 0.4 }, { scale: 1, autoAlpha: 1, duration: 0.9, ease: 'power3.out' });
    gsap.fromTo(panel.querySelectorAll('.ch-info > *'), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.6, stagger: 0.05, ease: 'power3.out' });
  });

  // Booking panel: steps cascade in as the drawer opens
  document.addEventListener('vl:booking-open', function () {
    gsap.fromTo('#booking .bk-step, #booking .bk-summary', { autoAlpha: 0, x: 28 }, { autoAlpha: 1, x: 0, duration: 0.6, stagger: 0.07, delay: 0.12, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
  });

  /* ---------- start once fonts are ready (line splits need final metrics) ---------- */
  var started = false;
  function start() {
    if (started) return;
    started = true;
    heroIntro();
    scrollEntrances();
    ST.refresh();
  }
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(start);
    setTimeout(start, 2500); // never wait on a slow font forever
  } else {
    start();
  }
  window.addEventListener('load', function () { ST.refresh(); });
})();
