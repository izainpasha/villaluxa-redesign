/* Villa Luxa — shared booking engine for both design concepts.
 *
 * Renders the booking panel into #booking (styled per concept via .bk-* classes),
 * prices the stay live, and hands the request off to WhatsApp.
 *
 * STRIPE LATER: set CONFIG.checkout = 'stripe' and implement startStripeCheckout().
 * GitHub Pages is static, so Stripe needs either Payment Links or a small serverless
 * function (Cloudflare Worker / Netlify / Vercel) that creates a Checkout Session from
 * the `request` object built in buildRequest(). Nothing else in the UI has to change.
 */
(function () {
  'use strict';

  var CONFIG = {
    checkout: 'whatsapp', // 'whatsapp' | 'stripe'
    whatsapp: '351924338608',
    currency: 'EUR',
  };

  var ROOMS = [
    { id: 'family-terrace', name: 'Family Room with Terrace', beds: '1 king + 1 queen', sleeps: 4, size: 28, price: 120, img: 'family-terrace.webp', pets: true, note: 'Private terrace' },
    { id: 'family', name: 'Family Room', beds: '1 king + 1 queen', sleeps: 4, size: 28, price: 110, img: 'family-room.webp', pets: true, note: 'Moorish Castle views' },
    { id: 'king-suite', name: 'Deluxe King Suite', beds: '1 king', sleeps: 2, size: 22, price: 100, img: 'king-suite.webp', pets: true, note: 'Garden-facing windows' },
    { id: 'double', name: 'Deluxe Double Room', beds: '1 double', sleeps: 2, size: 18, price: 89, img: 'deluxe-double.webp', pets: false, note: 'Pastel blue, brass lamps' },
  ];

  var EXTRAS = [
    { id: 'transfer', name: 'Airport transfer', detail: 'Private car, up to 6 passengers', options: [['One way', 50], ['Both ways', 100]] },
    { id: 'massage', name: 'Massage in your room', detail: 'With a visiting therapist', options: [['60 min', 65], ['90 min', 85], ['120 min', 120]] },
    { id: 'celebration', name: 'Celebration surprise', detail: 'Balloons, wine and a card waiting in the room', options: [['Add', 25]] },
    { id: 'early', name: 'Early check-in', detail: 'Your room from 12:00', options: [['Add', 20]] },
    { id: 'late', name: 'Late check-out', detail: 'Keep the room until 14:00', options: [['Add', 20]] },
    { id: 'pet', name: 'Bringing a pet', detail: 'Per stay. Not in the Deluxe Double', options: [['Add', 20]], needsPetRoom: true },
  ];

  var TOURS = {
    'sintra-day': 'Sintra in a day package (1 night, Deluxe King Suite + Discover Sintra tour, €200 for two)',
    'sintra-coast': 'Sintra & the coast package (2 nights + two guided days, €400 for two)',
    'discover-sintra': 'Discover Sintra tour (€50 per person)',
    'atlantic-coast': 'The Atlantic coast tour (€75 per person)',
  };

  var state = { checkin: '', checkout: '', guests: 2, rooms: {}, extras: {} };
  var root, imgBase;

  /* ---------- helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function eur(n) { return '€' + n.toLocaleString('en-GB'); }
  function iso(d) { return d.toISOString().slice(0, 10); }
  function addDays(s, n) { var d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return iso(d); }
  function nights() {
    if (!state.checkin || !state.checkout) return 0;
    var n = Math.round((new Date(state.checkout + 'T12:00:00') - new Date(state.checkin + 'T12:00:00')) / 864e5);
    return n > 0 ? n : 0;
  }
  function fmtDate(s) {
    if (!s) return '';
    return new Date(s + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  function roomById(id) { for (var i = 0; i < ROOMS.length; i++) if (ROOMS[i].id === id) return ROOMS[i]; }
  function waLink(text) { return 'https://wa.me/' + CONFIG.whatsapp + '?text=' + encodeURIComponent(text); }

  /* ---------- pricing ---------- */
  function totals() {
    var n = nights(), roomsTotal = 0, beds = 0, petOk = false, any = false;
    Object.keys(state.rooms).forEach(function (id) {
      var q = state.rooms[id]; if (!q) return;
      var r = roomById(id); any = true;
      roomsTotal += r.price * q * Math.max(n, 1);
      beds += r.sleeps * q;
      if (r.pets) petOk = true;
    });
    var extrasTotal = 0;
    Object.keys(state.extras).forEach(function (id) {
      var sel = state.extras[id]; if (sel == null) return;
      var ex = EXTRAS.filter(function (e) { return e.id === id; })[0];
      if (ex.needsPetRoom && !petOk) return;
      extrasTotal += ex.options[sel][1];
    });
    return { nights: n, rooms: roomsTotal, extras: extrasTotal, total: roomsTotal + extrasTotal, capacity: beds, petOk: petOk, any: any };
  }

  function buildRequest() {
    var t = totals();
    return {
      checkin: state.checkin, checkout: state.checkout, nights: t.nights, guests: state.guests,
      rooms: Object.keys(state.rooms).filter(function (id) { return state.rooms[id]; }).map(function (id) {
        var r = roomById(id); return { id: id, name: r.name, qty: state.rooms[id], nightly: r.price };
      }),
      extras: Object.keys(state.extras).filter(function (id) { return state.extras[id] != null; }).map(function (id) {
        var ex = EXTRAS.filter(function (e) { return e.id === id; })[0], o = ex.options[state.extras[id]];
        return { id: id, name: ex.name, option: o[0], price: o[1] };
      }),
      estimate: t.total, currency: CONFIG.currency,
    };
  }

  function waMessage(req) {
    var lines = ['Hello Villa Luxa, I would like to check availability:', ''];
    lines.push('Dates: ' + fmtDate(req.checkin) + ' to ' + fmtDate(req.checkout) + ' (' + req.nights + (req.nights === 1 ? ' night' : ' nights') + ')');
    lines.push('Guests: ' + req.guests);
    req.rooms.forEach(function (r) { lines.push('Room: ' + r.qty + ' × ' + r.name); });
    req.extras.forEach(function (e) { lines.push('Extra: ' + e.name + (e.option !== 'Add' ? ' (' + e.option + ')' : '')); });
    lines.push('', 'Estimated total: ' + eur(req.estimate));
    return lines.join('\n');
  }

  function startStripeCheckout(req) {
    // Placeholder for the future integration, e.g.:
    // fetch('https://<your-worker>.workers.dev/checkout', { method: 'POST', body: JSON.stringify(req) })
    //   .then(function (r) { return r.json(); }).then(function (s) { location.href = s.url; });
    console.info('Stripe checkout request', req);
  }

  /* ---------- render ---------- */
  function render() {
    var today = iso(new Date());
    var html = '';
    html += '<div class="bk-head"><h2 class="bk-title" id="bk-title">Your stay</h2>' +
      '<button type="button" class="bk-close" data-book-close aria-label="Close booking panel">' +
      '<i data-lucide="x" aria-hidden="true"></i></button></div>';

    html += '<div class="bk-body">';
    // Step 1
    html += '<section class="bk-step"><h3 class="bk-step-title"><span class="bk-num">1</span>Dates and guests</h3>' +
      '<div class="bk-dates">' +
      '<label class="bk-field"><span>Check-in</span><input type="date" name="bk-in" min="' + today + '"></label>' +
      '<label class="bk-field"><span>Check-out</span><input type="date" name="bk-out" min="' + today + '"></label>' +
      '<div class="bk-field bk-guests"><span id="bk-guests-label">Guests</span><div class="bk-stepper" role="group" aria-labelledby="bk-guests-label">' +
      '<button type="button" data-g="-1" aria-label="Fewer guests">−</button><output data-gval>2</output><button type="button" data-g="1" aria-label="More guests">+</button></div></div>' +
      '</div><p class="bk-nights" data-nights></p></section>';

    // Step 2
    html += '<section class="bk-step"><h3 class="bk-step-title"><span class="bk-num">2</span>Choose your room</h3><div class="bk-rooms">';
    ROOMS.forEach(function (r) {
      html += '<div class="bk-room" data-room-card="' + r.id + '">' +
        '<img src="' + imgBase + r.img + '" alt="" loading="lazy">' +
        '<div class="bk-room-info"><p class="bk-room-name">' + r.name + '</p>' +
        '<p class="bk-room-meta">' + r.beds + ', sleeps ' + r.sleeps + ', ' + r.size + ' m²</p>' +
        '<p class="bk-room-price"><strong>' + eur(r.price) + '</strong> a night</p></div>' +
        '<div class="bk-stepper bk-stepper-sm" role="group" aria-label="' + r.name + ' quantity">' +
        '<button type="button" data-r="' + r.id + '" data-d="-1" aria-label="Remove one ' + r.name + '">−</button>' +
        '<output data-rq="' + r.id + '">0</output>' +
        '<button type="button" data-r="' + r.id + '" data-d="1" aria-label="Add one ' + r.name + '">+</button></div></div>';
    });
    html += '</div><p class="bk-warn" data-capacity hidden></p></section>';

    // Step 3
    html += '<section class="bk-step"><h3 class="bk-step-title"><span class="bk-num">3</span>Make it yours <em>optional</em></h3><div class="bk-extras">';
    EXTRAS.forEach(function (ex) {
      html += '<fieldset class="bk-extra" data-extra="' + ex.id + '"><legend class="bk-extra-name">' + ex.name + '</legend>' +
        '<p class="bk-extra-detail">' + ex.detail + '</p><div class="bk-chips">';
      ex.options.forEach(function (o, i) {
        html += '<button type="button" class="bk-chip" aria-pressed="false" data-x="' + ex.id + '" data-o="' + i + '">' +
          (o[0] === 'Add' ? 'Add · ' : o[0] + ' · ') + eur(o[1]) + '</button>';
      });
      html += '</div></fieldset>';
    });
    html += '</div></section></div>';

    // Summary
    html += '<div class="bk-summary"><div class="bk-sum-lines" data-sum></div>' +
      '<div class="bk-total"><span>Estimated total</span><strong data-total>€0</strong></div>' +
      '<button type="button" class="bk-cta" data-submit disabled>Request these dates on WhatsApp</button>' +
      '<p class="bk-fine">Nothing is charged now. The house confirms availability and the final price in the chat. Card payment by Stripe is coming soon.</p></div>';

    root.innerHTML = html;
    if (window.lucide) window.lucide.createIcons(); // Lucide (ISC), loaded by each page
  }

  function sync() {
    var t = totals();
    $('[name=bk-in]', root).value = state.checkin;
    $('[name=bk-out]', root).value = state.checkout;
    $('[name=bk-out]', root).min = state.checkin ? addDays(state.checkin, 1) : iso(new Date());
    $('[data-gval]', root).textContent = state.guests;
    $('[data-nights]', root).textContent = t.nights
      ? fmtDate(state.checkin) + ' to ' + fmtDate(state.checkout) + ', ' + t.nights + (t.nights === 1 ? ' night' : ' nights')
      : 'Pick your dates to see the price of your stay.';

    ROOMS.forEach(function (r) {
      var q = state.rooms[r.id] || 0;
      $('[data-rq="' + r.id + '"]', root).textContent = q;
      $('[data-room-card="' + r.id + '"]', root).classList.toggle('is-on', q > 0);
    });

    var cap = $('[data-capacity]', root);
    if (t.any && t.capacity < state.guests) {
      cap.hidden = false;
      cap.textContent = 'Your rooms sleep ' + t.capacity + '. Add a room for ' + (state.guests - t.capacity) + ' more ' + (state.guests - t.capacity === 1 ? 'guest' : 'guests') + '.';
    } else cap.hidden = true;

    $all('.bk-chip', root).forEach(function (c) {
      var on = state.extras[c.dataset.x] === +c.dataset.o;
      c.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    var pet = $('[data-extra="pet"]', root);
    var petBlocked = t.any && !t.petOk;
    pet.classList.toggle('is-disabled', petBlocked);
    $all('button', pet).forEach(function (b) { b.disabled = petBlocked; });

    var sum = '';
    var req = buildRequest();
    req.rooms.forEach(function (r) {
      sum += '<p><span>' + r.qty + ' × ' + r.name + (t.nights ? ', ' + t.nights + (t.nights === 1 ? ' night' : ' nights') : '') + '</span><span>' + eur(r.nightly * r.qty * Math.max(t.nights, 1)) + '</span></p>';
    });
    req.extras.forEach(function (e) {
      if (e.id === 'pet' && !t.petOk) return;
      sum += '<p><span>' + e.name + (e.option !== 'Add' ? ', ' + e.option : '') + '</span><span>' + eur(e.price) + '</span></p>';
    });
    $('[data-sum]', root).innerHTML = sum || '<p class="bk-empty">Choose dates and a room to see your total.</p>';
    $('[data-total]', root).textContent = eur(t.total);

    var ready = t.nights > 0 && t.any && t.capacity >= state.guests;
    var btn = $('[data-submit]', root);
    btn.disabled = !ready;
    btn.textContent = CONFIG.checkout === 'stripe' ? 'Pay securely' : 'Request these dates on WhatsApp';

    // Mirror into any quick-book bars on the page
    $all('[data-qb-in]').forEach(function (i) { i.value = state.checkin; });
    $all('[data-qb-out]').forEach(function (i) { i.value = state.checkout; });
    $all('[data-qb-guests]').forEach(function (o) { o.textContent = state.guests; });
  }

  /* ---------- open / close ---------- */
  var lastFocus;
  function open(opts) {
    opts = opts || {};
    if (opts.room) { state.rooms = {}; state.rooms[opts.room] = 1; }
    lastFocus = document.activeElement;
    sync();
    document.documentElement.classList.add('bk-open');
    root.setAttribute('aria-hidden', 'false');
    var scrim = $('.bk-scrim'); if (scrim) scrim.hidden = false;
    document.dispatchEvent(new CustomEvent('vl:booking-open'));
    setTimeout(function () {
      var target = !state.checkin ? $('[name=bk-in]', root) : opts.room ? $('[data-room-card="' + opts.room + '"] [data-d="1"]', root) : $('.bk-close', root);
      if (target) target.focus();
    }, 60);
  }
  function close() {
    document.documentElement.classList.remove('bk-open');
    root.setAttribute('aria-hidden', 'true');
    var scrim = $('.bk-scrim'); if (scrim) scrim.hidden = true;
    document.dispatchEvent(new CustomEvent('vl:booking-close'));
    if (lastFocus) lastFocus.focus();
  }

  /* ---------- events ---------- */
  function bind() {
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      if (b.hasAttribute('data-book-close')) return close();
      if (b.dataset.g) { state.guests = Math.min(16, Math.max(1, state.guests + +b.dataset.g)); return sync(); }
      if (b.dataset.r) {
        var q = (state.rooms[b.dataset.r] || 0) + +b.dataset.d;
        state.rooms[b.dataset.r] = Math.max(0, Math.min(1, q)); // each room is a single unit
        return sync();
      }
      if (b.dataset.x) {
        var o = +b.dataset.o;
        state.extras[b.dataset.x] = state.extras[b.dataset.x] === o ? null : o;
        return sync();
      }
      if (b.hasAttribute('data-submit')) {
        var req = buildRequest();
        if (CONFIG.checkout === 'stripe') return startStripeCheckout(req);
        window.open(waLink(waMessage(req)), '_blank', 'noopener');
      }
    });
    root.addEventListener('change', function (e) {
      if (e.target.name === 'bk-in') {
        state.checkin = e.target.value;
        if (!state.checkout || state.checkout <= state.checkin) state.checkout = state.checkin ? addDays(state.checkin, 2) : '';
      }
      if (e.target.name === 'bk-out') state.checkout = e.target.value;
      sync();
    });

    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-book-open]');
      if (t) { e.preventDefault(); return open({ room: t.dataset.room }); }
      var tour = e.target.closest('[data-tour]');
      if (tour) {
        e.preventDefault();
        var name = TOURS[tour.dataset.tour] || 'a tour';
        window.open(waLink('Hello Villa Luxa, I would like to check availability for the ' + name + '.' + (state.checkin ? ' Preferred date: ' + fmtDate(state.checkin) + '.' : '')), '_blank', 'noopener');
      }
      var g = e.target.closest('[data-qb-g]');
      if (g) { state.guests = Math.min(16, Math.max(1, state.guests + +g.dataset.qbG)); sync(); }
      if (e.target.closest('.bk-scrim')) close();
    });
    document.addEventListener('change', function (e) {
      if (e.target.matches('[data-qb-in]')) {
        state.checkin = e.target.value;
        if (!state.checkout || state.checkout <= state.checkin) state.checkout = addDays(state.checkin, 2);
        sync();
      }
      if (e.target.matches('[data-qb-out]')) { state.checkout = e.target.value; sync(); }
    });
    document.addEventListener('submit', function (e) {
      if (e.target.matches('[data-quick-book]')) { e.preventDefault(); open(); }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.documentElement.classList.contains('bk-open')) close();
      if (e.key === 'Tab' && document.documentElement.classList.contains('bk-open')) {
        var f = $all('button:not([disabled]), input, [href]', root).filter(function (el) { return el.offsetParent !== null; });
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    });
  }

  function init() {
    root = document.getElementById('booking');
    if (!root) return;
    imgBase = root.dataset.img || '../assets/img/';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-labelledby', 'bk-title');
    root.setAttribute('aria-hidden', 'true');
    root.setAttribute('data-lenis-prevent', ''); // the panel scrolls natively under Lenis
    render();
    bind();
    sync();
    var today = iso(new Date());
    $all('[data-qb-in],[data-qb-out]').forEach(function (i) { i.min = today; });
  }

  window.VillaLuxa = { config: CONFIG, rooms: ROOMS, open: open, close: close, whatsapp: waLink };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
