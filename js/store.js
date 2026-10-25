// Local-only persistence: favorites/recent tools (localStorage) and file handoff between tools (IndexedDB).
const LS_FAV = 'lf-favs', LS_RECENT = 'lf-recent';
const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch { return []; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const getFavs = () => read(LS_FAV);
export const isFav = (slug) => getFavs().includes(slug);
export function toggleFav(slug) { const f = getFavs(); const i = f.indexOf(slug); i >= 0 ? f.splice(i, 1) : f.unshift(slug); write(LS_FAV, f.slice(0, 24)); return i < 0; }
export const getRecent = () => read(LS_RECENT);
export function pushRecent(slug) { const r = getRecent().filter((s) => s !== slug); r.unshift(slug); write(LS_RECENT, r.slice(0, 8)); }

function db() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('localforge', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('kv');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function tx(mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('kv', mode); const s = t.objectStore('kv'); const out = fn(s); t.oncomplete = () => res(out.result); t.onerror = () => rej(t.error); }); }
export const setHandoff = (name, bytes) => tx('readwrite', (s) => s.put({ name, bytes, t: Date.now() }, 'handoff'));
export async function getHandoff() { try { const v = await tx('readonly', (s) => s.get('handoff')); if (v && Date.now() - v.t < 30 * 60e3) return v; } catch {} return null; }
export const clearHandoff = () => tx('readwrite', (s) => s.delete('handoff')).catch(() => {});
