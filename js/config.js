/**
 * Harichandanpur Cricket Club — Frontend Configuration
 *
 * Single source of truth for API URL, Firebase config, Cloudinary preset,
 * admin allowlist and club metadata. Imported by every other JS module.
 *
 * Note: Firebase Web config + Apps Script Web App URL + Cloudinary cloud name
 * are all public-by-design. The Apps Script enforces admin checks server-side.
 */

/* ---------- Backend API (Google Apps Script Web App) ---------- */

export const API_URL =
  'https://script.google.com/macros/s/AKfycbz15ZTkknmdLrJwnINuAIrlmn8qZUdzeqdxy_CCt9hqSuwDTNsr828OncPti0MgwQDI/exec';

/* ---------- Google Sheet (admin direct-edit link) ---------- */

export const SHEET_URL =
  'https://docs.google.com/spreadsheets/d/10z-kOfcY1ZpMxSSSbiWP76veYju4ZEtruW28l-NUZGI/edit';

/* ---------- Firebase Web App ---------- */

export const firebaseConfig = {
  apiKey: 'AIzaSyBl0pXe09XcCQME6w8IuS0rFo11jIeExQo',
  authDomain: 'harichandanpur-cricket-club.firebaseapp.com',
  projectId: 'harichandanpur-cricket-club',
  storageBucket: 'harichandanpur-cricket-club.firebasestorage.app',
  messagingSenderId: '1083509620906',
  appId: '1:1083509620906:web:97faa73d5ce3cc70fa90d3'
};

/* ---------- Cloudinary (unsigned uploads only) ---------- */

export const CLOUDINARY = {
  cloudName: 'duxktmhuj',
  uploadPreset: 'hcc_unsigned',
  folders: {
    players: 'hcc/players',
    matches: 'hcc/matches',
    gallery: 'hcc/gallery',
    news:    'hcc/news',
    system:  'hcc/system'
  }
};

/* ---------- Admin allowlist (frontend gate; server enforces too) ---------- */

export const ADMIN_EMAILS = [
  'harichandanpurcricketclub@gmail.com',
  'ranjitmaity95@gmail.com'
];

/* ---------- Club metadata ---------- */

export const CLUB = {
  name:     'Harichandanpur Cricket Club',
  short:    'HCC',
  email:    'harichandanpurcricketclub@gmail.com',
  founded:  2024,
  location: 'Harichandanpur',
  tagline:  'Built on the streets. Forged in the field.'
};

/* ---------- Navigation links (used by every page) ---------- */

export const NAV_LINKS = [
  { label: 'Home',       href: '/index.html',      page: 'home' },
  { label: 'About',      href: '/about.html',      page: 'about' },
  { label: 'Team',       href: '/team.html',       page: 'team' },
  { label: 'Matches',    href: '/matches.html',    page: 'matches' },
  { label: 'Gallery',    href: '/gallery.html',    page: 'gallery' },
  { label: 'News',       href: '/news.html',       page: 'news' },
  { label: 'Contact',    href: '/contact.html',    page: 'contact' },
  { label: 'Join',       href: '/membership.html', page: 'membership' }
];

/* ---------- Social links (placeholders — update when accounts are live) ---------- */

export const SOCIAL_LINKS = [
  { label: 'Instagram', icon: 'instagram', href: '#' },
  { label: 'YouTube',   icon: 'youtube',   href: '#' },
  { label: 'Facebook',  icon: 'facebook',  href: '#' }
];

/* ---------- External form / service URLs ---------- */

export const FORMS = {
  /* Embed URL for Google Form (Membership). Replace with actual embed src when collected. */
  membershipEmbed: 'https://docs.google.com/forms/d/e/REPLACE_WITH_FORM_ID/viewform?embedded=true',
  /* Web3Forms access key for contact form (free email-direct service). */
  web3FormsAccessKey: 'REPLACE_WITH_WEB3FORMS_KEY'
};

/* ---------- Runtime flags ---------- */

export const FLAGS = {
  /* Set to true to log API calls + animation init to the browser console. */
  debug: false,
  /* Set to false to disable Lenis smooth scroll site-wide. */
  smoothScroll: true,
  /* Cache GET responses for this many milliseconds (5 min). 0 disables cache. */
  apiCacheTtlMs: 0
};
