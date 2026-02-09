import { build, files, version } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;

// Assets to cache on install
const ASSETS = [
	...build, // the app itself
	...files // everything in static
];

self.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		for (const key of await caches.keys()) {
			if (key !== CACHE) await caches.delete(key);
		}
	}

	event.waitUntil(
		deleteOldCaches().then(() => {
			console.log('Service Worker: Activated and old caches cleared');
			// Claim all clients so the new SW takes control immediately
			return self.clients.claim();
		})
	);
});

self.addEventListener('fetch', (event) => {
	// Ignore POST requests etc
	if (event.request.method !== 'GET') return;

	// Filter out unsupported URL schemes
	const url = new URL(event.request.url);
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return; // Let the browser handle chrome-extension:, moz-extension:, etc.
	}

	async function respond() {
		const cache = await caches.open(CACHE);

		// `build`/`files` can always be served from the cache
		if (ASSETS.includes(url.pathname)) {
			const response = await cache.match(url.pathname);
			if (response) {
				return response;
			}
		}

		// For everything else, try the network first, but
		// fall back to the cache if we're offline
		try {
			const response = await fetch(event.request);

			// if we're offline, fetch can return a value that is not a Response
			// instead of throwing - and we can't pass this non-Response to respondWith
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			// Only cache successful responses from our domain
			if (
				response.status === 200 &&
				url.origin === location.origin &&
				!url.pathname.startsWith('/api/') // Don't cache API responses
			) {
				try {
					cache.put(event.request, response.clone());
				} catch (error) {
					// Silently ignore cache put errors (e.g., storage quota exceeded)
					console.warn('Failed to cache response:', error);
				}
			}

			return response;
		} catch (err) {
			const response = await cache.match(event.request);

			if (response) {
				return response;
			}

			// if there's no cache, then just error out
			// as there is nothing we can do to respond to this request
			throw err;
		}
	}

	event.respondWith(respond());
});

// Handle messages from clients
self.addEventListener('message', (event) => {
	if (event.data && event.data.type === 'SKIP_WAITING') {
		console.log('Service Worker: Received SKIP_WAITING message');
		self.skipWaiting();

		// Notify all clients that we're about to take control
		self.clients.matchAll().then((clients) => {
			clients.forEach((client) => {
				client.postMessage({ type: 'SW_SKIP_WAITING' });
			});
		});
	}
});

// Handle notification clicks if you want to add push notifications later
self.addEventListener('notificationclick', (event) => {
	event.notification.close();

	event.waitUntil(
		self.clients.matchAll().then((clients) => {
			if (clients.length > 0) {
				clients[0].focus();
			} else {
				self.clients.openWindow('/');
			}
		})
	);
});

// Optional: Handle background sync for offline actions
self.addEventListener('sync', (event) => {
	console.log('Background sync:', event.tag);
	// Add your background sync logic here
});
