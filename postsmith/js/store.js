// Favorites + recently used tools, saved only in this browser (localStorage).
import { ls } from './ui.js';
const FAV = 'ps-favs', REC = 'ps-recent';
const list = (k) => { const v = ls.get(k, []); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; };
export const getFavs = () => list(FAV);
export const isFav = (slug) => getFavs().includes(slug);
export function toggleFav(slug) { const f = getFavs(); const i = f.indexOf(slug); i >= 0 ? f.splice(i, 1) : f.unshift(slug); ls.set(FAV, f.slice(0, 24)); return i < 0; }
export const getRecent = () => list(REC);
export function pushRecent(slug) { const r = getRecent().filter((s) => s !== slug); r.unshift(slug); ls.set(REC, r.slice(0, 8)); }
