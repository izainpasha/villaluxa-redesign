# Villa Luxa: homepage design directions

Two homepage concepts for [villaluxa.com](https://villaluxa.com/), a four-room boutique hotel in Sintra. They're static HTML/CSS/JS, hosted on GitHub Pages.

- `/` is the overview page that links to both concepts.
- `/a/` is **Salão**: evening and cinematic. Forest green, gilt and oxblood, Bodoni Moda with Jost, a hero video, capsule-framed photos and a chequered marble band.
- `/b/` is **Azulejo**: daylight and conversion-first. Chalk white, cobalt and Pena ochre, Young Serif with Instrument Sans, a booking card above the fold, an original azulejo tile pattern and an interactive room chooser.

## Booking

Both concepts share `assets/js/booking.js`. It handles dates, guests, rooms and extras, and shows a live estimated total. For now it sends a pre-filled request to WhatsApp (+351 924 338 608).

To switch to Stripe later, set `CONFIG.checkout = 'stripe'` and implement `startStripeCheckout(request)`. GitHub Pages is static, so Stripe needs one of these:

- **Stripe Payment Links:** simplest, but each link has a fixed price.
- **A small serverless function** (Cloudflare Worker, Netlify or Vercel): it creates a Checkout Session from the request object and redirects to `session.url`. This option supports the dynamic totals.

## Local preview

```
python -m http.server 8000
```

Then open http://localhost:8000/.
