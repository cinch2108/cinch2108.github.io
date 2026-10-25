// Emoji picker & copy tool
import { $, $$, esc, icon, copyText, ls, debounce, toast } from './ui.js';

const TONES = [['', '✋', 'Default'], ['🏻', '✋🏻', 'Light'], ['🏼', '✋🏼', 'Medium-light'], ['🏽', '✋🏽', 'Medium'], ['🏾', '✋🏾', 'Medium-dark'], ['🏿', '✋🏿', 'Dark']];
const MAX_RECENT = 36;

let canvasCtx = null, refW = 0;
function supported(ch) {
  try {
    if (!canvasCtx) {
      const c = document.createElement('canvas'); c.width = c.height = 40;
      canvasCtx = c.getContext('2d', { willReadFrequently: true });
      canvasCtx.font = '32px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; canvasCtx.textBaseline = 'top';
      refW = canvasCtx.measureText('😀').width || 32;
    }
    const x = canvasCtx; const w = x.measureText(ch).width;
    if (w > refW * 1.4) return false; // ZWJ sequence fell apart into several glyphs
    x.clearRect(0, 0, 40, 40); x.fillText(ch, 0, 0);
    const d = x.getImageData(0, 0, 40, 40).data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40 && (Math.abs(d[i] - d[i + 1]) > 18 || Math.abs(d[i + 1] - d[i + 2]) > 18)) return true;
    return false; // only monochrome pixels: tofu / missing glyph
  } catch { return true; }
}

export async function mount(panel) {
  panel.innerHTML = '<p class="muted" id="emLoading">Loading emoji…</p>';
  let data;
  try { data = await (await fetch(new URL('../data/emoji.json', import.meta.url))).json(); }
  catch { panel.innerHTML = '<p class="note err">Couldn’t load the emoji list. Check your connection and reload.</p>'; return; }
  const idle = () => new Promise((r) => setTimeout(r, 0));
  await idle(); // let the browser breathe between parsing the list and building the UI
  const E = data.e.map(([c, label, g, v, tags, sc, skins], i) => ({ i, c, label, g, v, tags, sc, skins, hay: `${label} ${tags} ${sc}`.toLowerCase() }));
  let tone = Number(ls.get('ps-em-tone', 0)) || 0; if (tone < 0 || tone > 5) tone = 0;
  let mode = ls.get('ps-em-mode', 'copy') === 'select' ? 'select' : 'copy';
  let recent = (ls.get('ps-em-recent', []) || []).filter((x) => typeof x === 'string').slice(0, MAX_RECENT);
  let showAll = false, sel = [], focusIdx = 0, current = null;
  const sup = new Map();
  const ok = (e) => { if (showAll || e.v < 12) return true; if (!sup.has(e.i)) sup.set(e.i, supported(e.c)); return sup.get(e.i); };
  const withTone = (e) => (tone && e.skins ? e.skins[tone - 1] : e.c);

  panel.innerHTML = `
  <div class="em-wrap">
    <div class="toolbar em-bar">
      <div class="search-wrap grow">${icon('search')}<input type="search" id="emQ" placeholder="Search ${E.length.toLocaleString()} emoji: heart, party, cat, :fire:" aria-label="Search emoji" autocomplete="off" data-testid="em-search"></div>
      <div class="seg" role="radiogroup" aria-label="Skin tone" id="emTone">${TONES.map(([, h, n], i) => `<button type="button" role="radio" aria-checked="${i === tone}" data-tone="${i}" title="${n} skin tone" aria-label="${n} skin tone">${h}</button>`).join('')}</div>
      <div class="seg" role="radiogroup" aria-label="Click action" id="emMode"><button type="button" role="radio" data-m="copy" aria-checked="${mode === 'copy'}">Copy instantly</button><button type="button" role="radio" data-m="select" aria-checked="${mode === 'select'}" data-testid="em-mode-select">Add to selection</button></div>
    </div>
    <nav class="em-cats" aria-label="Emoji categories" id="emCats"></nav>
    <div class="em-tray card" id="emTray" data-testid="em-tray">
      <output class="em-sel" id="emSel" aria-label="Selected emoji"></output>
      <div class="row nogrow"><button type="button" class="btn btn-sm btn-ghost" id="emBack" aria-label="Remove last">⌫</button><button type="button" class="btn btn-sm btn-ghost" id="emClr">Clear</button><button type="button" class="btn btn-sm btn-primary" id="emCopy" data-testid="em-copy-all">${icon('copy')}Copy all</button></div>
    </div>
    <div class="em-main">
      <div class="em-grid" id="emGrid" data-testid="em-grid"></div>
      <aside class="em-detail card" id="emDet" aria-live="polite"></aside>
    </div>
    <p class="tiny faint">${esc(data.v)} data from Emojibase (MIT). Tip: Shift-click adds to the selection in either mode. Newer emoji your device can’t draw are hidden. <button type="button" class="linkbtn" id="emAll">Show them anyway</button></p>
  </div>`;
  const grid = $('#emGrid', panel), q = $('#emQ', panel);
  $('#emCats', panel).innerHTML = [['recent', '🕘', 'Recently used'], ...data.groups.map((g, i) => [i, E.find((e) => e.g === i)?.c || '•', g])]
    .map(([id, c, n]) => `<button type="button" data-cat="${id}" title="${esc(n)}" aria-label="${esc(n)}">${c}</button>`).join('');

  function btn(e, k) { const ch = withTone(e); return `<button type="button" class="em" data-i="${e.i}" data-c="${esc(ch)}" tabindex="${k === 0 ? 0 : -1}" title="${esc(e.label)}" aria-label="${esc(e.label)}">${ch}</button>`; }
  let renderToken = 0, pending = null;
  function render() {
    const s = q.value.trim().toLowerCase().replace(/^:|:$/g, '');
    let k = 0; let html = '';
    if (s) {
      const words = s.split(/\s+/);
      const hits = E.filter((e) => ok(e) && words.every((w) => e.hay.includes(w) || e.c === w))
        .sort((a, b) => (b.label.startsWith(s) - a.label.startsWith(s)) || (b.label === s) - (a.label === s));
      html = `<section><h2 class="em-h">${hits.length} result${hits.length === 1 ? '' : 's'}</h2><div class="em-row">${hits.map((e) => btn(e, k++)).join('')}</div></section>`;
      if (!hits.length) html += `<p class="empty">No emoji match “${esc(q.value)}”.</p>`;
    } else {
      const rec = recent.map((c) => E.find((e) => e.c === c || (e.skins && e.skins.includes(c)))).filter(Boolean);
      if (rec.length) html += `<section id="em-cat-recent"><h2 class="em-h">Recently used</h2><div class="em-row">${rec.map((e) => btn(e, k++)).join('')}</div></section>`;
      // Render a first screenful now and the rest in small chunks so slow phones stay responsive.
      const token = ++renderToken; let gi = 0, at = 0, items = null, row = null;
      const chunk = (n) => {
        while (n > 0 && gi < data.groups.length) {
          if (!items) { items = E.filter((e) => e.g === gi && ok(e)); at = 0; grid.insertAdjacentHTML('beforeend', `<section id="em-cat-${gi}" class="em-sec"><h2 class="em-h">${esc(data.groups[gi])}</h2><div class="em-row"></div></section>`); row = grid.lastElementChild.lastElementChild; }
          const part = items.slice(at, at + n); row.insertAdjacentHTML('beforeend', part.map((e) => btn(e, k++)).join('')); at += part.length; n -= part.length;
          if (at >= items.length) { items = null; gi++; }
        }
        return gi < data.groups.length;
      };
      grid.innerHTML = html; focusIdx = 0; chunk(40);
      pending = () => { if (token === renderToken) chunk(Infinity); pending = null; };
      const step = () => { if (token !== renderToken) return; if (chunk(90)) setTimeout(step, 0); else pending = null; };
      setTimeout(step, 0);
      return;
    }
    renderToken++; pending = null;
    grid.innerHTML = html; focusIdx = 0;
  }
  function detail(e) {
    current = e; const d = $('#emDet', panel);
    if (!e) { d.innerHTML = '<p class="muted small">Hover or focus an emoji to see its name, shortcode and skin tones.</p>'; return; }
    const ch = withTone(e);
    d.innerHTML = `<div class="em-big" aria-hidden="true">${ch}</div><p class="em-name">${esc(e.label)}</p>
      ${e.sc ? `<p class="tiny muted">${e.sc.split(' ').map((x) => `<code>:${esc(x)}:</code>`).join(' ')}</p>` : ''}
      <p class="tiny faint">Emoji ${esc(String(e.v))} · U+${[...ch].map((x) => x.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' U+')}</p>
      ${e.skins ? `<div class="em-tones">${[e.c, ...e.skins].map((c, i) => `<button type="button" class="em" data-c="${esc(c)}" data-i="${e.i}" tabindex="-1" aria-label="${esc(e.label)}, ${TONES[i][2].toLowerCase()} skin tone">${c}</button>`).join('')}</div>` : ''}
      <div class="row nogrow"><button type="button" class="btn btn-sm" data-copy="${esc(ch)}">${icon('copy')}Copy</button><button type="button" class="btn btn-sm btn-ghost" data-add="${esc(ch)}">+ Add</button></div>`;
  }
  function addRecent(c) { recent = [c, ...recent.filter((x) => x !== c)].slice(0, MAX_RECENT); ls.set('ps-em-recent', recent); }
  function tray() { $('#emSel', panel).textContent = sel.join(''); $('#emTray', panel).classList.toggle('has', sel.length > 0); $('#emCopy', panel).disabled = !sel.length; }
  function pick(c, add) {
    addRecent(c);
    if (add || mode === 'select') { sel.push(c); tray(); } else copyText(c, `Copied ${c}`);
  }
  const onClick = (ev) => {
    const b = ev.target.closest('button.em'); if (!b) return;
    pick(b.dataset.c, ev.shiftKey);
  };
  grid.addEventListener('click', onClick);
  $('#emDet', panel).addEventListener('click', (ev) => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.classList.contains('em')) return pick(b.dataset.c, ev.shiftKey);
    if (b.dataset.copy) { addRecent(b.dataset.copy); copyText(b.dataset.copy, `Copied ${b.dataset.copy}`); }
    if (b.dataset.add) { addRecent(b.dataset.add); sel.push(b.dataset.add); tray(); }
  });
  const show = (ev) => { const b = ev.target.closest('button.em'); if (b && E[b.dataset.i] !== current) detail(E[b.dataset.i]); };
  grid.addEventListener('mouseover', show); grid.addEventListener('focusin', show);
  grid.addEventListener('keydown', (ev) => {
    const all = $$('button.em', grid); const cur = all.indexOf(document.activeElement); if (cur < 0) return;
    const cols = Math.max(1, Math.round(grid.clientWidth / (all[0].offsetWidth + 2)));
    const map = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols, Home: -cur, End: all.length - 1 - cur };
    if (!(ev.key in map)) return;
    ev.preventDefault(); const n = Math.max(0, Math.min(all.length - 1, cur + map[ev.key]));
    all[cur].tabIndex = -1; all[n].tabIndex = 0; all[n].focus(); focusIdx = n;
  });
  q.addEventListener('input', debounce(render, 120));
  $('#emTone', panel).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tone]'); if (!b) return; tone = Number(b.dataset.tone); ls.set('ps-em-tone', tone);
    $$('#emTone button', panel).forEach((x) => x.setAttribute('aria-checked', x === b)); render(); if (current) detail(current);
  });
  $('#emMode', panel).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-m]'); if (!b) return; mode = b.dataset.m; ls.set('ps-em-mode', mode);
    $$('#emMode button', panel).forEach((x) => x.setAttribute('aria-checked', x === b));
  });
  $('#emCats', panel).addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-cat]'); if (!b) return;
    if (q.value) { q.value = ''; render(); }
    if (pending) pending();
    const s = $(`#em-cat-${b.dataset.cat}`, grid);
    if (s) grid.scrollTo({ top: s.offsetTop, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    else if (b.dataset.cat === 'recent') toast('No recently used emoji yet');
  });
  $('#emCopy', panel).addEventListener('click', () => sel.length && copyText(sel.join(''), `Copied ${sel.length} emoji`));
  $('#emClr', panel).addEventListener('click', () => { sel = []; tray(); });
  $('#emBack', panel).addEventListener('click', () => { sel.pop(); tray(); });
  $('#emAll', panel).addEventListener('click', (ev) => { showAll = !showAll; ev.target.textContent = showAll ? 'Hide unsupported ones' : 'Show them anyway'; render(); });
  detail(null); tray(); await idle(); render();
}
