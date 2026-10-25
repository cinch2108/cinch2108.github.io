// Shared UI helpers (no dependencies)
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icon = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
export const debounce = (fn, ms = 150) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
export const fmt = (n) => Number(n).toLocaleString('en-US');

export function toast(msg, type = '', ms = 2600) {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 300); }, ms);
}

/** Copy text to the clipboard with a textarea fallback (for http:// or older browsers). */
export async function copyText(text, label = 'Copied to clipboard') {
  let done = false;
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); done = true; } } catch {}
  if (!done) {
    const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(ta); ta.select();
    try { done = document.execCommand('copy'); } catch {}
    ta.remove();
  }
  toast(done ? label : 'Copy failed. Select the text and press Ctrl/Cmd+C.', done ? 'ok' : 'warn');
  return done;
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

const loaded = new Map();
export function loadScript(src) {
  if (loaded.has(src)) return loaded.get(src);
  const p = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
  loaded.set(src, p); return p;
}

/** Build a ZIP from [{name, data:Uint8Array}] with the vendored fflate (loaded on demand). */
export async function makeZip(files) {
  if (!window.fflate) await loadScript(new URL('../vendor/fflate.js', import.meta.url).href);
  const obj = {}; files.forEach((f) => { obj[f.name] = [f.data, { level: /\.png$/i.test(f.name) ? 0 : 6 }]; });
  return new Promise((res, rej) => window.fflate.zip(obj, (err, out) => err ? rej(err) : res(new Blob([out], { type: 'application/zip' }))));
}

export function rangeFill(input) {
  const set = () => { const p = ((input.value - input.min) / (input.max - input.min)) * 100; input.style.setProperty('--p', p + '%'); };
  input.addEventListener('input', set); set();
}

/** Root URL of the site, derived from this module's own URL, so it works under any base path. */
export const ROOT = new URL('../', import.meta.url);
export const pageUrl = (slug) => new URL(slug ? `${slug}/` : './', ROOT).href;

export const ls = {
  get(k, d = null) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
