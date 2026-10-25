// Core PDF engine helpers: lazy-loads pdf-lib, PDF.js and qpdf (all vendored, same-origin).
import { loadScript } from './ui.js';

const BASE = new URL('../', import.meta.url).href;
let pdfjsP = null, qpdfFactoryP = null;

export async function PDFLib() { await loadScript(BASE + 'vendor/pdf-lib.min.js'); return window.PDFLib; }

export async function pdfjs() {
  if (!pdfjsP) pdfjsP = import(BASE + 'vendor/pdf.min.mjs').then((m) => { m.GlobalWorkerOptions.workerSrc = BASE + 'vendor/pdf.worker.min.mjs'; return m; });
  return pdfjsP;
}

export const qpdfSupported = () => typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function';

/** Run qpdf with args. files: {name: Uint8Array}. Returns {code, log, read(name)} */
export async function qpdf(args, files) {
  if (!qpdfSupported()) throw new Error('WebAssembly is not available in this browser.');
  if (!qpdfFactoryP) qpdfFactoryP = loadScript(BASE + 'vendor/qpdf.js').then(() => window.Module);
  const factory = await qpdfFactoryP;
  const log = [];
  const m = await factory({ locateFile: (p) => BASE + 'vendor/' + p, print: (t) => log.push(t), printErr: (t) => log.push(t) });
  for (const [n, d] of Object.entries(files)) m.FS.writeFile('/' + n, d);
  let code;
  try { code = m.callMain(args); } catch (e) { code = typeof e?.status === 'number' ? e.status : 2; if (typeof e?.status !== 'number') log.push(String(e?.message || e)); }
  return { code, log: log.join('\n'), read: (n) => { try { return m.FS.readFile('/' + n); } catch { return null; } } };
}

export async function readBytes(file) { return new Uint8Array(await file.arrayBuffer()); }

/** Open with PDF.js (copies bytes because PDF.js transfers the buffer to its worker). */
export async function openJs(bytes, password) {
  const lib = await pdfjs();
  return lib.getDocument({ data: bytes.slice(), password, isEvalSupported: false, enableXfa: false }).promise;
}

export async function isEncrypted(bytes) {
  const { PDFDocument } = await PDFLib();
  try { await PDFDocument.load(bytes, { updateMetadata: false }); return false; }
  catch (e) { if (/encrypt/i.test(e.message)) return true; throw e; }
}

export class NeedsPasswordError extends Error { constructor() { super('This PDF is password-protected. Unlock it first with the Unlock PDF tool (you need its password).'); this.name = 'NeedsPasswordError'; } }

/**
 * Prepare bytes for editing with pdf-lib. If the PDF only has an owner password (restrictions but
 * opens without a password), qpdf removes the encryption layer so it can be edited.
 */
export async function editableBytes(bytes) {
  if (!(await isEncrypted(bytes))) return { bytes, decrypted: false };
  const r = await qpdf(['--decrypt', '/in.pdf', '/out.pdf'], { 'in.pdf': bytes });
  const out = r.read('out.pdf');
  if ((r.code === 0 || r.code === 3) && out) return { bytes: out, decrypted: true };
  throw new NeedsPasswordError();
}

export async function loadLib(bytes, opts = {}) {
  const { PDFDocument } = await PDFLib();
  return PDFDocument.load(bytes, { updateMetadata: false, ...opts });
}

/** Render page (1-based) to a canvas. Either scale or width (CSS px) */
export async function renderPage(doc, n, { scale, width, maxPixels = 16e6 } = {}) {
  const page = await doc.getPage(n);
  let vp = page.getViewport({ scale: 1 });
  let s = scale ?? (width ? width / vp.width : 1);
  if (vp.width * s * vp.height * s > maxPixels) s = Math.sqrt(maxPixels / (vp.width * vp.height));
  vp = page.getViewport({ scale: s });
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
  const ctx = c.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  page.cleanup();
  return c;
}

export const canvasBlob = (c, type = 'image/png', q) => new Promise((res, rej) => c.toBlob((b) => b ? res(b) : rej(new Error('Canvas encode failed')), type, q));

export async function thumb(doc, n, width = 180) {
  const c = await renderPage(doc, n, { width: width * Math.min(2, devicePixelRatio || 1) });
  return URL.createObjectURL(await canvasBlob(c, 'image/jpeg', 0.8));
}

/** Parse "1-3, 5, 8-" (1-based) into arrays of 0-based indices. Throws on bad input. */
export function parseRanges(str, total) {
  const groups = [];
  for (const part of String(str).split(/[,;]+/).map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)?\s*(?:-\s*(\d+)?)?$/);
    if (!m || (!m[1] && !m[2] && !part.includes('-'))) throw new Error(`Couldn't read "${part}". Use something like 1-3, 5, 8-`);
    const isRange = part.includes('-');
    let a = m[1] ? +m[1] : 1, b = isRange ? (m[2] ? +m[2] : total) : a;
    if (a < 1 || b < 1 || a > total || b > total) throw new Error(`"${part}" is outside 1–${total}.`);
    const g = []; if (a <= b) for (let i = a; i <= b; i++) g.push(i - 1); else for (let i = a; i >= b; i--) g.push(i - 1);
    groups.push(g);
  }
  if (!groups.length) throw new Error('Enter at least one page or range.');
  return groups;
}

/**
 * Map "visual" coordinates (as the page is displayed: origin bottom-left, after /Rotate) to PDF user space.
 * Returns {x, y, rot} where rot is the extra rotation (degrees) to apply to drawn content so it looks upright.
 */
export function pageFrame(page) {
  const cb = page.getCropBox ? page.getCropBox() : { x: 0, y: 0, ...page.getSize() };
  const r = (((page.getRotation().angle % 360) + 360) % 360);
  const W = cb.width, H = cb.height;
  const vw = r % 180 ? H : W, vh = r % 180 ? W : H;
  const map = (vx, vy) => {
    let x, y;
    if (r === 90) { x = W - vy; y = vx; }
    else if (r === 180) { x = W - vx; y = H - vy; }
    else if (r === 270) { x = vy; y = H - vx; }
    else { x = vx; y = vy; }
    return { x: x + cb.x, y: y + cb.y };
  };
  // Correct mapping for r=90: PDF->visual is (vx,vy)=(y, W-x) so inverse x=W-vy, y=vx.
  return { vw, vh, r, map };
}

/** Rotate a vector by deg (counter-clockwise) */
export const rotV = (x, y, deg) => { const a = (deg * Math.PI) / 180; return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)]; };

/** Draw text so it appears at visual position (vx,vy = baseline-left) with visual rotation deg. */
export function drawTextVisual(page, text, { vx, vy, deg = 0, ...opts }) {
  const { degrees } = window.PDFLib; const f = pageFrame(page); const p = f.map(vx, vy);
  page.drawText(text, { ...opts, x: p.x, y: p.y, rotate: degrees(f.r + deg) });
}
export function drawImageVisual(page, img, { vx, vy, width, height, deg = 0, opacity = 1 }) {
  const { degrees } = window.PDFLib; const f = pageFrame(page); const p = f.map(vx, vy);
  page.drawImage(img, { x: p.x, y: p.y, width, height, opacity, rotate: degrees(f.r + deg) });
}

/** Replace characters the standard (WinAnsi) fonts can't encode. Returns [safeText, hadReplacements] */
export function winAnsiSafe(font, text) {
  let bad = false, out = '';
  for (const ch of text) {
    try { font.encodeText(ch); out += ch; } catch { bad = true; out += ch === '✓' || ch === '✔' ? 'X' : '?'; }
  }
  return [out, bad];
}

export function hexToRgb(hex) {
  const { rgb } = window.PDFLib; const n = parseInt(hex.replace('#', ''), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Read JPEG EXIF orientation (1..8) or 1 */
export function jpegOrientation(bytes) {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return 1;
  let o = 2;
  while (o + 4 < v.byteLength) {
    const marker = v.getUint16(o); const len = v.getUint16(o + 2);
    if (marker === 0xffe1 && v.getUint32(o + 4) === 0x45786966) {
      const t = o + 10; const le = v.getUint16(t) === 0x4949;
      const ifd = t + v.getUint32(t + 4, le); const n = v.getUint16(ifd, le);
      for (let i = 0; i < n; i++) { const e = ifd + 2 + i * 12; if (e + 10 > v.byteLength) break; if (v.getUint16(e, le) === 0x0112) return v.getUint16(e + 8, le); }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00 || marker === 0xffda) break;
    o += 2 + len;
  }
  return 1;
}

/** Load any browser-decodable image file → {kind:'jpg'|'png', bytes, width, height} ready for pdf-lib embedding. */
export async function imageForPdf(file, { jpegQuality = 0.92 } = {}) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (isJpg && jpegOrientation(bytes) === 1) {
    const bmp = await createImageBitmap(new Blob([bytes])); const r = { kind: 'jpg', bytes, width: bmp.width, height: bmp.height }; bmp.close?.(); return r;
  }
  if (isPng) {
    try { const bmp = await createImageBitmap(new Blob([bytes])); const r = { kind: 'png', bytes, width: bmp.width, height: bmp.height }; bmp.close?.(); return r; } catch {}
  }
  // Anything else (WebP, GIF, BMP, AVIF, SVG, rotated JPEG): decode via the browser and re-encode.
  let src;
  try { src = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    src = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(`Can't read ${file.name} as an image.`)); i.src = URL.createObjectURL(file); });
  }
  const w = src.naturalWidth || src.width || 1000, h = src.naturalHeight || src.height || 1000;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d'); ctx.drawImage(src, 0, 0, w, h);
  // keep transparency for PNG-ish sources, JPEG for photos
  const alpha = !isJpg && hasAlpha(ctx, w, h);
  const blob = await canvasBlob(c, alpha ? 'image/png' : 'image/jpeg', jpegQuality);
  return { kind: alpha ? 'png' : 'jpg', bytes: new Uint8Array(await blob.arrayBuffer()), width: w, height: h };
}
function hasAlpha(ctx, w, h) {
  const step = Math.max(1, Math.floor(Math.sqrt((w * h) / 40000)));
  const d = ctx.getImageData(0, 0, w, h).data;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) if (d[(y * w + x) * 4 + 3] < 250) return true;
  return false;
}

export const baseName = (n) => n.replace(/\.[^.]+$/, '');
export const pdfBlob = (bytes) => new Blob([bytes], { type: 'application/pdf' });
