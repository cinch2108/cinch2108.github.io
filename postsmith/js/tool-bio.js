// Link-in-bio page builder: live preview + standalone HTML / JSON export
import { $, $$, esc, icon, copyText, ls, debounce, downloadBlob, toast } from './ui.js';
import { ICONS } from './bio-icons.js';
import { THEMES, FONTS, BUTTONS, LIMITS, blank, normalize, renderBio, safeUrl, socialUrl } from './bio-render.js';

const KEY = 'ps-bio';
const fileSlug = (s) => (s || 'links').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'links';
const SOC_ORDER = ['instagram', 'tiktok', 'youtube', 'x', 'threads', 'facebook', 'linkedin', 'bluesky', 'mastodon', 'pinterest', 'snapchat', 'twitch', 'kick', 'discord', 'spotify', 'applemusic', 'soundcloud', 'github', 'reddit', 'whatsapp', 'telegram', 'patreon', 'substack', 'medium', 'kofi', 'buymeacoffee', 'etsy', 'dribbble', 'behance', 'vimeo', 'tumblr', 'cashapp', 'paypal', 'venmo', 'website', 'email', 'phone'];
const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="si"><path d="${esc(ICONS[k].path)}"/></svg>`;
const hint = (k) => (k === 'email' ? 'you@example.com' : k === 'phone' ? '+1 555 123 4567' : k === 'website' ? 'yoursite.com' : k === 'mastodon' ? '@you@mastodon.social' : ['applemusic', 'spotify'].includes(k) ? 'Paste the full link' : '@handle or full link');

async function avatarFrom(file) {
  if (!/^image\//.test(file.type)) throw new Error('Choose an image file');
  if (file.size > 25e6) throw new Error('That image is over 25 MB');
  const bmp = await createImageBitmap(file);
  const S = 320, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d');
  const sc = Math.max(S / bmp.width, S / bmp.height); const w = bmp.width * sc, h = bmp.height * sc;
  x.imageSmoothingQuality = 'high'; x.drawImage(bmp, (S - w) / 2, (S - h) / 2, w, h); bmp.close?.();
  let url = c.toDataURL('image/webp', 0.86); if (!url.startsWith('data:image/webp')) url = c.toDataURL('image/jpeg', 0.86);
  return url;
}

export function mount(panel) {
  let s; try { s = normalize(ls.get(KEY, null), ICONS); } catch { s = blank(); }
  panel.innerHTML = `
  <div class="bio-layout">
    <div class="bio-edit stack">
      <section class="card stack" aria-labelledby="bpH"><h2 class="small-h" id="bpH">${icon('user')}Profile</h2>
        <div class="row nogrow" style="align-items:center;gap:14px"><div class="bio-av" id="bAvP"></div>
          <div class="stack" style="gap:6px"><label class="btn btn-sm" for="bAv">${icon('upload')}Upload photo</label><input type="file" id="bAv" accept="image/*" class="sr-only" data-testid="bio-avatar"><button type="button" class="btn btn-sm btn-ghost" id="bAvX">Remove</button></div></div>
        <label class="field"><span>Name</span><input type="text" id="bName" maxlength="${LIMITS.name}" data-testid="bio-name"></label>
        <label class="field"><span>Bio <small class="faint" id="bBioN"></small></span><textarea id="bBio" rows="3" maxlength="${LIMITS.bio}"></textarea></label>
      </section>
      <section class="card stack" aria-labelledby="blH"><div class="row nogrow" style="justify-content:space-between;align-items:center"><h2 class="small-h" id="blH">${icon('link')}Links</h2><button type="button" class="btn btn-sm" id="bAddL" data-testid="bio-add-link">${icon('plus')}Add link</button></div>
        <ol class="bio-list" id="bLinks"></ol></section>
      <section class="card stack" aria-labelledby="bsH"><h2 class="small-h" id="bsH">${icon('smile')}Social icons</h2>
        <div class="row nogrow wrap" style="align-items:end"><label class="field"><span>Platform</span><select id="bSocK">${SOC_ORDER.map((k) => `<option value="${k}">${esc(ICONS[k].name)}</option>`).join('')}</select></label>
        <button type="button" class="btn btn-sm" id="bAddS">${icon('plus')}Add icon</button></div>
        <ol class="bio-list" id="bSocs"></ol></section>
      <section class="card stack" aria-labelledby="baH"><h2 class="small-h" id="baH">${icon('palette')}Appearance</h2>
        <div class="bio-themes" role="radiogroup" aria-label="Theme" id="bThemes">${THEMES.map((t) => `<button type="button" role="radio" data-t="${t.id}" aria-label="${esc(t.name)} theme" title="${esc(t.name)}"><i style="background:${t.bg}"><b style="background:${t.btn};border-color:${t.border}"></b></i><span>${esc(t.name)}</span></button>`).join('')}</div>
        <div class="grid3 bio-custom" id="bCustom">${[['bg', 'Background'], ['text', 'Text'], ['btn', 'Buttons'], ['btnText', 'Button text']].map(([k, n]) => `<label class="field"><span>${n}</span><input type="color" data-c="${k}"></label>`).join('')}</div>
        <div class="grid3">
          <label class="field"><span>Font</span><select id="bFont">${Object.entries(FONTS).map(([k, f]) => `<option value="${k}">${esc(f.name)}</option>`).join('')}</select></label>
          <label class="field"><span>Buttons</span><select id="bBtn">${Object.entries(BUTTONS).map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label>
          <label class="field"><span>Alignment</span><select id="bAlign"><option value="center">Centered</option><option value="left">Left</option></select></label>
        </div>
        <label class="field"><span>Browser tab title (optional)</span><input type="text" id="bTitle" maxlength="${LIMITS.title}" placeholder="Defaults to your name"></label>
        <label class="switch-row"><input type="checkbox" class="switch" id="bCredit"> <span>Show “Made with Postsmith” (plain text, no link or tracking)</span></label>
      </section>
      <section class="card stack" aria-labelledby="beH"><h2 class="small-h" id="beH">${icon('download')}Export</h2>
        <div class="row wrap nogrow">
          <button type="button" class="btn btn-primary" id="bDl" data-testid="bio-export-html">${icon('download')}Download HTML page</button>
          <button type="button" class="btn" id="bCopy">${icon('code')}Copy HTML</button>
        </div>
        <div class="row wrap nogrow">
          <button type="button" class="btn btn-sm" id="bJson" data-testid="bio-export-json">${icon('download')}Save project (.json)</button>
          <label class="btn btn-sm" for="bImp">${icon('upload')}Open project</label><input type="file" id="bImp" accept="application/json,.json" class="sr-only" data-testid="bio-import">
          <button type="button" class="btn btn-sm btn-ghost" id="bReset">${icon('refresh')}Start over</button>
        </div>
        <p class="tiny muted">The HTML file is one self-contained page: no scripts, trackers or external requests (your photo is embedded). Upload it to any static host such as GitHub Pages, Netlify, Cloudflare Pages or your own domain, then put that URL in your bio. Your draft is saved in this browser only.</p>
      </section>
    </div>
    <div class="bio-prev">
      <div class="seg" role="radiogroup" aria-label="Preview size" id="bDev"><button type="button" role="radio" aria-checked="true" data-d="phone">Phone</button><button type="button" role="radio" aria-checked="false" data-d="wide">Desktop</button></div>
      <div class="phone" id="bPhone"><iframe id="bFrame" title="Live preview of your link-in-bio page" sandbox="" loading="eager" data-testid="bio-preview"></iframe></div>
    </div>
  </div>`;
  const P = (id) => $('#' + id, panel);
  const save = debounce(() => { try { ls.set(KEY, s); } catch { toast('Draft too large to save in this browser', 'err'); } }, 300);
  const preview = debounce(() => { P('bFrame').srcdoc = renderBio(s, ICONS, { preview: true }); }, 120);
  const changed = () => { save(); preview(); };

  function fillProfile() {
    P('bName').value = s.name; P('bBio').value = s.bio; P('bTitle').value = s.title; P('bCredit').checked = s.credit;
    P('bFont').value = s.font; P('bBtn').value = s.button; P('bAlign').value = s.align;
    $$('[data-c]', panel).forEach((i) => { i.value = s.custom[i.dataset.c]; });
    P('bBioN').textContent = `${[...s.bio].length}/${LIMITS.bio}`;
    P('bAvP').innerHTML = s.avatar ? `<img src="${esc(s.avatar)}" alt="" width="64" height="64">` : icon('user');
    P('bAvX').hidden = !s.avatar;
    $$('#bThemes button', panel).forEach((b) => b.setAttribute('aria-checked', b.dataset.t === s.theme));
    P('bCustom').hidden = s.theme !== 'custom';
  }
  function drawLinks() {
    P('bLinks').innerHTML = s.links.map((l, i) => {
      const bad = l.url.trim() && !safeUrl(l.url);
      return `<li class="bio-item" data-i="${i}"><div class="grid2"><label class="field"><span>Title</span><input type="text" data-f="title" maxlength="100" value="${esc(l.title)}"></label>
      <label class="field"><span>URL</span><input type="url" data-f="url" maxlength="${LIMITS.url}" value="${esc(l.url)}" placeholder="https://" aria-invalid="${!!bad}" inputmode="url"></label></div>
      ${bad ? '<p class="tiny err-t">Only http, https, mailto and tel links are allowed. This link will be skipped.</p>' : ''}
      <div class="row nogrow bio-ctl"><label class="switch-row tiny"><input type="checkbox" class="switch" data-f="on"${l.on !== false ? ' checked' : ''}> Visible</label><span class="grow"></span>
      <button type="button" class="icon-btn sm" data-a="up" aria-label="Move up"${i === 0 ? ' disabled' : ''}>${icon('up')}</button><button type="button" class="icon-btn sm" data-a="down" aria-label="Move down"${i === s.links.length - 1 ? ' disabled' : ''}>${icon('down')}</button><button type="button" class="icon-btn sm" data-a="del" aria-label="Delete link">${icon('trash')}</button></div></li>`;
    }).join('') || '<li class="empty">No links yet.</li>';
  }
  function drawSocs() {
    P('bSocs').innerHTML = s.socials.map((x, i) => {
      const u = socialUrl(x.k, x.v, ICONS);
      return `<li class="bio-item soc-item" data-i="${i}"><span class="soc-ic" title="${esc(ICONS[x.k].name)}">${svg(x.k)}</span>
      <label class="field grow"><span class="sr-only">${esc(ICONS[x.k].name)}</span><input type="text" data-f="v" value="${esc(x.v)}" placeholder="${esc(hint(x.k))}" aria-label="${esc(ICONS[x.k].name)}" maxlength="300"></label>
      <button type="button" class="icon-btn sm" data-a="up" aria-label="Move up"${i === 0 ? ' disabled' : ''}>${icon('up')}</button><button type="button" class="icon-btn sm" data-a="del" aria-label="Remove ${esc(ICONS[x.k].name)}">${icon('trash')}</button>
      <p class="tiny ${u || !x.v ? 'faint' : 'err-t'} soc-url">${x.v ? (u ? esc(u) : 'Can’t make a valid link from this') : ''}</p></li>`;
    }).join('') || '<li class="empty">No social icons yet.</li>';
  }
  const all = () => { fillProfile(); drawLinks(); drawSocs(); changed(); };

  P('bName').addEventListener('input', (e) => { s.name = e.target.value; changed(); });
  P('bBio').addEventListener('input', (e) => { s.bio = e.target.value; P('bBioN').textContent = `${[...s.bio].length}/${LIMITS.bio}`; changed(); });
  P('bTitle').addEventListener('input', (e) => { s.title = e.target.value; changed(); });
  P('bCredit').addEventListener('change', (e) => { s.credit = e.target.checked; changed(); });
  P('bFont').addEventListener('change', (e) => { s.font = e.target.value; changed(); });
  P('bBtn').addEventListener('change', (e) => { s.button = e.target.value; changed(); });
  P('bAlign').addEventListener('change', (e) => { s.align = e.target.value; changed(); });
  $$('[data-c]', panel).forEach((i) => i.addEventListener('input', () => { s.custom[i.dataset.c] = i.value; changed(); }));
  P('bThemes').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; s.theme = b.dataset.t; fillProfile(); changed(); });
  P('bAv').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { s.avatar = await avatarFrom(f); fillProfile(); changed(); } catch (err) { toast(err.message || 'Couldn’t read that image', 'err'); }
  });
  P('bAvX').addEventListener('click', () => { s.avatar = ''; fillProfile(); changed(); });

  const listHandler = (arr, redraw, live) => (e) => {
    const li = e.target.closest('.bio-item'); if (!li) return; const i = +li.dataset.i; const a = e.target.closest('[data-a]')?.dataset.a;
    if (e.type === 'click' && a) {
      const list = arr();
      if (a === 'del') list.splice(i, 1);
      if (a === 'up' && i > 0) [list[i - 1], list[i]] = [list[i], list[i - 1]];
      if (a === 'down' && i < list.length - 1) [list[i + 1], list[i]] = [list[i], list[i + 1]];
      redraw(); changed();
      const t = $(`.bio-item[data-i="${a === 'up' ? i - 1 : a === 'down' ? i + 1 : Math.min(i, list.length - 1)}"] [data-a="${a === 'del' ? 'del' : a}"]`, panel) || $(`.bio-item [data-f]`, panel);
      t?.focus(); return;
    }
    const f = e.target.dataset.f; if (!f) return;
    arr()[i][f] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; live(li, i); changed();
  };
  const lh = listHandler(() => s.links, drawLinks, (li, i) => {
    const inp = $('[data-f="url"]', li); const bad = inp.value.trim() && !safeUrl(inp.value); inp.setAttribute('aria-invalid', !!bad);
    let p = $('.err-t', li); if (bad && !p) { p = document.createElement('p'); p.className = 'tiny err-t'; p.textContent = 'Only http, https, mailto and tel links are allowed. This link will be skipped.'; $('.bio-ctl', li).before(p); } else if (!bad && p) p.remove();
  });
  P('bLinks').addEventListener('click', lh); P('bLinks').addEventListener('input', lh); P('bLinks').addEventListener('change', (e) => e.target.type === 'checkbox' && lh(e));
  const sh = listHandler(() => s.socials, drawSocs, (li, i) => {
    const x = s.socials[i]; const u = socialUrl(x.k, x.v, ICONS); const p = $('.soc-url', li);
    p.className = `tiny ${u || !x.v ? 'faint' : 'err-t'} soc-url`; p.textContent = x.v ? (u || 'Can’t make a valid link from this') : '';
  });
  P('bSocs').addEventListener('click', sh); P('bSocs').addEventListener('input', sh);
  P('bAddL').addEventListener('click', () => {
    if (s.links.length >= LIMITS.links) return toast(`Up to ${LIMITS.links} links`, 'err');
    s.links.push({ title: '', url: '', on: true }); drawLinks(); changed(); $$('#bLinks [data-f="title"]', panel).pop()?.focus();
  });
  P('bAddS').addEventListener('click', () => {
    if (s.socials.length >= LIMITS.socials) return toast(`Up to ${LIMITS.socials} icons`, 'err');
    s.socials.push({ k: P('bSocK').value, v: '' }); drawSocs(); changed(); $$('#bSocs [data-f="v"]', panel).pop()?.focus();
  });
  const html = () => renderBio(s, ICONS);
  P('bDl').addEventListener('click', () => { downloadBlob(new Blob([html()], { type: 'text/html' }), `${fileSlug(s.name)}-links.html`); toast('Saved your page', 'ok'); });
  P('bCopy').addEventListener('click', () => copyText(html(), 'Copied HTML'));
  P('bJson').addEventListener('click', () => downloadBlob(new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' }), `${fileSlug(s.name)}-postsmith-bio.json`));
  P('bImp').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { if (f.size > 3e6) throw new Error('File is too large'); s = normalize(JSON.parse(await f.text()), ICONS); all(); toast('Project opened', 'ok'); }
    catch (err) { toast(err instanceof SyntaxError ? 'That file isn’t valid JSON' : err.message, 'err'); }
  });
  P('bReset').addEventListener('click', () => { if (confirm('Replace your current page with the starter example? Save a project file first if you want to keep it.')) { s = blank(); all(); } });
  P('bDev').addEventListener('click', (e) => { const b = e.target.closest('[data-d]'); if (!b) return; $$('#bDev button', panel).forEach((x) => x.setAttribute('aria-checked', x === b)); P('bPhone').classList.toggle('wide', b.dataset.d === 'wide'); });
  all();
}
