// SnakeKeeper Service Worker
// Versione cache — aggiorna questo numero per forzare refresh
const CACHE_VERSION = 'sk-v1';
const CACHE_NAME = `snakekeeper-${CACHE_VERSION}`;

// File da cachare per uso offline
const STATIC_ASSETS = [
  '/Snakekeeper/',
  '/Snakekeeper/index.html',
  '/Snakekeeper/icon-192.png',
  '/Snakekeeper/icon-512.png',
  '/Snakekeeper/manifest.json',
];

// ── INSTALL: scarica e cacha tutti gli asset ──
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: elimina cache vecchie ──
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k.startsWith('snakekeeper-') && k !== CACHE_NAME)
            .map(k => { console.log('[SW] Deleting old cache:', k); return caches.delete(k); })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: strategia Network-first per API, Cache-first per static ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Richieste Supabase: network-first (mai cachare dati live)
  if (url.hostname.includes('supabase.co') || url.hostname.includes('qrserver.com') || url.hostname.includes('fonts.googleapis.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Se offline e la richiesta fallisce, restituisci risposta vuota per le API
        if (url.hostname.includes('supabase.co')) {
          return new Response(JSON.stringify([]), {
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response('', { status: 503 });
      })
    );
    return;
  }
  
  // Asset statici: cache-first
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
        // Offline fallback per pagine HTML
        if (event.request.destination === 'document') {
          return caches.match('/Snakekeeper/');
        }
        return new Response('Offline', { status: 503 });
      });
    })
  );
});

// ── BACKGROUND SYNC: sincronizza dati offline quando torna la connessione ──
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pending-data') {
    event.waitUntil(syncPendingData());
  }
});

async function syncPendingData() {
  // Notifica tutte le finestre aperte che possono fare la sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => client.postMessage({ type: 'SYNC_REQUESTED' }));
}
