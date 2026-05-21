/**
 * Session manager — sits on top of firebase-init.js + api.js.
 *
 * Public surface:
 *   - readSession() / writeSession(session) — sessionStorage cache
 *   - resolveSession(user) — Firebase user -> { user, role, name, loginId, playerId }
 *   - performLogin() — popup + role resolve, returns full outcome
 *   - performLogout() — clear session + sign-out + redirect home
 *   - requireAuth({ requireRole? }) — used by protected pages (dashboard, admin)
 *   - redirectByRole(session) — sends user to dashboard or admin
 *
 * Session shape:
 *   {
 *     user:     { uid, email, displayName, photoURL },
 *     role:     'admin' | 'player' | 'pending' | 'unknown',
 *     name:     string,
 *     loginId:  string | null,
 *     playerId: string | null,
 *     pending:  boolean,
 *     resolvedAt: number  // ms epoch
 *   }
 */

import { onAuthChange, signInWithGoogle, signOutUser } from './firebase-init.js';
import api from './api.js';
import { ADMIN_EMAILS, FLAGS } from './config.js';

const SESSION_KEY = 'hcc_session';
const SESSION_TTL = 30 * 60 * 1000; // 30 min — re-check role after this

function log(...args) {
  if (FLAGS.debug) console.log('[auth]', ...args);
}

function lower(v) {
  return String(v || '').trim().toLowerCase();
}

/* ---------- Session storage ---------- */

export function readSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session) {
  try {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.warn('[auth] sessionStorage unavailable:', err);
  }
}

function isFresh(session) {
  if (!session || !session.resolvedAt) return false;
  return Date.now() - session.resolvedAt < SESSION_TTL;
}

/* ---------- Resolve session ----------
   Combines Firebase user + backend role lookup + frontend admin failsafe. */

export async function resolveSession(user) {
  if (!user || !user.email) return null;

  /* Backend lookup. */
  const res = await api.checkUser(user.email);
  const data = res.ok && res.data ? res.data : {};

  /* Frontend admin failsafe (backend is authoritative for actions). */
  const isAdmin = ADMIN_EMAILS.map(lower).includes(lower(user.email));

  let role = 'unknown';
  if (data.exists) {
    role = data.role || 'player';
  }
  if (isAdmin) role = 'admin';

  /* Special case: user exists in backend but role is empty/awaiting approval. */
  if (data.exists && !data.role && !isAdmin) role = 'pending';

  const session = {
    user: {
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName || data.name || user.email,
      photoURL:    user.photoURL || null
    },
    role,
    name:       data.name || user.displayName || user.email,
    loginId:    data.loginId || null,
    playerId:   data.playerId || null,
    pending:    role === 'pending',
    resolvedAt: Date.now()
  };

  writeSession(session);
  log('session resolved:', session);
  return session;
}

/* ---------- Login / Logout ---------- */

/**
 * Perform full sign-in: popup -> session resolve.
 * @returns {Promise<{ok: boolean, session?: object, error?: string}>}
 */
export async function performLogin() {
  const result = await signInWithGoogle();
  if (!result.ok) {
    return { ok: false, error: result.error || 'Sign-in failed' };
  }
  const session = await resolveSession(result.user);
  return { ok: true, session };
}

/**
 * Sign out, clear cached session, redirect to home.
 */
export async function performLogout(redirect = '/index.html') {
  writeSession(null);
  await signOutUser();
  if (redirect) window.location.href = redirect;
}

/* ---------- Redirect helpers ---------- */

export function redirectByRole(session, fallback = '/index.html') {
  if (!session) {
    window.location.href = fallback;
    return;
  }
  if (session.role === 'admin') {
    window.location.href = '/admin.html';
    return;
  }
  if (session.role === 'player') {
    window.location.href = '/dashboard.html';
    return;
  }
  /* pending / unknown — stay on login page so caller can display message. */
}

/* ---------- Protected page gate ----------
   Use inside dashboard.js / admin.js:
     const session = await requireAuth({ requireRole: 'player' });
   On failure this redirects to /login.html and the returned promise never
   resolves on the original page. */

export function requireAuth({ requireRole, allowPending = false } = {}) {
  return new Promise((resolve) => {
    const cached = readSession();
    /* Optimistic resolve from cache, then validate via Firebase. */
    if (cached && isFresh(cached) && cached.role !== 'unknown') {
      resolve(applyGuard(cached, requireRole, allowPending));
    }

    onAuthChange(async (user) => {
      if (!user) {
        gotoLogin();
        return;
      }
      let session = readSession();
      if (!session || !isFresh(session) || lower(session.user?.email) !== lower(user.email)) {
        session = await resolveSession(user);
      }
      if (!session) {
        gotoLogin();
        return;
      }
      resolve(applyGuard(session, requireRole, allowPending));
    });
  });
}

function applyGuard(session, requireRole, allowPending) {
  if (session.role === 'unknown') {
    window.location.href = `/login.html?status=no-account`;
    return new Promise(() => {}); /* never resolves */
  }
  if (session.role === 'pending' && !allowPending) {
    window.location.href = `/login.html?status=pending`;
    return new Promise(() => {});
  }
  if (requireRole) {
    /* admin can access player areas, but not vice versa. */
    if (requireRole === 'admin' && session.role !== 'admin') {
      window.location.href = '/dashboard.html';
      return new Promise(() => {});
    }
    if (requireRole === 'player' && session.role !== 'admin' && session.role !== 'player') {
      window.location.href = '/login.html';
      return new Promise(() => {});
    }
  }
  return session;
}

function gotoLogin() {
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  window.location.href = `/login.html?next=${next}`;
}

/* ---------- Default export ---------- */

export default {
  readSession,
  writeSession,
  resolveSession,
  performLogin,
  performLogout,
  requireAuth,
  redirectByRole
};
