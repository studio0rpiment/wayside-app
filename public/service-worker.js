const CACHE_NAME = 'wayside-app-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/vite.svg',
  // Add paths to your A-Frame and AR.js scripts
  'https://aframe.io/releases/1.3.0/aframe.min.js',
  'https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js',
  // Add paths to your marker images
  '/markers/marker1.patt',
  '/markers/marker2.patt',
  // Add paths to your 3D models, textures, and other assets
  '/models/model1.gltf',
  '/models/model2.gltf',
  '/textures/texture1.jpg',
  // Add paths to your compiled JS and CSS files
  // You'll need to update these based on your actual build output
  '/assets/index-[hash].js',
  '/assets/index-[hash].css'
];

// Install event - cache all necessary resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        // Try to cache all assets but don't fail if some can't be cached
        return cache.addAll(ASSETS_TO_CACHE).catch(err => {
          console.error('Some assets failed to cache:', err);
        });
      })
  );
});

// Fetch event - serve from cache first, then network
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // Not found in cache, fetch from network
        return fetch(event.request)
          .then((networkResponse) => {
            // Don't cache cross-origin resources
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }
            
            // Clone the response to cache it and return it
            const responseToCache = networkResponse.clone();
            
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });
            
            return networkResponse;
          })
          .catch(() => {
            // If both cache and network fail, return a simple offline page
            // or a default "offline" asset
            if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
              return caches.match('/offline-image.jpg');
            }
            return caches.match('/offline.html');
          });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});