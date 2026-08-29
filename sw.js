// SnakeKeeper Service Worker
const CACHE_VERSION = 'sk-v14';
const CACHE_NAME = `snakekeeper-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/icon-192.png',
  '/icon-512.png',
  '/manifest.json',
  '/hero-snake.webp',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // API calls e risorse esterne — sempre network
  if (url.hostname.includes('supabase.co') || url.hostname.includes('stripe.com') || url.hostname.includes('qrserver.com') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Prima restituiva un finto 200 con [] per le chiamate Supabase: sembrava un
        // aiuto "offline-friendly", ma nascondeva ogni fallimento di rete dietro una
        // risposta indistinguibile da un account vuoto — l'app non poteva più sapere
        // che il caricamento era fallito. Un 503 reale lascia che SB.req() lanci
        // l'errore come previsto, così l'app può gestirlo (retry, banner) invece di
        // credere che i dati siano semplicemente assenti.
        return new Response(JSON.stringify({ message: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  // index.html — SEMPRE network first
  if (url.pathname === '/' || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Tutto il resto — cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-data') {
    event.waitUntil(
      self.clients.matchAll().then(clients =>
        clients.forEach(c => c.postMessage({ type: 'SYNC_REQUESTED' }))
      )
    );
  }
});
