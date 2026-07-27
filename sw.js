// SnakeKeeper Service Worker
const CACHE_VERSION = 'sk-v3';  // Incrementato per forzare refresh
const CACHE_NAME = `snakekeeper-${CACHE_VERSION}`;

const STATIC_ASSETS = [
  '/Snakekeeper/',
  '/Snakekeeper/index.html',
  '/Snakekeeper/icon-192.png',
  '/Snakekeeper/icon-512.png',
  '/Snakekeeper/manifest.json',
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
        keys.filter(k => k.startsWith('snakekeeper-') && k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  if (url.hostname.includes('supabase.co') || url.hostname.includes('qrserver.com') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        if (url.hostname.includes('supabase.co')) {
          return new Response(JSON.stringify([]), { headers: { 'Content-Type': 'application/json' } });
        }
        return new Response('', { status: 503 });
      })
    );
    return;
  }

  // Network-first per index.html — assicura sempre versione aggiornata
  if (url.pathname.includes('index.html') || url.pathname.endsWith('/Snakekeeper/')) {
    event.respondWith(
      fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

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
          return caches.match('/Snakekeeper/');
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
