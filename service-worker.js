const CACHE_NAME = 'my-simple-pwa-v2';
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
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('[Service Worker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      )
    )
  );
});

// Fetch event: serve from cache, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
