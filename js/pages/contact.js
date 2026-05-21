/**
 * Contact page (contact.html).
 *
 * On submit:
 *   1. Send to Web3Forms (primary path) — emails directly to club.
 *   2. ALSO fire api.submitContact() so the message lands in Contact_Messages sheet.
 *
 * If the Web3Forms key is still the placeholder, we skip Web3Forms and
 * rely on the Apps Script path alone. Either path succeeding = success.
 */

import api from '../api.js';
import { FORMS, CLUB } from '../config.js';

const WEB3_URL = 'https://api.web3forms.com/submit';

function setStatus(state, message) {
  const wrap = document.querySelector('[data-form-status]');
  const msg = document.querySelector('[data-form-status-message]');
  if (!wrap || !msg) return;
  wrap.classList.remove('is-success', 'is-error');
  if (state === 'success') wrap.classList.add('is-success');
  if (state === 'error')   wrap.classList.add('is-error');
  wrap.classList.toggle('is-visible', Boolean(state));
  msg.textContent = message || '';
}

function setSubmitting(submitting) {
  const btn = document.querySelector('[data-submit]');
  const lbl = document.querySelector('[data-submit-label]');
  if (!btn) return;
  btn.disabled = submitting;
  btn.setAttribute('aria-busy', String(submitting));
  if (lbl) lbl.textContent = submitting ? 'Sending…' : 'Send message';
}

async function sendToWeb3Forms(payload) {
  if (!FORMS.web3FormsAccessKey || FORMS.web3FormsAccessKey.includes('REPLACE_WITH')) {
    return { skipped: true };
  }

  try {
    const res = await fetch(WEB3_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        access_key: FORMS.web3FormsAccessKey,
        subject: payload.subject || `Contact form — ${payload.name}`,
        from_name: `HCC Website — ${payload.name}`,
        replyto: payload.email,
        ...payload
      })
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success !== false) {
      return { ok: true };
    }
    return { ok: false, error: json.message || `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error' };
  }
}

function validate(payload) {
  if (!payload.name)    return 'Name is required.';
  if (!payload.email)   return 'Email is required.';
  if (!/^\S+@\S+\.\S+$/.test(payload.email)) return 'That email looks off.';
  if (!payload.message || payload.message.length < 10) return 'Message must be at least 10 characters.';
  if (payload.botcheck) return 'Bot check failed.';
  return null;
}

async function handleSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);

  const payload = {
    name:    String(formData.get('name')    || '').trim(),
    email:   String(formData.get('email')   || '').trim(),
    subject: String(formData.get('subject') || '').trim(),
    message: String(formData.get('message') || '').trim(),
    botcheck: String(formData.get('botcheck') || '').trim()
  };

  const error = validate(payload);
  if (error) {
    setStatus('error', error);
    return;
  }

  setStatus(null, '');
  setSubmitting(true);

  /* Fire both paths in parallel — succeed if EITHER works. */
  const [web3Result, apiResult] = await Promise.allSettled([
    sendToWeb3Forms(payload),
    api.submitContact({
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
      message: payload.message
    })
  ]);

  setSubmitting(false);

  const web3Ok = web3Result.status === 'fulfilled' &&
    (web3Result.value.ok || web3Result.value.skipped);
  const apiOk = apiResult.status === 'fulfilled' && apiResult.value.ok;

  if (web3Ok || apiOk) {
    setStatus('success', `Thanks ${payload.name.split(' ')[0]}, message received. ${CLUB.short} will reply to ${payload.email} soon.`);
    form.reset();
  } else {
    const reason = (web3Result.value && web3Result.value.error) ||
                   (apiResult.value && apiResult.value.error) ||
                   'Something went wrong. Try emailing us directly.';
    setStatus('error', reason);
  }
}

function boot() {
  const form = document.querySelector('[data-contact-form]');
  if (form) form.addEventListener('submit', handleSubmit);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
