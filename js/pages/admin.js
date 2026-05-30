/**
 * Admin panel (admin.html).
 *
 * Flow:
 *   1. requireAuth({ requireRole: 'admin' }) — non-admin redirected.
 *   2. Fade auth loader.
 *   3. Parallel fetch: getMembershipRequests + getPlayers + getMatches +
 *      getStats; News and Inbox load separately for tab badges.
 *   4. Render overview cards + each tab panel.
 *   5. Actions: approve / reject / addMatch — optimistic UI + toast.
 */

import { requireAuth, performLogout } from '../auth.js';
import api from '../api.js';
import { SHEET_URL } from '../config.js';

const DEFAULT_AVATAR = '/images/default-avatar.svg';

const state = {
  session: null,
  requests: [],
  players: [],
  matches: [],
  news: [],
  stats: {}
};

/* ---------- Helpers ---------- */

/* Formats a DOB value to "22 Mar 2000" */
function formatDobAdmin(dob) {
  if (!dob) return '—';
  const d = new Date(dob);
  if (isNaN(d.getTime())) return String(dob);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

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

function formatDate(input) {
  if (!input) return '—';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function hideLoader() {
  const loader = document.querySelector('[data-auth-loader]');
  if (!loader) return;
  loader.classList.add('is-hidden');
  setTimeout(() => loader.remove(), 500);
}

let toastTimer = null;
function toast(message, kind = 'success') {
  const el = document.querySelector('[data-toast]');
  const msg = document.querySelector('[data-toast-message]');
  if (!el || !msg) return;
  el.classList.remove('is-success', 'is-error');
  el.classList.add(kind === 'error' ? 'is-error' : 'is-success');
  msg.textContent = message;
  el.classList.add('is-visible');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-visible'), 3000);
}

/* ---------- Overview ---------- */

function renderOverview() {
  const set = (sel, val) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = String(val);
  };
  set('[data-overview-pending]',  state.requests.length);
  set('[data-overview-players]',  state.players.length);
  set('[data-overview-wins]',     state.stats.wins ?? state.stats.total_wins ?? 0);

  const now = Date.now();
  const upcoming = state.matches.filter((m) => {
    const t = m.date ? new Date(m.date).getTime() : NaN;
    return !Number.isNaN(t) && t >= now;
  }).length;
  set('[data-overview-upcoming]', upcoming);

  /* Tab counts */
  set('[data-tab-count-requests]', state.requests.length);
  set('[data-tab-count-members]',  state.players.length);
  set('[data-tab-count-matches]',  state.matches.length);
  set('[data-tab-count-news]',     state.news.length);
}

/* ---------- REQUESTS tab ---------- */

function renderRequests() {
  const wrap = document.querySelector('[data-requests-list]');
  if (!wrap) return;

  if (!state.requests.length) {
    wrap.innerHTML = `
      <div class="state">
        <i data-lucide="inbox"></i>
        <h3 class="text-h3">No pending requests</h3>
        <p class="text-small text-muted mt-2">When new members apply, they will appear here.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  wrap.innerHTML = state.requests
    .map((r) => {
      const row   = r.row || r._row || r.row_number || '';
      const name  = r.name || r.full_name || 'Unknown';
      const photo = r.photo_url || r.cloudinary_url || DEFAULT_AVATAR;
      const email = r.email || '';
      const phone = r.phone || '';
      const age     = r.age_calc?.display || (r.age ? `${r.age} years` : '');
      const dob     = r.dob || '';
      const role    = r.role || '';
      const date  = r.applied_at || r.timestamp || r.date || '';
      const note  = r.why || r.note || r.message || '';

      return `
        <article class="request-card" data-row="${escapeAttr(row)}">
          <img class="request-photo" src="${escapeAttr(photo)}" alt="${escapeAttr(name)}" loading="lazy"
               onerror="this.src='${DEFAULT_AVATAR}'">
          <div class="request-info">
            <h3 class="request-name">${escapeHtml(name)}</h3>
            <div class="request-meta">
              ${role ? `<div><strong>Role:</strong> ${escapeHtml(role)}</div>` : ''}
              ${dob  ? `<div><strong>DOB:</strong> ${escapeHtml(formatDobAdmin(dob))}</div>` : ''}
              ${age  ? `<div><strong>Age:</strong> ${escapeHtml(age)}</div>` : ''}
              ${email ? `<div><strong>Email:</strong> ${escapeHtml(email)}</div>` : ''}
              ${phone ? `<div><strong>Phone:</strong> ${escapeHtml(phone)}</div>` : ''}
              ${date  ? `<div><strong>Applied:</strong> ${escapeHtml(formatDate(date))}</div>` : ''}
            </div>
            ${note ? `<p class="text-small text-muted mt-3" style="max-width: 540px;">“${escapeHtml(note)}”</p>` : ''}
          </div>
          <div class="request-actions">
            <button class="btn btn-primary btn-sm" data-approve type="button">
              <i data-lucide="check"></i> Approve
            </button>
            <button class="btn btn-secondary btn-sm" data-reject-show type="button">
              <i data-lucide="x"></i> Reject
            </button>
          </div>

          <form class="reject-form" data-reject-form>
            <input class="form-input" type="text" placeholder="Reason (optional)" maxlength="200">
            <button class="btn btn-danger btn-sm" type="submit">Confirm reject</button>
            <button class="btn btn-ghost btn-sm" data-reject-cancel type="button">Cancel</button>
          </form>
        </article>
      `;
    })
    .join('');

  if (window.lucide) window.lucide.createIcons();
}

async function handleRequestClick(event) {
  const card = event.target.closest('.request-card');
  if (!card) return;
  const row = card.dataset.row;
  if (!row) return;

  if (event.target.closest('[data-approve]')) {
    return approveRequest(card, row);
  }
  if (event.target.closest('[data-reject-show]')) {
    card.querySelector('[data-reject-form]')?.classList.add('is-visible');
    return;
  }
  if (event.target.closest('[data-reject-cancel]')) {
    card.querySelector('[data-reject-form]')?.classList.remove('is-visible');
    return;
  }
}

async function handleRejectSubmit(event) {
  const form = event.target.closest('[data-reject-form]');
  if (!form) return;
  event.preventDefault();
  const card = form.closest('.request-card');
  if (!card) return;
  const row = card.dataset.row;
  const reason = form.querySelector('input')?.value.trim() || '';
  return rejectRequest(card, row, reason);
}

async function approveRequest(card, row) {
  card.classList.add('is-processing');
  const res = await api.approveMember({ row: Number(row) });
  card.classList.remove('is-processing');

  if (!res.ok) {
    toast(res.error || 'Could not approve. Try again.', 'error');
    return;
  }
  const loginId = res.data?.loginId ? ` (ID: ${res.data.loginId})` : '';
  toast(`Approved${loginId} — welcome email sent.`, 'success');
  /* Remove from local list. */
  state.requests = state.requests.filter((r) => String(r.row || r._row || r.row_number) !== String(row));
  renderOverview();
  renderRequests();
}

async function rejectRequest(card, row, reason) {
  card.classList.add('is-processing');
  const res = await api.rejectMember({ row: Number(row), reason });
  card.classList.remove('is-processing');

  if (!res.ok) {
    toast(res.error || 'Could not reject. Try again.', 'error');
    return;
  }
  toast('Request rejected.', 'success');
  state.requests = state.requests.filter((r) => String(r.row || r._row || r.row_number) !== String(row));
  renderOverview();
  renderRequests();
}

/* ---------- MEMBERS tab ---------- */

function renderMembers() {
  const wrap = document.querySelector('[data-members-list]');
  if (!wrap) return;

  if (!state.players.length) {
    wrap.innerHTML = `
      <div class="state" style="grid-column: 1 / -1;">
        <i data-lucide="users"></i>
        <h3 class="text-h3">No players yet</h3>
        <p class="text-small text-muted mt-2">Approve membership requests or add players directly in Sheets.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  wrap.innerHTML = state.players
    .map(
      (p) => `
      <div class="ro-card">
        <img src="${escapeAttr(p.photo_url || DEFAULT_AVATAR)}" alt="${escapeAttr(p.name || '')}"
             onerror="this.src='${DEFAULT_AVATAR}'">
        <div class="ro-card-body">
          <div class="ro-card-name">${escapeHtml(p.name || 'Unknown')}</div>
          <div class="ro-card-meta">${escapeHtml(p.role || 'Player')}${p.jersey_no ? ` · #${escapeHtml(String(p.jersey_no))}` : ''}</div>
        </div>
      </div>
    `
    )
    .join('');
}

/* ---------- MATCHES tab ---------- */

function renderUpcomingMatches() {
  const wrap = document.querySelector('[data-upcoming-list]');
  if (!wrap) return;

  const now = Date.now();
  const upcoming = state.matches
    .filter((m) => {
      const t = m.date ? new Date(m.date).getTime() : NaN;
      return !Number.isNaN(t) && t >= now;
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (!upcoming.length) {
    wrap.innerHTML = `
      <div class="state">
        <i data-lucide="calendar-plus"></i>
        <h3 class="text-h3">Nothing scheduled</h3>
        <p class="text-small text-muted mt-2">Add a match above to notify the squad.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  wrap.innerHTML = upcoming
    .map(
      (m) => `
      <div class="match-row">
        <div>
          <strong>HCC vs ${escapeHtml(m.opponent || 'TBA')}</strong>
          <div class="text-small text-muted mt-1">
            ${escapeHtml(formatDate(m.date))}${m.time ? ` · ${escapeHtml(m.time)}` : ''}${m.venue ? ` · ${escapeHtml(m.venue)}` : ''}
          </div>
        </div>
        <span class="badge">${escapeHtml(m.type || 'Friendly')}</span>
      </div>
    `
    )
    .join('');
}

async function handleAddMatch(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = {
    date:     String(formData.get('date')     || '').trim(),
    time:     String(formData.get('time')     || '').trim(),
    opponent: String(formData.get('opponent') || '').trim(),
    venue:    String(formData.get('venue')    || '').trim(),
    type:     String(formData.get('type')     || 'Friendly').trim()
  };

  if (!payload.date || !payload.time || !payload.opponent || !payload.venue) {
    toast('Fill date, time, opponent and venue.', 'error');
    return;
  }

  const btn = document.querySelector('[data-add-match-submit]');
  const label = document.querySelector('[data-add-match-label]');
  if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
  if (label) label.textContent = 'Sending…';

  const res = await api.addMatch(payload);

  if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
  if (label) label.textContent = 'Add match + notify squad';

  if (!res.ok) {
    toast(res.error || 'Could not add match.', 'error');
    return;
  }
  const sent = res.data?.notificationsSent ?? res.data?.notifications ?? 0;
  toast(sent ? `Match added — notifications sent to ${sent} player${sent === 1 ? '' : 's'}.` : 'Match added.', 'success');
  form.reset();
  /* Refresh matches. */
  await refreshMatches();
}

async function refreshMatches() {
  const res = await api.getMatches();
  if (res.ok) {
    state.matches = Array.isArray(res.data) ? res.data : [];
    renderOverview();
    renderUpcomingMatches();
  }
}

/* ---------- NEWS tab ---------- */

function renderNews() {
  const wrap = document.querySelector('[data-news-list]');
  if (!wrap) return;

  if (!state.news.length) {
    wrap.innerHTML = `
      <div class="state" style="grid-column: 1 / -1;">
        <i data-lucide="newspaper"></i>
        <h3 class="text-h3">No news yet</h3>
        <p class="text-small text-muted mt-2">Add posts in the News sheet — they will appear here and on the public news page.</p>
      </div>
    `;
    if (window.lucide) window.lucide.createIcons();
    return;
  }

  wrap.innerHTML = state.news
    .map(
      (n) => `
      <div class="ro-card">
        <img src="${escapeAttr(n.image_url || DEFAULT_AVATAR)}" alt="${escapeAttr(n.title || '')}"
             onerror="this.src='${DEFAULT_AVATAR}'">
        <div class="ro-card-body">
          <div class="ro-card-name">${escapeHtml(n.title || 'Untitled')}</div>
          <div class="ro-card-meta">${escapeHtml(formatDate(n.date))}</div>
        </div>
      </div>
    `
    )
    .join('');
}

const News = {
  posts: [],
  editingRow: null,
  loaded: false,
  loading: false,
  error: null,

  async load({ quiet = false } = {}) {
    const listEl = document.getElementById('newsList');
    if (!listEl) return;

    this.loading = true;
    this.error = null;
    if (!quiet || this.isActive()) {
      listEl.innerHTML = `
        <div class="state">
          <div class="spinner" style="margin: 0 auto var(--space-3);"></div>
          <p class="text-small">Loading posts...</p>
        </div>
      `;
    }

    const res = await api.getNews();
    this.loading = false;

    if (!res.ok) {
      this.loaded = false;
      this.posts = [];
      state.news = [];
      this.error = res.error || 'Could not load posts.';
      this.updateBadge();
      renderOverview();
      this.renderList();
      return;
    }

    this.loaded = true;
    this.posts = Array.isArray(res.data) ? res.data : [];
    state.news = this.posts;
    this.updateBadge();
    renderOverview();
    this.renderList();
  },

  isActive() {
    return document.querySelector('[data-tab-panel="news"]')?.classList.contains('is-active') || false;
  },

  updateBadge() {
    const badge = document.getElementById('newsBadge');
    if (!badge) return;
    badge.textContent = String(this.posts.length);
    badge.style.display = 'inline-flex';
  },

  renderList() {
    const listEl = document.getElementById('newsList');
    if (!listEl) return;

    if (this.loading) {
      listEl.innerHTML = `
        <div class="state">
          <div class="spinner" style="margin: 0 auto var(--space-3);"></div>
          <p class="text-small">Loading posts...</p>
        </div>
      `;
      return;
    }

    if (this.error) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i data-lucide="alert-triangle"></i>
          <h3 class="text-h3">Could not load posts</h3>
          <p class="text-small text-muted mt-2">${escapeHtml(this.error)}</p>
          <button class="btn btn-secondary btn-sm mt-4" data-news-action="retry" type="button">Retry</button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    if (!this.posts.length) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i data-lucide="newspaper"></i>
          <h3 class="text-h3">No news posts yet</h3>
          <p class="text-small text-muted mt-2">Publish your first one above.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listEl.innerHTML = this.posts.map((post) => {
      const row = Number(post.row);
      const previewText = window.markdownPreview
        ? window.markdownPreview(post.content || '', 200)
        : this.truncate(post.content || '', 200);
      return `
        <article class="news-admin-card" data-row="${escapeAttr(row)}">
          <div class="news-admin-meta">
            ${post.id ? `<span class="news-admin-id">${escapeHtml(post.id)}</span>` : ''}
            <span class="news-admin-date">${escapeHtml(formatDate(post.date))}</span>
            <span class="news-admin-author">by ${escapeHtml(post.author || 'HCC')}</span>
          </div>
          <h4 class="news-admin-title">${escapeHtml(post.title || '(untitled)')}</h4>
          <div class="news-admin-content">${escapeHtml(previewText)}</div>
          <div class="news-admin-actions">
            <button class="btn-action" data-news-action="edit" type="button">
              <i data-lucide="edit-3"></i> Edit
            </button>
            <button class="btn-action btn-danger-action" data-news-action="delete" type="button">
              <i data-lucide="trash-2"></i> Delete
            </button>
          </div>
        </article>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  async publish() {
    const titleEl = document.getElementById('newsTitle');
    const imageEl = document.getElementById('newsImageUrl');
    const contentEl = document.getElementById('newsContent');
    const dateEl = document.getElementById('newsDate');
    const authorEl = document.getElementById('newsAuthor');
    const btn = document.getElementById('newsPublishBtn');

    const title = titleEl?.value.trim() || '';
    const imageUrl = imageEl?.value.trim() || '';
    const content = contentEl?.value.trim() || '';
    const date = dateEl?.value || '';
    const author = authorEl?.value.trim() || 'HCC Admin';
    const isEditMode = this.editingRow !== null;

    if (!title) {
      toast('Title is required.', 'error');
      titleEl?.focus();
      return;
    }
    if (!content) {
      toast('Content is required.', 'error');
      contentEl?.focus();
      return;
    }
    if (imageUrl && !/^(https?:\/\/|\/)/i.test(imageUrl)) {
      toast('Image URL must start with http://, https://, or /.', 'error');
      imageEl?.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = isEditMode ? 'Updating...' : 'Publishing...';
    }

    const payload = {
      title,
      content,
      image_url: isEditMode ? imageUrl : imageUrl || undefined,
      date: date || undefined,
      author
    };
    const res = isEditMode
      ? await api.updateNews({ ...payload, row: this.editingRow })
      : await api.addNews(payload);

    if (btn) {
      btn.disabled = false;
      btn.textContent = isEditMode ? 'Update Post' : 'Publish';
    }

    if (!res.ok || !res.data?.success) {
      toast(res.error || res.data?.message || (isEditMode ? 'Update failed.' : 'Publish failed.'), 'error');
      return;
    }

    if (isEditMode) {
      toast('Post updated.', 'success');
      this.cancelEdit();
    } else {
      const id = res.data?.id ? ` as ${res.data.id}` : '';
      toast(`Published${id}.`, 'success');
      this.clear();
    }
    await this.load();
  },

  clear() {
    const titleEl = document.getElementById('newsTitle');
    const imageEl = document.getElementById('newsImageUrl');
    const contentEl = document.getElementById('newsContent');
    const dateEl = document.getElementById('newsDate');
    const authorEl = document.getElementById('newsAuthor');
    const countEl = document.getElementById('titleCount');

    if (titleEl) titleEl.value = '';
    if (imageEl) imageEl.value = '';
    if (contentEl) contentEl.value = '';
    if (dateEl) dateEl.value = '';
    if (authorEl) authorEl.value = '';
    if (countEl) countEl.textContent = '0';
    MarkdownToolbar.reset();
  },

  startEdit(row) {
    const targetRow = Number(row);
    const post = this.posts.find((p) => Number(p.row) === targetRow);
    if (!post) {
      toast('Post not found.', 'error');
      return;
    }

    this.setValue('newsTitle', post.title || '');
    this.setValue('newsImageUrl', post.image_url || '');
    this.setValue('newsContent', post.content || '');
    this.setValue('newsAuthor', post.author || '');
    this.setValue('newsDate', this.toDateInputValue(post.date));
    this.updateTitleCount();
    MarkdownToolbar.refreshPreview();

    this.editingRow = targetRow;
    this.setEditButtonState(true);
    this.showEditingBanner(post);

    const formCard = document.querySelector('.news-form-card');
    formCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.setTimeout(() => {
      document.getElementById('newsTitle')?.focus();
    }, 300);
  },

  cancelEdit() {
    this.editingRow = null;
    this.clear();
    this.setEditButtonState(false);

    const banner = document.getElementById('editingBanner');
    if (banner) banner.style.display = 'none';
  },

  setEditButtonState(isEditing) {
    const publishBtn = document.getElementById('newsPublishBtn');
    if (!publishBtn) return;

    publishBtn.textContent = isEditing ? 'Update Post' : 'Publish';
    publishBtn.dataset.mode = isEditing ? 'edit' : 'create';
  },

  showEditingBanner(post) {
    const formCard = document.querySelector('.news-form-card');
    if (!formCard) return;

    let banner = document.getElementById('editingBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'editingBanner';
      banner.className = 'editing-banner';
      formCard.insertBefore(banner, formCard.firstChild);
    }

    banner.style.display = 'block';
    banner.innerHTML = `
      Editing post <strong>${escapeHtml(post.id || '')}</strong> -
      <a href="#" data-news-cancel-edit>Cancel</a>
    `;
    banner.querySelector('[data-news-cancel-edit]')?.addEventListener('click', (event) => {
      event.preventDefault();
      this.cancelEdit();
    });
  },

  setValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  },

  toDateInputValue(input) {
    if (!input) return '';

    const raw = String(input);
    const direct = raw.match(/^(\d{4}-\d{2}-\d{2})/);
    if (direct) return direct[1];

    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
  },

  confirmDelete(row) {
    const post = this.posts.find((p) => Number(p.row) === Number(row));
    const title = post?.title || 'this post';
    if (!window.confirm(`Delete "${title}" permanently?`)) return;
    this.deletePost(row);
  },

  async deletePost(row) {
    const res = await api.deleteNews(Number(row));
    if (!res.ok || !res.data?.success) {
      toast(res.error || res.data?.message || 'Delete failed.', 'error');
      return;
    }

    this.posts = this.posts.filter((p) => Number(p.row) !== Number(row));
    this.posts.forEach((p) => {
      if (Number(p.row) > Number(row)) p.row = Number(p.row) - 1;
    });
    if (Number(this.editingRow) === Number(row)) this.cancelEdit();
    state.news = this.posts;
    this.updateBadge();
    renderOverview();
    this.renderList();
    toast('Post deleted.', 'success');
  },

  handleListClick(event) {
    const retry = event.target.closest('[data-news-action="retry"]');
    if (retry) {
      this.load();
      return;
    }

    const action = event.target.closest('[data-news-action]');
    if (!action) return;

    const card = action.closest('[data-row]');
    const row = Number(card?.dataset.row);
    if (!row) return;

    if (action.dataset.newsAction === 'edit') this.startEdit(row);
    if (action.dataset.newsAction === 'delete') this.confirmDelete(row);
  },

  setDefaultDate() {
    const dateEl = document.getElementById('newsDate');
    if (dateEl && !dateEl.value) dateEl.valueAsDate = new Date();
  },

  updateTitleCount() {
    const titleEl = document.getElementById('newsTitle');
    const countEl = document.getElementById('titleCount');
    if (titleEl && countEl) countEl.textContent = String(titleEl.value.length);
  },

  truncate(text, max) {
    const value = String(text || '');
    return value.length > max ? `${value.slice(0, max).trimEnd()}...` : value;
  }
};

const MarkdownToolbar = {
  initialized: false,
  previewMode: false,

  get editor() {
    return document.getElementById('newsContent');
  },

  get preview() {
    return document.getElementById('newsPreview');
  },

  get toggleBtn() {
    return document.getElementById('mdTogglePreview');
  },

  init() {
    if (this.initialized) return;

    const toolbar = document.querySelector('.md-toolbar');
    const editor = this.editor;
    if (!toolbar || !editor) return;

    toolbar.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-md-action]');
      if (!btn) return;
      event.preventDefault();
      this.handleAction(btn.dataset.mdAction);
    });

    editor.addEventListener('input', () => {
      this.refreshPreview();
    });

    editor.addEventListener('keydown', (event) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key !== 'b' && key !== 'i') return;

      event.preventDefault();
      this.handleAction(key === 'b' ? 'bold' : 'italic');
    });

    this.initialized = true;
    this.refreshPreview();
  },

  handleAction(action) {
    if (action === 'preview') {
      this.togglePreview();
      return;
    }

    const editor = this.editor;
    if (!editor) return;

    if (this.previewMode) this.togglePreview(false);

    if (action === 'bold') this.wrapSelection('**', '**', 'bold text');
    if (action === 'italic') this.wrapSelection('*', '*', 'italic text');
    if (action === 'heading') this.prefixSelection('## ', 'Heading');
    if (action === 'list') this.prefixSelection('- ', 'List item');
    if (action === 'quote') this.prefixSelection('> ', 'Quote');
    if (action === 'link') this.insertLink();

    this.refreshPreview();
  },

  wrapSelection(prefix, suffix, placeholder) {
    const editor = this.editor;
    if (!editor) return;

    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    const selected = editor.value.slice(start, end);
    const text = selected || placeholder;

    editor.setRangeText(`${prefix}${text}${suffix}`, start, end, 'end');
    editor.focus();

    if (!selected) {
      editor.setSelectionRange(start + prefix.length, start + prefix.length + text.length);
    }
  },

  prefixSelection(prefix, placeholder) {
    const editor = this.editor;
    if (!editor) return;

    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    const selected = editor.value.slice(start, end);
    const text = selected || placeholder;
    const lines = text.split('\n').map((line) => `${prefix}${line || placeholder}`);

    editor.setRangeText(lines.join('\n'), start, end, 'end');
    editor.focus();
  },

  insertLink() {
    const editor = this.editor;
    if (!editor) return;

    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    const selected = editor.value.slice(start, end) || 'link text';
    const url = window.prompt('Enter URL:', 'https://');
    const cleanUrl = url?.trim() || '';
    if (!cleanUrl) return;
    const value = `[${selected}](${cleanUrl})`;

    editor.setRangeText(value, start, end, 'end');
    editor.focus();
  },

  togglePreview(force) {
    const editor = this.editor;
    const preview = this.preview;
    const btn = this.toggleBtn;
    if (!editor || !preview || !btn) return;

    this.previewMode = typeof force === 'boolean' ? force : !this.previewMode;
    if (this.previewMode) this.refreshPreview();

    editor.style.display = this.previewMode ? 'none' : '';
    preview.style.display = this.previewMode ? 'block' : 'none';
    btn.textContent = this.previewMode ? 'Edit' : 'Preview';
    btn.classList.toggle('is-active', this.previewMode);
  },

  refreshPreview() {
    const editor = this.editor;
    const preview = this.preview;
    if (!editor || !preview) return;

    const content = editor.value.trim();
    const renderer = window.renderMarkdown || ((value) => escapeHtml(value).replace(/\n/g, '<br>'));
    preview.innerHTML = content ? renderer(content) : '<p class="text-muted">Preview will appear here.</p>';
  },

  reset() {
    const editor = this.editor;
    if (!editor) return;
    this.refreshPreview();
    this.togglePreview(false);
  }
};

function attachNewsHandlers() {
  MarkdownToolbar.init();

  document.getElementById('newsTitle')?.addEventListener('input', () => {
    News.updateTitleCount();
  });

  document.querySelector('[data-news-form]')?.addEventListener('submit', (event) => {
    event.preventDefault();
    News.publish();
  });

  document.getElementById('newsClearBtn')?.addEventListener('click', () => {
    News.cancelEdit();
  });

  document.getElementById('newsList')?.addEventListener('click', (event) => {
    News.handleListClick(event);
  });

  News.setDefaultDate();
}

/* ---------- INBOX tab ---------- */

const Inbox = {
  messages: [],
  currentFilter: 'all',
  replyingTo: null,
  loaded: false,
  loading: false,
  error: null,

  async load({ quiet = false } = {}) {
    const listEl = document.getElementById('inboxList');
    if (!listEl) return;

    this.loading = true;
    this.error = null;
    if (!quiet || this.isActive()) {
      listEl.innerHTML = `
        <div class="state">
          <div class="spinner" style="margin: 0 auto var(--space-3);"></div>
          <p class="text-small">Loading messages...</p>
        </div>
      `;
    }

    const res = await api.getContactMessages();
    this.loading = false;

    if (!res.ok) {
      this.loaded = false;
      this.messages = [];
      this.error = res.error || 'Could not load messages.';
      this.updateBadge();
      this.render();
      return;
    }

    this.loaded = true;
    this.messages = Array.isArray(res.data) ? res.data : [];
    this.updateBadge();
    this.render();
  },

  isActive() {
    return document.querySelector('[data-tab-panel="inbox"]')?.classList.contains('is-active') || false;
  },

  updateBadge() {
    const badge = document.getElementById('inboxBadge');
    if (!badge) return;

    const unreadCount = this.messages.filter((m) => !this.isYes(m.read)).length;
    badge.textContent = String(unreadCount);
    badge.style.display = unreadCount > 0 ? 'inline-flex' : 'none';
  },

  filter(type) {
    this.currentFilter = type || 'all';
    document.querySelectorAll('.filter-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.filter === this.currentFilter);
    });
    this.render();
  },

  getFiltered() {
    if (this.currentFilter === 'unread') {
      return this.messages.filter((m) => !this.isYes(m.read));
    }
    if (this.currentFilter === 'unreplied') {
      return this.messages.filter((m) => !this.isYes(m.replied));
    }
    return this.messages;
  },

  render() {
    const listEl = document.getElementById('inboxList');
    if (!listEl) return;

    if (this.loading) {
      listEl.innerHTML = `
        <div class="state">
          <div class="spinner" style="margin: 0 auto var(--space-3);"></div>
          <p class="text-small">Loading messages...</p>
        </div>
      `;
      return;
    }

    if (this.error) {
      listEl.innerHTML = `
        <div class="empty-state">
          <i data-lucide="alert-triangle"></i>
          <h3 class="text-h3">Could not load messages</h3>
          <p class="text-small text-muted mt-2">${escapeHtml(this.error)}</p>
          <button class="btn btn-secondary btn-sm mt-4" data-inbox-retry type="button">Retry</button>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    const filtered = this.getFiltered();
    if (!filtered.length) {
      const label = this.currentFilter === 'all' ? 'No messages yet' : `No ${this.currentFilter} messages`;
      listEl.innerHTML = `
        <div class="empty-state">
          <i data-lucide="inbox"></i>
          <h3 class="text-h3">${escapeHtml(label)}</h3>
          <p class="text-small text-muted mt-2">Contact form messages will appear here.</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
      return;
    }

    listEl.innerHTML = filtered.map((msg) => {
      const row = Number(msg.row);
      const isUnread = !this.isYes(msg.read);
      const isReplied = this.isYes(msg.replied);

      return `
        <article class="message-card ${isUnread ? 'unread' : ''}" data-row="${escapeAttr(row)}">
          <div class="message-header">
            <div class="message-meta">
              <div class="message-from">
                <span class="message-name">${escapeHtml(msg.name || 'Unknown sender')}</span>
                <span class="message-email">${escapeHtml(msg.email || '')}</span>
              </div>
              <div class="message-time">${escapeHtml(this.formatTime(msg.timestamp))}</div>
            </div>
            <div class="message-badges">
              ${isUnread ? '<span class="message-badge message-badge-unread">Unread</span>' : ''}
              ${isReplied ? '<span class="message-badge message-badge-replied">Replied</span>' : ''}
            </div>
          </div>
          <div class="message-subject">${escapeHtml(msg.subject || '(no subject)')}</div>
          <div class="message-body">${escapeHtml(msg.message || '')}</div>
          <div class="message-actions">
            ${isUnread ? `
              <button class="btn-action" data-message-action="mark-read" type="button">
                <i data-lucide="check"></i> Mark read
              </button>
            ` : ''}
            <button class="btn-action btn-primary-action" data-message-action="reply" type="button">
              <i data-lucide="reply"></i> Reply
            </button>
            <button class="btn-action btn-danger-action" data-message-action="delete" type="button">
              <i data-lucide="trash-2"></i> Delete
            </button>
          </div>
        </article>
      `;
    }).join('');

    if (window.lucide) window.lucide.createIcons();
  },

  async markRead(row) {
    const res = await api.markMessageRead(Number(row));
    if (!res.ok || !res.data?.success) {
      toast(res.error || res.data?.message || 'Could not mark message as read.', 'error');
      return;
    }

    const msg = this.messages.find((m) => Number(m.row) === Number(row));
    if (msg) msg.read = 'Y';
    this.updateBadge();
    this.render();
    toast('Marked as read.', 'success');
  },

  openReply(row) {
    const msg = this.messages.find((m) => Number(m.row) === Number(row));
    if (!msg) return;

    this.replyingTo = msg;
    this.setText('replyToName', msg.name || 'Unknown sender');
    this.setText('replyToEmail', msg.email || '');
    this.setText('replyToSubject', msg.subject || '(no subject)');
    this.setText('replyOriginalText', msg.message || '');

    const textarea = document.getElementById('replyTextarea');
    if (textarea) textarea.value = '';

    const modal = document.getElementById('replyModal');
    if (modal) modal.style.display = 'flex';
    textarea?.focus();
  },

  closeReply() {
    const modal = document.getElementById('replyModal');
    if (modal) modal.style.display = 'none';
    this.replyingTo = null;
  },

  async sendReply() {
    if (!this.replyingTo) return;

    const textarea = document.getElementById('replyTextarea');
    const body = textarea?.value.trim() || '';
    if (!body) {
      toast('Reply cannot be empty.', 'error');
      return;
    }

    const sendBtn = document.getElementById('replySendBtn');
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending...';
    }

    const res = await api.replyToMessage({
      row: Number(this.replyingTo.row),
      email: this.replyingTo.email,
      subject: this.replyingTo.subject,
      replyBody: body
    });

    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.textContent = 'Send Reply';
    }

    if (!res.ok || !res.data?.success) {
      toast(res.error || res.data?.message || 'Could not send reply.', 'error');
      return;
    }

    const msg = this.messages.find((m) => Number(m.row) === Number(this.replyingTo.row));
    if (msg) {
      msg.read = 'Y';
      msg.replied = 'Y';
    }
    this.updateBadge();
    this.render();
    this.closeReply();
    toast('Reply sent.', 'success');
  },

  async deleteMsg(row) {
    const confirmed = window.confirm('Delete this message permanently?');
    if (!confirmed) return;

    const res = await api.deleteMessage(Number(row));
    if (!res.ok || !res.data?.success) {
      toast(res.error || res.data?.message || 'Could not delete message.', 'error');
      return;
    }

    this.messages = this.messages.filter((m) => Number(m.row) !== Number(row));
    this.messages.forEach((m) => {
      if (Number(m.row) > Number(row)) m.row = Number(m.row) - 1;
    });
    this.updateBadge();
    this.render();
    toast('Message deleted.', 'success');
  },

  handleListClick(event) {
    if (event.target.closest('[data-inbox-retry]')) {
      this.load();
      return;
    }

    const action = event.target.closest('[data-message-action]');
    if (!action) return;

    const card = action.closest('[data-row]');
    const row = Number(card?.dataset.row);
    if (!row) return;

    const type = action.dataset.messageAction;
    if (type === 'mark-read') this.markRead(row);
    if (type === 'reply') this.openReply(row);
    if (type === 'delete') this.deleteMsg(row);
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  isYes(value) {
    return String(value || '').trim().toUpperCase() === 'Y';
  },

  formatTime(input) {
    if (!input) return '';
    const d = new Date(input);
    if (Number.isNaN(d.getTime())) return String(input);

    const diffMs = Date.now() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
};

function attachInboxHandlers() {
  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.addEventListener('click', () => Inbox.filter(btn.dataset.filter));
  });

  document.getElementById('inboxList')?.addEventListener('click', (event) => {
    Inbox.handleListClick(event);
  });

  document.getElementById('replyModalClose')?.addEventListener('click', () => Inbox.closeReply());
  document.getElementById('replyCancelBtn')?.addEventListener('click', () => Inbox.closeReply());
  document.getElementById('replySendBtn')?.addEventListener('click', () => Inbox.sendReply());
  document.getElementById('replyModal')?.addEventListener('click', (event) => {
    if (event.target.id === 'replyModal') Inbox.closeReply();
  });
}

/* ---------- Tabs ---------- */

function switchTab(tab) {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    const isActive = btn.dataset.tab === tab;
    btn.classList.toggle('is-active', isActive);
    btn.setAttribute('aria-selected', String(isActive));
  });
  document.querySelectorAll('[data-tab-panel]').forEach((panel) => {
    panel.classList.toggle('is-active', panel.dataset.tabPanel === tab);
  });

  if (tab === 'inbox') {
    if (!Inbox.loaded && !Inbox.loading) {
      Inbox.load();
    } else {
      Inbox.render();
    }
  }
  if (tab === 'news') {
    if (!News.loaded && !News.loading) {
      News.load();
    } else {
      News.renderList();
    }
  }
}

function attachTabHandlers() {
  document.querySelector('[data-tabs]')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tab]');
    if (!btn) return;
    switchTab(btn.dataset.tab);
  });
}

/* ---------- Data load ---------- */

async function loadAll() {
  let requestsOk = false;
  const [reqRes, playersRes, matchesRes, statsRes] = await Promise.allSettled([
    api.getMembershipRequests(),
    api.getPlayers(),
    api.getMatches(),
    api.getStats()
  ]);

  if (reqRes.status === 'fulfilled' && reqRes.value.ok) {
    state.requests = Array.isArray(reqRes.value.data) ? reqRes.value.data : [];
    requestsOk = true;
  } else if (reqRes.status === 'fulfilled') {
    /* Endpoint may not exist yet — show friendly empty state. */
    state.requests = [];
    const wrap = document.querySelector('[data-requests-list]');
    if (wrap) {
      wrap.innerHTML = `
        <div class="state">
          <i data-lucide="alert-triangle"></i>
          <h3 class="text-h3">Cannot load requests</h3>
          <p class="text-small text-muted mt-2">
            ${escapeHtml(reqRes.value.error || 'Make sure the backend exposes getMembershipRequests.')}
          </p>
          <p class="text-small text-muted mt-2">
            You can still review pending rows directly in the
            <a class="text-accent" href="${escapeAttr(SHEET_URL)}" target="_blank" rel="noopener" style="text-decoration: underline;">Google Sheet</a>.
          </p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  } else {
    state.requests = [];
    const wrap = document.querySelector('[data-requests-list]');
    if (wrap) {
      wrap.innerHTML = `
        <div class="state">
          <i data-lucide="alert-triangle"></i>
          <h3 class="text-h3">Cannot load requests</h3>
          <p class="text-small text-muted mt-2">${escapeHtml(reqRes.reason?.message || 'Network error.')}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
  }

  if (playersRes.status === 'fulfilled' && playersRes.value.ok) {
    state.players = Array.isArray(playersRes.value.data) ? playersRes.value.data : [];
  }
  if (matchesRes.status === 'fulfilled' && matchesRes.value.ok) {
    state.matches = Array.isArray(matchesRes.value.data) ? matchesRes.value.data : [];
  }
  if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
    state.stats = statsRes.value.data || {};
  }

  renderOverview();
  if (requestsOk) renderRequests();
  renderMembers();
  renderUpcomingMatches();
  await News.load({ quiet: true });
  await Inbox.load({ quiet: true });
}

/* ---------- Sign out / refresh / sheet link ---------- */

function attachChromeHandlers() {
  document.querySelectorAll('[data-signout]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.setAttribute('aria-busy', 'true');
      await performLogout('/index.html');
    });
  });

  document.querySelector('[data-refresh]')?.addEventListener('click', async (event) => {
    const btn = event.currentTarget;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    api.clearApiCache();
    await loadAll();
    btn.disabled = false;
    btn.removeAttribute('aria-busy');
    toast('Data refreshed.', 'success');
  });

  /* Sheet links (multiple). */
  document.querySelectorAll('[data-sheet-link]').forEach((a) => {
    a.setAttribute('href', SHEET_URL);
  });

  /* Tab handlers + request actions. */
  attachTabHandlers();
  attachNewsHandlers();
  attachInboxHandlers();
  document.querySelector('[data-requests-list]')?.addEventListener('click', handleRequestClick);
  document.querySelector('[data-requests-list]')?.addEventListener('submit', handleRejectSubmit);

  /* Add match form. */
  document.querySelector('[data-add-match-form]')?.addEventListener('submit', handleAddMatch);
}

/* ---------- Boot ---------- */

async function boot() {
  attachChromeHandlers();

  const session = await requireAuth({ requireRole: 'admin' });
  if (!session) return;
  state.session = session;

  const emailEl = document.querySelector('[data-admin-email]');
  if (emailEl) emailEl.textContent = session.user?.email || '';

  hideLoader();
  await loadAll();
}

boot();
