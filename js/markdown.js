/**
 * Shared Markdown rendering helpers.
 *
 * marked.js parses Markdown, DOMPurify sanitizes the generated HTML.
 * If either CDN is unavailable, fall back to escaped text with line breaks.
 */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripMarkdown(value) {
  return String(value ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[\s>*-]*[-+*]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/[*_~>#|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function renderMarkdown(mdText) {
  const source = String(mdText ?? '');
  const markedLib = window.marked;
  const purifier = window.DOMPurify;

  if (!source.trim()) return '';

  if (!markedLib || !purifier) {
    return escapeHtml(source).replace(/\n/g, '<br>');
  }

  if (typeof markedLib.setOptions === 'function') {
    markedLib.setOptions({
      breaks: true,
      gfm: true
    });
  }

  const rawHtml = markedLib.parse(source);
  return purifier.sanitize(rawHtml, {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel']
  });
}

export function markdownPreview(mdText, maxLen = 180) {
  const plain = stripMarkdown(mdText);
  return plain.length > maxLen ? `${plain.slice(0, maxLen - 3).trimEnd()}...` : plain;
}

window.renderMarkdown = renderMarkdown;
window.markdownPreview = markdownPreview;
