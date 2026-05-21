/**
 * Home page (index.html) data binding + page-specific animations.
 *
 * - Hero headline GSAP entrance (word-by-word reveal)
 * - Counter animation for stats once values arrive from API
 * - Replaces skeletons with real data in: latest match, featured players, news, gallery
 * - Initialises Swiper for gallery teaser
 *
 * Loads main.js + global animations.js first (via main.js side-effect imports),
 * then this module runs page-specific logic.
 */

import api from '../api.js';
import { FLAGS } from '../config.js';

const DEFAULT_AVATAR = '/images/default-avatar.svg';

function log(...args) {
  if (FLAGS.debug) console.log('[home]', ...args);
}

/* ---------- HERO: word-by-word reveal ---------- */

function animateHero() {
  const gsap = window.gsap;
  if (!gsap) return;

  const words = document.querySelectorAll('[data-hero-word]');
  if (!words.length) return;

  gsap.set(words, { yPercent: 110, opacity: 0 });
  gsap.to(words, {
    yPercent: 0,
    opacity: 1,
    duration: 1.1,
    stagger: 0.12,
    ease: 'power4.out',
    delay: 0.2
  });
}

/* ---------- STATS: counter animation when values arrive ---------- */

function animateCounter(el, finalValue) {
  const gsap = window.gsap;
  if (!gsap) {
    el.textContent = String(finalValue);
    return;
  }

  const obj = { val: 0 };
  gsap.to(obj, {
    val: finalValue,
    duration: 1.4,
    ease: 'power2.out',
    onUpdate: () => {
      el.textContent = Math.round(obj.val).toLocaleString();
    },
    onComplete: () => {
      el.textContent = String(finalValue);
    }
  });
}

async function loadStats() {
  const res = await api.getStats();
  if (!res.ok) {
    log('stats failed:', res.error);
    return;
  }
  const stats = res.data || {};
  document.querySelectorAll('[data-stat]').forEach((el) => {
    const key = el.dataset.stat;
    const value = Number(stats[key] ?? 0);
    el.dataset.final = String(value);
    animateCounter(el, value);
  });
}

/* ---------- LATEST MATCH ---------- */

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function renderLatestMatch(matches) {
  const wrap = document.querySelector('[data-latest-match]');
  if (!wrap) return;

  const now = new Date();
  const upcoming = matches
    .filter((m) => m.date && new Date(m.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const match = upcoming[0] || matches[0];
  if (!match) {
    wrap.innerHTML = `
      <p class="text-label">No matches yet</p>
      <h3 class="card-title mt-3">Stay tuned</h3>
      <p class="text-small text-muted">First match coming soon.</p>
    `;
    return;
  }

  const isUpcoming = match.date && new Date(match.date) >= now;
  const badgeClass = isUpcoming ? 'badge-info' : 'badge-success';
  const badgeText = isUpcoming ? 'Upcoming' : (match.result || 'Past match');

  wrap.innerHTML = `
    <div class="flex items-center justify-between" style="flex-wrap: wrap; gap: var(--space-3);">
      <span class="badge ${badgeClass}">${badgeText}</span>
      <span class="text-small text-muted">${escapeHtml(match.type || 'Friendly')}</span>
    </div>

    <div class="match-versus">
      <div class="match-side">
        <span class="text-tiny text-muted">Home</span>
        <span class="match-side-name">HCC</span>
        ${match.our_score ? `<span class="text-small text-muted">${escapeHtml(match.our_score)}</span>` : ''}
      </div>
      <div class="match-vs">VS</div>
      <div class="match-side opponent">
        <span class="text-tiny text-muted">Away</span>
        <span class="match-side-name">${escapeHtml(match.opponent || 'TBA')}</span>
        ${match.their_score ? `<span class="text-small text-muted">${escapeHtml(match.their_score)}</span>` : ''}
      </div>
    </div>

    <div class="match-meta">
      <div class="match-meta-item"><i data-lucide="calendar"></i> ${escapeHtml(formatDate(match.date))}</div>
      ${match.time ? `<div class="match-meta-item"><i data-lucide="clock"></i> ${escapeHtml(match.time)}</div>` : ''}
      ${match.venue ? `<div class="match-meta-item"><i data-lucide="map-pin"></i> ${escapeHtml(match.venue)}</div>` : ''}
    </div>
  `;

  if (window.lucide) window.lucide.createIcons();
}

async function loadLatestMatch() {
  const res = await api.getMatches();
  if (!res.ok) {
    log('matches failed:', res.error);
    return;
  }
  renderLatestMatch(Array.isArray(res.data) ? res.data : []);
}

/* ---------- FEATURED PLAYERS ---------- */

function renderPlayers(players) {
  const wrap = document.querySelector('[data-featured-players]');
  if (!wrap) return;

  const featured = players.slice(0, 6);
  if (!featured.length) {
    wrap.innerHTML = `<p class="text-muted">Squad list will appear here once players are added.</p>`;
    return;
  }

  wrap.innerHTML = featured
    .map(
      (p) => `
      <article class="player-card stagger-child">
        <img
          class="player-card-photo"
          src="${escapeAttr(p.photo_url || DEFAULT_AVATAR)}"
          alt="${escapeAttr(p.name || 'Player')}"
          loading="lazy"
          onerror="this.src='${DEFAULT_AVATAR}'">
        <div class="player-card-body">
          <h3 class="player-card-name">${escapeHtml(p.name || 'Unknown')}</h3>
          <span class="player-card-role">${escapeHtml(p.role || 'Player')}</span>
          ${p.jersey_no ? `<span class="badge mt-3">#${escapeHtml(String(p.jersey_no))}</span>` : ''}
        </div>
      </article>
    `
    )
    .join('');

  revealDynamicStagger(wrap);
}

async function loadPlayers() {
  const res = await api.getPlayers();
  if (!res.ok) {
    log('players failed:', res.error);
    return;
  }
  renderPlayers(Array.isArray(res.data) ? res.data : []);
}

/* ---------- LATEST NEWS ---------- */

function renderNews(items) {
  const wrap = document.querySelector('[data-featured-news]');
  if (!wrap) return;

  const featured = items.slice(0, 3);
  if (!featured.length) {
    wrap.innerHTML = `<p class="text-muted">News will appear here.</p>`;
    return;
  }

  wrap.innerHTML = featured
    .map(
      (n) => `
      <a class="home-news-link stagger-child" href="${escapeAttr(newsLink(n))}" aria-label="Read ${escapeAttr(n.title || 'news post')}">
        <article class="card card-hover">
          ${n.image_url ? `<img class="card-image" src="${escapeAttr(n.image_url)}" alt="${escapeAttr(n.title || '')}" loading="lazy">` : ''}
          <p class="text-tiny text-muted">${escapeHtml(formatDate(n.date))}</p>
          <h3 class="card-title mt-2">${escapeHtml(n.title || 'Untitled')}</h3>
          <p class="text-small text-secondary">${escapeHtml(markdownPreview(n.content || '', 150))}</p>
        </article>
      </a>
    `
    )
    .join('');

  revealDynamicStagger(wrap);
}

async function loadNews() {
  const res = await api.getNews();
  if (!res.ok) {
    log('news failed:', res.error);
    return;
  }
  renderNews(Array.isArray(res.data) ? res.data : []);
}

/* ---------- GALLERY TEASER (Swiper) ---------- */

function renderGallery(items) {
  const root = document.querySelector('[data-gallery-swiper]');
  if (!root) return;
  const track = root.querySelector('.swiper-wrapper');
  if (!track) return;

  const featured = items.slice(0, 8);
  if (!featured.length) {
    track.innerHTML = `<div class="swiper-slide"><p class="text-muted">Gallery is empty.</p></div>`;
    return;
  }

  track.innerHTML = featured
    .map(
      (g) => `
      <div class="swiper-slide">
        <div class="gallery-slide">
          <img src="${escapeAttr(g.image_url)}" alt="${escapeAttr(g.caption || 'Gallery image')}" loading="lazy">
          ${g.caption ? `<div class="gallery-slide-caption">${escapeHtml(g.caption)}</div>` : ''}
        </div>
      </div>
    `
    )
    .join('');

  if (!window.Swiper) {
    console.warn('[home] Swiper not loaded');
    return;
  }

  /* eslint-disable no-new */
  new window.Swiper(root, {
    slidesPerView: 1.2,
    spaceBetween: 16,
    grabCursor: true,
    autoplay: { delay: 4500, disableOnInteraction: false },
    breakpoints: {
      480:  { slidesPerView: 1.8, spaceBetween: 16 },
      768:  { slidesPerView: 2.4, spaceBetween: 20 },
      1024: { slidesPerView: 3.4, spaceBetween: 24 },
      1440: { slidesPerView: 4,   spaceBetween: 24 }
    }
  });
}

async function loadGallery() {
  const res = await api.getGallery();
  if (!res.ok) {
    log('gallery failed:', res.error);
    return;
  }
  renderGallery(Array.isArray(res.data) ? res.data : []);
}

/* ---------- Helpers ---------- */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value) {
  return escapeHtml(value);
}

function truncate(text, max) {
  const t = String(text);
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function markdownPreview(text, max) {
  if (window.markdownPreview) return window.markdownPreview(text || '', max);
  const plain = String(text || '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/^[-*]\s+/gm, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
  return plain.length > max ? `${plain.slice(0, max).trimEnd()}...` : plain;
}

function newsLink(post) {
  return post?.id ? `/news.html#${encodeURIComponent(post.id)}` : '/news.html';
}

function revealDynamicStagger(parent) {
  const children = parent.querySelectorAll('.stagger-child');
  if (!children.length) return;

  const gsap = window.gsap;
  if (!gsap) {
    children.forEach((child) => {
      child.style.opacity = '1';
      child.style.transform = 'translateY(0)';
    });
    return;
  }

  gsap.killTweensOf(children);
  gsap.set(children, { opacity: 0, y: 24 });

  const tween = {
    opacity: 1,
    y: 0,
    duration: parseFloat(parent.dataset.duration || '0.9'),
    ease: parent.dataset.ease || 'power3.out',
    stagger: parseFloat(parent.dataset.staggerDelay || '0.08')
  };

  gsap.to(children, tween);
  if (window.ScrollTrigger) window.ScrollTrigger.refresh();
}

/* ---------- Boot ---------- */

function boot() {
  animateHero();

  /* Parallel data loads — independent, so fire together. */
  Promise.allSettled([
    loadStats(),
    loadLatestMatch(),
    loadPlayers(),
    loadNews(),
    loadGallery()
  ]).then(() => {
    log('all sections loaded');
    /* Re-create Lucide icons for any newly injected nodes. */
    if (window.lucide) window.lucide.createIcons();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
