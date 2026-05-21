/**
 * Player dashboard (dashboard.html).
 *
 * Flow:
 *   1. requireAuth({ requireRole: 'player' }) — admin also allowed.
 *      Redirects to /login.html?next=/dashboard.html if not signed in.
 *   2. Fade out the auth loader once authenticated.
 *   3. Fetch getPlayerDashboard(email) + getMatches() in parallel.
 *   4. Render profile / stats / availability / fees.
 *   5. Availability buttons: optimistic UI + markAvailability POST.
 */

import { requireAuth, performLogout } from '../auth.js';
import api from '../api.js';

const DEFAULT_AVATAR = '/images/default-avatar.svg';

const state = {
  session: null,
  player: null,
  stats: {},
  fees: { current: null, history: [] },
  availability: {},   // matchId -> 'YES' | 'NO' | 'MAYBE'
  upcoming: []
};

/* ---------- Helpers ---------- */

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(d) {
  if (!d) return '';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function hideLoader() {
  const loader = document.querySelector('[data-auth-loader]');
  if (!loader) return;
  loader.classList.add('is-hidden');
  setTimeout(() => loader.remove(), 500);
}

function firstName(name) {
  return String(name || '').split(' ')[0] || 'player';
}

function pickStatusForMatch(matchId) {
  /* availability could be:
       - object: { matchId: 'YES' }
       - array:  [{ match_id, status }, ...]
     handle both. */
  if (!matchId) return null;
  const a = state.availability;
  if (!a) return null;
  if (Array.isArray(a)) {
    const found = a.find(
      (r) => String(r.match_id || r.matchId) === String(matchId)
    );
    return found ? (found.status || null) : null;
  }
  return a[matchId] || a[String(matchId)] || null;
}

/* ---------- Render: profile ---------- */

function renderProfile() {
  const s = state.session;
  const p = state.player || {};

  const photo = document.querySelector('[data-profile-photo]');
  const name  = document.querySelector('[data-profile-name]');
  const role  = document.querySelector('[data-profile-role]');
  const jersey = document.querySelector('[data-profile-jersey]');
  const loginId = document.querySelector('[data-profile-loginid]');
  const email = document.querySelector('[data-profile-email]');
  const first = document.querySelector('[data-firstname]');

  const displayName = p.name || s?.name || s?.user?.displayName || 'Player';

  if (photo) {
    photo.src = p.photo_url || s?.user?.photoURL || DEFAULT_AVATAR;
    photo.onerror = () => { photo.src = DEFAULT_AVATAR; };
  }
  if (name) name.textContent = displayName;
  if (role) role.textContent = p.role || '—';
  if (jersey) jersey.textContent = p.jersey_no ? `#${p.jersey_no}` : '—';
  if (loginId) loginId.textContent = s?.loginId || p.login_id || '—';
  if (email) email.textContent = s?.user?.email || '—';
  if (first) first.textContent = firstName(displayName);
}

/* ---------- Render: stats ---------- */

function renderStats() {
  const stats = state.stats || {};
  document.querySelectorAll('[data-stat-key]').forEach((el) => {
    const key = el.dataset.statKey;
    /* tolerate snake_case or camelCase keys from backend */
    const value =
      stats[key] ??
      stats[key.toLowerCase()] ??
      stats[key.replace(/([A-Z])/g, '_$1').toLowerCase()] ??
      0;
    animateNumber(el, Number(value) || 0);
  });
}

function animateNumber(el, target) {
  const gsap = window.gsap;
  if (!gsap) {
    el.textContent = String(target);
    return;
  }
  const obj = { val: 0 };
  gsap.to(obj, {
    val: target,
    duration: 1.1,
    ease: 'power2.out',
    onUpdate: () => { el.textContent = String(Math.round(obj.val)); },
    onComplete: () => { el.textContent = String(target); }
  });
}

/* ---------- Render: availability ---------- */

function renderAvailability() {
  const list = document.querySelector('[data-avail-list]');
  if (!list) return;

  if (!state.upcoming.length) {
    list.innerHTML = `
      <div class="state">
        <i data-lucide="calendar-x"></i>
        <h3 class="text-h3">No upcoming matches</h3>
        <p class="text-small text-muted mt-2">When admins add the next fixture, you can mark availability here.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  list.innerHTML = state.upcoming
    .map((m) => {
      const date = parseDate(m.date);
      const current = pickStatusForMatch(m.match_id || m.id);
      return `
        <article class="avail-card" data-match-id="${escapeHtml(m.match_id || m.id || '')}">
          <div class="avail-card-head">
            <h3 class="avail-card-title">HCC vs ${escapeHtml(m.opponent || 'TBA')}</h3>
            <span class="badge badge-info">${escapeHtml(m.type || 'Friendly')}</span>
          </div>
          <div class="avail-card-meta">
            <div><i data-lucide="calendar"></i> ${escapeHtml(formatDate(date))}</div>
            ${m.time ? `<div><i data-lucide="clock"></i> ${escapeHtml(m.time)}</div>` : ''}
            ${m.venue ? `<div><i data-lucide="map-pin"></i> ${escapeHtml(m.venue)}</div>` : ''}
          </div>
          <div class="avail-actions">
            <button class="avail-btn ${current === 'YES'   ? 'is-active' : ''}" data-status="YES"   type="button">
              <i data-lucide="check"></i> Yes, in
            </button>
            <button class="avail-btn ${current === 'NO'    ? 'is-active' : ''}" data-status="NO"    type="button">
              <i data-lucide="x"></i> Not this time
            </button>
            <button class="avail-btn ${current === 'MAYBE' ? 'is-active' : ''}" data-status="MAYBE" type="button">
              <i data-lucide="circle-help"></i> Maybe
            </button>
          </div>
          <p class="avail-feedback" data-feedback></p>
        </article>
      `;
    })
    .join('');

  if (window.lucide) window.lucide.createIcons();
}

async function handleAvailabilityClick(event) {
  const btn = event.target.closest('.avail-btn');
  if (!btn) return;
  const card = btn.closest('.avail-card');
  if (!card) return;
  if (btn.getAttribute('aria-busy') === 'true') return;

  const matchId = card.dataset.matchId;
  const newStatus = btn.dataset.status;
  if (!matchId || !newStatus) return;

  /* Optimistic UI: capture previous state for rollback. */
  const prevActive = card.querySelector('.avail-btn.is-active');
  const prevStatus = prevActive?.dataset.status || null;

  card.querySelectorAll('.avail-btn').forEach((b) => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  btn.setAttribute('aria-busy', 'true');
  const fb = card.querySelector('[data-feedback]');
  if (fb) {
    fb.textContent = 'Saving…';
    fb.classList.remove('is-error', 'is-success');
  }

  const res = await api.markAvailability({
    email:    state.session?.user?.email || '',
    playerId: state.session?.playerId || state.player?.player_id || '',
    matchId,
    status:   newStatus
  });

  btn.removeAttribute('aria-busy');

  if (!res.ok) {
    /* Rollback. */
    card.querySelectorAll('.avail-btn').forEach((b) => b.classList.remove('is-active'));
    if (prevStatus) {
      card.querySelector(`.avail-btn[data-status="${prevStatus}"]`)?.classList.add('is-active');
    }
    if (fb) {
      fb.textContent = res.error || 'Could not save. Try again.';
      fb.classList.add('is-error');
    }
    return;
  }

  /* Persist locally for subsequent re-renders. */
  if (Array.isArray(state.availability)) {
    const idx = state.availability.findIndex((r) => String(r.match_id || r.matchId) === String(matchId));
    if (idx >= 0) state.availability[idx].status = newStatus;
    else state.availability.push({ match_id: matchId, status: newStatus });
  } else {
    state.availability[matchId] = newStatus;
  }

  if (fb) {
    fb.textContent = 'Saved ✓';
    fb.classList.add('is-success');
    setTimeout(() => {
      if (fb.classList.contains('is-success')) {
        fb.textContent = '';
        fb.classList.remove('is-success');
      }
    }, 2500);
  }
}

/* ---------- Render: fees ---------- */

function renderFees() {
  const monthEl = document.querySelector('[data-fees-month]');
  const statusEl = document.querySelector('[data-fees-status]');
  const historyEl = document.querySelector('[data-fees-history]');

  const fees = state.fees || {};
  const list = Array.isArray(fees) ? fees : (fees.history || []);
  const current = (Array.isArray(fees) ? fees[0] : fees.current) || list[0] || null;

  const now = new Date();
  const currentLabel = now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  if (monthEl) {
    monthEl.textContent = current?.month || currentLabel;
  }
  if (statusEl) {
    const status = String(current?.status || 'Unpaid').toLowerCase();
    statusEl.textContent = current?.status || 'Unpaid';
    statusEl.className = 'badge ' + (
      status.includes('paid') ? 'badge-success' :
      status.includes('pend') ? 'badge-warning' :
      'badge-danger'
    );
  }

  if (historyEl) {
    if (!list.length) {
      historyEl.innerHTML = `<p class="text-small text-muted">No fee records yet.</p>`;
      return;
    }
    historyEl.innerHTML = list
      .slice(0, 12)
      .map(
        (row) => `
        <div class="fees-row">
          <span>${escapeHtml(row.month || row.period || '—')}</span>
          <span><strong>${escapeHtml(row.status || '—')}</strong> ${row.amount ? `· ₹${escapeHtml(String(row.amount))}` : ''}</span>
        </div>
      `
      )
      .join('');
  }
}

/* ---------- Data load ---------- */

async function loadDashboardData() {
  const email = state.session?.user?.email;
  if (!email) return;

  const [dashRes, matchesRes] = await Promise.allSettled([
    api.getPlayerDashboard(email),
    api.getMatches()
  ]);

  if (dashRes.status === 'fulfilled' && dashRes.value.ok) {
    const data = dashRes.value.data || {};
    state.player = data.player || null;
    state.stats = data.stats || {};
    state.fees = data.fees || { current: null, history: [] };
    state.availability = data.availability || {};
  }

  if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
    const all = Array.isArray(matchesRes.value.data) ? matchesRes.value.data : [];
    const now = Date.now();
    state.upcoming = all
      .filter((m) => {
        const d = parseDate(m.date);
        return d && d.getTime() >= now;
      })
      .sort((a, b) => parseDate(a.date) - parseDate(b.date));
  }

  renderProfile();
  renderStats();
  renderAvailability();
  renderFees();
}

/* ---------- Sign out ---------- */

function attachSignOut() {
  document.querySelectorAll('[data-signout]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      await performLogout('/index.html');
    });
  });
}

/* ---------- Boot ---------- */

async function boot() {
  attachSignOut();

  const session = await requireAuth({ requireRole: 'player' });
  if (!session) return; /* requireAuth already redirected */

  state.session = session;
  /* Render minimal profile straight away from the session. */
  renderProfile();
  hideLoader();

  /* Wire availability clicks. */
  document.querySelector('[data-avail-list]')?.addEventListener('click', handleAvailabilityClick);

  /* Load actual dashboard data. */
  await loadDashboardData();
}

boot();
