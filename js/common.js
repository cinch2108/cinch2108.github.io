// Shared tool-panel building blocks
import { $, $$, esc, icon, fmtBytes, toast, downloadBlob, makeZip, wireDrop, initRanges } from './ui.js';
import { PAGES, url } from './catalog.js';
import { setHandoff, getHandoff, clearHandoff } from './store.js';
import { NeedsPasswordError } from './pdfcore.js';

export const isPdf = (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
export const isImg = (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|avif|svg|ico)$/i.test(f.name);

/** File intake: dropzone + optional handoff chip. onFiles(File[]) */
export function intake(host, { id = 'drop', accept = '.pdf,application/pdf', multiple = false, title, sub, filter = isPdf, onFiles, compact = false }) {
  const wrap = document.createElement('div');
  wrap.innerHTML = `<div class="dropzone ${compact ? 'compact' : ''}" id="${id}">
      <input type="file" accept="${accept}" ${multiple ? 'multiple' : ''} aria-label="${esc(title)}" data-testid="${id}-input">
      <div class="dz-icon">${icon('upload')}</div>
      <div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div></div>
    <div class="handoff hidden"></div>`;
  host.appendChild(wrap);
  wireDrop($('.dropzone', wrap), $('input', wrap), onFiles, filter);
  if (accept.includes('pdf')) getHandoff().then((h) => {
    if (!h) return;
    const el = $('.handoff', wrap); el.classList.remove('hidden');
    el.innerHTML = `<div class="note" style="margin-top:.8rem;align-items:center">${icon('info')}<span style="flex:1">Continue with <b>${esc(h.name)}</b> from your previous tool?</span><button class="btn btn-sm btn-primary" type="button">Use it</button><button class="btn btn-sm btn-ghost" type="button" aria-label="Dismiss">${icon('x')}</button></div>`;
    const [use, dis] = $$('button', el);
    use.onclick = () => { el.remove(); clearHandoff(); onFiles([new File([h.bytes], h.name, { type: 'application/pdf' })]); };
    dis.onclick = () => { el.remove(); clearHandoff(); };
  });
  return wrap;
}

export function fileChip(f, extra = '') {
  return `<div class="filechip"><span class="fi-ic">${icon('file')}</span><div style="min-width:0;flex:1"><div class="fname">${esc(f.name)}</div><div class="small muted">${fmtBytes(f.size)}${extra ? ' · ' + extra : ''}</div></div><button class="btn btn-sm" type="button" data-act="change">Change file</button></div>`;
}

export function busy(btn, on, label) {
  if (on) { btn._html = btn.innerHTML; btn.disabled = true; btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${esc(label || 'Working…')}`; }
  else { btn.disabled = false; if (btn._html) btn.innerHTML = btn._html; }
}

export function progressEl(host) {
  const el = document.createElement('div'); el.className = 'progress-wrap';
  el.innerHTML = `<div class="small muted" aria-live="polite"></div><div class="progress"><i></i></div>`;
  host.appendChild(el);
  return { set(p, txt) { $('i', el).style.width = Math.round(p * 100) + '%'; if (txt != null) $('div', el).textContent = txt; }, remove() { el.remove(); } };
}

/** Show results. files: [{name, blob}] */
export function showResult(host, files, { origSize, note } = {}) {
  host.innerHTML = '';
  const box = document.createElement('div'); box.className = 'result'; box.setAttribute('role', 'status');
  const total = files.reduce((s, f) => s + f.blob.size, 0);
  let sav = '';
  if (origSize) { const pct = Math.round((1 - total / origSize) * 100); sav = pct > 0 ? `<span class="badge ok">−${pct}%</span>` : `<span class="badge warn">${pct === 0 ? 'same size' : '+' + -pct + '%'}</span>`; }
  const single = files.length === 1;
  const pdfs = single && files[0].blob.type === 'application/pdf';
  box.innerHTML = `<span class="r-ic">${icon('check')}</span>
    <div class="sp" style="min-width:0"><strong>${single ? esc(files[0].name) : files.length + ' files ready'}</strong>
    <div class="small muted">${origSize ? fmtBytes(origSize) + ' → ' : ''}${fmtBytes(total)} ${sav}${note ? ' · ' + esc(note) : ''}</div></div>
    <button class="btn btn-primary" type="button" data-testid="download" id="dlBtn">${icon('download')}${single ? 'Download' : 'Download ZIP'}</button>`;
  host.appendChild(box);
  $('#dlBtn', box).onclick = async () => {
    if (single) return downloadBlob(files[0].blob, files[0].name);
    const b = $('#dlBtn', box); b.disabled = true;
    try { downloadBlob(await makeZip(files.map((f) => ({ name: f.name, data: f.blob }))), (files.zipName || 'localforge') + '.zip'); }
    catch (e) { toast('ZIP failed: ' + e.message, 'err'); } finally { b.disabled = false; }
  };
  if (!single && files.length <= 400) {
    const list = document.createElement('ul'); list.className = 'filelist';
    list.innerHTML = files.map((f, i) => `<li><span class="fi-ic">${icon('file')}</span><span class="fname">${esc(f.name)}</span><span class="small muted">${fmtBytes(f.blob.size)}</span><button class="btn btn-sm" type="button" data-i="${i}" aria-label="Download ${esc(f.name)}">${icon('download')}</button></li>`).join('');
    list.onclick = (e) => { const b = e.target.closest('button[data-i]'); if (b) downloadBlob(files[+b.dataset.i].blob, files[+b.dataset.i].name); };
    host.appendChild(list);
  }
  if (pdfs) {
    const cont = document.createElement('div'); cont.className = 'continue';
    const here = document.body.dataset.slug;
    cont.innerHTML = `<span class="small muted">Continue with this file:</span>` + PAGES.filter((p) => p.slug !== here && !['merge-pdf', 'jpg-to-pdf'].includes(p.slug)).slice(0, 16).map((p) => `<a class="chip" href="${url(p.slug)}" data-slug="${p.slug}">${icon(p.icon)}${esc(p.name)}</a>`).join('');
    cont.addEventListener('click', async (e) => {
      const a = e.target.closest('a[data-slug]'); if (!a) return; e.preventDefault();
      await setHandoff(files[0].name, new Uint8Array(await files[0].blob.arrayBuffer()));
      location.href = a.href;
    });
    host.appendChild(cont);
  }
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export function handleErr(e, ctx = '') {
  console.warn(e);
  if (e instanceof NeedsPasswordError) { toast(e.message, 'warn', 7000); return; }
  const msg = /Failed to parse|Invalid PDF|No PDF header|InvalidPDFException/i.test(e?.message || e?.name || '') ? 'That file doesn\u2019t look like a valid PDF.' : (e?.message || String(e));
  toast((ctx ? ctx + ': ' : '') + msg, 'err', 7000);
}

export function seg(name, options, value) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(name)}">${options.map(([v, l]) => `<label><input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
}
export const segVal = (root, name) => $(`input[name="${name}"]:checked`, root)?.value;
export { initRanges };
