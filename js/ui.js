// Shared UI helpers
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icon = (n) => `<svg aria-hidden="true"><use href="#i-${n}"/></svg>`;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let uid = 0; export const nextId = (p = 'id') => `${p}${++uid}`;

export function fmtBytes(b) {
  if (b == null || isNaN(b)) return '—';
  if (b < 1024) return b + ' B';
  const u = ['KB', 'MB', 'GB']; let i = -1;
  do { b /= 1024; i++; } while (b >= 1024 && i < u.length - 1);
  return (b >= 100 ? b.toFixed(0) : b >= 10 ? b.toFixed(1) : b.toFixed(2)) + ' ' + u[i];
}

export function toast(msg, type = '', ms = 4200) {
  const el = document.createElement('div');
  el.className = 'toast ' + type; el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s, transform .3s'; el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; setTimeout(() => el.remove(), 300); }, ms);
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function uniqueName(name, used) {
  if (!used.has(name)) { used.add(name); return name; }
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name, ext = dot > 0 ? name.slice(dot) : '';
  let i = 2; while (used.has(`${base} (${i})${ext}`)) i++;
  const n = `${base} (${i})${ext}`; used.add(n); return n;
}

/** Build a ZIP from [{name, data:Uint8Array|Blob}] using fflate. */
export async function makeZip(files) {
  const used = new Set(); const obj = {};
  for (const f of files) {
    const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer());
    // already-compressed formats: store; others: deflate
    const store = /\.(jpe?g|png|webp|avif|zip|gif)$/i.test(f.name);
    obj[uniqueName(f.name, used)] = [data, { level: store ? 0 : 6 }];
  }
  if (!window.fflate) await loadScript(new URL('../vendor/fflate.js', import.meta.url).href);
  return new Promise((res, rej) => {
    window.fflate.zip(obj, (err, out) => err ? rej(err) : res(new Blob([out], { type: 'application/zip' })));
  });
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

export function rangeFill(input) {
  const set = () => { const p = ((input.value - input.min) / (input.max - input.min)) * 100; input.style.setProperty('--p', p + '%'); };
  input.addEventListener('input', set); set();
}
export function initRanges(root = document) { $$('input[type=range]', root).forEach((r) => { if (!r._rf) { r._rf = 1; rangeFill(r); } }); }

/* ---- Modal ---- */
let lastFocus = null, onCloseCb = null;
export function openModal({ title, body, foot = '', wide = true, onClose }) {
  const m = $('#modal');
  lastFocus = document.activeElement; onCloseCb = onClose || null;
  $('#modalTitle').textContent = title;
  const b = $('#modalBody'); b.innerHTML = ''; if (typeof body === 'string') b.innerHTML = body; else b.appendChild(body);
  const f = $('#modalFoot'); f.innerHTML = ''; if (typeof foot === 'string') f.innerHTML = foot; else f.appendChild(foot);
  f.classList.toggle('hidden', !f.childNodes.length);
  $('.modal-box', m).style.width = wide ? '' : 'min(560px,100%)';
  m.hidden = false; document.body.style.overflow = 'hidden';
  initRanges(m);
  setTimeout(() => ($('[autofocus]', m) || $('[data-close]', m)).focus(), 30);
  return m;
}
export function closeModal() {
  const m = $('#modal'); if (m.hidden) return;
  m.hidden = true; document.body.style.overflow = '';
  const cb = onCloseCb; onCloseCb = null; cb && cb();
  lastFocus && lastFocus.focus && lastFocus.focus();
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => {
  const m = $('#modal'); if (m.hidden) return;
  if (e.key === 'Escape') closeModal();
  if (e.key === 'Tab') { // focus trap
    const f = $$('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])', m).filter((x) => !x.disabled && x.offsetParent !== null);
    if (!f.length) return; const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { last.focus(); e.preventDefault(); }
    else if (!e.shiftKey && document.activeElement === last) { first.focus(); e.preventDefault(); }
  }
});

/** Wire a dropzone element; calls onFiles(File[]) */
export function wireDrop(zone, input, onFiles, accept = () => true) {
  const take = (list) => { const files = [...list].filter(accept); if (files.length) onFiles(files); else toast('Those files are not supported here.', 'warn'); };
  input.addEventListener('change', () => { if (input.files.length) take(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave', 'dragend', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { if (ev !== 'dragleave' || !zone.contains(e.relatedTarget)) zone.classList.remove('drag'); }));
  zone.addEventListener('drop', (e) => { e.preventDefault(); if (e.dataTransfer?.files?.length) take(e.dataTransfer.files); });
}

export function dropzoneHTML({ id, title, sub, accept, multiple = true, compact = false, iconName = 'upload' }) {
  return `<div class="dropzone ${compact ? 'compact' : ''}" id="${id}"><input type="file" accept="${accept}" ${multiple ? 'multiple' : ''} aria-label="${esc(title)}"><div class="dz-icon">${icon(iconName)}</div><div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div></div>`;
}

/** Simple drag-and-drop reorder for children of a container. onReorder(fromIdx,toIdx) */
export function sortable(container, itemSel, onReorder) {
  let dragIdx = -1;
  container.addEventListener('dragstart', (e) => {
    const it = e.target.closest(itemSel); if (!it) return;
    dragIdx = [...container.querySelectorAll(itemSel)].indexOf(it);
    it.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', String(dragIdx)); } catch {}
  });
  container.addEventListener('dragend', (e) => { $$(itemSel, container).forEach((x) => x.classList.remove('dragging', 'over')); });
  container.addEventListener('dragover', (e) => {
    const it = e.target.closest(itemSel); if (!it || dragIdx < 0) return;
    e.preventDefault(); $$(itemSel, container).forEach((x) => x.classList.toggle('over', x === it));
  });
  container.addEventListener('drop', (e) => {
    const it = e.target.closest(itemSel); if (!it || dragIdx < 0) return;
    e.preventDefault(); e.stopPropagation();
    const to = [...container.querySelectorAll(itemSel)].indexOf(it);
    const from = dragIdx; dragIdx = -1;
    if (from !== to) onReorder(from, to);
  });
}
export const moveItem = (arr, from, to) => { const [x] = arr.splice(from, 1); arr.splice(to, 0, x); return arr; };
