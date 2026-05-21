/**
 * Matches page (matches.html).
 * Splits matches into upcoming/past, renders cards with countdown for upcoming.
 */

import api from '../api.js';

const state = {
  upcoming: [],
  past: [],
  activeTab: 'upcoming'
};

let countdownInterval = null;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDate(input) {
  if (!input) return null;
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d) {
  if (!d) return '';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function classifyResult(match) {
  /* Best-effort win/loss/draw classification. Falls back to match.result if set. */
  if (match.result) return String(match.result);
  if (match.our_score && match.their_score) {
    const our = parseInt(String(match.our_score).split('/')[0], 10);
    const their = parseInt(String(match.their_score).split('/')[0], 10);
    if (!isNaN(our) && !isNaN(their)) {
      if (our > their) return 'Won';
      if (our < their) return 'Lost';
      return 'Tied';
    }
  }
  return 'Completed';
}

function resultBadgeClass(result) {
  const r = String(result).toLowerCase();
  if (r.includes('won') || r.includes('win')) return 'badge-success';
  if (r.includes('lost') || r.includes('loss')) return 'badge-danger';
  if (r.includes('tie') || r.includes('draw')) return 'badge-warning';
  return 'badge-info';
}

/* ---------- Countdown ---------- */

function diffToNow(target) {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return null;
  const days  = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins  = Math.floor((ms % 3600000) / 60000);
  const secs  = Math.floor((ms % 60000) / 1000);
  return { days, hours, mins, secs };
}

function renderCountdownInto(el, target) {
  const d = diffToNow(target);
  if (!d) {
    el.innerHTML = '<span class="badge badge-warning">Today</span>';
    return;
  }
  el.innerHTML = `
    <div class="countdown-unit"><span class="countdown-num">${String(d.days).padStart(2,'0')}</span><span class="countdown-label">Days</span></div>
    <div class="countdown-unit"><span class="countdown-num">${String(d.hours).padStart(2,'0')}</span><span class="countdown-label">Hrs</span></div>
    <div class="countdown-unit"><span class="countdown-num">${String(d.mins).padStart(2,'0')}</span><span class="countdown-label">Min</span></div>
    <div class="countdown-unit"><span class="countdown-num">${String(d.secs).padStart(2,'0')}</span><span class="countdown-label">Sec</span></div>
  `;
}

function startCountdowns() {
  stopCountdowns();
  const tick = () => {
    document.querySelectorAll('[data-countdown-target]').forEach((el) => {
      const targetMs = parseInt(el.dataset.countdownTarget, 10);
      if (!targetMs) return;
      renderCountdownInto(el, new Date(targetMs));
    });
  };
  tick();
  countdownInterval = setInterval(tick, 1000);
}

function stopCountdowns() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

/* ---------- Card render ---------- */

function upcomingCard(match) {
  const date = parseDate(match.date);
  const targetMs = date ? date.getTime() : 0;

  return `
    <article class="match-card">
      <div class="match-card-head">
        <span class="badge badge-info">Upcoming</span>
        <span class="text-small text-muted">${escapeHtml(match.type || 'Friendly')}</span>
      </div>

      <div class="match-card-grid">
        <div class="match-card-side">
          <span class="text-tiny text-muted">Home</span>
          <span class="match-card-team">HCC</span>
        </div>
        <div class="match-card-vs">VS</div>
        <div class="match-card-side opponent">
          <span class="text-tiny text-muted">Away</span>
          <span class="match-card-team">${escapeHtml(match.opponent || 'TBA')}</span>
        </div>
      </div>

      <div class="match-card-meta">
        <div><i data-lucide="calendar"></i> ${escapeHtml(formatDate(date))}</div>
        ${match.time ? `<div><i data-lucide="clock"></i> ${escapeHtml(match.time)}</div>` : ''}
        ${match.venue ? `<div><i data-lucide="map-pin"></i> ${escapeHtml(match.venue)}</div>` : ''}
      </div>

      ${targetMs ? `
        <div class="mt-4">
          <p class="text-tiny text-muted mb-2">Starts in</p>
          <div class="countdown" data-countdown-target="${targetMs}"></div>
        </div>
      ` : ''}
    </article>
  `;
}

function pastCard(match) {
  const date = parseDate(match.date);
  const result = classifyResult(match);
  const badgeCls = resultBadgeClass(result);

  return `
    <article class="match-card">
      <div class="match-card-head">
        <span class="badge ${badgeCls}">${escapeHtml(result)}</span>
        <span class="text-small text-muted">${escapeHtml(match.type || 'Friendly')}</span>
      </div>

      <div class="match-card-grid">
        <div class="match-card-side">
          <span class="text-tiny text-muted">Home</span>
          <span class="match-card-team">HCC</span>
          ${match.our_score ? `<span class="match-card-score">${escapeHtml(match.our_score)}</span>` : ''}
        </div>
        <div class="match-card-vs">VS</div>
        <div class="match-card-side opponent">
          <span class="text-tiny text-muted">Away</span>
          <span class="match-card-team">${escapeHtml(match.opponent || 'TBA')}</span>
          ${match.their_score ? `<span class="match-card-score">${escapeHtml(match.their_score)}</span>` : ''}
        </div>
      </div>

      <div class="match-card-meta">
        <div><i data-lucide="calendar"></i> ${escapeHtml(formatDate(date))}</div>
        ${match.venue ? `<div><i data-lucide="map-pin"></i> ${escapeHtml(match.venue)}</div>` : ''}
      </div>
    </article>
  `;
}

function renderPanels() {
  const upcomingPanel = document.querySelector('[data-tab-panel="upcoming"]');
  const pastPanel = document.querySelector('[data-tab-panel="past"]');

  if (upcomingPanel) {
    upcomingPanel.innerHTML = state.upcoming.length
      ? state.upcoming.map(upcomingCard).join('')
      : `<div class="state"><i data-lucide="calendar-x"></i><h3 class="text-h2">No matches scheduled yet</h3><p class="text-small text-muted mt-2">Check back soon.</p></div>`;
  }
  if (pastPanel) {
    pastPanel.innerHTML = state.past.length
      ? state.past.map(pastCard).join('')
      : `<div class="state"><i data-lucide="history"></i><h3 class="text-h2">No past results yet</h3><p class="text-small text-muted mt-2">First match coming soon.</p></div>`;
  }

  const upCount = document.querySelector('[data-upcoming-count]');
  const pastCount = document.querySelector('[data-past-count]');
  if (upCount) upCount.textContent = String(state.upcoming.length);
  if (pastCount) pastCount.textContent = String(state.past.length);

  if (window.lucide) window.lucide.createIcons();
  startCountdowns();
}

function switchTab(tab) {
  state.activeTab = tab;
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.classList.toggle('hidden', panel.dataset.tabPanel !== tab);
  });
}

function attachTabHandlers() {
  document.querySelector('[data-tabs]')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });
}

async function loadMatches() {
  const res = await api.getMatches();
  if (!res.ok) {
    const panels = document.querySelectorAll('[data-tab-panel]');
    panels.forEach((p) => {
      p.innerHTML = `
        <div class="state">
          <i data-lucide="wifi-off"></i>
          <h3 class="text-h2">Could not load matches</h3>
          <p class="text-small text-muted mt-2">${escapeHtml(res.error || 'Try again later.')}</p>
        </div>
      `;
    });
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  const list = Array.isArray(res.data) ? res.data : [];
  const now = Date.now();
  state.upcoming = list
    .filter((m) => {
      const d = parseDate(m.date);
      return d && d.getTime() >= now;
    })
    .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  state.past = list
    .filter((m) => {
      const d = parseDate(m.date);
      return d && d.getTime() < now;
    })
    .sort((a, b) => parseDate(b.date) - parseDate(a.date));

  renderPanels();
}

function boot() {
  attachTabHandlers();
  loadMatches();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}

window.addEventListener('beforeunload', stopCountdowns);
