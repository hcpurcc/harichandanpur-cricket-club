/**
 * Login page (login.html).
 *
 * Boot sequence:
 *   1. If session already exists (returning user), redirect by role to dashboard / admin.
 *   2. If ?status=pending or ?status=no-account in URL, show that banner.
 *   3. Wire up the Google sign-in button. On click:
 *        - call performLogin() which does popup + role resolve
 *        - redirect to ?next= URL if present, else dashboard/admin by role
 *        - show pending / no-account / error banner accordingly
 */

import { performLogin, readSession, redirectByRole } from '../auth.js';
import { onAuthChange } from '../firebase-init.js';

const params = new URLSearchParams(window.location.search);
const nextUrl = params.get('next');

function showBanner(kind, detail) {
  document.querySelectorAll('[data-banner]').forEach((el) => {
    el.classList.remove('is-visible');
  });
  if (!kind) return;
  const banner = document.querySelector(`[data-banner="${kind}"]`);
  if (banner) banner.classList.add('is-visible');
  if (detail) {
    const target = document.querySelector('[data-banner-detail]');
    if (target) target.textContent = detail;
  }
}

function setButtonState(state) {
  const btn = document.querySelector('[data-google-signin]');
  const label = document.querySelector('[data-google-label]');
  if (!btn) return;

  if (state === 'loading') {
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    if (label) label.textContent = 'Signing in…';
  } else {
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    if (label) label.textContent = 'Sign in with Google';
  }
}

function gotoTarget(session) {
  if (nextUrl && nextUrl.startsWith('/')) {
    window.location.href = nextUrl;
    return;
  }
  redirectByRole(session);
}

function showInitialStatusFromUrl() {
  const status = params.get('status');
  if (status === 'pending')    showBanner('pending');
  else if (status === 'no-account') showBanner('no-account');
}

async function handleSignIn() {
  showBanner(null);
  setButtonState('loading');

  const result = await performLogin();

  if (!result.ok) {
    setButtonState('idle');
    /* User-closed-popup is a common case — quiet message. */
    const msg = String(result.error || '').toLowerCase();
    if (msg.includes('popup') && msg.includes('closed')) {
      showBanner(null);
      return;
    }
    showBanner('error', result.error || 'Sign-in failed. Try again.');
    return;
  }

  const session = result.session;

  if (!session || session.role === 'unknown') {
    setButtonState('idle');
    showBanner('no-account');
    return;
  }

  if (session.role === 'pending') {
    setButtonState('idle');
    showBanner('pending');
    return;
  }

  /* Success — flash success banner briefly then redirect. */
  const successTitle = document.querySelector('[data-banner-success-title]');
  if (successTitle) {
    successTitle.textContent = `Welcome${session.name ? ', ' + session.name.split(' ')[0] : ''}.`;
  }
  showBanner('success');
  setTimeout(() => gotoTarget(session), 700);
}

function boot() {
  /* Already logged in? Bounce to the right place. */
  const cached = readSession();
  if (cached && (cached.role === 'admin' || cached.role === 'player')) {
    gotoTarget(cached);
    return;
  }

  /* No cache — listen briefly for Firebase auth state in case the user is
     still signed in from a previous tab/session. If yes, the auth.js code
     will see no session and call backend; we just redirect once we know. */
  let handled = false;
  const stop = onAuthChange(async (user) => {
    if (handled) return;
    if (!user) return;
    handled = true;
    /* Quietly resolve and redirect (no UI spinner needed). */
    setButtonState('loading');
    const session = readSession();
    if (session && session.role !== 'unknown' && session.role !== 'pending') {
      gotoTarget(session);
    }
  });

  showInitialStatusFromUrl();

  const btn = document.querySelector('[data-google-signin]');
  if (btn) btn.addEventListener('click', handleSignIn);

  /* Footer year */
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* Lucide icons */
  if (window.lucide) window.lucide.createIcons();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
