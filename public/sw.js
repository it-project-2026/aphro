const CACHE_NAME = 'aphro-v2026.09.15.01';
const ASSETS_TO_CACHE = [
  '/manifest.json',
  '/favicon.ico',
  '/favicon.png',
  '/icon.png',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png'
];

// Install Event: Precache static app shell assets (Excluding index.html & version.json)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate Event: Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Listen for SKIP_WAITING message from client
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch Event: Smart Cache Strategy
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // 1. Always Network-Only for version.json & Supabase API calls
  if (url.pathname.endsWith('/version.json') || url.pathname.includes('/rest/v1/') || url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Network-First for HTML navigation / index.html (Never rely on stale index.html)
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request, { cache: 'no-cache' })
        .then((networkResponse) => networkResponse)
        .catch(() => caches.match('/index.html') || caches.match('/'))
    );
    return;
  }

  // 3. Cache-First for Hashed JS/CSS and static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((networkResponse) => {
        // Cache static assets dynamically (excluding API/HTML)
        if (networkResponse.status === 200 && (url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|woff2?)$/))) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        }
        return networkResponse;
      });
    })
  );
});
