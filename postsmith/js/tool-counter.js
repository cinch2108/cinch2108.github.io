// Social media character counter with per-platform limits and truncation preview
import { $, $$, esc, icon, copyText, ls, debounce, fmt } from './ui.js';
import { measure, cutIndex, stats } from './count.js';
import { PLATFORMS, METHOD_NOTE } from './limits.js';

const GROUPS = [...new Set(PLATFORMS.map((p) => p.group))];
const dur = (s) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

export function mount(panel) {
  let on = new Set(ls.get('ps-ct-groups', GROUPS).filter((g) => GROUPS.includes(g)));
  if (!on.size) on = new Set(GROUPS);
  panel.innerHTML = `
  <div class="stack">
    <label class="field"><span>Your post</span>
      <textarea id="ctIn" rows="7" placeholder="Write or paste your post, caption, bio or title. Everything is counted live in your browser." data-testid="ct-input"></textarea></label>
    <div class="statbar" id="ctStats" aria-live="polite"></div>
    <div class="row nogrow wrap">
      <button class="btn btn-sm" type="button" id="ctCopy">${icon('copy')}Copy text</button>
      <button class="btn btn-sm btn-ghost" type="button" id="ctClear">${icon('trash')}Clear</button>
    </div>
    <fieldset class="chipset"><legend class="small-h">Platforms</legend>${GROUPS.map((g) => `<label class="chk"><input type="checkbox" value="${esc(g)}"${on.has(g) ? ' checked' : ''}><span>${esc(g)}</span></label>`).join('')}</fieldset>
    <div class="ct-grid" id="ctGrid"></div>
    <section class="card ct-prev" aria-labelledby="ctPrevH">
      <div class="row nogrow wrap" style="align-items:end;justify-content:space-between">
        <h2 id="ctPrevH" class="small-h">${icon('eye')}Truncation preview</h2>
        <label class="field" style="min-width:min(260px,100%)"><span>Platform</span><select id="ctSel">${PLATFORMS.map((p) => `<option value="${p.id}">${esc(p.name)} (${fmt(p.limit)})</option>`).join('')}</select></label>
      </div>
      <div class="prev-box" id="ctPrev" data-testid="ct-preview"></div>
      <p class="tiny muted" id="ctPrevNote"></p>
      <div class="legend tiny"><span><i class="lg vis"></i>Visible in the feed</span><span><i class="lg fold"></i>Hidden behind “…more”</span><span><i class="lg over"></i>Over the limit (won’t post)</span></div>
      <button class="btn btn-sm" type="button" id="ctFit" data-testid="ct-fit">${icon('copy')}Copy text trimmed to fit</button>
    </section>
  </div>`;
  const inp = $('#ctIn', panel), grid = $('#ctGrid', panel), sel = $('#ctSel', panel);
  inp.value = ls.get('ps-ct-text', '') || '';
  sel.value = ls.get('ps-ct-sel', 'x') || 'x'; if (!sel.value) sel.value = 'x';

  function render() {
    const t = inp.value; const st = stats(t);
    $('#ctStats', panel).innerHTML = [
      ['Characters', st.chars], ['Words', st.words], ['No spaces', st.charsNoSpaces], ['Lines', st.lines], ['Emoji', st.emoji], ['Hashtags', st.hashtags], ['Mentions', st.mentions], ['Links', st.urls], ['UTF-8 bytes', st.bytes], ['Read time', dur(st.readSec)],
    ].map(([k, v]) => `<div><b data-testid="stat-${k.toLowerCase().replace(/[^a-z0-9]+/g, '-')}">${typeof v === 'number' ? fmt(v) : esc(v)}</b><span>${k}</span></div>`).join('');
    grid.innerHTML = PLATFORMS.filter((p) => on.has(p.group)).map((p) => {
      const n = measure(t, p.method), left = p.limit - n, pct = Math.min(100, (n / p.limit) * 100);
      const cls = left < 0 ? 'over' : pct >= 90 ? 'near' : '';
      const warn = [];
      if (p.maxTags && st.hashtags > p.maxTags) warn.push(`${st.hashtags} hashtags: max ${p.maxTags}`);
      if (p.noAngle && /[<>]/.test(t)) warn.push('“<” and “>” aren’t allowed');
      if (p.fold && n > p.fold) warn.push(`Cut off after ~${p.fold} in the feed`);
      return `<div class="ct-card ${cls}" data-p="${p.id}" data-testid="ct-${p.id}"><div class="ct-top"><span class="ct-name">${esc(p.name)}</span><span class="ct-num"><b>${fmt(n)}</b> / ${fmt(p.limit)}</span></div>
        <div class="bar" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>
        <div class="ct-foot"><span class="${left < 0 ? 'err-t' : ''}">${left < 0 ? `${fmt(-left)} over` : `${fmt(left)} left`}</span>${p.method !== 'graphemes' ? `<span class="tiny faint" title="${esc(METHOD_NOTE[p.method])}">${p.method === 'x' ? 'X weighting' : p.method === 'bsky' ? 'links shortened' : 'links = 23'}</span>` : ''}</div>
        ${warn.length ? `<div class="ct-warn">${warn.map(esc).join(' · ')}</div>` : ''}</div>`;
    }).join('') || '<p class="empty">Pick at least one platform.</p>';
    preview();
  }
  function preview() {
    const p = PLATFORMS.find((x) => x.id === sel.value) || PLATFORMS[0]; const t = p.method === 'x' ? inp.value.normalize('NFC') : inp.value;
    const cut = cutIndex(t, p.method, p.limit), fold = p.fold ? Math.min(cutIndex(t, p.method, p.fold), cut) : cut;
    const box = $('#ctPrev', panel);
    if (!t) box.innerHTML = '<span class="faint">Your text will appear here, split where the platform cuts it.</span>';
    else box.innerHTML = `<span class="vis">${esc(t.slice(0, fold))}</span>${fold < cut ? `<span class="fold-mark" aria-hidden="true">…more</span><span class="fold">${esc(t.slice(fold, cut))}</span>` : ''}${cut < t.length ? `<mark class="over" title="Over the limit">${esc(t.slice(cut))}</mark>` : ''}`;
    $('#ctPrevNote', panel).textContent = [METHOD_NOTE[p.method], p.fold ? `About ${fmt(p.fold)} characters show before “…more”.` : '', p.note || ''].filter(Boolean).join(' ');
  }
  const save = debounce(() => ls.set('ps-ct-text', inp.value), 400);
  inp.addEventListener('input', () => { render(); save(); });
  sel.addEventListener('change', () => { ls.set('ps-ct-sel', sel.value); preview(); });
  grid.addEventListener('click', (e) => { const c = e.target.closest('.ct-card'); if (c) { sel.value = c.dataset.p; ls.set('ps-ct-sel', sel.value); preview(); } });
  $$('.chipset input', panel).forEach((c) => c.addEventListener('change', () => { c.checked ? on.add(c.value) : on.delete(c.value); ls.set('ps-ct-groups', [...on]); render(); }));
  $('#ctCopy', panel).addEventListener('click', () => copyText(inp.value));
  $('#ctClear', panel).addEventListener('click', () => { inp.value = ''; ls.del('ps-ct-text'); render(); inp.focus(); });
  $('#ctFit', panel).addEventListener('click', () => { const p = PLATFORMS.find((x) => x.id === sel.value); const t = p.method === 'x' ? inp.value.normalize('NFC') : inp.value; copyText(t.slice(0, cutIndex(t, p.method, p.limit)), `Copied text that fits ${p.name}`); });
  render();
}
