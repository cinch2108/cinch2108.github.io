// Organize / optimize / convert tools
import { $, $$, esc, icon, fmtBytes, toast, sortable, moveItem, initRanges, nextId } from './ui.js';
import * as core from './pdfcore.js';
import { intake, fileChip, busy, progressEl, showResult, handleErr, isPdf, isImg, seg, segVal } from './common.js';

const { readBytes, editableBytes, loadLib, openJs, thumb, parseRanges, baseName, pdfBlob, canvasBlob, renderPage, imageForPdf } = core;

/* ============================ MERGE ============================ */
export function merge(panel) {
  const items = [];
  panel.innerHTML = '';
  intake(panel, { id: 'mergeDrop', multiple: true, accept: '.pdf,application/pdf,image/*', filter: (f) => isPdf(f) || isImg(f), title: 'Drop PDFs (and images) here or click to browse', sub: 'Add as many files as you like. Drag the list to set the order.', onFiles: add });
  panel.insertAdjacentHTML('beforeend', `<ul class="filelist" id="mergeList" aria-label="Files to merge, in order"></ul>
    <div class="opts hidden" id="mergeOpts"><label class="field"><span>Output file name</span><input type="text" id="mergeName" value="merged.pdf"></label></div>
    <div class="actions-bar hidden" id="mergeBar"><button class="btn btn-primary btn-lg" type="button" id="mergeBtn" data-testid="run">${icon('merge')}Merge files</button><span class="small muted" id="mergeInfo"></span></div>
    <div id="mergeOut"></div>`);
  const list = $('#mergeList', panel);
  sortable(list, 'li', (a, b) => { moveItem(items, a, b); render(); });
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const i = +b.closest('li').dataset.i;
    if (b.dataset.act === 'up' && i > 0) moveItem(items, i, i - 1);
    if (b.dataset.act === 'down' && i < items.length - 1) moveItem(items, i, i + 1);
    if (b.dataset.act === 'rm') items.splice(i, 1);
    render(); const nb = $(`li[data-i="${Math.min(i, items.length - 1)}"] button[data-act="${b.dataset.act}"]`, list); nb && nb.focus();
  });
  async function add(files) {
    for (const f of files) {
      const it = { id: nextId('m'), file: f, kind: isPdf(f) ? 'pdf' : 'img', pages: f.type.startsWith('image') || !isPdf(f) ? 1 : null, thumb: null };
      items.push(it);
      if (it.kind === 'img') it.thumb = URL.createObjectURL(f);
    }
    render();
    for (const it of items.filter((x) => x.kind === 'pdf' && x.pages == null && !x.err)) {
      try {
        const { bytes, decrypted } = await editableBytes(await readBytes(it.file));
        it.bytes = bytes; if (decrypted) toast(`${it.file.name}: removed owner restrictions so it can be merged.`, 'warn');
        const d = await openJs(bytes); it.pages = d.numPages; it.thumb = await thumb(d, 1, 80); d.destroy();
      } catch (e) { it.err = true; handleErr(e, it.file.name); items.splice(items.indexOf(it), 1); }
      render();
    }
  }
  function render() {
    const has = items.length > 0;
    ['#mergeOpts', '#mergeBar'].forEach((s) => $(s, panel).classList.toggle('hidden', !has));
    list.innerHTML = items.map((it, i) => `<li draggable="true" data-i="${i}"><span class="grip" aria-hidden="true">${icon('grip')}</span>
      ${it.thumb ? `<img class="fthumb" src="${it.thumb}" alt="First page of ${esc(it.file.name)}">` : '<span class="fthumb"></span>'}
      <span class="fname">${esc(it.file.name)}</span><span class="small muted">${it.pages == null ? 'reading…' : it.pages + (it.pages === 1 ? ' page' : ' pages')} · ${fmtBytes(it.file.size)}</span>
      <button class="btn btn-sm btn-ghost" type="button" data-act="up" aria-label="Move ${esc(it.file.name)} up" ${i === 0 ? 'disabled' : ''}>${icon('up')}</button>
      <button class="btn btn-sm btn-ghost" type="button" data-act="down" aria-label="Move ${esc(it.file.name)} down" ${i === items.length - 1 ? 'disabled' : ''}>${icon('down')}</button>
      <button class="btn btn-sm btn-ghost btn-danger" type="button" data-act="rm" aria-label="Remove ${esc(it.file.name)}">${icon('x')}</button></li>`).join('');
    const pages = items.reduce((s, x) => s + (x.pages || 0), 0);
    $('#mergeInfo', panel).textContent = has ? `${items.length} file${items.length > 1 ? 's' : ''} · ${pages} pages total` : '';
    $('#mergeBtn', panel).disabled = items.length < 1 || items.some((x) => x.pages == null);
  }
  $('#mergeBtn', panel).onclick = async () => {
    const btn = $('#mergeBtn', panel); busy(btn, true, 'Merging…');
    const prog = progressEl($('#mergeOut', panel));
    try {
      const { PDFDocument } = await core.PDFLib();
      const out = await PDFDocument.create();
      for (let i = 0; i < items.length; i++) {
        const it = items[i]; prog.set(i / items.length, `Adding ${it.file.name}…`);
        if (it.kind === 'pdf') {
          const src = await loadLib(it.bytes, { ignoreEncryption: true });
          (await out.copyPages(src, src.getPageIndices())).forEach((p) => out.addPage(p));
        } else {
          const im = await imageForPdf(it.file);
          const emb = im.kind === 'jpg' ? await out.embedJpg(im.bytes) : await out.embedPng(im.bytes);
          let w = (im.width * 72) / 96, h = (im.height * 72) / 96; const k = Math.min(1, 1684 / Math.max(w, h)); w *= k; h *= k;
          out.addPage([w, h]).drawImage(emb, { x: 0, y: 0, width: w, height: h });
        }
      }
      prog.set(1, 'Saving…');
      const bytes = await out.save({ useObjectStreams: true });
      let name = $('#mergeName', panel).value.trim() || 'merged.pdf'; if (!/\.pdf$/i.test(name)) name += '.pdf';
      showResult($('#mergeOut', panel), [{ name, blob: pdfBlob(bytes) }], { note: `${out.getPageCount()} pages` });
    } catch (e) { prog.remove(); handleErr(e, 'Merge failed'); } finally { busy(btn, false); }
  };
}

/* ============================ single-PDF loader ============================ */
function singlePdf(panel, { title, sub, onLoad }) {
  panel.innerHTML = '';
  const zone = intake(panel, { id: 'drop', title: title || 'Drop a PDF here or click to browse', sub: sub || 'Your file is processed on this device and never uploaded.', onFiles: (f) => load(f[0]) });
  const area = document.createElement('div'); area.id = 'toolArea'; panel.appendChild(area);
  async function load(file) {
    try {
      area.innerHTML = `<div class="progress indet" style="margin-top:1rem"><i></i></div>`;
      const raw = await readBytes(file);
      const { bytes, decrypted } = await editableBytes(raw);
      if (decrypted) toast('This PDF had owner restrictions. They were removed so it can be edited.', 'warn');
      zone.classList.add('hidden'); area.innerHTML = '';
      const chipHost = document.createElement('div'); area.appendChild(chipHost);
      const body = document.createElement('div'); area.appendChild(body);
      const ctx = { file, bytes, origSize: file.size, chipHost, body, setChip: (extra) => { chipHost.innerHTML = fileChip(file, extra); $('[data-act=change]', chipHost).onclick = () => { zone.classList.remove('hidden'); area.innerHTML = ''; $('input', zone).click(); }; } };
      ctx.setChip('');
      await onLoad(ctx);
      initRanges(area);
    } catch (e) { area.innerHTML = ''; zone.classList.remove('hidden'); handleErr(e); }
  }
  return { load };
}
export { singlePdf };

/* ============================ SPLIT / EXTRACT ============================ */
export function split(panel, mode = 'ranges') {
  singlePdf(panel, {
    async onLoad(ctx) {
      const js = await openJs(ctx.bytes); const n = js.numPages; ctx.setChip(`${n} pages`);
      const sel = new Set();
      ctx.body.innerHTML = `<div class="opts" style="grid-template-columns:1fr">
        <div class="field"><span>Split mode</span>${seg('smode', [['ranges', 'Custom ranges'], ['all', 'Every page'], ['every', 'Every N pages'], ['extract', 'Extract into one file']], mode)}</div>
        <label class="field" id="fRanges"><span>Pages / ranges <span class="faint">e.g. 1-3, 5, 8-</span></span><input type="text" id="ranges" value="${mode === 'extract' ? '1' : n > 1 ? '1-' + Math.ceil(n / 2) + ', ' + (Math.ceil(n / 2) + 1) + '-' + n : '1'}" autocomplete="off"></label>
        <label class="field hidden" id="fEvery"><span>Pages per file</span><input type="number" id="every" min="1" max="${n}" value="${Math.min(2, n)}"></label>
        <p class="small muted" id="splitHint" style="margin:0"></p></div>
        <div class="pages small-pages" id="splitPages" aria-label="Click pages to select them"></div>
        <div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="splitBtn" data-testid="run">${icon('split')}Split PDF</button></div><div id="splitOut"></div>`;
      const grid = $('#splitPages', ctx.body);
      const pageCount = Math.min(n, 300);
      grid.innerHTML = Array.from({ length: pageCount }, (_, i) => `<button class="page" type="button" data-i="${i}" aria-pressed="false" aria-label="Page ${i + 1}"><div class="pimg"></div><div class="pfoot"><span>${i + 1}</span></div></button>`).join('');
      const upd = () => {
        const m = segVal(ctx.body, 'smode');
        $('#fRanges', ctx.body).classList.toggle('hidden', m === 'all' || m === 'every');
        $('#fEvery', ctx.body).classList.toggle('hidden', m !== 'every');
        $('#splitHint', ctx.body).textContent = { ranges: 'Each range becomes its own PDF. Click thumbnails to build a selection.', all: `Creates ${n} single-page PDFs (downloaded as a ZIP).`, every: 'Cuts the document into equal chunks.', extract: 'All listed pages go into one new PDF, in the order you type them.' }[m];
        $('#splitBtn', ctx.body).innerHTML = `${icon('split')}${m === 'extract' ? 'Extract pages' : 'Split PDF'}`;
      };
      ctx.body.addEventListener('change', upd); upd();
      grid.addEventListener('click', (e) => {
        const b = e.target.closest('.page'); if (!b) return; const i = +b.dataset.i;
        sel.has(i) ? sel.delete(i) : sel.add(i);
        b.classList.toggle('sel', sel.has(i)); b.setAttribute('aria-pressed', sel.has(i));
        $('#ranges', ctx.body).value = compress([...sel].sort((a, b) => a - b));
        if (segVal(ctx.body, 'smode') === 'all' || segVal(ctx.body, 'smode') === 'every') { $(`input[value="extract"]`, ctx.body).checked = true; upd(); }
      });
      lazyThumbs(js, grid, 110);
      $('#splitBtn', ctx.body).onclick = async () => {
        const btn = $('#splitBtn', ctx.body); const m = segVal(ctx.body, 'smode');
        let groups;
        try {
          if (m === 'all') groups = Array.from({ length: n }, (_, i) => [i]);
          else if (m === 'every') { const k = Math.max(1, +$('#every', ctx.body).value || 1); groups = []; for (let i = 0; i < n; i += k) groups.push(Array.from({ length: Math.min(k, n - i) }, (_, j) => i + j)); }
          else { groups = parseRanges($('#ranges', ctx.body).value, n); if (m === 'extract') groups = [groups.flat()]; }
        } catch (e) { return toast(e.message, 'warn'); }
        busy(btn, true, 'Splitting…'); const prog = progressEl($('#splitOut', ctx.body));
        try {
          const { PDFDocument } = await core.PDFLib();
          const src = await loadLib(ctx.bytes, { ignoreEncryption: true });
          const files = []; const base = baseName(ctx.file.name);
          for (let g = 0; g < groups.length; g++) {
            prog.set(g / groups.length, `Creating file ${g + 1} of ${groups.length}…`);
            const out = await PDFDocument.create();
            (await out.copyPages(src, groups[g])).forEach((p) => out.addPage(p));
            const label = m === 'extract' ? 'extracted' : groups[g].length === 1 ? `page-${groups[g][0] + 1}` : `pages-${groups[g][0] + 1}-${groups[g][groups[g].length - 1] + 1}`;
            files.push({ name: `${base}-${label}.pdf`, blob: pdfBlob(await out.save({ useObjectStreams: true })) });
            if (g % 20 === 19) await new Promise((r) => setTimeout(r));
          }
          files.zipName = base + '-split';
          showResult($('#splitOut', ctx.body), files);
        } catch (e) { prog.remove(); handleErr(e, 'Split failed'); } finally { busy(btn, false); }
      };
    },
  });
}
const compress = (arr) => { const out = []; for (let i = 0; i < arr.length; i++) { let j = i; while (j + 1 < arr.length && arr[j + 1] === arr[j] + 1) j++; out.push(i === j ? `${arr[i] + 1}` : `${arr[i] + 1}-${arr[j] + 1}`); i = j; } return out.join(', '); };

/** Render thumbnails into .page .pimg elements lazily as they scroll into view. */
export function lazyThumbs(js, grid, width = 140, getIdx = (el) => +el.dataset.i + 1, getRot = () => 0) {
  const queue = []; let running = false;
  const pump = async () => {
    if (running) return; running = true;
    while (queue.length) {
      const el = queue.shift(); if (!el.isConnected || el._done) continue; el._done = 1;
      try { const u = await thumb(js, getIdx(el), width); const holder = $('.pimg', el); holder.innerHTML = `<img src="${u}" alt="Thumbnail of page ${getIdx(el)}" draggable="false">`; applyRot(el, getRot(el)); } catch (e) { console.warn(e); }
    }
    running = false;
  };
  const io = new IntersectionObserver((ents) => { ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); queue.push(en.target); } }); pump(); }, { rootMargin: '300px' });
  $$('.page', grid).forEach((el) => io.observe(el));
  return io;
}
export function applyRot(el, rot) { const img = $('img', el); if (img) img.style.transform = `rotate(${rot}deg)${rot % 180 ? ' scale(.77)' : ''}`; }

/* ============================ ORGANIZE / ROTATE / DELETE ============================ */
export function organize(panel, mode = 'organize') {
  singlePdf(panel, {
    title: 'Drop a PDF here or click to browse',
    sub: mode === 'rotate' ? 'Rotate single pages or the whole document, then save.' : mode === 'delete' ? 'Click pages to select them, then delete.' : 'Drag pages to reorder. Rotate, delete, insert blank pages or add another PDF.',
    async onLoad(ctx) {
      const sources = []; let pages = [];
      async function addSource(bytes, name) {
        const js = await openJs(bytes); const si = sources.length; sources.push({ bytes, js, name });
        for (let i = 0; i < js.numPages; i++) pages.push({ id: nextId('p'), s: si, i, rot: 0, sel: false });
      }
      await addSource(ctx.bytes, ctx.file.name);
      ctx.body.innerHTML = `<div class="toolbar" role="toolbar" aria-label="Page tools">
        <button class="btn btn-sm" type="button" data-t="rotl">${icon('rotate-l')}Rotate ${mode === 'rotate' ? 'all' : ''} left</button>
        <button class="btn btn-sm" type="button" data-t="rotr" data-testid="rotate-all">${icon('rotate')}Rotate ${mode === 'rotate' ? 'all' : ''} right</button>
        <span class="sep"></span>
        <button class="btn btn-sm" type="button" data-t="all">Select all</button>
        <button class="btn btn-sm" type="button" data-t="none">Clear selection</button>
        <button class="btn btn-sm btn-danger" type="button" data-t="del" data-testid="delete-selected">${icon('trash')}Delete selected</button>
        <span class="sep"></span>
        <button class="btn btn-sm" type="button" data-t="rev">Reverse order</button>
        <button class="btn btn-sm" type="button" data-t="blank">${icon('plus')}Blank page</button>
        <label class="btn btn-sm" style="position:relative">${icon('plus')}Add PDF<input type="file" accept=".pdf,application/pdf" style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Add pages from another PDF"></label>
      </div>
      <p class="small muted" id="orgHint" style="margin:.7rem 0 0">Tip: drag thumbnails to reorder, or use the arrow buttons. The rotate/select buttons apply to selected pages, or all pages when nothing is selected.</p>
      <div class="pages" id="orgGrid" aria-label="Pages"></div>
      <div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="orgSave" data-testid="run">${icon('download')}Save PDF</button><button class="btn" type="button" id="orgExtract">Extract selected</button><span class="small muted" id="orgInfo"></span></div>
      <div id="orgOut"></div>`;
      const grid = $('#orgGrid', ctx.body);
      const render = () => {
        grid.innerHTML = pages.map((p, k) => `<div class="page ${p.sel ? 'sel' : ''}" draggable="true" data-k="${k}" data-id="${p.id}">
          <input class="pcheck" type="checkbox" ${p.sel ? 'checked' : ''} aria-label="Select page ${k + 1}">
          <div class="ptools">
            <button type="button" data-a="l" aria-label="Move page ${k + 1} earlier">${icon('left')}</button>
            <button type="button" data-a="r" aria-label="Move page ${k + 1} later">${icon('right')}</button>
            <button type="button" data-a="rl" aria-label="Rotate page ${k + 1} left">${icon('rotate-l')}</button>
            <button type="button" data-a="rr" aria-label="Rotate page ${k + 1} right">${icon('rotate')}</button>
            <button type="button" data-a="x" aria-label="Delete page ${k + 1}">${icon('trash')}</button>
          </div>
          <div class="pimg">${p.blank ? '<div class="blankpg" aria-label="Blank page"></div>' : ''}</div>
          <div class="pfoot"><span>${k + 1}</span><span class="faint">${p.rot ? p.rot + '°' : sources.length > 1 && !p.blank ? 'file ' + (p.s + 1) : ''}</span></div></div>`).join('');
        const bySrc = new Map();
        $$('.page', grid).forEach((el) => { const p = pages[+el.dataset.k]; if (p.blank) return; if (!bySrc.has(p.s)) bySrc.set(p.s, []); bySrc.get(p.s).push(el); });
        bySrc.forEach((els, s) => { lazyThumbsEls(sources[s].js, els, (el) => pages[+el.dataset.k].i + 1, (el) => pages[+el.dataset.k].rot); });
        const ns = pages.filter((p) => p.sel).length;
        $('#orgInfo', ctx.body).textContent = `${pages.length} pages${ns ? ` · ${ns} selected` : ''}`;
        $('#orgSave', ctx.body).disabled = !pages.length; $('#orgExtract', ctx.body).disabled = !ns;
        ctx.setChip(`${pages.length} pages`);
      };
      const targets = () => { const s = pages.filter((p) => p.sel); return s.length ? s : pages; };
      sortable(grid, '.page', (a, b) => { moveItem(pages, a, b); render(); });
      grid.addEventListener('click', (e) => {
        const el = e.target.closest('.page'); if (!el) return; const k = +el.dataset.k; const p = pages[k];
        const b = e.target.closest('button[data-a]');
        if (b) {
          const a = b.dataset.a;
          if (a === 'l' && k > 0) moveItem(pages, k, k - 1);
          if (a === 'r' && k < pages.length - 1) moveItem(pages, k, k + 1);
          if (a === 'rl') p.rot = (p.rot + 270) % 360;
          if (a === 'rr') p.rot = (p.rot + 90) % 360;
          if (a === 'x') pages.splice(k, 1);
          if (a === 'rl' || a === 'rr') { applyRot(el, p.rot); $('.pfoot .faint', el).textContent = p.rot ? p.rot + '°' : ''; return; }
          render();
          const nk = a === 'l' ? k - 1 : a === 'r' ? k + 1 : k; const nb = $(`.page[data-k="${Math.max(0, Math.min(nk, pages.length - 1))}"] button[data-a="${a}"]`, grid); nb && nb.focus();
          return;
        }
        if (e.target.matches('.pcheck') || mode === 'delete' || e.target.closest('.pimg')) { p.sel = e.target.matches('.pcheck') ? e.target.checked : !p.sel; el.classList.toggle('sel', p.sel); $('.pcheck', el).checked = p.sel; const ns = pages.filter((x) => x.sel).length; $('#orgInfo', ctx.body).textContent = `${pages.length} pages${ns ? ` · ${ns} selected` : ''}`; $('#orgExtract', ctx.body).disabled = !ns; }
      });
      $('.toolbar', ctx.body).addEventListener('click', async (e) => {
        const b = e.target.closest('button[data-t]'); if (!b) return; const t = b.dataset.t;
        if (t === 'rotl' || t === 'rotr') targets().forEach((p) => (p.rot = (p.rot + (t === 'rotr' ? 90 : 270)) % 360));
        if (t === 'all') pages.forEach((p) => (p.sel = true));
        if (t === 'none') pages.forEach((p) => (p.sel = false));
        if (t === 'del') { const n = pages.filter((p) => p.sel).length; if (!n) return toast('Select pages first (click them).', 'warn'); if (n === pages.length) return toast('You can\u2019t delete every page.', 'warn'); pages = pages.filter((p) => !p.sel); }
        if (t === 'rev') pages.reverse();
        if (t === 'blank') { const ref = pages.find((p) => !p.blank); let size = [595.28, 841.89]; if (ref) { const pg = await sources[ref.s].js.getPage(ref.i + 1); const vp = pg.getViewport({ scale: 1 }); size = [vp.width, vp.height]; } const after = pages.findLastIndex ? pages.findLastIndex((p) => p.sel) : -1; pages.splice(after >= 0 ? after + 1 : pages.length, 0, { id: nextId('p'), blank: size, rot: 0, sel: false }); }
        render();
      });
      $('.toolbar input[type=file]', ctx.body).addEventListener('change', async (e) => {
        const f = e.target.files[0]; e.target.value = ''; if (!f) return;
        try { const { bytes } = await editableBytes(await readBytes(f)); await addSource(bytes, f.name); render(); toast(`Added ${f.name}`, 'ok'); } catch (er) { handleErr(er, f.name); }
      });
      async function build(list) {
        const { PDFDocument, degrees } = await core.PDFLib();
        const out = await PDFDocument.create();
        const libs = await Promise.all(sources.map((s) => loadLib(s.bytes, { ignoreEncryption: true })));
        for (const p of list) {
          if (p.blank) { const pg = out.addPage(p.blank); if (p.rot) pg.setRotation(degrees(p.rot)); continue; }
          const [pg] = await out.copyPages(libs[p.s], [p.i]);
          pg.setRotation(degrees((((pg.getRotation().angle + p.rot) % 360) + 360) % 360));
          out.addPage(pg);
        }
        return out.save({ useObjectStreams: true });
      }
      const run = async (btn, list, suffix) => {
        busy(btn, true, 'Saving…');
        try { const bytes = await build(list); showResult($('#orgOut', ctx.body), [{ name: `${baseName(ctx.file.name)}-${suffix}.pdf`, blob: pdfBlob(bytes) }], { note: `${list.length} pages` }); }
        catch (e) { handleErr(e, 'Save failed'); } finally { busy(btn, false); }
      };
      $('#orgSave', ctx.body).onclick = (e) => run(e.currentTarget, pages, mode === 'rotate' ? 'rotated' : mode === 'delete' ? 'edited' : 'organized');
      $('#orgExtract', ctx.body).onclick = (e) => run(e.currentTarget, pages.filter((p) => p.sel), 'extracted');
      render();
    },
  });
}
function lazyThumbsEls(js, els, getIdx, getRot) {
  const queue = []; let running = false;
  const pump = async () => { if (running) return; running = true; while (queue.length) { const el = queue.shift(); if (!el.isConnected) continue; try { const u = await thumbCache(js, getIdx(el)); $('.pimg', el).innerHTML = `<img src="${u}" alt="Thumbnail of page ${getIdx(el)}" draggable="false">`; applyRot(el, getRot(el)); } catch (e) { console.warn(e); } } running = false; };
  const io = new IntersectionObserver((ents) => { ents.forEach((en) => { if (en.isIntersecting) { io.unobserve(en.target); queue.push(en.target); } }); pump(); }, { rootMargin: '400px' });
  els.forEach((el) => io.observe(el));
}
const tcache = new WeakMap();
function thumbCache(js, n) { let m = tcache.get(js); if (!m) tcache.set(js, (m = new Map())); if (!m.has(n)) m.set(n, thumb(js, n, 150)); return m.get(n); }

/* ============================ COMPRESS ============================ */
export function compressTool(panel) {
  singlePdf(panel, {
    async onLoad(ctx) {
      const js = await openJs(ctx.bytes); const n = js.numPages; ctx.setChip(`${n} pages`);
      ctx.body.innerHTML = `<div class="opts" style="grid-template-columns:1fr">
        <div class="field"><span>Compression</span>${seg('cmode', [['lossless', 'Lossless (keeps text)'], ['strong', 'Strong (for scans)'], ['target', 'Target file size']], 'lossless')}</div>
        <div id="cStrong" class="grid2 hidden">
          <label class="field"><span>Resolution <output id="dpiV">110 DPI</output></span><input type="range" id="dpi" min="50" max="200" step="10" value="110"></label>
          <label class="field"><span>Image quality <output id="qV">65%</output></span><input type="range" id="q" min="20" max="95" step="5" value="65"></label>
          <label class="switch"><input type="checkbox" id="gray"> Grayscale</label>
        </div>
        <div id="cTarget" class="row hidden" style="max-width:420px">
          <label class="field"><span>Make it smaller than</span><input type="number" id="tSize" min="0.05" step="0.05" value="${Math.max(0.1, +(ctx.origSize / 1048576 / 2).toFixed(2))}"></label>
          <label class="field nogrow" style="width:110px"><span>Unit</span><select id="tUnit"><option value="1048576">MB</option><option value="1024">KB</option></select></label>
        </div>
        <p class="note" id="cNote">${icon('info')}<span></span></p>
      </div>
      <div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="cBtn" data-testid="run">${icon('compress')}Compress PDF</button></div><div id="cOut"></div>`;
      const b = ctx.body;
      const upd = () => {
        const m = segVal(b, 'cmode');
        $('#cStrong', b).classList.toggle('hidden', m !== 'strong'); $('#cTarget', b).classList.toggle('hidden', m !== 'target');
        $('#cNote span', b).textContent = { lossless: 'Repacks and recompresses the file structure with qpdf. Text, links and forms stay intact. Best for digital documents.', strong: 'Turns every page into an optimized image. Huge savings on scans and photos, but text is no longer selectable or searchable.', target: 'Tries lossless first. If that isn\u2019t enough, it finds the highest quality that fits your limit (pages become images in that case).' }[m];
        $('#dpiV', b).textContent = $('#dpi', b).value + ' DPI'; $('#qV', b).textContent = $('#q', b).value + '%';
      };
      b.addEventListener('input', upd); b.addEventListener('change', upd); upd();
      $('#cBtn', b).onclick = async () => {
        const btn = $('#cBtn', b); busy(btn, true, 'Compressing…'); const prog = progressEl($('#cOut', b));
        const m = segVal(b, 'cmode'); const name = `${baseName(ctx.file.name)}-compressed.pdf`;
        try {
          let out, note = '';
          if (m === 'lossless') { prog.set(0.3, 'Optimizing structure…'); out = await lossless(ctx.bytes); note = 'lossless'; }
          else if (m === 'strong') { out = await rasterize(js, { dpi: +$('#dpi', b).value, q: +$('#q', b).value / 100, gray: $('#gray', b).checked, prog }); note = `${$('#dpi', b).value} DPI, ${$('#q', b).value}% quality`; }
          else {
            const target = +$('#tSize', b).value * +$('#tUnit', b).value;
            if (!(target > 0)) throw new Error('Enter a target size.');
            prog.set(0.05, 'Trying lossless optimization…');
            const l = await lossless(ctx.bytes);
            if (l.length <= target) { out = l; note = 'lossless, target met'; }
            else {
              const r = await targetSearch(js, target, prog);
              out = r.bytes; note = r.ok ? `target met at ${r.dpi} DPI, ${Math.round(r.q * 100)}% quality` : `couldn\u2019t reach the target; smallest possible shown`;
              if (!r.ok) toast('Couldn\u2019t get under the target size. This is the smallest version.', 'warn', 7000);
            }
          }
          if (out.length >= ctx.origSize && m === 'lossless') { note = 'already well optimized, original kept'; out = ctx.bytes; }
          prog.remove();
          showResult($('#cOut', b), [{ name, blob: pdfBlob(out) }], { origSize: ctx.origSize, note });
        } catch (e) { prog.remove(); handleErr(e, 'Compression failed'); } finally { busy(btn, false); }
      };
    },
  });
}
async function lossless(bytes) {
  try {
    const r = await core.qpdf(['--object-streams=generate', '--compress-streams=y', '--recompress-flate', '--compression-level=9', '--remove-unreferenced-resources=yes', '/in.pdf', '/out.pdf'], { 'in.pdf': bytes });
    const o = r.read('out.pdf'); if ((r.code === 0 || r.code === 3) && o) return o.length < bytes.length ? o : bytes;
  } catch (e) { console.warn('qpdf failed, falling back to pdf-lib', e); }
  const d = await loadLib(bytes, { ignoreEncryption: true }); const o = await d.save({ useObjectStreams: true }); return o.length < bytes.length ? o : bytes;
}
const canvasCache = new WeakMap();
async function pageCanvas(js, i, dpi) {
  let m = canvasCache.get(js); if (!m) canvasCache.set(js, (m = new Map()));
  const k = i + '@' + dpi; if (m.has(k)) return m.get(k);
  const c = await renderPage(js, i, { scale: dpi / 72 });
  if (m.size > 60) m.clear(); m.set(k, c); return c;
}
async function rasterize(js, { dpi, q, gray, prog }) {
  const { PDFDocument } = await core.PDFLib(); const out = await PDFDocument.create();
  for (let i = 1; i <= js.numPages; i++) {
    prog && prog.set((i - 1) / js.numPages, `Compressing page ${i} of ${js.numPages}…`);
    let c = await pageCanvas(js, i, dpi);
    if (gray) { const g = document.createElement('canvas'); g.width = c.width; g.height = c.height; const x = g.getContext('2d'); x.filter = 'grayscale(1)'; x.drawImage(c, 0, 0); c = g; }
    const img = await out.embedJpg(new Uint8Array(await (await canvasBlob(c, 'image/jpeg', q)).arrayBuffer()));
    const pg = await js.getPage(i); const vp = pg.getViewport({ scale: 1 });
    out.addPage([vp.width, vp.height]).drawImage(img, { x: 0, y: 0, width: vp.width, height: vp.height });
  }
  return out.save({ useObjectStreams: true });
}
async function targetSearch(js, target, prog) {
  let best = null, smallest = null;
  for (const dpi of [150, 110, 80, 60, 45]) {
    let lo = 0.25, hi = 0.9;
    for (let it = 0; it < 4; it++) {
      const q = it === 0 ? hi : (lo + hi) / 2;
      prog.set(0.1 + 0.85 * Math.min(1, ([150, 110, 80, 60, 45].indexOf(dpi) * 4 + it) / 20), `Trying ${dpi} DPI at ${Math.round(q * 100)}% quality…`);
      const bytes = await rasterize(js, { dpi, q });
      if (!smallest || bytes.length < smallest.bytes.length) smallest = { bytes, dpi, q };
      if (bytes.length <= target) { if (!best || q > best.q || dpi > best.dpi) best = { bytes, dpi, q, ok: true }; if (it === 0) break; lo = q; } else hi = q;
    }
    if (best) return best;
    const lowQ = await rasterize(js, { dpi, q: 0.25 });
    if (lowQ.length <= target) { return { bytes: lowQ, dpi, q: 0.25, ok: true }; }
  }
  return { ...smallest, ok: false };
}

/* ============================ IMAGES → PDF ============================ */
export function img2pdf(panel) {
  const items = [];
  panel.innerHTML = '';
  intake(panel, { id: 'imgDrop', multiple: true, accept: 'image/*', filter: isImg, title: 'Drop images here or click to browse', sub: 'JPG, PNG, WebP, GIF, BMP, AVIF, SVG. Drag to reorder. One image per page.', onFiles: (fs) => { fs.forEach((f) => items.push({ f, url: URL.createObjectURL(f) })); render(); } });
  panel.insertAdjacentHTML('beforeend', `<div class="pages hidden" id="iList" aria-label="Images, in page order"></div>
    <div class="opts hidden" id="iOpts">
      <label class="field"><span>Page size</span><select id="iSize"><option value="fit">Same as image</option><option value="a4" selected>A4</option><option value="letter">US Letter</option><option value="legal">US Legal</option><option value="a3">A3</option><option value="a5">A5</option></select></label>
      <label class="field"><span>Orientation</span><select id="iOri"><option value="auto">Auto (match image)</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
      <label class="field"><span>Margin</span><select id="iMargin"><option value="0">None</option><option value="18" selected>Small</option><option value="40">Large</option></select></label>
      <label class="field"><span>Image fit</span><select id="iFit"><option value="contain">Fit whole image</option><option value="cover">Fill page (crop)</option></select></label>
    </div>
    <div class="actions-bar hidden" id="iBar"><button class="btn btn-primary btn-lg" type="button" id="iBtn" data-testid="run">${icon('file')}Create PDF</button><span class="small muted" id="iInfo"></span></div><div id="iOut"></div>`);
  const list = $('#iList', panel);
  sortable(list, '.page', (a, b) => { moveItem(items, a, b); render(); });
  list.addEventListener('click', (e) => { const b = e.target.closest('button[data-a]'); if (!b) return; const k = +b.closest('.page').dataset.k; const a = b.dataset.a; if (a === 'x') items.splice(k, 1); if (a === 'l' && k > 0) moveItem(items, k, k - 1); if (a === 'r' && k < items.length - 1) moveItem(items, k, k + 1); render(); });
  function render() {
    ['#iList', '#iOpts', '#iBar'].forEach((s) => $(s, panel).classList.toggle('hidden', !items.length));
    list.innerHTML = items.map((it, k) => `<div class="page" draggable="true" data-k="${k}"><div class="ptools"><button type="button" data-a="l" aria-label="Move earlier">${icon('left')}</button><button type="button" data-a="r" aria-label="Move later">${icon('right')}</button><button type="button" data-a="x" aria-label="Remove ${esc(it.f.name)}">${icon('trash')}</button></div><div class="pimg"><img src="${it.url}" alt="${esc(it.f.name)}" draggable="false" loading="lazy"></div><div class="pfoot"><span>${k + 1}</span><span class="faint" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70%">${esc(it.f.name)}</span></div></div>`).join('');
    $('#iInfo', panel).textContent = `${items.length} image${items.length === 1 ? '' : 's'}`;
  }
  const SIZES = { a4: [595.28, 841.89], letter: [612, 792], legal: [612, 1008], a3: [841.89, 1190.55], a5: [419.53, 595.28] };
  $('#iBtn', panel).onclick = async () => {
    const btn = $('#iBtn', panel); busy(btn, true, 'Creating…'); const prog = progressEl($('#iOut', panel));
    try {
      const { PDFDocument } = await core.PDFLib(); const out = await PDFDocument.create();
      const size = $('#iSize', panel).value, ori = $('#iOri', panel).value, mg = +$('#iMargin', panel).value, fit = $('#iFit', panel).value;
      for (let k = 0; k < items.length; k++) {
        prog.set(k / items.length, `Adding ${items[k].f.name}…`);
        const im = await imageForPdf(items[k].f);
        const emb = im.kind === 'jpg' ? await out.embedJpg(im.bytes) : await out.embedPng(im.bytes);
        let pw, ph;
        if (size === 'fit') { pw = (im.width * 72) / 96 + 2 * mg; ph = (im.height * 72) / 96 + 2 * mg; const s = Math.min(1, 2000 / Math.max(pw, ph)); pw *= s; ph *= s; }
        else { [pw, ph] = SIZES[size]; const land = ori === 'landscape' || (ori === 'auto' && im.width > im.height); if (land) [pw, ph] = [ph, pw]; }
        const page = out.addPage([pw, ph]);
        const bw = pw - 2 * mg, bh = ph - 2 * mg;
        const s = fit === 'cover' ? Math.max(bw / im.width, bh / im.height) : Math.min(bw / im.width, bh / im.height);
        const w = im.width * s, h = im.height * s;
        if (fit === 'cover') { page.drawImage(emb, { x: mg + (bw - w) / 2, y: mg + (bh - h) / 2, width: w, height: h }); }
        else page.drawImage(emb, { x: mg + (bw - w) / 2, y: mg + (bh - h) / 2, width: w, height: h });
      }
      prog.set(1, 'Saving…');
      const bytes = await out.save({ useObjectStreams: true });
      showResult($('#iOut', panel), [{ name: items.length === 1 ? baseName(items[0].f.name) + '.pdf' : 'images.pdf', blob: pdfBlob(bytes) }], { note: `${items.length} pages` });
    } catch (e) { prog.remove(); handleErr(e, 'Conversion failed'); } finally { busy(btn, false); }
  };
}

/* ============================ PDF → IMAGES ============================ */
export function pdf2img(panel, mode = 'jpg') {
  singlePdf(panel, {
    async onLoad(ctx) {
      const js = await openJs(ctx.bytes); const n = js.numPages; ctx.setChip(`${n} pages`);
      ctx.body.innerHTML = `<div class="opts">
        <div class="field"><span>Format</span>${seg('fmt', [['jpg', 'JPG'], ['png', 'PNG']], mode)}</div>
        <label class="field"><span>Resolution</span><select id="dpi"><option value="72">72 DPI (screen)</option><option value="150" selected>150 DPI (sharp)</option><option value="200">200 DPI</option><option value="300">300 DPI (print)</option></select></label>
        <label class="field" id="fq"><span>JPG quality <output id="qV">90%</output></span><input type="range" id="q" min="40" max="100" step="5" value="90"></label>
        <label class="field"><span>Pages <span class="faint">blank = all</span></span><input type="text" id="rng" placeholder="e.g. 1-3, 7" autocomplete="off"></label>
      </div>
      <div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="cvBtn" data-testid="run">${icon('image')}Convert to images</button></div><div id="cvOut"></div><div class="out-grid" id="cvGrid"></div>`;
      const b = ctx.body; const upd = () => { $('#fq', b).classList.toggle('hidden', segVal(b, 'fmt') !== 'jpg'); $('#qV', b).textContent = $('#q', b).value + '%'; }; b.addEventListener('input', upd); b.addEventListener('change', upd); upd();
      $('#cvBtn', b).onclick = async () => {
        let idx; try { idx = $('#rng', b).value.trim() ? [...new Set(parseRanges($('#rng', b).value, n).flat())] : [...Array(n).keys()]; } catch (e) { return toast(e.message, 'warn'); }
        const fmt = segVal(b, 'fmt'), dpi = +$('#dpi', b).value, q = +$('#q', b).value / 100;
        const btn = $('#cvBtn', b); busy(btn, true, 'Rendering…'); const grid = $('#cvGrid', b); grid.innerHTML = ''; $('#cvOut', b).innerHTML = '';
        const prog = progressEl($('#cvOut', b)); const files = []; const base = baseName(ctx.file.name);
        try {
          for (let k = 0; k < idx.length; k++) {
            prog.set(k / idx.length, `Rendering page ${idx[k] + 1} (${k + 1} of ${idx.length})…`);
            const c = await renderPage(js, idx[k] + 1, { scale: dpi / 72, maxPixels: 40e6 });
            const blob = await canvasBlob(c, fmt === 'png' ? 'image/png' : 'image/jpeg', q);
            const name = `${base}-page-${String(idx[k] + 1).padStart(String(n).length, '0')}.${fmt}`; files.push({ name, blob });
            const u = URL.createObjectURL(blob);
            grid.insertAdjacentHTML('beforeend', `<a href="${u}" download="${esc(name)}"><img src="${u}" alt="Page ${idx[k] + 1} as ${fmt.toUpperCase()}" loading="lazy"><span>Page ${idx[k] + 1} · ${fmtBytes(blob.size)}</span></a>`);
            c.width = c.height = 0;
          }
          files.zipName = base + '-images'; prog.remove(); showResult($('#cvOut', b), files);
        } catch (e) { prog.remove(); handleErr(e, 'Conversion failed'); } finally { busy(btn, false); }
      };
    },
  });
}
