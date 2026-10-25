// Unicode "font" styles. Pure functions, shared by the browser tool and the static build.
// sr: how screen readers typically handle the result.
//   'poor'  = read as math symbols ("mathematical bold capital A") or skipped entirely
//   'bad'   = unreadable / misleading (upside-down, glitch)
//   'fair'  = letters usually read, but extra marks or symbols may be announced
const cp = (n) => String.fromCodePoint(n);
const range = (a, z) => { const o = []; for (let c = a.codePointAt(0); c <= z.codePointAt(0); c++) o.push(cp(c)); return o; };
const UP = range('A', 'Z'), LO = range('a', 'z'), DIG = range('0', '9');

function math(upStart, loStart, digStart, holes = {}) {
  const m = {};
  UP.forEach((c, i) => { m[c] = holes[c] || cp(upStart + i); });
  if (loStart) LO.forEach((c, i) => { m[c] = holes[c] || cp(loStart + i); });
  if (digStart) DIG.forEach((c, i) => { m[c] = cp(digStart + i); });
  return m;
}
const pairs = (from, to) => { const m = {}; const f = [...from], t = [...to]; f.forEach((c, i) => { m[c] = t[i]; }); return m; };

const SCRIPT_H = { B: '\u212C', E: '\u2130', F: '\u2131', H: '\u210B', I: '\u2110', L: '\u2112', M: '\u2133', R: '\u211B', e: '\u212F', g: '\u210A', o: '\u2134' };
const FRAK_H = { C: '\u212D', H: '\u210C', I: '\u2111', R: '\u211C', Z: '\u2128' };
const DS_H = { C: '\u2102', H: '\u210D', N: '\u2115', P: '\u2119', Q: '\u211A', R: '\u211D', Z: '\u2124' };

const circled = (() => { const m = math(0x24B6, 0x24D0); DIG.forEach((d, i) => { m[d] = i === 0 ? '\u24EA' : cp(0x2460 + i - 1); }); return m; })();
const negCircled = (() => { const m = {}; UP.forEach((c, i) => { m[c] = m[c.toLowerCase()] = cp(0x1F150 + i); }); DIG.forEach((d, i) => { m[d] = i === 0 ? '\u24FF' : cp(0x2776 + i - 1); }); return m; })();
const squared = (() => { const m = {}; UP.forEach((c, i) => { m[c] = m[c.toLowerCase()] = cp(0x1F130 + i); }); return m; })();
const negSquared = (() => { const m = {}; UP.forEach((c, i) => { m[c] = m[c.toLowerCase()] = cp(0x1F170 + i); }); return m; })();
const paren = (() => { const m = {}; LO.forEach((c, i) => { m[c] = m[c.toUpperCase()] = cp(0x249C + i); }); DIG.slice(1).forEach((d, i) => { m[d] = cp(0x2474 + i); }); return m; })();
const fullwidth = (() => { const m = { ' ': '\u3000' }; for (let c = 0x21; c <= 0x7E; c++) m[cp(c)] = cp(0xFF01 + c - 0x21); return m; })();
const smallCaps = pairs('abcdefghijklmnopqrstuvwxyz', 'ᴀʙᴄᴅᴇꜰɢʜɪᴊᴋʟᴍɴᴏᴘǫʀꜱᴛᴜᴠᴡxʏᴢ');
const superscript = pairs('abcdefghijklmnoprstuvwxyzABDEGHIJKLMNOPRTUVW0123456789+-=()', 'ᵃᵇᶜᵈᵉᶠᵍʰⁱʲᵏˡᵐⁿᵒᵖʳˢᵗᵘᵛʷˣʸᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾');
const subscript = pairs('aehijklmnoprstuvx0123456789+-=()', 'ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎');
const flip = pairs(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,'\"?!()[]{}<>_&;",
  "ɐqɔpǝɟƃɥᴉɾʞlɯuodbɹsʇnʌʍxʎz∀ꓭƆꓷƎℲ⅁HIſꓘ˥WNOԀῸꓤS⊥∩ΛMX⅄Z0ƖᄅƐㄣϛ9ㄥ86˙'„,¿¡)(][}{><‾⅋؛");
const mirror = pairs('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ()[]{}<>?', 'ɒdɔbɘʇϱʜiįʞlmnoqpɿƨɈυvwxγzAᙠƆᗡƎꟻᎮHIႱꓘ⅃MИOꟼỌЯƧTUVWXYZ)(][}{><⸮');

const map = (m) => (s) => Array.from(s, (c) => m[c] ?? c).join('');
const comb = (mark) => (s) => Array.from(s, (c) => (/\s/.test(c) ? c : c + mark)).join('');
// deterministic "glitch" so the same input always gives the same output
const ZALGO = ['\u030D', '\u030E', '\u0304', '\u0305', '\u033F', '\u0311', '\u0306', '\u0310', '\u0352', '\u0357', '\u0351', '\u0307', '\u0308', '\u030A', '\u0342', '\u0343', '\u0316', '\u0317', '\u0318', '\u0319', '\u031C', '\u031D', '\u0323', '\u0324', '\u0325', '\u0326', '\u0329', '\u032A'];
const glitch = (s) => { let seed = 7; const r = () => (seed = (seed * 9301 + 49297) % 233280) / 233280; return Array.from(s, (c) => (/\s/.test(c) ? c : c + Array.from({ length: 1 + Math.floor(r() * 3) }, () => ZALGO[Math.floor(r() * ZALGO.length)]).join(''))).join(''); };
const wrapEach = (a, b = a) => (s) => Array.from(s, (c) => (/\s/.test(c) ? c : a + c + b)).join('');

export const STYLES = [
  { id: 'bold', name: 'Bold (serif)', group: 'Bold & italic', sr: 'poor', fn: map(math(0x1D400, 0x1D41A, 0x1D7CE)) },
  { id: 'italic', name: 'Italic (serif)', group: 'Bold & italic', sr: 'poor', fn: map(math(0x1D434, 0x1D44E, 0, { h: '\u210E' })) },
  { id: 'bold-italic', name: 'Bold italic (serif)', group: 'Bold & italic', sr: 'poor', fn: map(math(0x1D468, 0x1D482)) },
  { id: 'sans', name: 'Sans', group: 'Bold & italic', sr: 'poor', fn: map(math(0x1D5A0, 0x1D5BA, 0x1D7E2)) },
  { id: 'sans-bold', name: 'Sans bold', group: 'Bold & italic', sr: 'poor', fn: map(math(0x1D5D4, 0x1D5EE, 0x1D7EC)) },
  { id: 'sans-italic', name: 'Sans italic', group: 'Bold & italic', sr: 'poor', fn: map(math(0x1D608, 0x1D622)) },
  { id: 'sans-bold-italic', name: 'Sans bold italic', group: 'Bold & italic', sr: 'poor', fn: map(math(0x1D63C, 0x1D656)) },
  { id: 'script', name: 'Script (cursive)', group: 'Script & gothic', sr: 'poor', fn: map(math(0x1D49C, 0x1D4B6, 0, SCRIPT_H)) },
  { id: 'bold-script', name: 'Bold script', group: 'Script & gothic', sr: 'poor', fn: map(math(0x1D4D0, 0x1D4EA)) },
  { id: 'fraktur', name: 'Fraktur (gothic)', group: 'Script & gothic', sr: 'poor', fn: map(math(0x1D504, 0x1D51E, 0, FRAK_H)) },
  { id: 'bold-fraktur', name: 'Bold Fraktur', group: 'Script & gothic', sr: 'poor', fn: map(math(0x1D56C, 0x1D586)) },
  { id: 'double-struck', name: 'Double-struck (outline)', group: 'Script & gothic', sr: 'poor', fn: map(math(0x1D538, 0x1D552, 0x1D7D8, DS_H)) },
  { id: 'monospace', name: 'Monospace (typewriter)', group: 'Script & gothic', sr: 'poor', fn: map(math(0x1D670, 0x1D68A, 0x1D7F6)) },
  { id: 'small-caps', name: 'Small caps', group: 'Letter shapes', sr: 'poor', fn: map(smallCaps) },
  { id: 'fullwidth', name: 'Wide (fullwidth)', group: 'Letter shapes', sr: 'fair', fn: map(fullwidth) },
  { id: 'superscript', name: 'Tiny (superscript)', group: 'Letter shapes', sr: 'poor', fn: map(superscript) },
  { id: 'subscript', name: 'Subscript', group: 'Letter shapes', sr: 'poor', fn: map(subscript) },
  { id: 'bubble', name: 'Bubble (circled)', group: 'Bubbles & boxes', sr: 'poor', fn: map(circled) },
  { id: 'bubble-black', name: 'Black bubble', group: 'Bubbles & boxes', sr: 'poor', fn: map(negCircled) },
  { id: 'squared', name: 'Squared', group: 'Bubbles & boxes', sr: 'poor', fn: map(squared) },
  { id: 'squared-black', name: 'Black squared', group: 'Bubbles & boxes', sr: 'poor', fn: map(negSquared) },
  { id: 'parenthesized', name: 'Parenthesized', group: 'Bubbles & boxes', sr: 'poor', fn: map(paren) },
  { id: 'strikethrough', name: 'Strikethrough', group: 'Lines & marks', sr: 'fair', fn: comb('\u0336') },
  { id: 'slash', name: 'Slashed', group: 'Lines & marks', sr: 'fair', fn: comb('\u0338') },
  { id: 'underline', name: 'Underline', group: 'Lines & marks', sr: 'fair', fn: comb('\u0332') },
  { id: 'double-underline', name: 'Double underline', group: 'Lines & marks', sr: 'fair', fn: comb('\u0333') },
  { id: 'overline', name: 'Overline', group: 'Lines & marks', sr: 'fair', fn: comb('\u0305') },
  { id: 'dotted', name: 'Dotted above', group: 'Lines & marks', sr: 'fair', fn: comb('\u0307') },
  { id: 'glitch', name: 'Glitch (Zalgo)', group: 'Lines & marks', sr: 'bad', fn: glitch },
  { id: 'upside-down', name: 'Upside down', group: 'Flipped', sr: 'bad', fn: (s) => Array.from(map(flip)(s)).reverse().join('') },
  { id: 'mirror', name: 'Mirrored', group: 'Flipped', sr: 'bad', fn: (s) => Array.from(map(mirror)(s)).reverse().join('') },
  { id: 'brackets', name: 'Lenticular brackets', group: 'Decorations', sr: 'fair', fn: (s) => (s ? `【${s}】` : s) },
  { id: 'sparkles', name: 'Sparkles', group: 'Decorations', sr: 'fair', fn: (s) => (s ? `✨ ${s} ✨` : s) },
  { id: 'stars', name: 'Stars', group: 'Decorations', sr: 'fair', fn: (s) => (s ? `★彡 ${s} 彡★` : s) },
  { id: 'hearts', name: 'Hearts', group: 'Decorations', sr: 'fair', fn: (s) => (s ? `♡ ${s} ♡` : s) },
  { id: 'wave', name: 'Wave', group: 'Decorations', sr: 'fair', fn: (s) => (s ? `˜”*°•.˜”*°• ${s} •°*”˜.•°*”˜` : s) },
  { id: 'arrows', name: 'Arrows', group: 'Decorations', sr: 'fair', fn: (s) => (s ? `➵ ${s} ➶` : s) },
  { id: 'boxed-letters', name: 'Letters in brackets', group: 'Decorations', sr: 'poor', fn: wrapEach('[', ']') },
  { id: 'spaced', name: 'S p a c e d', group: 'Decorations', sr: 'poor', fn: (s) => Array.from(s).join(' ') },
  { id: 'clap', name: 'Clap 👏 between 👏 words', group: 'Decorations', sr: 'fair', fn: (s) => s.trim().split(/\s+/).join(' 👏 ') },
];
export const SR_LABEL = { fair: 'Usually readable', poor: 'Screen readers struggle', bad: 'Unreadable for screen readers' };
export const GROUPS = [...new Set(STYLES.map((s) => s.group))];
export const transform = (id, s) => (STYLES.find((x) => x.id === id) || { fn: (t) => t }).fn(String(s ?? ''));
