# Harichandanpur Cricket Club Website

Official website for Harichandanpur Cricket Club (HCC). Static site, vanilla HTML/CSS/JS, fully free stack.

**Live URL:** `https://harichandanpurcc.netlify.app` (after first deploy)
**Shipping?** See [`DEPLOY.md`](./DEPLOY.md) for the full pre-flight checklist.
---

## Stack

| Layer | Tool |
|-------|------|
| Frontend | HTML5 + CSS3 + Vanilla JS (no build step) |
| Animations | GSAP + ScrollTrigger (CDN) |
| Smooth scroll | Lenis (CDN) |
| Carousels | Swiper (CDN) |
| Icons | Lucide (CDN) |
| Auth | Firebase Google Sign-In |
| Backend API | Google Apps Script Web App |
| Database | Google Sheets |
| Images | Cloudinary (CDN) |
| Contact form | Web3Forms |
| Hosting | Netlify (auto SSL, GitHub integration) |

**Cost:** ₹0 forever.

---

## Local development

No npm, no build step. You just need a static HTTP server because the project uses ES modules (which browsers refuse to load over `file://`).

```powershell
cd C:\Users\66807\Downloads\HCC-Website
python -m http.server 8000
```

Open `http://localhost:8000`. Edit a file, refresh the browser.

If you don't have Python:

```powershell
# Node alternative
npx serve .
```

Either works.

---

## Project structure

```
HCC-Website/
├── index.html, about.html, team.html, ...   Page files (13 total)
├── 404.html                                  Custom 404
├── login.html / dashboard.html / admin.html  Member area (private)
│
├── css/
│   ├── style.css         Design system: tokens, typography, components
│   ├── animations.css    GSAP-ready states + CSS fallback
│   └── responsive.css    Mobile-first breakpoints
│
├── js/
│   ├── config.js         API URL, Firebase config, admin emails, club meta
│   ├── firebase-init.js  Firebase + Google auth provider
│   ├── auth.js           Session manager (requireAuth, performLogin, etc.)
│   ├── api.js            Apps Script API wrapper (all endpoints)
│   ├── main.js           Common page boot (navbar, Lucide, IO fallback)
│   ├── smooth-scroll.js  Lenis init + ScrollTrigger sync
│   ├── animations.js     GSAP entrance/scroll animations
│   └── pages/
│       ├── home.js
│       ├── team.js
│       ├── matches.js    Tabs + countdown timer
│       ├── gallery.js    Lightbox + masonry grid
│       ├── news.js
│       ├── contact.js    Web3Forms + API dual submit
│       ├── login.js      Sign-in flow + redirect by role
│       ├── dashboard.js  Player profile, stats, availability
│       └── admin.js      Approvals, add match, etc.
│
├── images/
│   ├── logo.svg
│   └── default-avatar.svg
│
├── robots.txt, sitemap.xml                  SEO
├── netlify.toml                              Static deploy config
└── PROJECT_PLAN_v5_FINAL.md                  Architecture & credentials (PRIVATE)
```

---

## How it fits together

```
                          Visitor
                            │
                            ▼
                  ┌──────────────────┐
                  │     Netlify      │   serves static files
                  └────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
       Firebase Auth   Apps Script    Cloudinary
       (Google login)   (API + DB)     (images)
                            │
                            ▼
                      Google Sheets
                    (Users, Players,
                     Matches, News...)
                            │
                            ▼
                      Gmail (Apps
                      Script sends
                      emails)
```

---

## Common changes

**Add a player:** Add a row to the Players sheet. The team page picks it up within 5 minutes (cached).

**Add news:** Add a row to the News sheet with `title`, `content`, `image_url`, `date`, `author`.

**Change colors:** Edit `:root` in `css/style.css`. All components re-theme automatically.

**Change a nav link:** Edit the navbar HTML in each page file (intentionally duplicated for simplicity).

**Change mobile menu behavior:** Keep `<div class="menu-backdrop" aria-hidden="true"></div>` directly after `<body>` on every HTML page. The backdrop lives in `css/style.css`, drawer sizing lives in `css/responsive.css`, and click/ESC/scroll-lock behavior lives in `js/main.js`.

**Add an admin:** `js/config.js` → `ADMIN_EMAILS`. Also update the Apps Script admin list so backend actions work.

See [`DEPLOY.md`](./DEPLOY.md) for the deploy checklist and post-deploy smoke tests.

---

## Architecture decisions

All locked decisions are in [`PROJECT_PLAN_v5_FINAL.md`](./PROJECT_PLAN_v5_FINAL.md) (private — do not commit credentials publicly).

Quick highlights:
- **Vanilla over framework** — project size doesn't justify React. CDN libraries handle animations.
- **Sheets as DB** — easy manual edits, zero infra.
- **Apps Script as API** — free, integrated with Sheets + Gmail.
- **POSTs use `text/plain` Content-Type** — avoids Apps Script CORS preflight.
- **Session in sessionStorage** — tab-scoped, 30-min TTL, role re-checked from backend periodically.

---

## License

Internal project. All rights reserved.
