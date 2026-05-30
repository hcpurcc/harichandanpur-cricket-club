/**
 * Single news post page — /news/NEWS001
 * Reads post ID from URL path, fetches all news, renders the matching post.
 */

import api from '../api.js';

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function formatDate(input) {
  if (!input) return '';
  const d = new Date(input);
  if (isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderMarkdown(content) {
  const fn = window.renderMarkdown || ((v) => escapeHtml(v).replace(/\n/g, '<br>'));
  return fn(content || '');
}

function getPostId() {
  /* URL is /news/NEWS001 — Netlify rewrites to /news/post.html
     but window.location.pathname is still /news/NEWS001 */
  const parts = window.location.pathname.replace(/\/$/, '').split('/');
  return parts[parts.length - 1] || '';
}

function renderPost(post) {
  /* Update page title + OG tags */
  document.title = `${post.title || 'Post'} — HCC News`;
  const ogTitle = document.getElementById('og-title');
  const ogDesc  = document.getElementById('og-desc');
  const ogImage = document.getElementById('og-image');
  if (ogTitle) ogTitle.setAttribute('content', post.title || '');
  if (ogDesc)  ogDesc.setAttribute('content', String(post.content || '').slice(0, 160).replace(/[#*_]/g, ''));
  if (ogImage && post.image_url) ogImage.setAttribute('content', post.image_url);

  const main = document.getElementById('post-main');
  if (!main) return;

  main.innerHTML = `
    <section class="post-hero">
      <div class="container">
        <a class="post-back" href="/news.html">
          <i data-lucide="arrow-left"></i> All news
        </a>
        <div class="post-meta">
          <span>${escapeHtml(formatDate(post.date))}</span>
          ${post.author ? `<span>· ${escapeHtml(post.author)}</span>` : ''}
          ${post.id ? `<span>· ${escapeHtml(post.id)}</span>` : ''}
        </div>
        <h1 class="post-title">${escapeHtml(post.title || 'Untitled')}</h1>
      </div>
    </section>

    <section class="section">
      <div class="container">
        ${post.image_url
          ? `<img class="post-cover" src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title || '')}" loading="lazy">`
          : ''}
        <div class="post-body">
          ${renderMarkdown(post.content || '')}
        </div>
        <div class="post-footer-nav">
          <a class="post-back" href="/news.html">
            <i data-lucide="arrow-left"></i> Back to all news
          </a>
        </div>
      </div>
    </section>
  `;

  if (window.lucide) window.lucide.createIcons();

  /* GSAP entrance animation */
  if (window.gsap) {
    window.gsap.fromTo(
      main,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
    );
  }
}

function renderError(postId) {
  const main = document.getElementById('post-main');
  if (!main) return;
  document.title = 'Post not found — HCC News';
  main.innerHTML = `
    <section class="section">
      <div class="container">
        <div class="post-error">
          <p class="text-label" style="color:var(--accent-neon);">404</p>
          <h2>Post not found</h2>
          <p class="text-body text-muted">
            "${escapeHtml(postId)}" does not exist or may have been removed.
          </p>
          <a class="btn btn-primary mt-5" href="/news.html">← All news</a>
        </div>
      </div>
    </section>
  `;
}

async function boot() {
  const postId = getPostId();
  if (!postId) { window.location.href = '/news.html'; return; }

  const res = await api.getNews();

  if (!res.ok) {
    renderError(postId);
    return;
  }

  const posts = Array.isArray(res.data) ? res.data : [];
  const post  = posts.find(
    (p) => String(p.id || '').toUpperCase() === postId.toUpperCase()
  );

  if (!post) {
    renderError(postId);
    return;
  }

  renderPost(post);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
