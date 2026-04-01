const CACHE_NAME = 'roayti-cache-v8';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.svg',
  '/offline.html'
];

// Install event - caching core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching core assets');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - cleaning up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - Network first, falling back to cache
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // If successful, clone it and put it in the cache
        if (response.status === 200 && event.request.url.startsWith(self.location.origin)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // If network fails, try to get it from the cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // If it's a navigation request, return the offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});

// Background Sync
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-data') {
    console.log('Service Worker: Syncing data');
  }
});

// Message event
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Periodic Background Sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'get-daily-news') {
    console.log('Service Worker: Periodic sync');
  }
});

// Push Notifications
self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'روايتي Ai';
  const options = {
    body: data.body || 'لديك إشعار جديد من روايتي',
    icon: '/logo.svg',
    badge: '/logo.svg'
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});
