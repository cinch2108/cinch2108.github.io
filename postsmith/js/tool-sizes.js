// Social media image size guide with client-side blank template downloads
import { $, $$, esc, icon, copyText, ls, downloadBlob, makeZip, toast, debounce } from './ui.js';
import { SIZES, ALL, ratio, UPDATED } from './sizes-data.js';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function templateCanvas(it, o) {
  const c = document.createElement('canvas'); c.width = it.w; c.height = it.h; const x = c.getContext('2d');
  const W = it.w, H = it.h, u = Math.max(1, Math.min(W, H) / 400);
  if (o.bg !== 'transparent') { x.fillStyle = o.bg === 'white' ? '#ffffff' : o.bg === 'black' ? '#000000' : o.color; x.fillRect(0, 0, W, H); }
  const dark = o.bg === 'black' || (o.bg === 'custom' && lum(o.color) < 0.45);
  const line = dark ? 'rgba(255,255,255,.55)' : 'rgba(17,24,39,.45)';
  if (o.guides) {
    x.save(); x.strokeStyle = dark ? 'rgba(255,255,255,.14)' : 'rgba(17,24,39,.12)'; x.lineWidth = u; x.beginPath();
    [1, 2].forEach((k) => { x.moveTo((W * k) / 3, 0); x.lineTo((W * k) / 3, H); x.moveTo(0, (H * k) / 3); x.lineTo(W, (H * k) / 3); }); x.stroke(); x.restore();
    x.save(); x.fillStyle = 'rgba(236,72,153,.16)'; x.strokeStyle = '#ec4899'; x.lineWidth = 2 * u; x.setLineDash([8 * u, 6 * u]);
    if (it.safe) { const s = it.safe; x.fillRect(0, 0, W, s.t); x.fillRect(0, H - s.b, W, s.b); x.fillRect(0, s.t, s.l, H - s.t - s.b); x.fillRect(W - s.r, s.t, s.r, H - s.t - s.b); x.strokeRect(s.l, s.t, W - s.l - s.r, H - s.t - s.b); }
    if (it.center) { const [cw, ch] = it.center; const l = (W - cw) / 2, t = (H - ch) / 2; x.fillRect(0, 0, W, t); x.fillRect(0, t + ch, W, H - t - ch); x.fillRect(0, t, l, ch); x.fillRect(l + cw, t, W - l - cw, ch); x.strokeRect(l, t, cw, ch); }
    if (it.circle) { x.beginPath(); x.rect(0, 0, W, H); x.arc(W / 2, H / 2, Math.min(W, H) / 2, 0, Math.PI * 2, true); x.fill('evenodd'); x.beginPath(); x.arc(W / 2, H / 2, Math.min(W, H) / 2 - u, 0, Math.PI * 2); x.stroke(); }
    x.restore();
  }
  if (o.label) {
    const fs = Math.max(11, Math.round(Math.min(W / 22, H / 9)));
    x.fillStyle = line; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    x.fillText(`${it.w} × ${it.h}`, W / 2, H / 2 - fs * 0.6, W * 0.9);
    x.font = `400 ${Math.round(fs * 0.5)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    x.fillText(`${it.platform ? it.platform + ' · ' : ''}${it.name} · ${ratio(it.w, it.h)}`, W / 2, H / 2 + fs * 0.45, W * 0.9);
  }
  return c;
}
function lum(hex) { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return 1; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
const toBlob = (c) => new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Canvas export failed'))), 'image/png'));

export function mount(panel) {
  const saved = ls.get('ps-sz', {}) || {};
  const o = { bg: ['transparent', 'white', 'black', 'custom'].includes(saved.bg) ? saved.bg : 'white', color: /^#[0-9a-f]{6}$/i.test(saved.color || '') ? saved.color : '#f5f3ff', guides: saved.guides !== false, label: saved.label !== false };
  let plat = '';
  panel.innerHTML = `
  <div class="stack">
    <div class="toolbar">
      <div class="search-wrap grow">${icon('search')}<input type="search" id="szQ" placeholder="Search sizes: story, banner, 1080, thumbnail" aria-label="Search sizes" data-testid="sz-search"></div>
    </div>
    <div class="chips" id="szPlat" role="group" aria-label="Platform"><button type="button" class="chip" aria-pressed="true" data-p="">All</button>${SIZES.map((p) => `<button type="button" class="chip" aria-pressed="false" data-p="${p.id}">${esc(p.name)}</button>`).join('')}</div>
    <details class="card sz-opts" open><summary class="small-h">${icon('frame')}Template options</summary>
      <div class="row wrap nogrow" style="align-items:end">
        <label class="field"><span>Background</span><select id="szBg"><option value="white">White</option><option value="transparent">Transparent</option><option value="black">Black</option><option value="custom">Custom color</option></select></label>
        <label class="field" id="szColorF"><span>Color</span><input type="color" id="szColor"></label>
        <label class="switch-row"><input type="checkbox" class="switch" id="szGuides"> <span>Safe-zone guides</span></label>
        <label class="switch-row"><input type="checkbox" class="switch" id="szLabel"> <span>Size label</span></label>
      </div>
      <p class="tiny faint">Templates are blank PNGs drawn in your browser at the exact pixel size. Guides show areas that apps cover with buttons or crop away. Turn guides and labels off for a plain canvas.</p>
    </details>
    <div class="row nogrow wrap" id="szZipRow"></div>
    <div class="sz-grid" id="szGrid"></div>
    <section class="card" aria-labelledby="szCustH"><h2 class="small-h" id="szCustH">${icon('ruler')}Custom size</h2>
      <div class="row wrap nogrow" style="align-items:end">
        <label class="field"><span>Width (px)</span><input type="number" id="szW" min="16" max="8000" value="1080" inputmode="numeric"></label>
        <label class="field"><span>Height (px)</span><input type="number" id="szH" min="16" max="8000" value="1350" inputmode="numeric"></label>
        <label class="field grow"><span>Label</span><input type="text" id="szN" maxlength="60" value="Custom"></label>
        <button type="button" class="btn" id="szCust" data-testid="sz-custom">${icon('download')}Download PNG</button>
      </div><p class="tiny muted" id="szCustR"></p></section>
    <p class="tiny faint">Sizes reviewed ${esc(UPDATED)}. Platforms change specs without notice; check their help pages for anything critical.</p>
  </div>`;
  const q = $('#szQ', panel), grid = $('#szGrid', panel);
  $('#szBg', panel).value = o.bg; $('#szColor', panel).value = o.color; $('#szGuides', panel).checked = o.guides; $('#szLabel', panel).checked = o.label;
  const syncOpts = () => { $('#szColorF', panel).hidden = o.bg !== 'custom'; ls.set('ps-sz', o); };
  syncOpts();
  function overlay(it) {
    const pc = (v, t) => `${((v / t) * 100).toFixed(2)}%`;
    if (it.safe) { const s = it.safe; return `<i class="sz-safe" style="top:${pc(s.t, it.h)};bottom:${pc(s.b, it.h)};left:${pc(s.l, it.w)};right:${pc(s.r, it.w)}"></i>`; }
    if (it.center) { const [cw, ch] = it.center; return `<i class="sz-safe" style="top:${pc((it.h - ch) / 2, it.h)};bottom:${pc((it.h - ch) / 2, it.h)};left:${pc((it.w - cw) / 2, it.w)};right:${pc((it.w - cw) / 2, it.w)}"></i>`; }
    if (it.circle) return '<i class="sz-circle"></i>';
    return '';
  }
  function render() {
    const s = q.value.trim().toLowerCase();
    const items = ALL.filter((it) => (!plat || it.pid === plat) && (!s || ((hay) => s.split(/\s+/).every((w) => hay.includes(w)))(`${it.platform} ${it.name} ${it.w}x${it.h} ${it.w}×${it.h} ${it.w} ${it.h} ${ratio(it.w, it.h)} ${it.note}`.toLowerCase())));
    grid.innerHTML = items.map((it) => {
      const r = it.w / it.h, bw = r >= 1 ? 100 : Math.max(28, r * 100);
      return `<article class="sz-card" data-id="${it.id}"><div class="sz-viz"><div class="sz-box" style="width:${bw.toFixed(1)}%;aspect-ratio:${it.w}/${it.h}">${overlay(it)}<span>${ratio(it.w, it.h)}</span></div></div>
      <div class="sz-body"><p class="tiny muted">${esc(it.platform)}</p><h2 class="sz-name">${esc(it.name)}</h2><p class="sz-dim"><b>${it.w} × ${it.h}</b> px</p>${it.note ? `<p class="tiny muted">${esc(it.note)}</p>` : ''}
      <div class="row nogrow"><button type="button" class="btn btn-sm" data-dl data-testid="sz-dl-${it.id}">${icon('download')}Template</button><button type="button" class="btn btn-sm btn-ghost" data-cp aria-label="Copy size ${it.w} by ${it.h}">${icon('copy')}Copy size</button></div></div></article>`;
    }).join('') || '<p class="empty">No sizes match. Try “story”, “banner” or a number like 1080.</p>';
    const zp = plat ? SIZES.filter((p) => p.id === plat) : [];
    $('#szZipRow', panel).innerHTML = zp.map((p) => `<button type="button" class="btn btn-primary" data-zip="${p.id}" data-testid="sz-zip">${icon('download')}Download all ${esc(p.name)} templates (ZIP)</button>`).join('') || '<p class="tiny muted">Pick a platform to download all of its templates as one ZIP.</p>';
  }
  async function dl(it) {
    try { const b = await toBlob(templateCanvas(it, o)); downloadBlob(b, `${slug(it.platform || 'custom')}-${slug(it.name)}-${it.w}x${it.h}.png`); }
    catch (e) { toast('Couldn’t create that template: ' + e.message, 'err'); }
  }
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.sz-card'); if (!card) return; const it = ALL.find((x) => x.id === card.dataset.id);
    if (e.target.closest('[data-dl]')) dl(it);
    else if (e.target.closest('[data-cp]')) copyText(`${it.w} × ${it.h}`, `Copied ${it.w} × ${it.h}`);
  });
  $('#szZipRow', panel).addEventListener('click', async (e) => {
    const b = e.target.closest('[data-zip]'); if (!b) return; const p = SIZES.find((x) => x.id === b.dataset.zip);
    b.disabled = true;
    try {
      const files = []; for (const it of p.items) { const blob = await toBlob(templateCanvas({ ...it, platform: p.name }, o)); files.push({ name: `${slug(it.name)}-${it.w}x${it.h}.png`, data: new Uint8Array(await blob.arrayBuffer()) }); }
      downloadBlob(await makeZip(files), `postsmith-${p.id}-templates.zip`); toast(`Saved ${files.length} templates`, 'ok');
    } catch (err) { toast('ZIP failed: ' + err.message, 'err'); } finally { b.disabled = false; }
  });
  $('#szPlat', panel).addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (!b) return; plat = b.dataset.p; $$('#szPlat .chip', panel).forEach((x) => x.setAttribute('aria-pressed', x === b)); render(); });
  q.addEventListener('input', debounce(render, 100));
  $('#szBg', panel).addEventListener('change', (e) => { o.bg = e.target.value; syncOpts(); });
  $('#szColor', panel).addEventListener('input', (e) => { o.color = e.target.value; syncOpts(); });
  $('#szGuides', panel).addEventListener('change', (e) => { o.guides = e.target.checked; syncOpts(); });
  $('#szLabel', panel).addEventListener('change', (e) => { o.label = e.target.checked; syncOpts(); });
  const custR = () => { const w = +$('#szW', panel).value, h = +$('#szH', panel).value; $('#szCustR', panel).textContent = w > 0 && h > 0 ? `Aspect ratio ${ratio(Math.round(w), Math.round(h))}` : ''; };
  $('#szW', panel).addEventListener('input', custR); $('#szH', panel).addEventListener('input', custR); custR();
  $('#szCust', panel).addEventListener('click', () => {
    const w = Math.round(+$('#szW', panel).value), h = Math.round(+$('#szH', panel).value);
    if (!(w >= 16 && w <= 8000 && h >= 16 && h <= 8000)) return toast('Width and height must be 16 to 8000 px', 'err');
    dl({ w, h, name: $('#szN', panel).value.trim() || 'Custom', platform: '' });
  });
  render();
}
