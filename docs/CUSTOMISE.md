# 🎨 Making Nocturne yours

Everything here is a **find-and-replace** job — no build, no compiling. Edit the file, refresh the browser.

---

## 1 · The 60-second rebrand

<details open>
<summary><b>Brand name</b> — it appears in 6 places</summary>

| Where | What to look for |
|:--|:--|
| `index.html` | `<title>`, `<meta name="description">`, header `.brand`, footer copyright |
| `index.html` | preloader wordmark, menu overlay wordmark |
| `README.md` | banners, headings |
| `index.html` | the wordmark itself: `<span class="logo-mark">NOCTURNE</span>` — typographic, no logo file |
| `assets/js/main.js` | `nocturne` easter-egg keyword (and `nocturne-blessed`, `nocturne-consent` storage keys if you change them, keep both sides in sync) |

> Keep the mark ≤ 6 characters — the header grid was tuned for a short wordmark, longer names will squeeze the nav.
</details>

<details>
<summary><b>Palette</b> — one block of variables</summary>

`assets/css/main.css`, very top:

```css
:root{
  --night:#0a0a0a;      /* page surface            */
  --void:#000;          /* manifesto / hero base   */
  --parchment:#f9f9f9;  /* primary text            */
  --ember:#ad6646;      /* accent, bids, hovers    */
  --ember-deep:#61392c; /* gradient mid-stop       */
  --flame:#fb5711;      /* tiny hot accents        */
  --ash:#8f8f8f;        /* secondary text          */
  --sand:#edd6bd;       /* warm type on gradients  */
  --soot:#1c1616;       /* card surfaces           */
}
```

Change `--ember` and `--ember-deep` together, and everything follows — gradients, timer colour, cursor labels, the trending glow.
</details>

<details>
<summary><b>Type</b></summary>

- Display = **Bodoni Moda** (italic is doing most of the work). Any high-contrast didone swaps in — *Playfair Display*, *Bodoni 72*, *Prata*.
- UI = **Manrope**. *Inter*, *Satoshi*, *General Sans* all behave.
- Graffiti hover = **Permanent Marker**. Used only in the hero title hover (`data-title`).

Drop new `woff2` files into `assets/fonts/`, then update the `@font-face` block at the top of `main.css` and the family names in `--font-heading` / `--font-body` / `--font-marker`.
</details>

---

## 2 · Swapping the artwork

All art lives in `assets/img/` and is referenced by **filename**. Match the name and aspect ratio, and nothing else needs to change.

<table>
<tr><th align="left">File</th><th align="left">Ratio</th><th align="left">Used by</th></tr>
<tr><td><code>hero-cloud.jpg</code></td><td>21:9</td><td>Three.js hero plane — keep it wide; edges get feathered by the shader</td></tr>
<tr><td><code>menu-clouds.jpg</code></td><td>3:4</td><td>Fullscreen menu backdrop</td></tr>
<tr><td><code>footer-clouds-back/front.png</code></td><td>21:9</td><td>Cloud parallax. **Transparent PNG** — black-keyed from a painting</td></tr>
<tr><td><code>manifesto-left/topright/portrait/art2/art5.jpg</code></td><td>various</td><td>the three sideways panels</td></tr>
<tr><td><code>manifesto-pill.jpg</code></td><td>1:1</td><td>circular plate — angels ringing a runner, masked to a circle in CSS</td></tr>
<tr><td><code>manifesto-yellow.jpg</code></td><td>340:547</td><td>tall collage plate — reclining figure, sculptural sneakers</td></tr>
<tr><td><code>manifesto-dunk.jpg</code></td><td>607:284</td><td>wide collage plate — still life, candle and pearls</td></tr>
<tr><td><code>manifesto-bacchus.jpg</code></td><td>520:656</td><td>tall collage plate — laurel-crowned figure with embroidered pair</td></tr>
<tr><td><code>manifesto-angel.png</code></td><td>1:1, alpha</td><td>floating cupid across panels</td></tr>
<tr><td><code>relic-01…05.png</code></td><td>4:5</td><td>Top Relics hover plates</td></tr>
<tr><td><code>trend-01…04.png</code></td><td>4:5</td><td>Trending Auctions cards</td></tr>
<tr><td><code>mystery-chest.png</code> · <code>mystery-curtain-top/bottom.svg</code></td><td>—</td><td>vault. Curtains are **SVG**, so they scale without blurring</td></tr>
<tr><td><code>atelier-01…04.jpg</code></td><td>720:368</td><td>Latest from Atelier — one plate per article row (hover swaps them)</td></tr>
<tr><td><code>find-price-cupid.png</code> · <code>trend-glow.svg</code></td><td>—</td><td>decor accents</td></tr>
</table>

> **Keying a black background out of a painting:** if your new art is a JPG on black, convert it to a transparent PNG by mapping near-black pixels to alpha, then save at 60–70 % quality. That's exactly how the footer clouds and angel were made.

---

## 3 · Copy that needs a decision from you

| Block | Placeholder | Ship-ready? |
|:--|:--|:--:|
| Header nav | `My Archive` / `Bag` / `Wishlist` | links are `#` — wire or remove |
| Menu | 6 links + 5 socials | all `#` |
| Auctions | `data-auction-id`, `data-min` | fake IDs, `data-ends-at` is generated at runtime |
| Newsletter | `#newsletter-form` | validates, then simulates — needs a POST target |
| Bid modal | `#bid-form` | same |
| Legal row | T&C · Privacy · Shipping · Cookies · FAQ | empty stubs |
| Footer credit | `Nocturne 2026` | your name here |

T&C, privacy and cookie copy in particular are placeholders — if this goes anywhere public, they need real text for your jurisdiction.

---

## 4 · Changing the flow

- **Auction countdowns** — set `data-ends-at` to a unix timestamp (seconds). The JS rebuilds H/M/S every second and auto-extends to a fresh 12 h window when it hits zero (that's the `is-closing` state) — comment out that branch in `initTimers()` if you'd rather they stop at `Ended`.
- **Typewriter queries** — they're in the markup: `index.html` → `<h3 class="find__typer" data-typewriter='["Arc Runner ’95", …]'>` (JSON array, any length).
- **Manifesto length** — the horizontal scroll is derived from the track's `scrollWidth`, so adding a 4th panel “just works”. Give it `.manifesto__panel` and keep the `--pw` sizing.
- **Vault pin length** — the `+=150%` ScrollTrigger `end` value.
- **Add a room** — copy any `<section class="…">` block, give it a class, add padding from the shared `section` rule, then `ScrollTrigger.refresh()` is called automatically on resize.

---

## 5 · Sound

Look for `const Sound = {` in `main.js`. Each cue is a small buffer synthesis — `wind`, `whoosh`, `gavel`, `chest`, `steps`, `shimmer`, `clock`. Change `gain` values to taste, or delete the cue calls (`Sound.play('…')`) to silence individual interactions. The master toggle lives in the footer bar, is **off by default**, and is respected everywhere.

---

## 6 · Before you call it done

- [ ] All `href="#"` replaced or removed
- [ ] Newsletter/bid endpoints wired
- [ ] Real legal pages
- [ ] Page title & meta description rewritten
- [ ] Tested at 390 px, 768 px, 1440 px, 1920 px
- [ ] Keyboard-only pass: Tab through header → menu → sliders → forms
- [ ] `prefers-reduced-motion` checked in DevTools → Rendering
- [ ] Images compressed (`pngquant` for PNGs, 80–85 % JPEG)
