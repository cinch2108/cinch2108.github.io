// Runs on every page: theme, nav, favorites/recent, tool mounting (lazy), service worker.
import { $, $$, esc, icon } from './ui.js';
import { PAGES, bySlug } from './catalog.js';
import { getFavs, isFav, toggleFav, getRecent, pushRecent } from './store.js';

const root = document.documentElement;
const themeBtn = $('#themeBtn');
function setTheme(t, save) {
  root.dataset.theme = t;
  if (save) try { localStorage.setItem('lf-theme', t); } catch {}
  $('use', themeBtn).setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
  themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
}
setTheme(root.dataset.theme || 'dark');
themeBtn.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
const menu = $('#menuBtn'), links = $('#navLinks');
menu.addEventListener('click', () => { const o = links.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && links.classList.contains('open')) { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.focus(); } });

const slug = document.body.dataset.slug;
const page = bySlug(slug);

/* ---------- favorites + recent (localStorage only) ---------- */
const chip = (p, kind) => `<a class="chip" href="/${p.slug}/">${icon(kind === 'fav' ? 'star' : 'clock')}${esc(p.name)}</a>`;
function renderMine() {
  const favs = getFavs().map(bySlug).filter(Boolean);
  const rec = getRecent().filter((s) => !getFavs().includes(s) && s !== slug).map(bySlug).filter(Boolean).slice(0, 5);
  const home = $('#myTools');
  if (home) {
    home.classList.toggle('hidden', !favs.length && !rec.length);
    $('#myToolsChips').innerHTML = favs.map((p) => chip(p, 'fav')).join('') + rec.map((p) => chip(p, 'rec')).join('');
  }
  const side = $('#sideMine');
  if (side) {
    side.innerHTML = (favs.length ? `<div class="lab">Favorites</div>${favs.map((p) => `<a href="/${p.slug}/"${p.slug === slug ? ' aria-current="page"' : ''}>${icon('star')}${esc(p.name)}</a>`).join('')}` : '')
      + (rec.length ? `<div class="lab">Recent</div>${rec.map((p) => `<a href="/${p.slug}/">${icon('clock')}${esc(p.name)}</a>`).join('')}` : '');
  }
}
const fav = $('#favBtn');
if (fav && page) {
  const sync = () => { const on = isFav(slug); fav.setAttribute('aria-pressed', on); $('span', fav).textContent = on ? 'Favorited' : 'Favorite'; fav.title = on ? 'Remove from your favorite tools' : 'Add to your favorite tools'; };
  fav.addEventListener('click', () => { toggleFav(slug); sync(); renderMine(); });
  sync();
}
if (page) pushRecent(slug);
renderMine();
window.addEventListener('storage', renderMine);

/* ---------- mount the tool (heavy code loads only here) ---------- */
const A = new Set(['merge', 'split', 'organize', 'compress', 'img2pdf', 'pdf2img']);
const FN = { compress: 'compressTool' };
if (page) {
  const panel = $('#toolPanel');
  (A.has(page.tool) ? import('./tools-a.js') : import('./tools-b.js'))
    .then((m) => { m[FN[page.tool] || page.tool](panel, page.mode); })
    .catch((e) => { console.error(e); panel.innerHTML = `<p class="note">${icon('info')}<span>The tool failed to load. Please reload the page. (${esc(e.message)})</span></p>`; });
  // Paste a PDF / image anywhere on the page
  window.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])]; if (!files.length) return;
    const input = $('#toolPanel input[type=file]'); if (!input) return;
    const dt = new DataTransfer(); files.forEach((f) => dt.items.add(f)); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
