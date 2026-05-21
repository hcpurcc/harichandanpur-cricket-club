/**
 * Team page (team.html) — fetch players, render grid, support role filter.
 */

import api from '../api.js';

const DEFAULT_AVATAR = '/images/default-avatar.svg';

const state = {
  players: [],
  role: 'all'
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normaliseRole(role) {
  return String(role || '').trim().toLowerCase();
}

function filteredPlayers() {
  if (state.role === 'all') return state.players;
  const wanted = normaliseRole(state.role);
  return state.players.filter((p) => normaliseRole(p.role) === wanted);
}

function renderGrid() {
  const grid = document.querySelector('[data-player-grid]');
  const emptyState = document.querySelector('[data-empty-state]');
  if (!grid) return;

  const list = filteredPlayers();
  updateCount(list.length);

  if (!list.length) {
    grid.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    return;
  }
  if (emptyState) emptyState.classList.add('hidden');

  grid.innerHTML = list
    .map(
      (p) => `
      <article class="player-card">
        <img
          class="player-card-photo"
          src="${escapeHtml(p.photo_url || DEFAULT_AVATAR)}"
          alt="${escapeHtml(p.name || 'Player')}"
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

  /* Re-animate with GSAP if available, otherwise CSS .in-view handles it. */
  const gsap = window.gsap;
  if (gsap) {
    gsap.fromTo(
      grid.querySelectorAll('.player-card'),
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.05 }
    );
  }
}

function updateCount(n) {
  const countEl = document.querySelector('[data-count]');
  const suffixEl = document.querySelector('[data-count-suffix]');
  if (countEl) countEl.textContent = String(n);
  if (suffixEl) suffixEl.textContent = n === 1 ? '' : 's';
}

function attachFilterHandlers() {
  const root = document.querySelector('[data-role-filter]');
  if (!root) return;

  root.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-role]');
    if (!chip) return;
    state.role = chip.dataset.role || 'all';
    root.querySelectorAll('.chip').forEach((el) => el.classList.toggle('is-active', el === chip));
    renderGrid();
  });
}

async function loadPlayers() {
  const res = await api.getPlayers();
  if (!res.ok) {
    const grid = document.querySelector('[data-player-grid]');
    if (grid) {
      grid.innerHTML = `
        <div class="state" style="grid-column: 1 / -1;">
          <i data-lucide="wifi-off"></i>
          <h3 class="text-h2">Could not load players</h3>
          <p class="text-small text-muted mt-2">${escapeHtml(res.error || 'Try again later.')}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
    return;
  }
  state.players = Array.isArray(res.data) ? res.data : [];
  renderGrid();
}

function boot() {
  attachFilterHandlers();
  loadPlayers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
