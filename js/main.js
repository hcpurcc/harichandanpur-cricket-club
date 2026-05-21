/**
 * Common page bootstrap.
 *
 * Every HTML page imports this once:
 *   <script type="module" src="/js/main.js"></script>
 *
 * Responsibilities:
 *   - Initialise Lucide icons
 *   - Mobile navbar toggle
 *   - Active nav-link highlighting via <body data-page="home">
 *   - Footer year auto-update
 *   - Navbar background state on scroll (.is-scrolled)
 *   - IntersectionObserver fallback that adds .in-view to animation
 *     classes when GSAP is missing, so animations still trigger.
 *   - Trigger smooth-scroll + animations modules (side-effect imports).
 */

import { CLUB, FLAGS } from './config.js';
import './smooth-scroll.js';
import './animations.js';

/* ---------- Lucide icons ---------- */

const BRAND_ICONS = {
  instagram: `
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="5"></rect>
      <circle cx="12" cy="12" r="4"></circle>
      <circle cx="17.5" cy="6.5" r="1"></circle>
    </svg>`,
  youtube: `
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 12s0-4-1-5c-1-1-3-1-9-1s-8 0-9 1-1 5-1 5 0 4 1 5 3 1 9 1 8 0 9-1 1-5 1-5z"></path>
      <path d="m10 9 5 3-5 3z"></path>
    </svg>`,
  facebook: `
    <svg aria-hidden="true" focusable="false" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 8h3V4h-3c-3 0-5 2-5 5v3H6v4h3v4h4v-4h3l1-4h-4V9c0-1 .5-1 1-1z"></path>
    </svg>`
};

function initBrandIcons() {
  document.querySelectorAll('i[data-lucide]').forEach((el) => {
    const icon = el.getAttribute('data-lucide');
    const svg = BRAND_ICONS[icon];
    if (svg) el.outerHTML = svg.trim();
  });
}

function initLucide() {
  if (typeof window === 'undefined') return;
  initBrandIcons();
  if (!window.lucide) return;
  try {
    window.lucide.createIcons();
  } catch (err) {
    console.warn('[main] Lucide init failed:', err);
  }
}

/* ---------- Reflect auth state in public navbars ----------
   Public pages ship with a "Join" CTA pointing to /membership.html. If a
   session is already cached, swap that CTA for a one-tap link back to the
   user's own area (Dashboard or Admin). Dashboard / admin pages have their
   own navbar markup, so they are not affected. */

function reflectAuthInNavbar() {
  const cta = document.querySelector(
    '.navbar-links .btn-primary[href="/membership.html"]'
  );
  if (!cta) return;

  let session = null;
  try {
    const raw = sessionStorage.getItem('hcc_session');
    if (raw) session = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  if (!session || !session.role) return;

  if (session.role === 'admin') {
    cta.textContent = 'Admin';
    cta.setAttribute('href', '/admin.html');
  } else if (session.role === 'player') {
    cta.textContent = 'Dashboard';
    cta.setAttribute('href', '/dashboard.html');
  }
}

/* ---------- Mobile navbar toggle ---------- */

function initNavbar() {
  const navbar = document.querySelector('.navbar');
  if (!navbar) return;

  const toggle = navbar.querySelector('.navbar-toggle');
  const linksContainer = navbar.querySelector('.navbar-links');

  const openMenu = () => {
    navbar.classList.add('is-open');
    document.body.classList.add('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'true');
  };

  const closeMenu = () => {
    if (!navbar.classList.contains('is-open')) return;
    navbar.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  };

  if (toggle) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (navbar.classList.contains('is-open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });
  }

  /* Close menu when a link is clicked (mobile). */
  navbar.querySelectorAll('.navbar-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  /* Close on click outside the menu panel (backdrop area). */
  document.addEventListener('click', (e) => {
    if (!navbar.classList.contains('is-open')) return;
    const target = e.target;
    if (linksContainer && linksContainer.contains(target)) return;
    if (toggle && toggle.contains(target)) return;
    closeMenu();
  });

  /* Close on ESC. */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navbar.classList.contains('is-open')) {
      closeMenu();
    }
  });

  /* If the viewport grows past the mobile breakpoint, drop any locked state. */
  const desktopMql = window.matchMedia('(min-width: 1024px)');
  const handleViewportChange = (event) => {
    if (event.matches) closeMenu();
  };
  if (desktopMql.addEventListener) {
    desktopMql.addEventListener('change', handleViewportChange);
  } else if (desktopMql.addListener) {
    desktopMql.addListener(handleViewportChange);
  }

  /* Background state on scroll. */
  let lastY = window.scrollY;
  const updateScrollState = () => {
    const y = window.scrollY;
    navbar.classList.toggle('is-scrolled', y > 16);
    lastY = y;
  };
  updateScrollState();
  window.addEventListener('scroll', updateScrollState, { passive: true });

  /* Active page highlighting (driven by body[data-page]). */
  const currentPage = document.body.dataset.page;
  if (currentPage) {
    navbar.querySelectorAll('.navbar-link').forEach((link) => {
      if (link.dataset.page === currentPage) {
        link.classList.add('is-active');
      }
    });
  }
}

/* ---------- Footer year ---------- */

function initFooter() {
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const clubEl = document.querySelector('[data-club-name]');
  if (clubEl) clubEl.textContent = CLUB.name;
}

/* ---------- IntersectionObserver fallback ----------
   GSAP is the primary animator (see animations.js). If GSAP fails to load,
   we still want elements to appear when scrolled into view. This observer
   adds .in-view to the animation utility classes — animations.css already
   has matching .in-view rules that smoothly transition to the final state. */

const ANIM_SELECTORS = [
  '.fade-in',
  '.slide-up',
  '.slide-down',
  '.slide-in-left',
  '.slide-in-right',
  '.scale-in',
  '.blur-in',
  '.anim-fade',
  '.anim-slide-up',
  '.anim-slide-down',
  '.anim-slide-left',
  '.anim-slide-right',
  '.anim-scale',
  '.anim-blur'
].join(',');

function initIntersectionFallback() {
  /* If GSAP is present, animations.js owns the reveal logic. Skip. */
  if (window.gsap) return;
  if (!('IntersectionObserver' in window)) {
    /* Very old browser — just reveal everything immediately. */
    document.querySelectorAll(ANIM_SELECTORS).forEach((el) => {
      el.classList.add('in-view');
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.05 }
  );

  document.querySelectorAll(ANIM_SELECTORS).forEach((el) => observer.observe(el));
}

/* ---------- Boot ---------- */

function boot() {
  initLucide();
  initNavbar();
  reflectAuthInNavbar();
  initFooter();
  initIntersectionFallback();
  if (FLAGS.debug) console.log('[main] boot complete on page:', document.body.dataset.page);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
