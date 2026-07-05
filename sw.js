// Cadence PWA service worker — cache the score page and detector so the installed
// app opens instantly and works with no network. Bump CACHE to ship an update.
const CACHE = 'cadence-v1';
const ASSETS = [
  'check.html',
  'extension/detector.js',
  'assets/logo.svg',
  'assets/icon-180.png',
  'assets/icon-192.png',
  'assets/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for GET; fall back to the network, and to the cached page when offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).catch(() => caches.match('check.html'))
    )
  );
});
