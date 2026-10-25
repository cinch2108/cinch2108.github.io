// Pure (DOM-free) link-in-bio model: validation, URL safety and standalone HTML rendering.
export const THEMES = [
  { id: 'midnight', name: 'Midnight', bg: 'linear-gradient(160deg,#0f172a,#1e1b4b)', text: '#f8fafc', muted: '#cbd5e1', btn: 'rgba(255,255,255,.1)', btnText: '#f8fafc', border: 'rgba(255,255,255,.18)' },
  { id: 'sunset', name: 'Sunset', bg: 'linear-gradient(160deg,#f97316,#db2777 55%,#7c3aed)', text: '#ffffff', muted: '#fde7f3', btn: 'rgba(255,255,255,.18)', btnText: '#ffffff', border: 'rgba(255,255,255,.35)' },
  { id: 'paper', name: 'Paper', bg: '#faf7f2', text: '#1c1917', muted: '#57534e', btn: '#ffffff', btnText: '#1c1917', border: '#e7e5e4' },
  { id: 'mono', name: 'Mono', bg: '#ffffff', text: '#0a0a0a', muted: '#525252', btn: '#0a0a0a', btnText: '#ffffff', border: '#0a0a0a' },
  { id: 'ocean', name: 'Ocean', bg: 'linear-gradient(170deg,#0ea5e9,#1e3a8a)', text: '#ffffff', muted: '#e0f2fe', btn: '#ffffff', btnText: '#1e3a8a', border: '#ffffff' },
  { id: 'forest', name: 'Forest', bg: 'linear-gradient(170deg,#14532d,#064e3b)', text: '#ecfdf5', muted: '#bbf7d0', btn: '#ecfdf5', btnText: '#14532d', border: '#ecfdf5' },
  { id: 'candy', name: 'Candy', bg: 'linear-gradient(160deg,#fce7f3,#e0e7ff)', text: '#4a044e', muted: '#6b2165', btn: '#ffffff', btnText: '#86198f', border: '#f5d0fe' },
  { id: 'neon', name: 'Neon', bg: '#09090b', text: '#fafafa', muted: '#a1a1aa', btn: 'transparent', btnText: '#a3e635', border: '#a3e635' },
  { id: 'latte', name: 'Latte', bg: 'linear-gradient(170deg,#f5e6d3,#e8d5bf)', text: '#3f2a1d', muted: '#6b4f3a', btn: '#3f2a1d', btnText: '#f5e6d3', border: '#3f2a1d' },
  { id: 'lavender', name: 'Lavender', bg: 'linear-gradient(170deg,#ede9fe,#c4b5fd)', text: '#2e1065', muted: '#4c1d95', btn: '#2e1065', btnText: '#f5f3ff', border: '#2e1065' },
  { id: 'custom', name: 'Custom', bg: '#111827', text: '#f9fafb', muted: '#d1d5db', btn: '#ec4899', btnText: '#ffffff', border: '#ec4899' },
];
export const FONTS = {
  system: { name: 'System sans', css: 'system-ui,-apple-system,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif' },
  rounded: { name: 'Rounded', css: 'ui-rounded,"SF Pro Rounded","Nunito","Varela Round",system-ui,sans-serif' },
  serif: { name: 'Serif', css: 'ui-serif,Georgia,Cambria,"Times New Roman",serif' },
  mono: { name: 'Mono', css: 'ui-monospace,"SF Mono",Menlo,Consolas,"Liberation Mono",monospace' },
  condensed: { name: 'Condensed', css: '"Avenir Next Condensed","Arial Narrow","Roboto Condensed",sans-serif-condensed,system-ui,sans-serif' },
};
export const BUTTONS = { rounded: 'Rounded', pill: 'Pill', square: 'Square', outline: 'Outline', shadow: 'Hard shadow' };
export const LIMITS = { name: 60, bio: 300, title: 80, url: 2000, links: 40, socials: 30 };

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = (v, n) => (typeof v === 'string' ? v : '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, n);
const color = (v, d) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : d);
const AVATAR_RE = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Returns a safe absolute URL (http, https, mailto, tel) or '' if unsafe. Bare domains get https://. */
export function safeUrl(input) {
  let u = String(input ?? '').trim().replace(/[\u0000-\u001F\u007F]+/g, '');
  if (!u) return '';
  if (!/^(mailto|tel):/i.test(u)) u = u.replace(/\s+/g, (m) => (/^ +$/.test(m) ? '%20' : ''));
  if (/^(mailto|tel):/i.test(u)) {
    let [, scheme, rest] = /^(mailto|tel):(.*)$/i.exec(u);
    if (scheme.toLowerCase() === 'tel') { const t = rest.replace(/[^\d+()\-.]/g, ''); return t ? 'tel:' + t : ''; }
    rest = rest.replace(/ /g, '%20');
    return /^[^@\s<>"]+@[^@\s<>"]+\.[^@\s<>"]+$/.test(decodeURIComponentSafe(rest.split('?')[0])) ? 'mailto:' + rest : '';
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(u) && !/^https?:\/\//i.test(u)) return ''; // javascript:, data:, etc.
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u.replace(/^\/+/, '');
  try { const p = new URL(u); if (!/^https?:$/.test(p.protocol) || !p.hostname || !p.hostname.includes('.') && p.hostname !== 'localhost') return ''; return p.href; } catch { return ''; }
}
function decodeURIComponentSafe(s) { try { return decodeURIComponent(s); } catch { return s; } }

/** Turn a handle or URL typed for a social platform into a URL. */
export function socialUrl(kind, value, icons) {
  const v = String(value ?? '').trim(); if (!v) return '';
  if (kind === 'email') return safeUrl(/^mailto:/i.test(v) ? v : 'mailto:' + v);
  if (kind === 'phone') return safeUrl(/^tel:/i.test(v) ? v : 'tel:' + v);
  if (/^https?:\/\//i.test(v) || /^[\w-]+(\.[\w-]+)+\//.test(v) || (/\.[a-z]{2,}$/i.test(v) && !v.startsWith('@') && kind === 'website')) return safeUrl(v);
  if (kind === 'mastodon') { const m = /^@?([\w.]+)@([\w.-]+\.[a-z]{2,})$/i.exec(v); return m ? safeUrl(`https://${m[2]}/@${m[1]}`) : ''; }
  const tpl = icons && icons[kind] && icons[kind].tpl; if (!tpl) return safeUrl(v);
  const h = encodeURIComponent(v.replace(/^[@$]/, '')).replace(/%40/g, '@').replace(/%2E/gi, '.');
  return safeUrl(tpl.replace('{h}', h));
}

export function blank() {
  return { app: 'postsmith-bio', v: 1, name: 'Your Name', bio: 'Creator · Coffee lover · Sharing what I learn ✨', avatar: '', title: '', theme: 'sunset', font: 'system', button: 'pill', align: 'center',
    custom: { bg: '#111827', text: '#f9fafb', btn: '#ec4899', btnText: '#ffffff' }, credit: true,
    links: [{ title: 'My latest video', url: 'https://youtube.com', on: true }, { title: 'Shop my favorites', url: 'https://example.com/shop', on: true }, { title: 'Newsletter', url: 'https://example.com/newsletter', on: true }],
    socials: [{ k: 'instagram', v: 'yourname' }, { k: 'tiktok', v: 'yourname' }, { k: 'x', v: 'yourname' }, { k: 'email', v: 'hello@example.com' }] };
}

/** Validate/coerce untrusted JSON into a clean state. Throws on wrong format. */
export function normalize(raw, icons) {
  if (!raw || typeof raw !== 'object' || raw.app !== 'postsmith-bio') throw new Error('This isn’t a Postsmith link-in-bio file.');
  if (raw.v !== 1) throw new Error('Unsupported file version.');
  const d = blank();
  const c = raw.custom && typeof raw.custom === 'object' ? raw.custom : {};
  return {
    app: 'postsmith-bio', v: 1,
    name: str(raw.name, LIMITS.name), bio: str(raw.bio, LIMITS.bio), title: str(raw.title, LIMITS.title),
    avatar: typeof raw.avatar === 'string' && raw.avatar.length < 2_000_000 && AVATAR_RE.test(raw.avatar) ? raw.avatar : '',
    theme: THEMES.some((t) => t.id === raw.theme) ? raw.theme : d.theme,
    font: Object.hasOwn(FONTS, raw.font) ? raw.font : d.font,
    button: Object.hasOwn(BUTTONS, raw.button) ? raw.button : d.button,
    align: raw.align === 'left' ? 'left' : 'center',
    custom: { bg: color(c.bg, d.custom.bg), text: color(c.text, d.custom.text), btn: color(c.btn, d.custom.btn), btnText: color(c.btnText, d.custom.btnText) },
    credit: raw.credit !== false,
    links: (Array.isArray(raw.links) ? raw.links : []).slice(0, LIMITS.links).filter((l) => l && typeof l === 'object').map((l) => ({ title: str(l.title, 100), url: str(l.url, LIMITS.url), on: l.on !== false })),
    socials: (Array.isArray(raw.socials) ? raw.socials : []).slice(0, LIMITS.socials).filter((s) => s && typeof s === 'object' && icons && Object.hasOwn(icons, s.k)).map((s) => ({ k: s.k, v: str(s.v, 300) })),
  };
}

function themeOf(s) {
  const t = THEMES.find((x) => x.id === s.theme) || THEMES[0];
  if (t.id !== 'custom') return t;
  const c = s.custom; return { ...t, bg: c.bg, text: c.text, muted: c.text, btn: c.btn, btnText: c.btnText, border: c.btn };
}
const initials = (n) => (String(n).trim().split(/\s+/).slice(0, 2).map((w) => [...w][0] || '').join('') || '?').toUpperCase();

/** Render a complete standalone HTML document. opts.preview disables link clicks. */
export function renderBio(s, icons, opts = {}) {
  const t = themeOf(s); const f = (FONTS[s.font] || FONTS.system).css;
  const r = { rounded: '14px', pill: '999px', square: '4px', outline: '14px', shadow: '10px' }[s.button] || '14px';
  const outline = s.button === 'outline'; const shadow = s.button === 'shadow';
  const links = s.links.filter((l) => l.on !== false).map((l) => ({ title: l.title.trim(), url: safeUrl(l.url) })).filter((l) => l.title && l.url);
  const socials = s.socials.map((x) => ({ k: x.k, url: socialUrl(x.k, x.v, icons), i: icons[x.k] })).filter((x) => x.url && x.i);
  const title = s.title.trim() || s.name.trim() || 'Links';
  const ext = (u) => /^https?:/.test(u);
  const css = `*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;min-height:100vh;background:${t.bg};background-attachment:fixed;color:${t.text};font-family:${f};line-height:1.5;-webkit-font-smoothing:antialiased}
main{max-width:580px;margin:0 auto;padding:48px 20px 32px;text-align:${s.align === 'left' ? 'left' : 'center'}}
.av{width:104px;height:104px;border-radius:50%;object-fit:cover;display:block;margin:${s.align === 'left' ? '0 0 16px' : '0 auto 16px'};border:3px solid ${t.border};background:${t.btn}}
.ini{display:grid;place-items:center;font-size:38px;font-weight:700;color:${t.btnText}}
h1{font-size:1.5rem;line-height:1.2;margin:0 0 6px;overflow-wrap:anywhere}
.bio{margin:0 0 24px;color:${t.muted};white-space:pre-line;overflow-wrap:anywhere}
.links{display:flex;flex-direction:column;gap:12px;margin:0 0 28px;padding:0;list-style:none}
.links a{display:block;padding:15px 20px;border-radius:${r};background:${outline ? 'transparent' : t.btn};color:${outline ? t.text : t.btnText};border:2px solid ${t.border};text-decoration:none;font-weight:600;text-align:center;overflow-wrap:anywhere;transition:transform .15s,filter .15s${shadow ? `;box-shadow:4px 4px 0 ${t.text}` : ''}}
.links a:hover{transform:translateY(-2px);filter:brightness(1.06)}.links a:focus-visible,.soc a:focus-visible{outline:3px solid ${t.text};outline-offset:3px}
.soc{display:flex;flex-wrap:wrap;gap:10px;justify-content:${s.align === 'left' ? 'flex-start' : 'center'};margin:0 0 28px;padding:0;list-style:none}
.soc a{display:grid;place-items:center;width:44px;height:44px;border-radius:50%;color:${t.text};border:1px solid ${t.border}}.soc svg{width:20px;height:20px;fill:currentColor}
.cr{font-size:12px;color:${t.muted};opacity:.8;text-align:center}.cr a{color:inherit}
@media (prefers-reduced-motion:reduce){.links a{transition:none}}${opts.preview ? 'a{pointer-events:none}' : ''}`;
  const av = s.avatar ? `<img class="av" src="${esc(s.avatar)}" alt="${esc(s.name)}" width="104" height="104">` : `<div class="av ini" aria-hidden="true">${esc(initials(s.name))}</div>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="strict-origin-when-cross-origin">
<title>${esc(title)}</title>
<meta name="description" content="${esc(s.bio.replace(/\s+/g, ' ').trim().slice(0, 160) || title)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(s.bio.replace(/\s+/g, ' ').trim().slice(0, 200))}">
<meta name="theme-color" content="${esc(/^#/.test(t.bg) ? t.bg : t.text === '#ffffff' ? '#111827' : '#ffffff')}">
<style>${css}</style>
</head>
<body>
<main>
${av}
<h1>${esc(s.name)}</h1>
${s.bio.trim() ? `<p class="bio">${esc(s.bio.trim())}</p>` : ''}
${links.length ? `<ul class="links">${links.map((l) => `<li><a href="${esc(l.url)}"${ext(l.url) ? ' rel="noopener"' : ''}>${esc(l.title)}</a></li>`).join('')}</ul>` : ''}
${socials.length ? `<ul class="soc">${socials.map((x) => `<li><a href="${esc(x.url)}" aria-label="${esc(x.i.name)}" title="${esc(x.i.name)}"${ext(x.url) ? ' rel="noopener me"' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${esc(x.i.path)}"/></svg></a></li>`).join('')}</ul>` : ''}
${s.credit ? '<p class="cr">Made with Postsmith</p>' : ''}
</main>
</body>
</html>
`;
}
