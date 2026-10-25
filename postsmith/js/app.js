// Runs on every page: theme, nav, favorites/recent, lazy tool mounting, service worker.
// All URLs are resolved relative to this file, so the site works under any base path.
import { $, esc, icon, ls, pageUrl, ROOT } from './ui.js';
import { bySlug } from './catalog.js';
import { getFavs, isFav, toggleFav, getRecent, pushRecent } from './store.js';

const root = document.documentElement;
const themeBtn = $('#themeBtn');
function setTheme(t, save) {
  root.dataset.theme = t;
  if (save) ls.set('ps-theme', t);
  $('use', themeBtn).setAttribute('href', t === 'dark' ? '#i-sun' : '#i-moon');
  themeBtn.setAttribute('aria-label', t === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  document.dispatchEvent(new CustomEvent('ps-theme', { detail: t }));
}
setTheme(root.dataset.theme || 'dark');
themeBtn.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true));
const menu = $('#menuBtn'), links = $('#navLinks');
menu.addEventListener('click', () => { const o = links.classList.toggle('open'); menu.setAttribute('aria-expanded', o); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && links.classList.contains('open')) { links.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.focus(); } });

const slug = document.body.dataset.slug;
const page = bySlug(slug);

/* ---------- favorites + recent (localStorage only) ---------- */
const chip = (p, kind) => `<a class="chip" href="${esc(pageUrl(p.slug))}">${icon(kind === 'fav' ? 'star' : 'clock')}${esc(p.name)}</a>`;
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
    side.innerHTML = (favs.length ? `<div class="lab">Favorites</div>${favs.map((p) => `<a href="${esc(pageUrl(p.slug))}"${p.slug === slug ? ' aria-current="page"' : ''}>${icon('star')}${esc(p.name)}</a>`).join('')}` : '')
      + (rec.length ? `<div class="lab">Recent</div>${rec.map((p) => `<a href="${esc(pageUrl(p.slug))}">${icon('clock')}${esc(p.name)}</a>`).join('')}` : '');
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

/* ---------- mount the tool (its code loads only on its own page) ---------- */
if (page) {
  const panel = $('#toolPanel');
  import(`./tool-${page.tool}.js`)
    .then((m) => m.mount(panel))
    .catch((e) => { console.warn(e); panel.innerHTML = `<p class="note">${icon('info')}<span>The tool failed to load. Please reload the page. (${esc(e.message)})</span></p>`; });
}

/* ---------- offline support: SW lives at the site root, wherever that is ---------- */
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register(new URL('sw.js', ROOT), { scope: ROOT.pathname }).catch(() => {}));
}
