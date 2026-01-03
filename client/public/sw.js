// Service Worker for Smart Hjem PWA
const CACHE_VERSION = 'v1.6'; // Updated version to force cache refresh
const CACHE_NAME = `smart-hjem-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Only cache essential static assets
const urlsToCache = [
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// Install event - skip waiting to activate immediately
self.addEventListener('install', event => {
  console.log('Service Worker installing with cache:', CACHE_NAME);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting()) // Activate immediately
  );
});

// Fetch event - Network first strategy for API, cache-first for assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip caching for API calls and auth-related requests
  if (url.pathname.startsWith('/api') || 
      url.pathname.startsWith('/auth') || 
      url.pathname.startsWith('/login') ||
      url.pathname.startsWith('/logout')) {
    event.respondWith(
      fetch(request, { 
        credentials: 'include',
        cache: 'no-store' 
      }).catch(() => {
        return new Response('Network error', {
          status: 503,
          statusText: 'Service Unavailable'
        });
      })
    );
    return;
  }
  
  // Skip caching for development hot reload
  if (url.pathname.includes('hot-update') || 
      url.pathname.includes('@vite') ||
      url.pathname.includes('@fs')) {
    event.respondWith(fetch(request));
    return;
  }
  
  // For other requests, try network first, fall back to cache
  event.respondWith(
    fetch(request, { cache: 'no-cache' })
      .then(response => {
        // Only cache successful responses
        if (response.status === 200) {
          const responseToCache = response.clone();
          caches.open(RUNTIME_CACHE).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache if network fails
        return caches.match(request).then(response => {
          if (response) {
            return response;
          }
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return new Response(
              '<html><body><h1>Offline</h1><p>Vennligst sjekk internettforbindelsen din.</p></body></html>',
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('Resource not available offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Activate event - Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker activating, cleaning old caches');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          // Delete all old caches
          if (!cacheName.includes(CACHE_VERSION)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Listen for messages from the client
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
  
  // Clear all caches if requested
  if (event.data === 'clearCache') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }).then(() => {
        // Send message back to client
        event.ports[0].postMessage({ cacheCleared: true });
      })
    );
  }
});