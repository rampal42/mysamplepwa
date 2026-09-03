const CACHE_NAME = 'my-simple-pwa-v3';
const ASSETS_TO_CACHE = [
  '/mysamplepwa/',
  '/mysamplepwa/index.html',
  '/mysamplepwa/style.css',
  '/mysamplepwa/app.js',
  '/mysamplepwa/manifest.json',
  '/mysamplepwa/icons/icon-192.png',
  '/mysamplepwa/icons/icon-512.png'
];

// Install event: cache files
self.addEventListener('install', event => {
  console.log('[Service Worker] Install');
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[Service Worker] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate event: cleanup old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate');
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        })
      ))
    ])
  );
});

// Prefer fresh files while retaining offline support.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('https://generativelanguage.googleapis.com')) {
    return;
  }

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        if (networkResponse.ok) {
          const responseToCache = networkResponse.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache))
          );
        }
        return networkResponse;
      })
      .catch(() => caches.match(event.request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return caches.match('/mysamplepwa/index.html');
      }))
  );
});
