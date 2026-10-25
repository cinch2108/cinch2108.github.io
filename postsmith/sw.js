// Postsmith service worker: caches the app shell for offline use. Every path is relative to
// this file, so it works at the domain root or under any sub-path.
const V = 'ps-mvo0yemt';
const BASE = new URL('./', self.location).href;
const CORE = ["./","fancy-text-generator/","character-counter/","hashtag-generator/","emoji-picker/","social-media-image-sizes/","link-in-bio-builder/","privacy/","terms/","manifest.webmanifest","favicon.svg","img/logo.svg","fonts/inter.woff2","data/emoji.json","css/styles.css?v=mvo0yemt","js/theme.js?v=mvo0yemt","js/consent.js?v=mvo0yemt","js/app.js?v=mvo0yemt","js/bio-icons.js","js/bio-render.js","js/catalog.js","js/count.js","js/fancy.js","js/hashtag-data.js","js/limits.js","js/sizes-data.js","js/store.js","js/tool-bio.js","js/tool-counter.js","js/tool-emoji.js","js/tool-fancy.js","js/tool-hashtags.js","js/tool-sizes.js","js/ui.js","vendor/fflate.js"].map((p) => new URL(p, BASE).href);
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('ps-') && k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin || !r.url.startsWith(BASE)) return;
  if (r.mode === 'navigate') {
    // network-first for pages so content updates show immediately; offline falls back to cache
    e.respondWith(fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; })
      .catch(() => caches.match(r, { ignoreSearch: true }).then((m) => m || caches.match(BASE))));
    return;
  }
  e.respondWith(caches.match(r).then((m) => {
    const net = fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; });
    return m || net;
  }));
});
