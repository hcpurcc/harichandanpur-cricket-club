# Responsive Audit — Harichandanpur Club Website

**Date:** 2026-05-21
**Scope:** All 12 pages (index, about, team, matches, gallery, news, contact, membership, login, dashboard, admin, 404) across 7 breakpoints (320, 375, 414, 768, 1024, 1440, 1920).
**Files touched:** `css/style.css`, `css/responsive.css`, `js/main.js`, all page HTML files, `index.html`, `matches.html`, `gallery.html`, `admin.html` (round 3 mobile fixes).

---

## TL;DR

The site is already mobile-first done well. Most grids use `auto-fit/auto-fill` with `minmax`, and most page-level layouts have explicit `@media (max-width: 768px)` overrides. Round 3 resolves the remaining mobile blockers:

1. **Mobile menu** (showstopper) — replaced the navbar pseudo-element backdrop with a body-level `.menu-backdrop`.
2. **Hero title on `index.html`** — tightened the clamp and line height for 320-414px phones.
3. **`matches.html` match card grid** — stacks below 480px.
4. **`gallery.html` lightbox** — nav arrows move to a bottom toolbar below 640px.
5. **`admin.html` reject form** — input no longer overflows on tiny phones.

All items from the previous pending list are now applied locally.

---

## Fixed in this round

### Mobile menu — full overhaul (`css/responsive.css`, `js/main.js`)

**Problems found:**

- Hamburger only appeared below 480px. Between 480 and 1023 px, the 7-link nav + Join CTA tried to fit horizontally and would wrap/cram.
- Backdrop (`.navbar.is-open::before`) was set with `position: fixed; inset: 0`. **Root cause:** `.navbar` has `backdrop-filter: blur(16px)` which makes it the *containing block* for any fixed-positioned descendant. So `inset: 0` resolved to the navbar's own 72-px bar — backdrop was effectively invisible and the drawer (`inset: var(--nav-height) 0 0 0`) collapsed to zero height. That is why only the first link ("Home") was visible.
- No `body.menu-open` class — scroll lock was applied via inline `body.style.overflow`.
- No click-outside-to-close.
- No ESC key handler.
- No reset when viewport grows past mobile breakpoint (menu state could be left stale on rotation).

**What changed:**

- Hamburger now shows up to **1023 px** (covers all phone + tablet portrait/landscape).
- Backdrop is now a body-level `.menu-backdrop` sibling on every HTML page, so it is no longer trapped inside `.navbar`'s `backdrop-filter` stacking context.
- Drawer uses explicit `top: var(--nav-height); height: calc(100vh - var(--nav-height))` and a raised open-menu stacking level so it stays above the backdrop.
- Drawer background switched to `--bg-secondary` (more visually distinct from the dark page behind the backdrop).
- Body scroll lock via `body.menu-open { overflow: hidden }` class.
- Document-level click handler closes menu on outside clicks (backdrop area).
- ESC key closes menu.
- `matchMedia('(min-width: 1024px)')` listener auto-closes menu when viewport grows past mobile range.
- Each drawer link has `min-height: 48px` for touch comfort.
- `.is-active` link colour set to neon green inside the drawer (consistent with desktop active state).

### Hero title overflow (`index.html`)

- `.hero-title` font-size was `clamp(48px, 10vw, 128px)`. At 320 px viewport, 48 px floor was too large — "HARICHANDANPUR" did not fit, and `.word { overflow: hidden }` clipped the visible portion.
- Round 3 tightened this further to `clamp(32px, 10vw, 128px)`, `line-height: 0.95`, and `letter-spacing: 0`.
- Calculated fit:
  - 320 px viewport, 16 px container pad each side, 32 px font — "HARICHANDANPUR" fits within the available width.
  - 375 px and 414 px viewports retain cleaner two-word wrapping with less visual density.

---

## Completed fixes from previous pending list

### 1. `matches.html` — match card grid does not stack on mobile

**Selector:** `.match-card-grid` (inline `<style>` block, line ~110)

```css
.match-card-grid {
  grid-template-columns: 1fr auto 1fr; /* opponent / VS / home — stays on mobile */
}
```

On viewports under ~480 px, opponent name + score on the right side plus team name on the left can squeeze into vertical text spaghetti. Applied option A:

```css
@media (max-width: 479px) {
  .match-card-grid {
    grid-template-columns: 1fr;
    text-align: center;
  }
  .match-card-side.opponent {
    align-items: center;
    text-align: center;
  }
  .match-card-vs {
    padding-block: var(--space-2);
  }
}
```

### 2. `gallery.html` — lightbox nav arrows overlap image on phones

**Selectors:** `.lightbox-prev`, `.lightbox-next`, `.lightbox-close`

At 320 px viewport: arrows are 48 px wide, positioned 24 px from each side. That leaves 320 - 24 - 48 - 48 - 24 = **176 px** for the image (image is set to `max-width: 92vw` ≈ 294 px). Result: arrows overlap the image edges and the close button sits over the top-right corner.

**Applied:** on `<=640px`, arrows move to a bottom toolbar row and the close button shrinks.

```css
@media (max-width: 640px) {
  .lightbox-img {
    max-width: 100vw;
    max-height: 70vh;
    padding-inline: var(--space-4);
  }
  .lightbox-prev,
  .lightbox-next {
    top: auto;
    bottom: 16px;
    transform: none;
    width: 44px;
    height: 44px;
  }
  .lightbox-prev { left: 50%; transform: translateX(calc(-50% - 32px)); }
  .lightbox-next { right: 50%; transform: translateX(calc(50% + 32px)); }
  .lightbox-close {
    top: 16px;
    right: 16px;
    width: 40px;
    height: 40px;
  }
  .lightbox-caption {
    bottom: 76px; /* sit above the new bottom toolbar */
  }
}
```

### 3. `admin.html` — `.reject-form input` may overflow at 320 px

`min-width: 200px` on the reject reason input. Combined with the approve/reject buttons it can spill past viewport on the smallest phones. The input now drops to full width below 480px.

```css
@media (max-width: 479px) {
  .reject-form input { min-width: 0; flex-basis: 100%; }
}
```

---

## What is already healthy (verified, no changes needed)

These were checked across all pages and breakpoints — confirming no work needed.

| Component | Status | Why |
|---|---|---|
| Player grid (`team.html`) | OK | `repeat(auto-fill, minmax(240px, 1fr))` — collapses naturally. |
| Pricing tiers (`membership.html`) | OK | Explicit `@media (max-width: 768px) { .tier-grid { grid-template-columns: 1fr; } }`. |
| Steps row (`membership.html`) | OK | Same pattern as pricing. |
| Gallery masonry (`gallery.html`) | OK | CSS `column-count` with breakpoints at 480 / 1024 / 1440. |
| News featured + grid (`news.html`) | OK | `auto-fill, minmax(280px, 1fr)` + explicit 1024 px override. |
| Contact split (`contact.html`) | OK | `1.4fr 1fr` with 1024 px collapse. |
| Login split (`login.html`) | OK | `1fr 1fr` with 768 px collapse + hero hidden on mobile. |
| Dashboard profile card | OK | Grid-area swap at 768 px — exemplary pattern. |
| Admin overview cards | OK | `auto-fit, minmax(220px, 1fr)`. |
| Admin tabs | OK | Already has `overflow-x: auto; max-width: 100%`. |
| Admin request cards | OK | Grid-area swap at 768 px. |
| Admin form grid | OK | `auto-fit, minmax(200px, 1fr)`. |
| Footer grid | OK | Already collapses at 479 px. |
| Hover effects on touch | OK | `@media (hover: none)` already disables lift/shadow on touch. |
| Print styles | OK | Block hidden, body unstyled. |
| 404 page | OK | Uses utility `.error-page` — minimal, scales. |

---

## Recommendations (future work, no immediate action needed)

1. **Adopt `100dvh` everywhere `100vh` is used.** Mobile browser chrome (URL bar) causes `100vh` to slightly overflow on iOS Safari. Already applied in mobile menu — extend to `.hero { min-height: ... }`, `.error-page`, `.auth-shell`, `.auth-loader`. Use the `height: 100vh; height: 100dvh;` cascade so older browsers keep working.

2. **Reduce hero title `clamp()` floor on every page-hero.** Same pattern as `index.html`'s hero. Most page-hero titles use `clamp(40px, 7vw, 96px)`. At 320 px viewport, 40 px floor is fine for shorter words ("Match days,", "Drop us") but tight for some others. If you ever add a long uppercase hero phrase, drop to `clamp(32px, 8vw, 96px)`.

3. **`<picture>` for hero/news images.** Currently `<img>` tags carry full desktop assets to mobile. If your news article images grow heavy, swap to `<picture>` with `srcset` for `(max-width: 768px)` — saves data on 3G/4G.

4. **Lenis on touch devices.** Lenis (the smooth scroll lib) sometimes feels laggy on lower-end Android. Worth verifying on a real device. If sluggish, disable Lenis below 768 px:
   ```js
   if (matchMedia('(max-width: 767px)').matches) { /* skip Lenis init */ }
   ```

5. **Touch target audit.** Most buttons are 44 px+. Chips and `.filter-btn` on tablet sit at ~36 px — borderline. Bump to 40 px min-height for safety.

6. **`prefers-reduced-motion` support.** No `@media (prefers-reduced-motion: reduce)` rule anywhere. Users with vestibular sensitivity see all the slide-ups, gradients, scale-ins. Add a single global block to disable transforms and animations for them.

7. **High-DPR images.** `images/logo.svg` is fine (vector). News/gallery photos served via Cloudinary should request `f_auto,q_auto,w_<size>,dpr_auto`. Verify in the upload flow.

---

## Test matrix (what was checked, manually)

| Page | 320 | 375 | 414 | 768 | 1024 | 1440 | Notes |
|---|---|---|---|---|---|---|---|
| index.html | ⚠→✅ | ⚠→✅ | ✅ | ✅ | ✅ | ✅ | hero title fixed |
| about.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | story-grid collapses at 768 |
| team.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | auto-fill grid |
| matches.html | ⚠→✅ | ⚠→✅ | ⚠→✅ | ✅ | ✅ | ✅ | match-card-grid stacks below 480 |
| gallery.html | ⚠→✅ | ⚠→✅ | ⚠→✅ | ✅ | ✅ | ✅ | lightbox arrows moved below image |
| news.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | featured collapses at 1024 |
| contact.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | split collapses at 1024 |
| membership.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | tier-grid collapses at 768 |
| login.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | hero hidden on mobile |
| dashboard.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | profile grid-area swap |
| admin.html | ⚠→✅ | ✅ | ✅ | ✅ | ✅ | ✅ | reject-form input fixed |
| 404.html | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | error-page utility |
| **mobile menu** | ⚠→✅ | ⚠→✅ | ⚠→✅ | ⚠→✅ | ✅ | ✅ | all breakpoints fixed |

Legend: ✅ healthy | ⚠ has known issue | ⚠→✅ was broken, now fixed

---

## Local change batches in this audit

1. `Fix mobile menu: add backdrop, scroll lock, ESC, click-outside` — extends hamburger to ≤1023 px, adds class-based scroll lock, ESC + click-outside handlers.
2. `Fix mobile menu round 2: escape backdrop-filter containing-block trap` — viewport-explicit sizing on backdrop + drawer so they actually render at viewport size instead of collapsing into navbar bounds.
3. `Fix hero title overflow on mobile` — clamp floor reduced, break-word safety net added.
4. `Fix mobile menu round 3: add body-level menu backdrop` — moves the overlay out of `.navbar` and adds backdrop click handling.
5. `Fix matches.html: stack match card grid on mobile`
6. `Fix gallery.html: lightbox arrows below 640 px`
7. `Fix admin.html: reject-form input on tiny phones`
