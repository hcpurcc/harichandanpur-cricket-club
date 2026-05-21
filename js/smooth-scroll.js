/**
 * Lenis smooth-scroll initialisation.
 *
 * Loaded as a side-effect import from main.js. Disabled automatically when
 * the user prefers reduced motion or FLAGS.smoothScroll is false.
 *
 * If GSAP + ScrollTrigger are loaded, ScrollTrigger is synced with Lenis so
 * scroll-based animations stay accurate.
 */

import { FLAGS } from './config.js';

const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let lenisInstance = null;

function initLenis() {
  if (!FLAGS.smoothScroll) return null;
  if (prefersReducedMotion) return null;
  if (typeof window === 'undefined' || !window.Lenis) {
    console.warn('[smooth-scroll] window.Lenis missing — load the Lenis CDN before main.js');
    return null;
  }

  const lenis = new window.Lenis({
    duration: 1.1,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    smoothTouch: false,
    touchMultiplier: 1.2
  });

  /* GSAP + ScrollTrigger integration. Safe no-op if either is absent. */
  if (window.gsap && window.ScrollTrigger) {
    lenis.on('scroll', window.ScrollTrigger.update);
    window.gsap.ticker.add((time) => lenis.raf(time * 1000));
    window.gsap.ticker.lagSmoothing(0);
  } else {
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
  }

  /* Intercept in-page anchor links so they ride the Lenis tween. */
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target, { offset: -80 });
  });

  if (FLAGS.debug) console.log('[smooth-scroll] Lenis initialised');
  return lenis;
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      lenisInstance = initLenis();
    });
  } else {
    lenisInstance = initLenis();
  }
}

export function getLenis() {
  return lenisInstance;
}

export default getLenis;
