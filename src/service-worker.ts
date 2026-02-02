/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

// Version information
const APP_VERSION = version;
const BUILD_DATE = new Date().toISOString();

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;
const RUNTIME_CACHE = `runtime-${version}`;

// Log version information
console.log(`Service Worker: Version ${APP_VERSION} - Built: ${BUILD_DATE}`);

const ASSETS = [
  ...build, // the app itself
  ...files  // everything in `static`
];

// Cache strategies for different types of resources
const CACHE_STRATEGIES = {
  // Always cache these critical files
  CRITICAL: [
    '/',
    '/offline',
    // Add other critical routes here
  ],
  
  // Cache but update in background
  STALE_WHILE_REVALIDATE: [
    '/api/', // API routes for when they work offline
  ],
  
  // Network first, fallback to cache
  NETWORK_FIRST: [
  ]
};

self.addEventListener('install', (event) => {
  console.log(`Service Worker: Installing version ${APP_VERSION}`);
  
  // Skip waiting - automatically activate the new service worker
  self.skipWaiting();
  
  // Create a new cache and add all files to it
  async function addFilesToCache() {
    const cache = await caches.open(CACHE);
    
    // Filter out files that might not exist and add them in batches
    const validAssets = [];
    
    for (const asset of ASSETS) {
      try {
        const response = await fetch(asset);
        if (response.ok) {
          validAssets.push(asset);
        }
      } catch (err) {
        console.warn(`Failed to fetch asset: ${asset}`, err);
      }
    }
    
    if (validAssets.length > 0) {
      // Add assets in smaller batches to avoid overwhelming the cache
      const batchSize = 50;
      for (let i = 0; i < validAssets.length; i += batchSize) {
        const batch = validAssets.slice(i, i + batchSize);
        try {
          await cache.addAll(batch);
        } catch (err) {
          console.warn('Failed to cache batch:', batch, err);
          // Try to add them individually if batch fails
          for (const asset of batch) {
            try {
              await cache.add(asset);
            } catch (individualErr) {
              console.warn(`Failed to cache individual asset: ${asset}`, individualErr);
            }
          }
        }
      }
    }
    
    console.log(`Service Worker: Cached ${validAssets.length} assets for version ${APP_VERSION}`);
  }

  event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
  console.log(`Service Worker: Activated version ${APP_VERSION}`);
  
  // Remove previous cached data from disk
  async function deleteOldCaches() {
    for (const key of await caches.keys()) {
      if (key !== CACHE && key !== RUNTIME_CACHE) {
        console.log(`Service Worker: Deleting old cache ${key}`);
        await caches.delete(key);
      }
    }
  }

  // Take control of all clients immediately
  self.clients.claim();
  
  // Notify all clients that a new version is active
  async function notifyClients() {
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(client => {
      client.postMessage({
        type: 'NEW_VERSION_ACTIVATED',
        version: APP_VERSION,
        buildDate: BUILD_DATE
      });
    });
  }
  
  event.waitUntil(Promise.all([
    deleteOldCaches(),
    notifyClients()
  ]));
});

self.addEventListener('fetch', (event) => {
  // ignore POST requests etc
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  
  // Skip caching for unsupported schemes (chrome-extension, moz-extension, etc.)
  const unsupportedSchemes = ['chrome-extension', 'moz-extension', 'safari-extension', 'ms-browser-extension'];
  if (unsupportedSchemes.includes(url.protocol.replace(':', ''))) {
    return;
  }
  
  // Only handle requests from the same origin or relative URLs
  if (url.origin !== location.origin && !url.pathname.startsWith('/')) {
    return;
  }

  async function respond() {
    const cache = await caches.open(CACHE);
    const runtimeCache = await caches.open(RUNTIME_CACHE);

    // `build`/`files` can always be served from the cache
    if (ASSETS.includes(url.pathname)) {
      const response = await cache.match(url.pathname);
      if (response) {
        return response;
      }
    }

    // Handle app routes - serve the app shell for SPA routes
    if (url.origin === location.origin && 
        !url.pathname.startsWith('/api/') && 
        !url.pathname.includes('.') && 
        url.pathname !== '/') {
      
      // Try to serve the cached index.html for SPA routes
      const appShell = await cache.match('/') || await cache.match('/index.html');
      if (appShell) {
        // For offline, serve the app shell which will handle routing client-side
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse instanceof Response) {
            return networkResponse;
          }
        } catch (err) {
          // Network failed, serve app shell
          return appShell;
        }
      }
    }

    // For everything else, try network first, then cache
    try {
      const response = await fetch(event.request);

      // if we're offline, fetch can return a value that is not a Response
      // instead of throwing - and we can't pass this non-Response to respondWith
      if (!(response instanceof Response)) {
        throw new Error('invalid response from fetch');
      }

      // Only cache successful responses from the same origin
      if (response.status === 200 && url.origin === location.origin) {
        try {
          // Cache in runtime cache for non-asset requests
          runtimeCache.put(event.request, response.clone());
        } catch (cacheError) {
          // Silently fail if we can't cache the request
          console.warn('Failed to cache request:', event.request.url, cacheError);
        }
      }

      return response;
    } catch (err) {
      // Network failed, try cache
      const cachedResponse = await cache.match(event.request) || 
                            await runtimeCache.match(event.request);

      if (cachedResponse) {
        return cachedResponse;
      }

      // If it's a navigation request and we have no cached version,
      // serve the app shell so the app can handle it
      if (event.request.mode === 'navigate') {
        const appShell = await cache.match('/') || await cache.match('/index.html');
        if (appShell) {
          return appShell;
        }
      }

      // if there's no cache, then just error out
      // as there is nothing we can do to respond to this request
      throw err;
    }
  }

  event.respondWith(respond());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    // Send version information back to the client
    event.ports[0]?.postMessage({
      type: 'VERSION_INFO',
      version: APP_VERSION,
      buildDate: BUILD_DATE,
      cacheNames: {
        main: CACHE,
        runtime: RUNTIME_CACHE
      }
    });
  }
  
  if (event.data && event.data.type === 'FORCE_REFRESH_ALL') {
    // Force refresh all clients
    self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
      clients.forEach(client => {
        client.navigate(client.url);
      });
    });
  }
});