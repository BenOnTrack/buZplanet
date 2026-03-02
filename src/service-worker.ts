import { build, files, version } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE_NAME = `cache-${version}`;

// Assets to cache on install
const ASSETS = [
	...build, // the app itself
	...files // everything in static
];

console.log('SW: Service Worker starting, version:', version);
console.log('SW: Assets to cache:', ASSETS.length);

// INSTALL EVENT - Cache all assets
self.addEventListener('install', (event) => {
	console.log('SW: Installing version', version);

	event.waitUntil(
		caches
			.open(CACHE_NAME)
			.then((cache) => {
				console.log('SW: Caching assets...');
				return cache.addAll(ASSETS);
			})
			.then(() => {
				console.log('SW: All assets cached successfully');

				// Store version info
				return caches.open(CACHE_NAME).then((cache) =>
					cache.put(
						'/__SW_VERSION__',
						new Response(
							JSON.stringify({
								version,
								timestamp: Date.now(),
								build: build.length,
								files: files.length
							}),
							{ headers: { 'Content-Type': 'application/json' } }
						)
					)
				);
			})
			.then(() => {
				// Check if this is an update
				const isUpdate = Boolean(self.registration?.active);
				if (isUpdate) {
					// For updates, notify clients but don't take control yet
					return self.clients.matchAll().then((clients) => {
						clients.forEach((client) => {
							client.postMessage({
								type: 'SW_INSTALLED',
								version,
								isUpdate: true
							});
						});
						console.log('SW: Update available, waiting for user decision');
					});
				} else {
					// For fresh installs, take control immediately
					console.log('SW: Fresh install, taking control');
					return self.skipWaiting();
				}
			})
			.catch((error) => {
				console.error('SW: Failed to cache assets:', error);
				throw error;
			})
	);
});

// ACTIVATE EVENT - Clean up old caches and take control
self.addEventListener('activate', (event) => {
	console.log('SW: Activating version', version);

	event.waitUntil(
		// Delete old caches
		caches
			.keys()
			.then((cacheNames) => {
				const deletePromises = cacheNames
					.filter((name) => name.startsWith('cache-') && name !== CACHE_NAME)
					.map((name) => {
						console.log('SW: Deleting old cache:', name);
						return caches.delete(name);
					});
				return Promise.all(deletePromises);
			})
			.then((deletedCaches) => {
				if (deletedCaches.length > 0) {
					console.log('SW: Deleted', deletedCaches.filter(Boolean).length, 'old caches');
				}
				// Take control of all clients
				return self.clients.claim();
			})
			.then(() => {
				console.log('SW: Claimed all clients');
				// Notify clients of activation
				return self.clients.matchAll();
			})
			.then((clients) => {
				const isUpdate = clients.length > 0;
				clients.forEach((client) => {
					client.postMessage({
						type: 'SW_ACTIVATED',
						version,
						isUpdate
					});
				});
				console.log('SW: Activated and notified', clients.length, 'clients');
			})
			.catch((error) => {
				console.error('SW: Activation failed:', error);
				throw error;
			})
	);
});

// Helper function to get fallback response for navigation
function getFallbackResponse(url: URL): Promise<Response> {
	// For navigation requests, serve the app shell
	if (url.pathname !== '/' && !url.pathname.includes('.')) {
		return caches.match('/').then((fallbackResponse) => {
			if (fallbackResponse) {
				console.log('SW: Served app shell as fallback for:', url.pathname);
				return fallbackResponse;
			}
			return new Response('Unable to load content offline', {
				status: 503,
				statusText: 'Service Unavailable',
				headers: { 'Content-Type': 'text/plain' }
			});
		});
	}

	// For other resources, return a generic offline response
	return Promise.resolve(
		new Response('Resource unavailable offline', {
			status: 503,
			statusText: 'Service Unavailable',
			headers: { 'Content-Type': 'text/plain' }
		})
	);
}

// FETCH EVENT - Cache-first strategy
self.addEventListener('fetch', (event) => {
	// Only handle GET requests
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Skip non-http requests and external requests
	if (!url.protocol.startsWith('http') || url.hostname !== self.location.hostname) {
		return;
	}

	event.respondWith(
		caches.match(event.request).then((cachedResponse) => {
			if (cachedResponse) {
				console.log('SW: Serving from cache:', url.pathname);
				return cachedResponse;
			}

			// Not in cache, try network
			console.log('SW: Not in cache, fetching from network:', url.pathname);

			return fetch(event.request)
				.then((networkResponse) => {
					// Check if response is valid
					if (
						!networkResponse ||
						networkResponse.status !== 200 ||
						networkResponse.type !== 'basic'
					) {
						console.log('SW: Invalid network response, serving fallback:', url.pathname);
						return getFallbackResponse(url);
					}

					// Clone and cache the response
					const responseToCache = networkResponse.clone();
					caches.open(CACHE_NAME).then((cache) => {
						cache.put(event.request, responseToCache);
						console.log('SW: Cached new response from network:', url.pathname);
					});

					return networkResponse;
				})
				.catch((error) => {
					console.log('SW: Network request failed, serving fallback:', url.pathname, error.message);
					return getFallbackResponse(url);
				});
		})
	);
});

// MESSAGE EVENT - Handle commands from the app
self.addEventListener('message', (event) => {
	console.log('SW: Received message:', event.data?.type);

	switch (event.data?.type) {
		case 'SKIP_WAITING':
		case 'ACCEPT_UPDATE':
			console.log('SW: User accepted update, taking control');
			self
				.skipWaiting()
				.then(() => self.clients.claim())
				.then(() => self.clients.matchAll())
				.then((clients) => {
					clients.forEach((client) => {
						client.postMessage({
							type: 'SW_SKIP_WAITING',
							version
						});
					});
					console.log('SW: Takeover complete, notified', clients.length, 'clients');
				})
				.catch((error) => {
					console.error('SW: Takeover failed:', error);
				});
			break;

		case 'GET_VERSION':
			// Handle both direct response and MessageChannel
			const versionInfo = {
				type: 'VERSION_INFO',
				version,
				timestamp: Date.now(),
				build: build.length,
				files: files.length
			};

			if (event.ports && event.ports[0]) {
				event.ports[0].postMessage(versionInfo);
			} else if (event.source) {
				event.source.postMessage(versionInfo);
			}
			break;

		case 'CHECK_VERSION':
			const checkVersion = async () => {
				try {
					const cache = await caches.open(CACHE_NAME);
					const cachedVersion = await cache.match('/__SW_VERSION__');

					const currentVersionData = {
						version,
						timestamp: Date.now(),
						build: build.length,
						files: files.length
					};

					let responseData;

					if (cachedVersion) {
						const versionData = await cachedVersion.json();
						responseData = {
							type: 'VERSION_COMPARE',
							current: currentVersionData,
							cached: versionData,
							isNewVersion: versionData.version !== version
						};
					} else {
						// No cached version, this is first install
						responseData = {
							type: 'VERSION_COMPARE',
							current: currentVersionData,
							cached: null,
							isNewVersion: false
						};
					}

					if (event.ports && event.ports[0]) {
						event.ports[0].postMessage(responseData);
					} else if (event.source) {
						event.source.postMessage(responseData);
					}
				} catch (error) {
					console.error('Version check failed:', error);
					const errorData = {
						type: 'VERSION_ERROR',
						error: error.message
					};

					if (event.ports && event.ports[0]) {
						event.ports[0].postMessage(errorData);
					} else if (event.source) {
						event.source.postMessage(errorData);
					}
				}
			};
			event.waitUntil(checkVersion());
			break;

		case 'POSTPONE_UPDATE':
			console.log('SW: User postponed update');
			self.clients.matchAll().then((clients) => {
				clients.forEach((client) => {
					client.postMessage({
						type: 'SW_UPDATE_POSTPONED',
						version
					});
				});
			});
			break;

		default:
			console.log('SW: Unknown message type:', event.data?.type);
	}
});

console.log('SW: Service Worker setup complete, version:', version);

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
