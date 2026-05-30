/**
 * News page (news.html). Featured post + grid of remaining posts.
 */

import api from '../api.js';

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
  if (!input) return '';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function truncate(text, max) {
  const t = String(text);
  return t.length > max ? t.slice(0, max - 1).trimEnd() + '…' : t;
}

function renderPostMarkdown(content) {
  const renderer = window.renderMarkdown || ((value) => escapeHtml(value).replace(/\n/g, '<br>'));
  return renderer(content || '');
}

function renderMarkdownPreview(content, max) {
  if (window.markdownPreview) return window.markdownPreview(content || '', max);
  return truncate(String(content || '').replace(/\s+/g, ' ').trim(), max);
}

function renderFeatured(post) {
  const wrap = document.querySelector('[data-news-featured]');
  if (!wrap) return;
  if (!post) {
    wrap.innerHTML = '';
    return;
  }

  const idAttr = post.id ? ` id="${escapeHtml(post.id)}"` : '';
  wrap.innerHTML = `
    <article class="news-featured"${idAttr}>
      <div class="news-featured-img">
        ${post.image_url
          ? `<img src="${escapeHtml(post.image_url)}" alt="${escapeHtml(post.title || '')}" loading="lazy">`
          : ''}
      </div>
      <div>
        <span class="badge badge-info">Featured</span>
        <div class="news-card-meta mt-3">
          <span>${escapeHtml(formatDate(post.date))}</span>
          ${post.author ? `<span>· ${escapeHtml(post.author)}</span>` : ''}
        </div>
        <h2 class="news-featured-title">
          <a href="/news/${escapeAttr(post.id || '')}" style="color:inherit;text-decoration:none;">
            ${escapeHtml(post.title || 'Untitled')}
          </a>
        </h2>
        <div class="news-body">${renderPostMarkdown(post.content || '')}</div>
      </div>
    </article>
  `;
}

function renderGrid(posts) {
  const grid = document.querySelector('[data-news-grid]');
  if (!grid) return;

  if (!posts.length) {
    grid.innerHTML = '';
    return;
  }

  grid.innerHTML = posts
    .map(
      (n) => {
        const idAttr = n.id ? ` id="${escapeHtml(n.id)}"` : '';
        return `
      <article class="news-card"${idAttr} onclick="window.location.href='/news/${escapeAttr(n.id || '')}'" style="cursor:pointer;">
        ${n.image_url
          ? `<div class="news-card-img"><img src="${escapeHtml(n.image_url)}" alt="${escapeHtml(n.title || '')}" loading="lazy"></div>`
          : `<div class="news-card-img"></div>`}
        <div class="news-card-meta">
          <span>${escapeHtml(formatDate(n.date))}</span>
          ${n.author ? `<span>· ${escapeHtml(n.author)}</span>` : ''}
        </div>
        <h3 class="news-card-title">${escapeHtml(n.title || 'Untitled')}</h3>
        <p class="news-card-excerpt">${escapeHtml(renderMarkdownPreview(n.content || '', 120))}</p>
      </article>
    `;
      }
    )
    .join('');

  const gsap = window.gsap;
  if (gsap) {
    gsap.fromTo(
      grid.querySelectorAll('.news-card'),
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.06 }
    );
  }
}

function focusLinkedPost() {
  if (!window.location.hash) return;

  const hash = decodeURIComponent(window.location.hash.slice(1));
  if (!hash) return;

  const target = document.getElementById(hash);
  if (!target) return;

  requestAnimationFrame(() => {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('highlight-flash');
    window.setTimeout(() => {
      target.classList.remove('highlight-flash');
    }, 2000);
  });
}

function renderEmpty() {
  const featured = document.querySelector('[data-news-featured]');
  const grid = document.querySelector('[data-news-grid]');
  const emptyState = document.querySelector('[data-empty-state]');
  if (featured) featured.innerHTML = '';
  if (grid) grid.innerHTML = '';
  if (emptyState) emptyState.classList.remove('hidden');
}

async function loadNews() {
  const res = await api.getNews();
  if (!res.ok) {
    const featured = document.querySelector('[data-news-featured]');
    if (featured) {
      featured.innerHTML = `
        <div class="state">
          <i data-lucide="wifi-off"></i>
          <h3 class="text-h2">Could not load news</h3>
          <p class="text-small text-muted mt-2">${escapeHtml(res.error || 'Try again later.')}</p>
        </div>
      `;
      if (window.lucide) window.lucide.createIcons();
    }
    return;
  }

  const posts = (Array.isArray(res.data) ? res.data : []).slice();
  /* Newest first (most APIs already do this, but make sure). */
  posts.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

  if (!posts.length) {
    renderEmpty();
    return;
  }

  const [featured, ...rest] = posts;
  renderFeatured(featured);
  renderGrid(rest);
  focusLinkedPost();
}

function boot() {
  loadNews();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
