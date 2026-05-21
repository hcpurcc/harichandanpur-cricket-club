/**
 * GSAP-driven entrance + scroll animations.
 *
 * Looks up CSS classes set on the markup (defined as initial-hidden states
 * in css/animations.css) and animates them to their visible state:
 *
 *   .fade-in        -> opacity 0 -> 1
 *   .slide-up       -> y+40 -> 0
 *   .slide-down     -> y-40 -> 0
 *   .slide-in-left  -> x-60 -> 0
 *   .slide-in-right -> x+60 -> 0
 *   .scale-in       -> scale .92 -> 1
 *   .blur-in        -> blur 12px -> 0
 *
 * Extra hooks:
 *   - [data-stagger]      : children with .stagger-child animate in sequence
 *   - [data-counter]      : numeric counter animates from 0 to its text value
 *   - .reveal-mask        : after-element wipes off the image
 *
 * If GSAP is not loaded, main.js falls back to IntersectionObserver + CSS.
 */

import { FLAGS } from './config.js';

const ANIM_CONFIGS = {
  '.fade-in':        { from: { opacity: 0 },                 to: { opacity: 1 } },
  '.slide-up':       { from: { opacity: 0, y: 40 },          to: { opacity: 1, y: 0 } },
  '.slide-down':     { from: { opacity: 0, y: -40 },         to: { opacity: 1, y: 0 } },
  '.slide-in-left':  { from: { opacity: 0, x: -60 },         to: { opacity: 1, x: 0 } },
  '.slide-in-right': { from: { opacity: 0, x: 60 },          to: { opacity: 1, x: 0 } },
  '.scale-in':       { from: { opacity: 0, scale: 0.92 },    to: { opacity: 1, scale: 1 } },
  '.blur-in':        { from: { opacity: 0, filter: 'blur(12px)' }, to: { opacity: 1, filter: 'blur(0px)' } }
};

const DEFAULTS = {
  duration: 0.9,
  ease:     'power3.out',
  stagger:  0.08
};

function log(...args) {
  if (FLAGS.debug) console.log('[animations]', ...args);
}

/* ---------- Single-element entrance ---------- */

function setupReveals(gsap, ScrollTrigger) {
  Object.entries(ANIM_CONFIGS).forEach(([selector, cfg]) => {
    const els = document.querySelectorAll(selector + ':not([data-stagger] ' + selector + ', .stagger-child)');
    if (!els.length) return;

    els.forEach((el) => {
      /* Skip if already inside a [data-stagger] parent — handled below. */
      if (el.closest('[data-stagger]')) return;

      const delay = parseFloat(el.dataset.delay || '0');
      const duration = parseFloat(el.dataset.duration || DEFAULTS.duration);

      const tween = {
        ...cfg.to,
        duration,
        delay,
        ease: el.dataset.ease || DEFAULTS.ease
      };

      gsap.set(el, cfg.from);

      if (ScrollTrigger) {
        gsap.to(el, {
          ...tween,
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            toggleActions: 'play none none none',
            once: true
          }
        });
      } else {
        gsap.to(el, tween);
      }
    });
  });
}

/* ---------- Staggered children ---------- */

function setupStaggers(gsap, ScrollTrigger) {
  const parents = document.querySelectorAll('[data-stagger]');
  parents.forEach((parent) => {
    const children = parent.querySelectorAll('.stagger-child');
    if (!children.length) return;

    gsap.set(children, { opacity: 0, y: 24 });

    const tween = {
      opacity: 1,
      y: 0,
      duration: parseFloat(parent.dataset.duration || DEFAULTS.duration),
      ease: parent.dataset.ease || DEFAULTS.ease,
      stagger: parseFloat(parent.dataset.staggerDelay || DEFAULTS.stagger)
    };

    if (ScrollTrigger) {
      gsap.to(children, {
        ...tween,
        scrollTrigger: {
          trigger: parent,
          start: 'top 80%',
          toggleActions: 'play none none none',
          once: true
        }
      });
    } else {
      gsap.to(children, tween);
    }
  });
}

/* ---------- Number counters ---------- */

function setupCounters(gsap, ScrollTrigger) {
  const counters = document.querySelectorAll('[data-counter]');
  counters.forEach((el) => {
    const target = parseFloat(el.dataset.counter || el.textContent || '0');
    if (!isFinite(target)) return;

    const obj = { val: 0 };
    el.textContent = '0';

    const tween = {
      val: target,
      duration: parseFloat(el.dataset.duration || '1.6'),
      ease: 'power2.out',
      onUpdate: () => {
        el.textContent = Math.round(obj.val).toLocaleString();
      }
    };

    if (ScrollTrigger) {
      gsap.to(obj, {
        ...tween,
        scrollTrigger: {
          trigger: el,
          start: 'top 90%',
          toggleActions: 'play none none none',
          once: true
        }
      });
    } else {
      gsap.to(obj, tween);
    }
  });
}

/* ---------- Image reveal mask ---------- */

function setupRevealMasks(gsap, ScrollTrigger) {
  const masks = document.querySelectorAll('.reveal-mask');
  masks.forEach((el) => {
    /* The ::after pseudo-element can't be tweened directly; animate via a
       custom property mapped in CSS, or use a real .reveal-mask-cover child.
       For simplicity, fall back to adding .is-revealed and use CSS. */
    gsap.set(el, { '--mask-scale': 1 });

    const reveal = () => el.classList.add('is-revealed');

    if (ScrollTrigger) {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 80%',
        once: true,
        onEnter: reveal
      });
    } else {
      reveal();
    }
  });
}

/* ---------- Parallax (data-parallax="-0.3") ---------- */

function setupParallax(gsap, ScrollTrigger) {
  if (!ScrollTrigger) return;
  document.querySelectorAll('[data-parallax]').forEach((el) => {
    const speed = parseFloat(el.dataset.parallax || '-0.3');
    gsap.to(el, {
      yPercent: speed * 100,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });
  });
}

/* ---------- Boot ---------- */

function boot() {
  const gsap = window.gsap;
  if (!gsap) {
    log('GSAP missing — relying on CSS fallback.');
    return;
  }

  const ScrollTrigger = window.ScrollTrigger;
  if (ScrollTrigger && gsap.registerPlugin) {
    gsap.registerPlugin(ScrollTrigger);
  }

  setupReveals(gsap, ScrollTrigger);
  setupStaggers(gsap, ScrollTrigger);
  setupCounters(gsap, ScrollTrigger);
  setupRevealMasks(gsap, ScrollTrigger);
  setupParallax(gsap, ScrollTrigger);

  log('GSAP animations ready');
}

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
}
