// LocalForge PDF service worker: caches the app shell only (never user files).
const V = 'lf-mvnzz5ql';
const CORE = ['/', '/css/styles.css', '/js/theme.js', '/js/app.js', '/js/consent.js', '/js/ui.js', '/js/store.js', '/js/catalog.js', '/fonts/inter.woff2', '/img/logo.svg', '/favicon.svg'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(V).then((c) => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); if (u.origin !== location.origin) return;
  if (r.mode === 'navigate' || r.headers.get('accept')?.includes('text/html')) {
    // network-first for pages so content updates show immediately
    e.respondWith(fetch(r).then((res) => { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); return res; }).catch(() => caches.match(r).then((m) => m || caches.match('/'))));
    return;
  }
  // cache-first (stale-while-revalidate) for static assets; vendor libs are cached the first time a tool uses them
  e.respondWith(caches.match(r).then((m) => {
    const net = fetch(r).then((res) => { if (res.ok) { const cp = res.clone(); caches.open(V).then((c) => c.put(r, cp)); } return res; });
    return m || net;
  }));
});
