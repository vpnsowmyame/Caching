// public/service-worker.js
const CACHE_NAME = 'my-app-cache-v1';
const API_CACHE_NAME = 'api-cache-v1';

// List of assets to cache on install (optional, but good for offline first)
// For this demo, we'll only cache the API call
const urlsToCache = [];

// Install event: Fires when the service worker is installed.
// Typically used to cache static assets.
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install Event. Caching static assets...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Opened cache');
                return cache.addAll(urlsToCache);
            })
            .catch(error => {
                console.error('[Service Worker] Failed to cache static assets:', error);
            })
    );
});

// Activate event: Fires when the service worker is activated.
// Typically used to clean up old caches.
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate Event. Cleaning old caches...');
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
                        console.log('[Service Worker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // This ensures that the service worker controls the page immediately after activation
    return self.clients.claim();
});

// Fetch event: Fires for every network request made by the page controlled by this service worker.
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Strategy 1: Cache First, then Network for our API data
    if (url.origin === self.location.origin && url.pathname === '/api/data') {
        console.log(`[Service Worker] Intercepting API request for ${url.pathname}`);
        event.respondWith(
            caches.open(API_CACHE_NAME).then(cache => {
                return cache.match(request).then(response => {
                    // Return cached response if available
                    if (response) {
                        console.log('[Service Worker] Serving API data from cache:', url.pathname);
                        return response;
                    }

                    // Otherwise, fetch from network and cache it
                    console.log('[Service Worker] Fetching API data from network:', url.pathname);
                    return fetch(request).then(networkResponse => {
                        // Check if we received a valid response
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }

                        // IMPORTANT: Clone the response. A response is a stream and can only be consumed once.
                        // We're consuming it here to cache, and the browser will consume it to deliver to the page.
                        const responseToCache = networkResponse.clone();
                        cache.put(request, responseToCache);
                        console.log('[Service Worker] API data cached:', url.pathname);
                        return networkResponse;
                    }).catch(error => {
                        console.error('[Service Worker] Network request for API data failed:', error);
                        // Fallback in case network fails and no cache is available
                        return new Response('<h1>Offline content</h1><p>Sorry, this content is not available offline.</p>', {
                            headers: { 'Content-Type': 'text/html' }
                        });
                    });
                });
            })
        );
        return; // Important: Stop here if we handled the request
    }

    // Default strategy: Network First (or let browser handle if not specifically cached)
    // For other requests (like static assets from our React app build), let the browser handle them,
    // which might involve its own HTTP cache.
    event.respondWith(fetch(request).catch(() => {
        // This catch block is hit if the network request fails AND there's no cache match for the request.
        // You can return a generic offline page here for other resources if desired.
        // For this demo, we'll keep it simple and just let the network error propagate if not API.
        console.warn(`[Service Worker] Network request failed for: ${url.pathname}. No specific offline fallback.`);
    }));
});