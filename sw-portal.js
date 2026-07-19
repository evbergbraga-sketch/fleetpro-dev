// sw-portal.js — Service Worker Portal Royal
const CACHE = 'royal-portal-v14';
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
  const url = new URL(e.request.url);

  // APIs (portal/bridge): sempre rede, nunca cache
  if (url.pathname.startsWith('/portal/') || url.hostname.includes('bridge')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Navegação de página (abrir/recarregar o app) e o próprio portal.html:
  // Network First — busca a versão mais nova do servidor; só usa o cache
  // se a rede falhar de verdade (offline). Isso garante que reabrir o
  // app instalado sempre traz a versão publicada mais recente.
  const ehNavegacao = e.request.mode === 'navigate' || url.pathname.endsWith('/portal.html');
  if (ehNavegacao) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          // Clona IMEDIATAMENTE (síncrono) — se esperar o caches.open()
          // (assíncrono) para clonar, o corpo da resposta original pode já
          // ter sido consumido nesse meio tempo, e o clone() falha com
          // "Response body is already used".
          const respClone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, respClone));
          return resp;
        })
        .catch(() => caches.match(e.request).then(cached => cached || caches.match('/portal.html')))
    );
    return;
  }

  // Demais assets estáticos (ícones, manifest): Cache First — raramente
  // mudam, prioriza velocidade e funcionamento offline.
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
