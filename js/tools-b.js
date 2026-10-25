// Edit / security / view tools
import { $, $$, esc, icon, fmtBytes, toast, openModal, closeModal, nextId, initRanges } from './ui.js';
import * as core from './pdfcore.js';
import { intake, fileChip, busy, progressEl, showResult, handleErr, isImg, seg, segVal } from './common.js';
import { singlePdf } from './tools-a.js';

const { readBytes, loadLib, openJs, parseRanges, baseName, pdfBlob, pageFrame, rotV, drawTextVisual, drawImageVisual, winAnsiSafe, hexToRgb, imageForPdf, renderPage } = core;

function pagesFromRange(str, n) { return str.trim() ? new Set(parseRanges(str, n).flat()) : null; }
const FONTS = [['Helvetica', 'Helvetica'], ['HelveticaBold', 'Helvetica Bold'], ['TimesRoman', 'Times'], ['TimesRomanBold', 'Times Bold'], ['Courier', 'Courier']];
const fontSelect = (id, v = 'Helvetica') => `<select id="${id}">${FONTS.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;

/* ============================ PAGE NUMBERS ============================ */
export function numbers(panel) {
  singlePdf(panel, {
    async onLoad(ctx) {
      const lib = await loadLib(ctx.bytes, { ignoreEncryption: true }); const n = lib.getPageCount(); ctx.setChip(`${n} pages`);
      ctx.body.innerHTML = `<div class="opts">
        <div class="field"><span>Position</span><div class="posgrid" role="radiogroup" aria-label="Position">${['tl', 'tc', 'tr', 'bl', 'bc', 'br'].map((p) => `<label><input type="radio" name="pos" value="${p}" ${p === 'bc' ? 'checked' : ''}><span aria-label="${{ tl: 'Top left', tc: 'Top center', tr: 'Top right', bl: 'Bottom left', bc: 'Bottom center', br: 'Bottom right' }[p]}"></span></label>`).join('')}</div></div>
        <label class="field"><span>Format</span><select id="fmt"><option value="{n}">1</option><option value="Page {n}">Page 1</option><option value="Page {n} of {total}" selected>Page 1 of 9</option><option value="{n} / {total}">1 / 9</option><option value="- {n} -">- 1 -</option><option value="custom">Custom…</option></select></label>
        <label class="field hidden" id="fCustom"><span>Custom text <span class="faint">{n} = number, {total} = count</span></span><input type="text" id="custom" value="Report · p. {n}"></label>
        <label class="field"><span>Start at</span><input type="number" id="start" value="1"></label>
        <label class="field"><span>Pages <span class="faint">blank = all</span></span><input type="text" id="rng" placeholder="e.g. 2-" autocomplete="off"></label>
        <label class="field"><span>Font</span>${fontSelect('font')}</label>
        <label class="field"><span>Size <output id="sV">11 pt</output></span><input type="range" id="size" min="6" max="36" value="11"></label>
        <label class="field"><span>Margin <output id="mV">28 pt</output></span><input type="range" id="margin" min="8" max="90" value="28"></label>
        <label class="field"><span>Color</span><input type="color" id="color" value="#333333"></label>
        <label class="switch"><input type="checkbox" id="skip1"> Don’t number the first page (cover)</label>
      </div><div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="nBtn" data-testid="run">${icon('hash')}Add page numbers</button></div><div id="nOut"></div>`;
      const b = ctx.body; const upd = () => { $('#fCustom', b).classList.toggle('hidden', $('#fmt', b).value !== 'custom'); $('#sV', b).textContent = $('#size', b).value + ' pt'; $('#mV', b).textContent = $('#margin', b).value + ' pt'; };
      b.addEventListener('input', upd); b.addEventListener('change', upd); upd();
      $('#nBtn', b).onclick = async () => {
        const btn = $('#nBtn', b); busy(btn, true, 'Numbering…');
        try {
          const { StandardFonts } = await core.PDFLib(); const doc = await loadLib(ctx.bytes, { ignoreEncryption: true });
          const font = await doc.embedFont(StandardFonts[$('#font', b).value]);
          const fmt = $('#fmt', b).value === 'custom' ? $('#custom', b).value : $('#fmt', b).value;
          const size = +$('#size', b).value, m = +$('#margin', b).value, color = hexToRgb($('#color', b).value), pos = segVal(b, 'pos');
          const only = pagesFromRange($('#rng', b).value, n); const skip = $('#skip1', b).checked; const start = +$('#start', b).value || 1;
          const pages = doc.getPages(); const targets = pages.map((_, i) => i).filter((i) => (!only || only.has(i)) && !(skip && i === 0));
          let warned = false;
          targets.forEach((i, k) => {
            const [txt, rep] = winAnsiSafe(font, fmt.replaceAll('{n}', String(start + k)).replaceAll('{total}', String(targets.length + start - 1)));
            if (rep && !warned) { warned = true; toast('Some characters aren\u2019t supported by standard PDF fonts and were replaced.', 'warn'); }
            const f = pageFrame(pages[i]); const w = font.widthOfTextAtSize(txt, size);
            const vx = pos[1] === 'l' ? m : pos[1] === 'r' ? f.vw - m - w : (f.vw - w) / 2;
            const vy = pos[0] === 't' ? f.vh - m - size * 0.75 : m;
            drawTextVisual(pages[i], txt, { vx, vy, size, font, color });
          });
          showResult($('#nOut', b), [{ name: `${baseName(ctx.file.name)}-numbered.pdf`, blob: pdfBlob(await doc.save({ useObjectStreams: true })) }], { note: `${targets.length} pages numbered` });
        } catch (e) { handleErr(e, 'Failed'); } finally { busy(btn, false); }
      };
    },
  });
}

/* ============================ WATERMARK ============================ */
export function watermark(panel) {
  singlePdf(panel, {
    async onLoad(ctx) {
      const lib = await loadLib(ctx.bytes, { ignoreEncryption: true }); const n = lib.getPageCount(); ctx.setChip(`${n} pages`);
      let wmImg = null;
      ctx.body.innerHTML = `<div class="opts">
        <div class="field"><span>Watermark type</span>${seg('wtype', [['text', 'Text'], ['image', 'Image / logo']], 'text')}</div>
        <div class="field"><span>Layout</span>${seg('wlay', [['center', 'Centered'], ['tile', 'Tiled']], 'center')}</div>
        <label class="field wt"><span>Text</span><input type="text" id="wText" value="CONFIDENTIAL"></label>
        <label class="field wt"><span>Font</span>${fontSelect('wFont', 'HelveticaBold')}</label>
        <label class="field wt"><span>Size <output id="wsV">60 pt</output></span><input type="range" id="wSize" min="10" max="160" value="60"></label>
        <label class="field wt"><span>Color</span><input type="color" id="wColor" value="#e11d48"></label>
        <div class="field wi hidden"><span>Image</span><label class="btn" style="position:relative">${icon('upload')}<span id="wImgName">Choose PNG / JPG…</span><input type="file" accept="image/*" id="wImg" style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Choose watermark image"></label></div>
        <label class="field wi hidden"><span>Width <output id="wwV">40%</output> of page</span><input type="range" id="wWidth" min="5" max="100" value="40"></label>
        <label class="field"><span>Opacity <output id="woV">25%</output></span><input type="range" id="wOp" min="5" max="100" value="25"></label>
        <label class="field"><span>Rotation <output id="wrV">45°</output></span><input type="range" id="wRot" min="-90" max="90" value="45"></label>
        <label class="field"><span>Pages <span class="faint">blank = all</span></span><input type="text" id="wRng" autocomplete="off" placeholder="e.g. 1-3"></label>
      </div><div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="wBtn" data-testid="run">${icon('drop')}Add watermark</button></div><div id="wOut"></div>`;
      const b = ctx.body;
      const upd = () => { const img = segVal(b, 'wtype') === 'image'; $$('.wt', b).forEach((e) => e.classList.toggle('hidden', img)); $$('.wi', b).forEach((e) => e.classList.toggle('hidden', !img)); $('#wsV', b).textContent = $('#wSize', b).value + ' pt'; $('#wwV', b).textContent = $('#wWidth', b).value + '%'; $('#woV', b).textContent = $('#wOp', b).value + '%'; $('#wrV', b).textContent = $('#wRot', b).value + '°'; };
      b.addEventListener('input', upd); b.addEventListener('change', upd); upd();
      $('#wImg', b).addEventListener('change', (e) => { const f = e.target.files[0]; if (f && isImg(f)) { wmImg = f; $('#wImgName', b).textContent = f.name; } });
      $('#wBtn', b).onclick = async () => {
        const isImage = segVal(b, 'wtype') === 'image'; if (isImage && !wmImg) return toast('Choose an image first.', 'warn');
        const btn = $('#wBtn', b); busy(btn, true, 'Stamping…');
        try {
          const { StandardFonts } = await core.PDFLib(); const doc = await loadLib(ctx.bytes, { ignoreEncryption: true });
          const only = pagesFromRange($('#wRng', b).value, n); const op = +$('#wOp', b).value / 100, deg = +$('#wRot', b).value, tile = segVal(b, 'wlay') === 'tile';
          let draw;
          if (isImage) {
            const im = await imageForPdf(wmImg); const emb = im.kind === 'jpg' ? await doc.embedJpg(im.bytes) : await doc.embedPng(im.bytes);
            draw = (pg, f, cx, cy, scaleW) => { const w = f.vw * scaleW, h = (w * im.height) / im.width; const [ox, oy] = rotV(w / 2, h / 2, deg); drawImageVisual(pg, emb, { vx: cx - ox, vy: cy - oy, width: w, height: h, deg, opacity: op }); return [w, h]; };
          } else {
            const font = await doc.embedFont(StandardFonts[$('#wFont', b).value]); const size = +$('#wSize', b).value; const color = hexToRgb($('#wColor', b).value);
            const [txt, rep] = winAnsiSafe(font, $('#wText', b).value || ' '); if (rep) toast('Some characters were replaced (standard PDF fonts are Latin-only).', 'warn');
            const w = font.widthOfTextAtSize(txt, size), h = size * 0.7;
            draw = (pg, f, cx, cy) => { const [ox, oy] = rotV(w / 2, h / 2, deg); drawTextVisual(pg, txt, { vx: cx - ox, vy: cy - oy, deg, size, font, color, opacity: op }); return [w, h]; };
          }
          const scaleW = +$('#wWidth', b).value / 100;
          doc.getPages().forEach((pg, i) => {
            if (only && !only.has(i)) return; const f = pageFrame(pg);
            if (!tile) return draw(pg, f, f.vw / 2, f.vh / 2, scaleW);
            const sw = isImage ? Math.min(scaleW, 0.3) : 0; const [w, h] = isImage ? [f.vw * sw, f.vw * sw] : [0, 0];
            const tw = isImage ? w : $('#wSize', b).value * Math.max(3, ($('#wText', b).value.length || 1) * 0.6);
            const stepX = tw * 1.5 + 40, stepY = (isImage ? h : +$('#wSize', b).value) * 3 + 40;
            for (let y = stepY / 2, row = 0; y < f.vh + stepY; y += stepY, row++) for (let x = (row % 2 ? stepX / 2 : 0); x < f.vw + stepX; x += stepX) draw(pg, f, x, y, sw);
          });
          showResult($('#wOut', b), [{ name: `${baseName(ctx.file.name)}-watermarked.pdf`, blob: pdfBlob(await doc.save({ useObjectStreams: true })) }]);
        } catch (e) { handleErr(e, 'Watermark failed'); } finally { busy(btn, false); }
      };
    },
  });
}

/* ============================ METADATA ============================ */
export function metadata(panel) {
  singlePdf(panel, {
    async onLoad(ctx) {
      const doc = await loadLib(ctx.bytes, { ignoreEncryption: true }); ctx.setChip(`${doc.getPageCount()} pages`);
      const g = (fn) => { try { return doc[fn]() ?? ''; } catch { return ''; } };
      const d2i = (d) => (d instanceof Date && !isNaN(d) ? new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16) : '');
      const kw = g('getKeywords');
      ctx.body.innerHTML = `<div class="opts">
        <label class="field"><span>Title</span><input type="text" id="mTitle" value="${esc(g('getTitle'))}"></label>
        <label class="field"><span>Author</span><input type="text" id="mAuthor" value="${esc(g('getAuthor'))}"></label>
        <label class="field"><span>Subject</span><input type="text" id="mSubject" value="${esc(g('getSubject'))}"></label>
        <label class="field"><span>Keywords <span class="faint">comma separated</span></span><input type="text" id="mKeywords" value="${esc(kw)}"></label>
        <label class="field"><span>Creator (app)</span><input type="text" id="mCreator" value="${esc(g('getCreator'))}"></label>
        <label class="field"><span>Producer</span><input type="text" id="mProducer" value="${esc(g('getProducer'))}"></label>
        <label class="field"><span>Created</span><input type="datetime-local" id="mCreated" value="${d2i(g('getCreationDate'))}"></label>
        <label class="field"><span>Modified</span><input type="datetime-local" id="mModified" value="${d2i(g('getModificationDate'))}"></label>
      </div>
      <div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="mSave" data-testid="run">${icon('tag')}Save metadata</button><button class="btn btn-danger" type="button" id="mWipe">${icon('trash')}Remove all metadata</button></div><div id="mOut"></div>`;
      const b = ctx.body;
      const run = async (wipe, btn) => {
        busy(btn, true, 'Saving…');
        try {
          const { PDFName } = await core.PDFLib(); const d = await loadLib(ctx.bytes, { ignoreEncryption: true });
          const info = d.getInfoDict(); for (const k of info.keys()) info.delete(k);
          d.catalog.delete(PDFName.of('Metadata'));
          if (!wipe) {
            const v = (id) => $(id, b).value.trim();
            if (v('#mTitle')) d.setTitle(v('#mTitle')); if (v('#mAuthor')) d.setAuthor(v('#mAuthor')); if (v('#mSubject')) d.setSubject(v('#mSubject'));
            if (v('#mKeywords')) d.setKeywords(v('#mKeywords').split(',').map((s) => s.trim()).filter(Boolean));
            if (v('#mCreator')) d.setCreator(v('#mCreator')); if (v('#mProducer')) d.setProducer(v('#mProducer'));
            if (v('#mCreated')) d.setCreationDate(new Date(v('#mCreated'))); if (v('#mModified')) d.setModificationDate(new Date(v('#mModified')));
          }
          showResult($('#mOut', b), [{ name: `${baseName(ctx.file.name)}${wipe ? '-clean' : ''}.pdf`, blob: pdfBlob(await d.save({ useObjectStreams: true })) }], { note: wipe ? 'all document info and XMP removed' : 'metadata updated' });
        } catch (e) { handleErr(e, 'Save failed'); } finally { busy(btn, false); }
      };
      $('#mSave', b).onclick = (e) => run(false, e.currentTarget);
      $('#mWipe', b).onclick = (e) => run(true, e.currentTarget);
    },
  });
}

/* ============================ PROTECT / UNLOCK ============================ */
async function encState(bytes) {
  try { const d = await openJs(bytes); d.destroy(); } catch (e) { if (e?.name === 'PasswordException') return 'user'; throw e; }
  return (await core.isEncrypted(bytes)) ? 'owner' : 'none';
}
export function protect(panel, mode = 'protect') {
  panel.innerHTML = '';
  if (!core.qpdfSupported()) { panel.innerHTML = `<p class="note">${icon('info')}<span>This browser doesn\u2019t support WebAssembly, which the encryption engine needs. Try a current version of Chrome, Edge, Firefox or Safari.</span></p>`; return; }
  const zone = intake(panel, { id: 'drop', title: mode === 'protect' ? 'Drop a PDF to password-protect' : 'Drop a locked PDF to unlock', sub: 'Encryption runs locally with qpdf (WebAssembly). Nothing is uploaded.', onFiles: (f) => load(f[0]) });
  const area = document.createElement('div'); panel.appendChild(area);
  async function load(file) {
    try {
      const bytes = await readBytes(file); const st = await encState(bytes);
      zone.classList.add('hidden');
      area.innerHTML = fileChip(file, { none: 'not encrypted', owner: 'restrictions only (no open password)', user: 'needs a password to open' }[st]) + '<div id="pBody"></div><div id="pOut"></div>';
      $('[data-act=change]', area).onclick = () => { zone.classList.remove('hidden'); area.innerHTML = ''; $('input', zone).click(); };
      const body = $('#pBody', area);
      if (mode === 'protect') {
        if (st === 'user') { body.innerHTML = `<p class="note">${icon('info')}<span>This PDF already has a password. <a href="/unlock-pdf/">Unlock it first</a>, then protect it again with a new password.</span></p>`; return; }
        body.innerHTML = `<div class="opts">
          <label class="field"><span>Password to open</span><input type="password" id="pw1" autocomplete="new-password" minlength="1"></label>
          <label class="field"><span>Repeat password</span><input type="password" id="pw2" autocomplete="new-password"></label>
          <label class="field"><span>Owner password <span class="faint">optional, for changing permissions</span></span><input type="password" id="pwo" autocomplete="new-password"></label>
          <div class="field"><span>Permissions</span><label class="switch"><input type="checkbox" id="pPrint" checked> Allow printing</label><label class="switch"><input type="checkbox" id="pCopy" checked> Allow copying text</label><label class="switch"><input type="checkbox" id="pMod" checked> Allow editing</label></div>
          <label class="switch"><input type="checkbox" id="pShow"> Show passwords</label>
        </div><p class="note">${icon('lock')}<span>AES-256 encryption. Keep the password safe. Nobody, including us, can recover it.</span></p>
        <div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="pBtn" data-testid="run">${icon('lock')}Protect PDF</button></div>`;
        $('#pShow', body).onchange = (e) => $$('input[type=password],input[data-pw]', body).forEach((i) => { i.dataset.pw = 1; i.type = e.target.checked ? 'text' : 'password'; });
        $('#pBtn', body).onclick = async () => {
          const u = $('#pw1', body).value; if (!u) return toast('Enter a password.', 'warn'); if (u !== $('#pw2', body).value) return toast('The passwords don\u2019t match.', 'warn');
          const o = $('#pwo', body).value || u + '-' + crypto.getRandomValues(new Uint32Array(2)).join('');
          const btn = $('#pBtn', body); busy(btn, true, 'Encrypting…');
          try {
            let src = bytes;
            if (st === 'owner') { const r0 = await core.qpdf(['--decrypt', '/in.pdf', '/d.pdf'], { 'in.pdf': bytes }); src = r0.read('d.pdf') || bytes; }
            const r = await core.qpdf(['--encrypt', u, o, '256', `--print=${$('#pPrint', body).checked ? 'full' : 'none'}`, `--extract=${$('#pCopy', body).checked ? 'y' : 'n'}`, `--modify=${$('#pMod', body).checked ? 'all' : 'none'}`, '--', '/in.pdf', '/out.pdf'], { 'in.pdf': src });
            const out = r.read('out.pdf'); if (!(r.code === 0 || r.code === 3) || !out) throw new Error(r.log || 'qpdf error');
            showResult($('#pOut', area), [{ name: `${baseName(file.name)}-protected.pdf`, blob: pdfBlob(out) }], { note: 'AES-256' });
          } catch (e) { handleErr(e, 'Encryption failed'); } finally { busy(btn, false); }
        };
      } else {
        if (st === 'none') { body.innerHTML = `<p class="note">${icon('info')}<span>This PDF isn\u2019t password-protected, so there\u2019s nothing to unlock.</span></p>`; return; }
        body.innerHTML = `${st === 'user' ? `<div class="opts"><label class="field"><span>Password</span><input type="password" id="uPw" autocomplete="current-password"></label></div>` : `<p class="note">${icon('info')}<span>This file opens without a password but has restrictions (printing, copying or editing). They can be removed without a password.</span></p>`}
          <div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="uBtn" data-testid="run">${icon('unlock')}Unlock PDF</button></div>`;
        const go = async () => {
          const btn = $('#uBtn', body); const pw = st === 'user' ? $('#uPw', body).value : '';
          if (st === 'user' && !pw) return toast('Enter the password.', 'warn');
          busy(btn, true, 'Unlocking…');
          try {
            const r = await core.qpdf([...(pw ? [`--password=${pw}`] : []), '--decrypt', '/in.pdf', '/out.pdf'], { 'in.pdf': bytes });
            const out = r.read('out.pdf');
            if (/invalid password/i.test(r.log) || !out || !(r.code === 0 || r.code === 3)) throw new Error(/invalid password/i.test(r.log) ? 'Wrong password. Please try again.' : r.log || 'qpdf error');
            showResult($('#pOut', area), [{ name: `${baseName(file.name)}-unlocked.pdf`, blob: pdfBlob(out) }], { note: 'password removed' });
          } catch (e) { handleErr(e, 'Unlock failed'); } finally { busy(btn, false); }
        };
        $('#uBtn', body).onclick = go; $('#uPw', body)?.addEventListener('keydown', (e) => e.key === 'Enter' && go()); $('#uPw', body)?.focus();
      }
    } catch (e) { handleErr(e); }
  }
}

/* ============================ VIEWER ============================ */
export function viewer(panel) {
  panel.innerHTML = '';
  const zone = intake(panel, { id: 'drop', title: 'Drop a PDF to view it', sub: 'Opens instantly in your browser. Password-protected files are supported.', onFiles: (f) => load(f[0]) });
  const area = document.createElement('div'); panel.appendChild(area);
  async function load(file, pw) {
    let js;
    try { js = await openJs(await readBytes(file), pw); }
    catch (e) {
      if (e?.name === 'PasswordException') {
        area.innerHTML = `<form class="opts" id="vpw" style="margin-top:1rem"><label class="field"><span>${pw ? 'Wrong password, try again' : 'This PDF needs a password'}</span><input type="password" id="vp" autocomplete="current-password"></label><div class="field nogrow"><span>&nbsp;</span><button class="btn btn-primary" type="submit">Open</button></div></form>`;
        $('#vpw', area).onsubmit = (ev) => { ev.preventDefault(); load(file, $('#vp', area).value); }; $('#vp', area).focus(); return;
      }
      return handleErr(e);
    }
    zone.classList.add('hidden'); const n = js.numPages; let zoom = 1;
    area.innerHTML = fileChip(file, `${n} pages`) + `<div class="toolbar viewer-bar" role="toolbar" aria-label="Viewer controls">
      <button class="btn btn-sm" type="button" data-z="out" aria-label="Zoom out">−</button><output id="zv" class="small" style="min-width:3.5em;text-align:center">100%</output><button class="btn btn-sm" type="button" data-z="in" aria-label="Zoom in">+</button>
      <button class="btn btn-sm" type="button" data-z="fit">Fit width</button><span class="sep"></span>
      <label class="small" style="display:flex;gap:.4rem;align-items:center">Page <input type="number" id="vpg" min="1" max="${n}" value="1" style="width:5em"> of ${n}</label></div>
      <div class="viewer" id="vwr" tabindex="0" aria-label="Document pages"></div>`;
    $('[data-act=change]', area).onclick = () => { zone.classList.remove('hidden'); area.innerHTML = ''; js.destroy(); $('input', zone).click(); };
    const vwr = $('#vwr', area);
    const sizes = []; for (let i = 1; i <= Math.min(n, 3000); i++) { if (i <= 1 || i % 1 === 0) { const p = await js.getPage(i); const vp = p.getViewport({ scale: 1 }); sizes.push([vp.width, vp.height]); } }
    const layout = () => {
      const base = Math.min(vwr.clientWidth - 24, 900);
      vwr.innerHTML = sizes.map(([w, h], i) => { const W = base * zoom, H = (W * h) / w; return `<div class="vpage" data-n="${i + 1}" style="width:${W}px;height:${H}px" aria-label="Page ${i + 1}"></div>`; }).join('');
      const io = new IntersectionObserver((ents) => ents.forEach(async (en) => {
        const el = en.target; if (!en.isIntersecting || el._r) return; el._r = 1;
        try { const c = await renderPage(js, +el.dataset.n, { width: el.clientWidth * Math.min(2, devicePixelRatio || 1) }); c.style.width = '100%'; c.style.height = '100%'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Page ${el.dataset.n}`); el.appendChild(c); } catch (er) { console.warn(er); }
      }), { root: vwr, rootMargin: '600px' });
      $$('.vpage', vwr).forEach((e) => io.observe(e));
      $('#zv', area).textContent = Math.round(zoom * 100) + '%';
    };
    layout();
    $('.viewer-bar', area).addEventListener('click', (e) => { const z = e.target.closest('[data-z]')?.dataset.z; if (!z) return; const cur = curPage(); zoom = z === 'in' ? Math.min(4, zoom * 1.25) : z === 'out' ? Math.max(0.25, zoom / 1.25) : 1; layout(); goto(cur); });
    const curPage = () => { const top = vwr.scrollTop; const el = $$('.vpage', vwr).find((e) => e.offsetTop + e.offsetHeight > top + 10); return el ? +el.dataset.n : 1; };
    const goto = (p) => { const el = $(`.vpage[data-n="${p}"]`, vwr); if (el) vwr.scrollTop = el.offsetTop - 8; };
    $('#vpg', area).addEventListener('change', (e) => goto(Math.max(1, Math.min(n, +e.target.value || 1))));
    vwr.addEventListener('scroll', () => { $('#vpg', area).value = curPage(); }, { passive: true });
    vwr.focus();
  }
}

/* ============================ FILL & SIGN ============================ */
let savedSig = null; // memory only
export function sign(panel) {
  singlePdf(panel, {
    title: 'Drop the PDF you need to fill or sign',
    async onLoad(ctx) {
      const js = await openJs(ctx.bytes); const n = js.numPages; ctx.setChip(`${n} pages`);
      const items = []; let cur = 1, selId = null, pageSize = [1, 1];
      ctx.body.innerHTML = `<div class="toolbar" role="toolbar" aria-label="Add to page">
          <button class="btn btn-sm btn-primary" type="button" id="addSig" data-testid="add-signature">${icon('pen')}Signature</button>
          <button class="btn btn-sm" type="button" id="addText">${icon('type')}Text</button>
          <button class="btn btn-sm" type="button" id="addDate">Date</button>
          <button class="btn btn-sm" type="button" id="addCheck">${icon('check')}Checkmark</button>
          <span class="sep"></span>
          <label class="small" style="display:flex;gap:.35rem;align-items:center">Size <input type="number" id="tSize" min="6" max="72" value="14" style="width:4.2em"></label>
          <input type="color" id="tColor" value="#111111" aria-label="Text color">
          <span class="sep"></span>
          <button class="btn btn-sm btn-ghost" type="button" id="pPrev" aria-label="Previous page">${icon('left')}</button><span class="small" id="pLbl">1 / ${n}</span><button class="btn btn-sm btn-ghost" type="button" id="pNext" aria-label="Next page">${icon('right')}</button>
        </div>
        <p class="small muted" style="margin:.6rem 0">Click a button to add an item, then drag it into place. Double-click text to edit it. Arrow keys nudge, Delete removes.</p>
        <div class="sign-wrap"><div class="sign-stage" id="stage"><canvas id="sCanvas" aria-label="Page preview"></canvas><div class="sign-layer" id="layer"></div></div></div>
        <div class="actions-bar"><button class="btn btn-primary btn-lg" type="button" id="sSave" data-testid="run">${icon('download')}Save signed PDF</button><span class="small muted" id="sInfo"></span></div><div id="sOut"></div>`;
      const b = ctx.body, stage = $('#stage', b), layer = $('#layer', b);
      async function showPage() {
        const c = await renderPage(js, cur, { width: Math.min(stage.parentElement.clientWidth, 900) * Math.min(2, devicePixelRatio || 1) });
        const page = await js.getPage(cur); const vp = page.getViewport({ scale: 1 }); pageSize = [vp.width, vp.height];
        const canvas = $('#sCanvas', b); canvas.width = c.width; canvas.height = c.height; canvas.getContext('2d').drawImage(c, 0, 0);
        stage.style.aspectRatio = `${vp.width} / ${vp.height}`;
        $('#pLbl', b).textContent = `${cur} / ${n}`; $('#pPrev', b).disabled = cur === 1; $('#pNext', b).disabled = cur === n;
        drawItems();
      }
      const ptScale = () => stage.clientWidth / pageSize[0]; // CSS px per pt
      function drawItems() {
        layer.innerHTML = '';
        items.filter((it) => it.page === cur).forEach((it) => {
          const el = document.createElement('div'); el.className = 'sign-item' + (it.id === selId ? ' sel' : ''); el.dataset.id = it.id; el.tabIndex = 0;
          el.style.left = it.x * 100 + '%'; el.style.top = it.y * 100 + '%';
          if (it.type === 'img') { el.style.width = it.w * 100 + '%'; el.innerHTML = `<img src="${it.src}" alt="Signature" draggable="false"><span class="rs" aria-hidden="true"></span>`; el.setAttribute('aria-label', 'Signature, use arrow keys to move'); }
          else { el.innerHTML = `<div class="txt" spellcheck="false">${esc(it.text)}</div>`; const t = $('.txt', el); t.style.fontSize = it.size * ptScale() + 'px'; t.style.color = it.color; t.style.fontFamily = it.type === 'check' ? 'inherit' : 'Helvetica, Arial, sans-serif'; el.setAttribute('aria-label', `${it.type === 'check' ? 'Checkmark' : 'Text: ' + it.text}, use arrow keys to move`); }
          el.insertAdjacentHTML('beforeend', `<button class="x" type="button" aria-label="Remove item">${icon('x')}</button>`);
          layer.appendChild(el);
        });
        $('#sInfo', b).textContent = items.length ? `${items.length} item${items.length > 1 ? 's' : ''} on ${new Set(items.map((i) => i.page)).size} page(s)` : '';
      }
      const add = (it) => { it.id = nextId('s'); it.page = cur; items.push(it); selId = it.id; drawItems(); const el = $(`[data-id="${it.id}"]`, layer); el && el.focus(); return el; };
      const color = () => $('#tColor', b).value, size = () => Math.max(6, Math.min(72, +$('#tSize', b).value || 14));
      $('#addText', b).onclick = () => { const el = add({ type: 'text', text: 'Type here', x: 0.1, y: 0.1, size: size(), color: color() }); el && startEdit(el); };
      $('#addDate', b).onclick = () => add({ type: 'text', text: new Date().toLocaleDateString(), x: 0.1, y: 0.15, size: size(), color: color() });
      $('#addCheck', b).onclick = () => add({ type: 'check', text: '\u2714', x: 0.1, y: 0.2, size: size(), color: color() });
      $('#addSig', b).onclick = () => sigModal((src, w, h) => { const fw = 0.3; add({ type: 'img', src, ar: h / w, x: 0.55, y: 0.75, w: fw }); });
      $('#pPrev', b).onclick = () => { if (cur > 1) { cur--; showPage(); } };
      $('#pNext', b).onclick = () => { if (cur < n) { cur++; showPage(); } };
      function startEdit(el) {
        const it = items.find((i) => i.id === el.dataset.id); if (!it || it.type !== 'text') return;
        const t = $('.txt', el); t.contentEditable = 'true'; t.focus(); document.getSelection().selectAllChildren(t);
        const done = () => { t.contentEditable = 'false'; it.text = t.innerText.replace(/\n$/, '') || ' '; t.removeEventListener('blur', done); };
        t.addEventListener('blur', done);
      }
      layer.addEventListener('dblclick', (e) => { const el = e.target.closest('.sign-item'); if (el) startEdit(el); });
      layer.addEventListener('click', (e) => { const x = e.target.closest('.x'); if (x) { const id = x.closest('.sign-item').dataset.id; items.splice(items.findIndex((i) => i.id === id), 1); drawItems(); } });
      layer.addEventListener('keydown', (e) => {
        const el = e.target.closest('.sign-item'); if (!el || e.target.isContentEditable) return; const it = items.find((i) => i.id === el.dataset.id);
        const st = e.shiftKey ? 0.02 : 0.004;
        if (e.key === 'Delete' || e.key === 'Backspace') { items.splice(items.indexOf(it), 1); drawItems(); e.preventDefault(); return; }
        if (e.key === 'Enter' && it.type === 'text') { startEdit(el); e.preventDefault(); return; }
        const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key]; if (!d) return;
        e.preventDefault(); it.x = clamp(it.x + d[0]); it.y = clamp(it.y + d[1]); el.style.left = it.x * 100 + '%'; el.style.top = it.y * 100 + '%';
      });
      const clamp = (v) => Math.max(0, Math.min(0.98, v));
      layer.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('.sign-item'); if (!el || e.target.closest('.x') || e.target.isContentEditable) return;
        const it = items.find((i) => i.id === el.dataset.id); selId = it.id; $$('.sign-item', layer).forEach((x) => x.classList.toggle('sel', x === el));
        const resize = e.target.classList.contains('rs'); const r = stage.getBoundingClientRect(); const sx = e.clientX, sy = e.clientY, ox = it.x, oy = it.y, ow = it.w;
        el.setPointerCapture(e.pointerId); e.preventDefault(); el.focus();
        const mv = (ev) => { const dx = (ev.clientX - sx) / r.width, dy = (ev.clientY - sy) / r.height; if (resize) { it.w = Math.max(0.04, Math.min(1, ow + dx)); el.style.width = it.w * 100 + '%'; } else { it.x = clamp(ox + dx); it.y = clamp(oy + dy); el.style.left = it.x * 100 + '%'; el.style.top = it.y * 100 + '%'; } };
        const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); };
        el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
      });
      new ResizeObserver(() => drawItems()).observe(stage);
      $('#sSave', b).onclick = async () => {
        if (!items.length) return toast('Add a signature or text first.', 'warn');
        const btn = $('#sSave', b); busy(btn, true, 'Saving…');
        try {
          const { StandardFonts } = await core.PDFLib(); const doc = await loadLib(ctx.bytes, { ignoreEncryption: true });
          const helv = await doc.embedFont(StandardFonts.Helvetica); const zapf = await doc.embedFont(StandardFonts.ZapfDingbats);
          const pages = doc.getPages(); let warned = false;
          for (const it of items) {
            const pg = pages[it.page - 1]; const f = pageFrame(pg);
            const vx = it.x * f.vw, top = f.vh - it.y * f.vh;
            if (it.type === 'img') {
              const png = await doc.embedPng(it.src); const w = it.w * f.vw, h = w * it.ar;
              drawImageVisual(pg, png, { vx, vy: top - h, width: w, height: h });
            } else if (it.type === 'check') {
              drawTextVisual(pg, '\u2714', { vx, vy: top - it.size * 0.85, size: it.size, font: zapf, color: hexToRgb(it.color) });
            } else {
              it.text.split('\n').forEach((line, k) => {
                const [t, rep] = winAnsiSafe(helv, line); if (rep && !warned) { warned = true; toast('Some characters aren\u2019t supported by standard PDF fonts and were replaced.', 'warn'); }
                drawTextVisual(pg, t, { vx, vy: top - it.size * (0.947 + 1.2 * k), size: it.size, font: helv, color: hexToRgb(it.color) });
              });
            }
          }
          showResult($('#sOut', b), [{ name: `${baseName(ctx.file.name)}-signed.pdf`, blob: pdfBlob(await doc.save({ useObjectStreams: true })) }]);
        } catch (e) { handleErr(e, 'Save failed'); } finally { busy(btn, false); }
      };
      await showPage();
    },
  });
}

function trimCanvas(c) {
  const x = c.getContext('2d'), { width: W, height: H } = c, d = x.getImageData(0, 0, W, H).data;
  let t = H, l = W, r = -1, btm = -1;
  for (let y = 0; y < H; y++) for (let i = 0; i < W; i++) if (d[(y * W + i) * 4 + 3] > 8) { if (y < t) t = y; if (y > btm) btm = y; if (i < l) l = i; if (i > r) r = i; }
  if (r < 0) return null;
  const o = document.createElement('canvas'); o.width = r - l + 9; o.height = btm - t + 9; o.getContext('2d').drawImage(c, l - 4, t - 4, o.width, o.height, 0, 0, o.width, o.height); return o;
}
function sigModal(onDone) {
  const body = document.createElement('div');
  body.innerHTML = `${seg('sigtab', [['draw', 'Draw'], ['type', 'Type'], ['upload', 'Upload']], 'draw')}
    <div class="sig-pane" data-p="draw" style="margin-top:1rem"><canvas class="sig-pad" id="pad" width="900" height="300" aria-label="Signature drawing area. Draw with mouse, finger or pen."></canvas>
      <div class="row" style="margin-top:.6rem"><input type="color" id="penC" value="#1a2b6d" aria-label="Pen color"><label class="small" style="display:flex;gap:.4rem;align-items:center">Thickness <input type="range" id="penW" min="1" max="8" value="3"></label><button class="btn btn-sm" type="button" id="clr">Clear</button></div></div>
    <div class="sig-pane hidden" data-p="type" style="margin-top:1rem"><label class="field"><span>Your name</span><input type="text" id="sigName" value="" placeholder="Jane Doe" autocomplete="name"></label>
      <div class="sig-fonts" role="radiogroup" aria-label="Style">${['"Segoe Script","Brush Script MT","Snell Roundhand",cursive', '"Lucida Handwriting","Apple Chancery",cursive', 'Georgia,"Times New Roman",serif', '"Comic Sans MS","Chalkboard SE",cursive'].map((f, i) => `<label><input type="radio" name="sigfont" value='${f}' ${i === 0 ? 'checked' : ''}><span style='font-family:${f}'>Signature</span></label>`).join('')}</div></div>
    <div class="sig-pane hidden" data-p="upload" style="margin-top:1rem"><label class="btn" style="position:relative">${icon('upload')}Choose an image of your signature<input type="file" accept="image/*" id="sigUp" style="position:absolute;inset:0;opacity:0;cursor:pointer" aria-label="Upload signature image"></label>
      <label class="switch" style="margin-top:.6rem"><input type="checkbox" id="rmWhite" checked> Remove white background</label><div id="upPrev" class="sig-prev"></div></div>
    <p class="small muted" style="margin-top:.8rem">Your signature stays in this tab\u2019s memory only. It\u2019s never stored or uploaded.</p>`;
  openModal({ title: 'Create your signature', body, foot: `${savedSig ? '<button class="btn" type="button" id="useLast">Use previous</button>' : ''}<button class="btn" type="button" data-close>Cancel</button><button class="btn btn-primary" type="button" id="sigOk" data-testid="sig-ok">Add signature</button>` });
  const foot = $('#modal');
  const pad = $('#pad', body), px = pad.getContext('2d'); let drawn = false, upImg = null;
  body.addEventListener('change', (e) => { if (e.target.name === 'sigtab') $$('.sig-pane', body).forEach((p) => p.classList.toggle('hidden', p.dataset.p !== e.target.value)); });
  let last = null;
  pad.addEventListener('pointerdown', (e) => { pad.setPointerCapture(e.pointerId); const r = pad.getBoundingClientRect(); last = [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height]; });
  pad.addEventListener('pointermove', (e) => {
    if (!last) return; const r = pad.getBoundingClientRect(); const p = [(e.clientX - r.left) * pad.width / r.width, (e.clientY - r.top) * pad.height / r.height];
    px.strokeStyle = $('#penC', body).value; px.lineWidth = +$('#penW', body).value * 2 * (e.pressure && e.pointerType === 'pen' ? 0.5 + e.pressure : 1); px.lineCap = px.lineJoin = 'round';
    px.beginPath(); px.moveTo(...last); px.lineTo(...p); px.stroke(); last = p; drawn = true;
  });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach((ev) => pad.addEventListener(ev, () => (last = null)));
  $('#clr', body).onclick = () => { px.clearRect(0, 0, pad.width, pad.height); drawn = false; };
  $('#sigUp', body).onchange = async (e) => { const f = e.target.files[0]; if (!f) return; const bm = await createImageBitmap(f); upImg = bm; $('#upPrev', body).textContent = f.name; };
  const finish = (c) => { const t = trimCanvas(c); if (!t) return toast('Your signature is empty.', 'warn'); savedSig = { src: t.toDataURL('image/png'), w: t.width, h: t.height }; closeModal(); onDone(savedSig.src, savedSig.w, savedSig.h); };
  $('#sigOk', foot).onclick = () => {
    const tab = segVal(body, 'sigtab');
    if (tab === 'draw') { if (!drawn) return toast('Draw your signature first.', 'warn'); return finish(pad); }
    if (tab === 'type') {
      const name = $('#sigName', body).value.trim(); if (!name) return toast('Type your name first.', 'warn');
      const c = document.createElement('canvas'); c.width = 1200; c.height = 300; const x = c.getContext('2d');
      x.font = `120px ${$('input[name=sigfont]:checked', body).value}`; x.fillStyle = $('#penC', body).value; x.textBaseline = 'middle'; x.fillText(name, 20, 150, 1160); return finish(c);
    }
    if (!upImg) return toast('Choose an image first.', 'warn');
    const s = Math.min(1, 1200 / upImg.width); const c = document.createElement('canvas'); c.width = Math.round(upImg.width * s); c.height = Math.round(upImg.height * s);
    const x = c.getContext('2d'); x.drawImage(upImg, 0, 0, c.width, c.height);
    if ($('#rmWhite', body).checked) { const d = x.getImageData(0, 0, c.width, c.height); const a = d.data; for (let i = 0; i < a.length; i += 4) { const l = (a[i] + a[i + 1] + a[i + 2]) / 3; if (l > 200) a[i + 3] = Math.max(0, Math.round((255 - l) * 4.6)); } x.putImageData(d, 0, 0); }
    finish(c);
  };
  const ul = $('#useLast', foot); if (ul) ul.onclick = () => { closeModal(); onDone(savedSig.src, savedSig.w, savedSig.h); };
}
