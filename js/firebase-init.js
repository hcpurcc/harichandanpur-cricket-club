/**
 * Firebase initialisation + Google Sign-In helpers.
 *
 * Loads the Firebase compat SDK from <script> tags in each HTML page,
 * then exposes a small surface that auth.js / dashboard.js / admin.js use.
 *
 * Usage in HTML (before any module that imports this file):
 *   <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
 *   <script type="module" src="/js/main.js"></script>
 */

import { firebaseConfig, FLAGS } from './config.js';

const fb = typeof window !== 'undefined' ? window.firebase : undefined;

if (!fb) {
  console.warn(
    '[firebase-init] window.firebase is missing. ' +
    'Add the Firebase compat <script> tags to the page before module scripts.'
  );
}

/* Guard against re-init if multiple modules import this file in one page. */
if (fb && !fb.apps.length) {
  fb.initializeApp(firebaseConfig);
  if (FLAGS.debug) console.log('[firebase-init] App initialised');
}

export const auth = fb ? fb.auth() : null;

export const googleProvider = fb ? new fb.auth.GoogleAuthProvider() : null;

if (googleProvider) {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
}

/**
 * Trigger Google Sign-In popup.
 * @returns {Promise<{ok: boolean, user?: object, error?: string}>}
 */
export async function signInWithGoogle() {
  if (!auth || !googleProvider) {
    return { ok: false, error: 'Firebase not loaded' };
  }

  try {
    const result = await auth.signInWithPopup(googleProvider);
    const user = result.user;
    if (FLAGS.debug) console.log('[firebase-init] Sign-in success:', user.email);
    return {
      ok: true,
      user: {
        uid:         user.uid,
        email:       user.email,
        displayName: user.displayName,
        photoURL:    user.photoURL
      }
    };
  } catch (err) {
    console.error('[firebase-init] Sign-in failed:', err);
    return { ok: false, error: err.message || 'Sign-in failed' };
  }
}

/**
 * Sign out the current user.
 * @returns {Promise<{ok: boolean, error?: string}>}
 */
export async function signOutUser() {
  if (!auth) return { ok: false, error: 'Firebase not loaded' };

  try {
    await auth.signOut();
    return { ok: true };
  } catch (err) {
    console.error('[firebase-init] Sign-out failed:', err);
    return { ok: false, error: err.message || 'Sign-out failed' };
  }
}

/**
 * Subscribe to auth state changes.
 * @param {(user: object|null) => void} callback
 * @returns {() => void} unsubscribe
 */
export function onAuthChange(callback) {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return auth.onAuthStateChanged((user) => {
    if (!user) {
      callback(null);
      return;
    }
    callback({
      uid:         user.uid,
      email:       user.email,
      displayName: user.displayName,
      photoURL:    user.photoURL
    });
  });
}

/**
 * Get the currently signed-in user synchronously (may be null if not yet hydrated).
 * Prefer onAuthChange for reliable reads on page load.
 */
export function getCurrentUser() {
  return auth?.currentUser
    ? {
        uid:         auth.currentUser.uid,
        email:       auth.currentUser.email,
        displayName: auth.currentUser.displayName,
        photoURL:    auth.currentUser.photoURL
      }
    : null;
}
