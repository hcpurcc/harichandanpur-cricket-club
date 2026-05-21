/**
 * Apps Script API wrapper.
 *
 * Every call returns a uniform shape: { ok, data, error }.
 *
 * CORS note: Google Apps Script web-apps do NOT respond to CORS preflight
 * (OPTIONS) requests. To avoid preflight, POSTs use Content-Type 'text/plain'
 * — which is a "simple request" — and send the JSON body as a plain string.
 * The Apps Script reads e.postData.contents and parses it as JSON.
 *
 * GET responses are cached in memory for FLAGS.apiCacheTtlMs to reduce
 * round-trips when navigating the site.
 */

import { API_URL, FLAGS } from './config.js';

/* ---------- Internal helpers ---------- */

const cache = new Map();

function cacheKey(action, params) {
  return action + '|' + JSON.stringify(params || {});
}

function readCache(key) {
  if (!FLAGS.apiCacheTtlMs) return null;
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.t > FLAGS.apiCacheTtlMs) {
    cache.delete(key);
    return null;
  }
  return entry.v;
}

function writeCache(key, value) {
  if (!FLAGS.apiCacheTtlMs) return;
  cache.set(key, { t: Date.now(), v: value });
}

export function clearApiCache() {
  cache.clear();
}

function ok(data)   { return { ok: true,  data,  error: null }; }
function fail(err)  { return { ok: false, data: null, error: String(err) }; }

function log(...args) {
  if (FLAGS.debug) console.log('[api]', ...args);
}

/**
 * GET ?action=...&param=value
 */
async function apiGet(action, params = {}, { useCache = true } = {}) {
  const key = cacheKey(action, params);
  if (useCache) {
    const cached = readCache(key);
    if (cached) {
      log(action, '(cache hit)');
      return ok(cached);
    }
  }

  const url = new URL(API_URL);
  url.searchParams.set('action', action);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  }

  try {
    log('GET', action, params);
    const res = await fetch(url.toString(), { method: 'GET' });
    if (!res.ok) return fail(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.error) return fail(json.error);
    writeCache(key, json);
    return ok(json);
  } catch (err) {
    console.error('[api] GET failed:', action, err);
    return fail(err.message || 'Network error');
  }
}

/**
 * POST with text/plain body (avoids CORS preflight).
 */
async function apiPost(action, payload = {}) {
  try {
    log('POST', action, payload);
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload })
    });
    if (!res.ok) return fail(`HTTP ${res.status}`);
    const json = await res.json();
    if (json && json.error) return fail(json.error);
    /* Invalidate GET cache on any mutation. */
    cache.clear();
    return ok(json);
  } catch (err) {
    console.error('[api] POST failed:', action, err);
    return fail(err.message || 'Network error');
  }
}

/* ---------- GET endpoints ---------- */

/** Array of player objects. */
export function getPlayers() {
  return apiGet('getPlayers');
}

/** Array of matches sorted newest first. */
export function getMatches() {
  return apiGet('getMatches');
}

/** Array of news posts. */
export function getNews() {
  return apiGet('getNews');
}

/** Array of gallery items. */
export function getGallery() {
  return apiGet('getGallery');
}

/** { exists, role, name, loginId, playerId } */
export function checkUser(email) {
  if (!email) return Promise.resolve(fail('email required'));
  return apiGet('checkUser', { email }, { useCache: false });
}

/** { player, fees, availability, stats } */
export function getPlayerDashboard(email) {
  if (!email) return Promise.resolve(fail('email required'));
  return apiGet('getPlayerDashboard', { email }, { useCache: false });
}

/** { totalPlayers, totalMatches, wins, upcomingMatches } */
export function getStats() {
  return apiGet('getStats');
}

/**
 * Admin: list pending membership applications.
 * Expected response: array of rows from Membership_Requests sheet, each
 * including the sheet row number so approve/reject can target it.
 * Backend endpoint name assumed: ?action=getMembershipRequests
 */
export function getMembershipRequests() {
  return apiGet('getMembershipRequests', {}, { useCache: false });
}

/** Admin: list contact messages from Contact_Messages sheet. */
export function getContactMessages() {
  return apiGet('getContactMessages', {}, { useCache: false });
}

/* ---------- POST endpoints ---------- */

/**
 * Mark match availability for the signed-in player.
 * @param {{ email: string, playerId: string, matchId: string, status: 'YES'|'NO'|'MAYBE', comments?: string }} payload
 */
export function markAvailability(payload) {
  return apiPost('markAvailability', payload);
}

/**
 * Submit contact form. (Web3Forms is the primary path; this is a backup
 * that also logs the message to the Contact_Messages sheet.)
 * @param {{ name: string, email: string, subject?: string, message: string }} payload
 */
export function submitContact(payload) {
  return apiPost('submitContact', payload);
}

/**
 * Admin: approve a pending membership request.
 * @param {{ row: number }} payload — row number in Membership_Requests sheet
 */
export function approveMember(payload) {
  return apiPost('approveMember', payload);
}

/**
 * Admin: reject a pending membership request.
 * @param {{ row: number, reason?: string }} payload
 */
export function rejectMember(payload) {
  return apiPost('rejectMember', payload);
}

/**
 * Admin: schedule a new match (also broadcasts notification emails).
 * @param {{ date: string, time: string, opponent: string, venue: string, type: string }} payload
 */
export function addMatch(payload) {
  return apiPost('addMatch', payload);
}

/** Admin: publish a news post.
 * @param {{ title: string, content: string, image_url?: string, date?: string, author?: string }} payload
 */
export function addNews(payload) {
  return apiPost('addNews', payload);
}

/** Admin: update an existing news post.
 * @param {{ row: number, title: string, content: string, image_url?: string, date?: string, author?: string }} payload
 */
export function updateNews(payload) {
  return apiPost('updateNews', payload);
}

/** Admin: delete a news post row. */
export function deleteNews(row) {
  return apiPost('deleteNews', { row });
}

/** Admin: mark a contact message as read. */
export function markMessageRead(row) {
  return apiPost('markMessageRead', { row });
}

/** Admin: reply to a contact message and mark it as replied. */
export function replyToMessage(payload) {
  return apiPost('replyToMessage', payload);
}

/** Admin: delete a contact message row. */
export function deleteMessage(row) {
  return apiPost('deleteMessage', { row });
}

/* ---------- Default export for star-imports ---------- */

export default {
  getPlayers,
  getMatches,
  getNews,
  getGallery,
  checkUser,
  getPlayerDashboard,
  getStats,
  getMembershipRequests,
  getContactMessages,
  markAvailability,
  submitContact,
  approveMember,
  rejectMember,
  addMatch,
  addNews,
  updateNews,
  deleteNews,
  markMessageRead,
  replyToMessage,
  deleteMessage,
  clearApiCache
};
