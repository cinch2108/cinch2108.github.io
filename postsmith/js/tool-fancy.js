// Fancy text / Unicode font generator
import { $, $$, esc, icon, copyText, ls, debounce } from './ui.js';
import { STYLES, GROUPS, SR_LABEL } from './fancy.js';
import { graphemes } from './count.js';

export function mount(panel) {
  const pins = new Set(ls.get('ps-fx-pins', []).filter((x) => typeof x === 'string'));
  panel.innerHTML = `
  <div class="stack">
    <label class="field"><span>Your text</span>
      <textarea id="fxIn" rows="3" maxlength="2000" placeholder="Type or paste your bio, name or caption" spellcheck="false" data-testid="fx-input"></textarea></label>
    <div class="toolbar">
      <div class="search-wrap">${icon('search')}<input type="search" id="fxFind" placeholder="Filter styles" aria-label="Filter styles"></div>
      <div class="seg" role="group" aria-label="Style group"><button type="button" aria-pressed="true" data-g="">All</button>${GROUPS.map((g) => `<button type="button" aria-pressed="false" data-g="${esc(g)}">${esc(g)}</button>`).join('')}</div>
      <label class="switch-row"><input type="checkbox" class="switch" id="fxA11y"> <span>Only screen-reader-friendly</span></label>
    </div>
    <p class="note warn" id="fxNote">${icon('alert')}<span><b>Accessibility:</b> these “fonts” are really math and symbol characters. Screen readers may read <i>𝐇𝐢</i> as “mathematical bold capital H, mathematical bold small i” or skip it, and the text won’t show up in search. Use them for a word or two, not your whole bio. Each style is labeled.</span></p>
    <div class="fx-list" id="fxList" aria-live="off"></div>
    <p class="tiny faint" id="fxCount"></p>
  </div>`;
  const inp = $('#fxIn', panel), list = $('#fxList', panel), find = $('#fxFind', panel), a11y = $('#fxA11y', panel);
  inp.value = ls.get('ps-fx-text', '') || '';
  let group = '';
  const render = () => {
    const text = inp.value || 'Postsmith';
    const q = find.value.trim().toLowerCase();
    const shown = STYLES.filter((s) => (!group || s.group === group) && (!q || s.name.toLowerCase().includes(q) || s.id.includes(q)) && (!a11y.checked || s.sr === 'fair'))
      .sort((a, b) => (pins.has(b.id) - pins.has(a.id)));
    list.innerHTML = shown.map((s) => {
      const out = s.fn(text);
      return `<div class="fx-row${pins.has(s.id) ? ' pinned' : ''}" data-id="${s.id}">
        <div class="fx-meta"><span class="fx-name">${esc(s.name)}</span><span class="badge sr-${s.sr}" title="${esc(SR_LABEL[s.sr])}">${s.sr === 'fair' ? icon('check') : icon('alert')}${esc(SR_LABEL[s.sr])}</span></div>
        <div class="fx-out" lang="und">${esc(out)}</div>
        <div class="fx-act"><button class="icon-btn sm" type="button" data-pin aria-pressed="${pins.has(s.id)}" aria-label="Pin ${esc(s.name)} to the top">${icon('star')}</button>
        <button class="btn btn-sm" type="button" data-copy data-testid="copy-${s.id}">${icon('copy')}Copy</button></div></div>`;
    }).join('') || `<p class="empty">No styles match.</p>`;
    $('#fxCount', panel).textContent = `${shown.length} of ${STYLES.length} styles · ${graphemes(inp.value).length} characters typed`;
  };
  const save = debounce(() => ls.set('ps-fx-text', inp.value), 400);
  inp.addEventListener('input', () => { render(); save(); });
  find.addEventListener('input', render); a11y.addEventListener('change', render);
  $$('.seg button', panel).forEach((b) => b.addEventListener('click', () => { group = b.dataset.g; $$('.seg button', panel).forEach((x) => x.setAttribute('aria-pressed', x === b)); render(); }));
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.fx-row'); if (!row) return;
    const s = STYLES.find((x) => x.id === row.dataset.id);
    if (e.target.closest('[data-copy]')) copyText(s.fn(inp.value || 'Postsmith'), `Copied ${s.name}`);
    else if (e.target.closest('[data-pin]')) { pins.has(s.id) ? pins.delete(s.id) : pins.add(s.id); ls.set('ps-fx-pins', [...pins]); render(); $(`.fx-row[data-id="${s.id}"] [data-pin]`, list)?.focus(); }
  });
  render();
}
