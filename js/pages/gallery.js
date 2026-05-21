/**
 * Gallery page (gallery.html). Renders masonry grid + lightbox with prev/next + keyboard nav.
 */

import api from '../api.js';

const state = {
  items: [],
  index: 0,
  open: false
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderGrid() {
  const grid = document.querySelector('[data-gallery-grid]');
  const emptyState = document.querySelector('[data-empty-state]');
  if (!grid) return;

  if (!state.items.length) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = state.items
    .map(
      (item, idx) => `
      <a class="gallery-item" data-gallery-open="${idx}" href="${escapeHtml(item.image_url)}">
        <img
          src="${escapeHtml(item.image_url)}"
          alt="${escapeHtml(item.caption || 'Gallery image')}"
          loading="lazy">
        ${item.caption ? `<div class="gallery-item-caption">${escapeHtml(item.caption)}</div>` : ''}
      </a>
    `
    )
    .join('');

  const gsap = window.gsap;
  if (gsap) {
    gsap.fromTo(
      grid.querySelectorAll('.gallery-item'),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.04 }
    );
  }
}

/* ---------- Lightbox ---------- */

function openLightbox(index) {
  state.index = index;
  state.open = true;
  updateLightbox();
  const lb = document.querySelector('[data-lightbox]');
  if (lb) lb.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function closeLightbox() {
  state.open = false;
  const lb = document.querySelector('[data-lightbox]');
  if (lb) lb.classList.remove('is-open');
  document.body.style.overflow = '';
}

function nextLightbox() {
  if (!state.items.length) return;
  state.index = (state.index + 1) % state.items.length;
  updateLightbox();
}

function prevLightbox() {
  if (!state.items.length) return;
  state.index = (state.index - 1 + state.items.length) % state.items.length;
  updateLightbox();
}

function updateLightbox() {
  const item = state.items[state.index];
  if (!item) return;
  const img = document.querySelector('[data-lightbox-img]');
  const caption = document.querySelector('[data-lightbox-caption]');
  if (img) {
    img.src = item.image_url;
    img.alt = item.caption || 'Gallery image';
  }
  if (caption) {
    caption.textContent = item.caption || '';
    caption.style.display = item.caption ? '' : 'none';
  }
}

function attachLightboxHandlers() {
  document.addEventListener('click', (event) => {
    const opener = event.target.closest('[data-gallery-open]');
    if (opener) {
      event.preventDefault();
      openLightbox(parseInt(opener.dataset.galleryOpen, 10));
      return;
    }
    if (event.target.closest('[data-lightbox-close]')) {
      closeLightbox();
      return;
    }
    if (event.target.closest('[data-lightbox-prev]')) {
      prevLightbox();
      return;
    }
    if (event.target.closest('[data-lightbox-next]')) {
      nextLightbox();
      return;
    }
    /* Click backdrop (the dialog wrapper) closes too. */
    const lb = event.target.closest('[data-lightbox]');
    if (lb && event.target === lb) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (!state.open) return;
    if (event.key === 'Escape') closeLightbox();
    else if (event.key === 'ArrowRight') nextLightbox();
    else if (event.key === 'ArrowLeft') prevLightbox();
  });
}

async function loadGallery() {
  const res = await api.getGallery();
  if (!res.ok) {
    const grid = document.querySelector('[data-gallery-grid]');
    if (grid) {
      grid.innerHTML = `
        <div class="state" style="column-span: all;">
          <i data-lucide="wifi-off"></i>
          <h3 class="text-h2">Could not load gallery</h3>
          <p class="text-small text-muted mt-2">${escapeHtml(res.error || 'Try again later.')}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
    return;
  }
  state.items = Array.isArray(res.data) ? res.data : [];
  renderGrid();
}

function boot() {
  attachLightboxHandlers();
  loadGallery();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
