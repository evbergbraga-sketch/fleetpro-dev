// sw-portal.js — Service Worker Portal Royal
const CACHE = 'royal-portal-v7';
const ASSETS = [
  '/portal.html',
  '/manifest-portal.json',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/icons/logo-Royal.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Rede primeiro para APIs, cache para assets estáticos
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/portal/') || url.hostname.includes('bridge')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
