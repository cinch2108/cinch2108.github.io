// Text measuring for social platforms. Pure functions, shared by the browser tool and the Node tests.
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'grapheme' }) : null;
const wseg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('en', { granularity: 'word' }) : null;
export const graphemes = (s) => (seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s));
const EMOJI_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20E3/u;
export const isEmoji = (g) => EMOJI_RE.test(g);

// Common TLDs for bare-domain links ("example.com/page"). Links with http(s):// always count.
const TLD = 'com|net|org|io|co|app|dev|ai|me|ly|gl|gg|tv|us|uk|ca|de|fr|in|info|biz|xyz|link|site|shop|store|blog|news|so|to|sh|it|es|nl|au|jp|br|ru|ch|se|no|fi|eu|edu|gov|page|online|tech|art|design|studio|live|social|fm|be|at|pl|cz|ie|nz|mx|kr|cn|tw|hk|sg|id|ph|vn|za|ng|ke|tk|ws|cc|is|pt|dk|gr|ro|hu|il|tr|ua|ar|cl|pe';
const URL_RE = new RegExp(String.raw`(?:\bhttps?:\/\/[^\s<>"'\u3000]+)|(?:(?<![\w@.\/-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${TLD})(?![\w-])(?::\d{2,5})?(?:\/[^\s<>"'\u3000]*)?)`, 'giu');
const TRAIL = /[.,!?;:)\]}'"…]+$/u;

/** Find links: [{start,end,url}] (trailing punctuation is not part of the link). */
export function findUrls(text, { bare = true } = {}) {
  const out = []; URL_RE.lastIndex = 0; let m;
  while ((m = URL_RE.exec(text))) {
    let u = m[0];
    if (!bare && !/^https?:/i.test(u)) continue;
    // keep balanced parentheses (Wikipedia-style links)
    while (TRAIL.test(u)) { const last = u.slice(-1); if (last === ')' && (u.match(/\(/g) || []).length >= (u.match(/\)/g) || []).length) break; u = u.slice(0, -1); }
    if (u.length) out.push({ start: m.index, end: m.index + u.length, url: u });
  }
  return out;
}

// X (twitter-text v3 config): code points in these ranges weigh 1, everything else 2; emoji 2; links 23.
const X_RANGES = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
const xCharWeight = (c) => { const n = c.codePointAt(0); return X_RANGES.some(([a, b]) => n >= a && n <= b) ? 1 : 2; };
/** Bluesky's composer shortens links before counting: host + first 13 chars of the path + "...". */
export function bskyShort(url) {
  try {
    const u = new URL(/^https?:/i.test(url) ? url : 'https://' + url);
    const path = (u.pathname === '/' ? '' : u.pathname) + u.search + u.hash;
    return path.length > 15 ? u.host + path.slice(0, 13) + '...' : u.host + path;
  } catch { return url; }
}

/**
 * Split text into counting units [{s,e,w}] (UTF-16 start/end, weight) for a counting method:
 * 'graphemes' (what you see), 'x', 'bsky', 'masto', 'utf16', 'codepoints'.
 */
export function units(text, method = 'graphemes') {
  const out = [];
  if (method === 'x') text = text.normalize('NFC');
  const urls = method === 'x' || method === 'bsky' ? findUrls(text) : method === 'masto' ? findUrls(text, { bare: false }) : [];
  const mentions = [];
  if (method === 'masto') { const re = /(?<![\w@])@(\w{1,30})@[\w.-]+\.\w+/gu; let m; while ((m = re.exec(text))) mentions.push({ start: m.index, end: m.index + m[0].length, w: 1 + m[1].length }); }
  const special = [...urls.map((u) => ({ ...u, w: method === 'bsky' ? graphemes(bskyShort(u.url)).length : 23 })), ...mentions].sort((a, b) => a.start - b.start);
  let i = 0;
  const plain = (s, e) => {
    let pos = s;
    for (const g of graphemes(text.slice(s, e))) {
      let w = 1;
      if (method === 'x') w = isEmoji(g) && !(g.length === 1 && g.charCodeAt(0) < 4352) ? 2 : Array.from(g).reduce((t, c) => t + xCharWeight(c), 0);
      else if (method === 'utf16') w = g.length;
      else if (method === 'codepoints' || method === 'masto') w = Array.from(g).length;
      out.push({ s: pos, e: pos + g.length, w }); pos += g.length;
    }
  };
  for (const sp of special) { if (sp.start < i) continue; plain(i, sp.start); out.push({ s: sp.start, e: sp.end, w: sp.w, link: true }); i = sp.end; }
  plain(i, text.length);
  return { text, units: out };
}
export const measure = (text, method) => units(text, method).units.reduce((t, u) => t + u.w, 0);

/** UTF-16 index where the text stops fitting into `limit` (text.length if it all fits). */
export function cutIndex(text, method, limit) {
  const { units: us } = units(text, method); let t = 0;
  for (const u of us) { if (t + u.w > limit) return u.s; t += u.w; }
  return text.length;
}

export function stats(text) {
  const g = graphemes(text);
  const words = wseg ? Array.from(wseg.segment(text)).filter((x) => x.isWordLike).length : (text.match(/\S+/g) || []).length;
  return {
    chars: g.length,
    charsNoSpaces: g.filter((x) => !/^\s+$/u.test(x)).length,
    codepoints: Array.from(text).length,
    utf16: text.length,
    bytes: new TextEncoder().encode(text).length,
    words,
    lines: text ? text.split(/\r\n|\r|\n/).length : 0,
    paragraphs: text.trim() ? text.trim().split(/\n\s*\n/).length : 0,
    sentences: (text.match(/[^.!?…\n]+[.!?…]+/gu) || []).length,
    emoji: g.filter(isEmoji).length,
    hashtags: (text.match(/(?<![\p{L}\p{N}_&])#[\p{L}\p{N}_]*\p{L}[\p{L}\p{N}_]*/gu) || []).length,
    mentions: (text.match(/(?<![\w@])@\w{1,30}(?:@[\w.-]+\.\w+)?/gu) || []).length,
    urls: findUrls(text).length,
    readSec: Math.round((words / 238) * 60),
    speakSec: Math.round((words / 150) * 60),
  };
}
