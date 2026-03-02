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
		console.log('Service Worker: Installing version', version);
		const cache = await caches.open(CACHE);
		await cache.addAll(ASSETS);

		// Store version info for update detection
		await cache.put(
			'/__SW_VERSION__',
			new Response(
				JSON.stringify({
					version,
					timestamp: Date.now(),
					build: build.length,
					files: files.length
				}),
				{
					headers: { 'Content-Type': 'application/json' }
				}
			)
		);
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		console.log('Service Worker: Activating version', version);
		for (const key of await caches.keys()) {
			// Keep only the current cache, delete everything else
			if (key !== CACHE) {
				console.log('Service Worker: Deleting old cache:', key);
				await caches.delete(key);
			}
		}
	}

	event.waitUntil(
		deleteOldCaches().then(() => {
			console.log('Service Worker: Activated and old caches cleared');
			// Claim all clients so the new SW takes control immediately
			return self.clients.claim().then(() => {
				// Notify all clients about the activation with version info
				return self.clients.matchAll().then((clients) => {
					clients.forEach((client) => {
						client.postMessage({
							type: 'SW_ACTIVATED',
							version: version
						});
					});
				});
			});
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

		// PURE OFFLINE-FIRST: Try cache first for ALL requests
		let cachedResponse = await cache.match(event.request);

		// For requests with special characters, try URL variations
		if (!cachedResponse && url.origin === location.origin) {
			// Try with URL-encoded version (spaces become %20)
			const encodedRequest = new Request(event.request.url.replace(/ /g, '%20'), {
				method: event.request.method,
				headers: event.request.headers,
				cache: event.request.cache,
				credentials: event.request.credentials,
				mode: event.request.mode
			});
			cachedResponse = await cache.match(encodedRequest);

			// Try with URL-decoded version (%20 becomes spaces)
			if (!cachedResponse) {
				const decodedRequest = new Request(decodeURIComponent(event.request.url), {
					method: event.request.method,
					headers: event.request.headers,
					cache: event.request.cache,
					credentials: event.request.credentials,
					mode: event.request.mode
				});
				cachedResponse = await cache.match(decodedRequest);
			}

			// For app assets, try matching just the pathname
			if (!cachedResponse && ASSETS.includes(url.pathname)) {
				cachedResponse = await cache.match(url.pathname);
			}

			// For map assets, try additional variations
			if (!cachedResponse) {
				const isMapAsset =
					url.pathname.startsWith('/glyphs/') ||
					url.pathname.startsWith('/sprites/') ||
					url.pathname.startsWith('/icons/');

				if (isMapAsset) {
					// Try all possible URL variations for map assets
					const variations = [
						event.request.url,
						event.request.url.replace(/ /g, '%20'),
						decodeURIComponent(event.request.url),
						encodeURI(event.request.url),
						event.request.url.replace(/%20/g, ' ')
					];

					for (const variation of variations) {
						try {
							cachedResponse = await cache.match(variation);
							if (cachedResponse) {
								console.log(`Found map asset in cache with variation: ${variation}`);
								break;
							}
						} catch (e) {
							// Invalid URL, continue to next variation
							continue;
						}
					}
				}
			}
		}

		// If found in cache, ALWAYS serve from cache (pure offline-first)
		if (cachedResponse) {
			const assetType = url.pathname.startsWith('/glyphs/')
				? 'glyph'
				: url.pathname.startsWith('/sprites/')
					? 'sprite'
					: url.pathname.startsWith('/icons/')
						? 'icon'
						: ASSETS.includes(url.pathname)
							? 'app-asset'
							: 'cached';
			console.log(`Serving ${assetType} from cache:`, url.pathname);
			return cachedResponse;
		}

		// Only fetch from network if NOT in cache (fallback for missing assets)
		// This should rarely happen in a properly pre-cached app
		console.warn('Asset not in cache, attempting network fallback:', url.pathname);

		// Network fallback - only used for assets not in cache
		// In a properly pre-cached offline-first app, this should rarely be used
		const isExternalRequest = url.origin !== location.origin;
		const timeout = 5000; // 5 second timeout for any network requests

		try {
			// Race between network request and timeout
			const response = await Promise.race([
				fetch(event.request),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Network timeout')), timeout))
			]);

			// if we're offline, fetch can return a value that is not a Response
			// instead of throwing - and we can't pass this non-Response to respondWith
			if (!(response instanceof Response)) {
				throw new Error('invalid response from fetch');
			}

			// Cache successful responses for future offline use
			if (
				response.status === 200 &&
				url.origin === location.origin &&
				!url.pathname.startsWith('/api/') // Don't cache API responses
			) {
				try {
					// Cache with original request URL
					await cache.put(event.request, response.clone());

					// For map assets, cache with multiple URL variations to ensure future matches
					const isMapAsset =
						url.pathname.startsWith('/glyphs/') ||
						url.pathname.startsWith('/sprites/') ||
						url.pathname.startsWith('/icons/');

					if (isMapAsset) {
						// Store additional variations to handle URL encoding issues
						const variations = [
							event.request.url.replace(/ /g, '%20'),
							event.request.url.replace(/%20/g, ' '),
							decodeURIComponent(event.request.url),
							encodeURI(event.request.url)
						];

						for (const variationUrl of variations) {
							if (variationUrl !== event.request.url) {
								try {
									const variationRequest = new Request(variationUrl, {
										method: event.request.method,
										headers: event.request.headers,
										cache: event.request.cache,
										credentials: event.request.credentials,
										mode: event.request.mode
									});
									await cache.put(variationRequest, response.clone());
								} catch (e) {
									// Invalid URL variation, skip
									continue;
								}
							}
						}
					}

					console.log('Cached missing asset for future offline use:', url.pathname);
				} catch (error) {
					// Silently ignore cache put errors (e.g., storage quota exceeded)
					console.warn('Failed to cache response:', error);
				}
			}

			return response;
		} catch (err) {
			// Network failed - return appropriate offline response
			if (isExternalRequest) {
				console.warn('External service unavailable offline:', url.href);
				return new Response('External service unavailable offline', {
					status: 503,
					statusText: 'Service Unavailable',
					headers: { 'Content-Type': 'text/plain' }
				});
			} else {
				console.warn('Asset not available offline:', url.pathname);
				return new Response('Asset not available offline', {
					status: 404,
					statusText: 'Not Found',
					headers: { 'Content-Type': 'text/plain' }
				});
			}
		}
	}

	// Note: Removed background cache updates for pure offline-first approach
	// All content is served from cache, no background network requests

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
				client.postMessage({
					type: 'SW_SKIP_WAITING',
					version: version
				});
			});
		});
	} else if (event.data && event.data.type === 'GET_VERSION') {
		// Send version info to client
		event.ports[0]?.postMessage({
			type: 'VERSION_INFO',
			version: version,
			timestamp: Date.now(),
			build: build.length,
			files: files.length
		});
	} else if (event.data && event.data.type === 'CHECK_VERSION') {
		// Compare current version with cached version
		const checkVersion = async () => {
			try {
				const cache = await caches.open(CACHE);
				const cachedVersion = await cache.match('/__SW_VERSION__');

				if (cachedVersion) {
					const versionData = await cachedVersion.json();
					event.ports[0]?.postMessage({
						type: 'VERSION_COMPARE',
						current: {
							version: version,
							timestamp: Date.now(),
							build: build.length,
							files: files.length
						},
						cached: versionData,
						isNewVersion: versionData.version !== version
					});
				} else {
					// No cached version, this is first install
					event.ports[0]?.postMessage({
						type: 'VERSION_COMPARE',
						current: {
							version: version,
							timestamp: Date.now(),
							build: build.length,
							files: files.length
						},
						cached: null,
						isNewVersion: false
					});
				}
			} catch (error) {
				console.error('Version check failed:', error);
				event.ports[0]?.postMessage({
					type: 'VERSION_ERROR',
					error: error.message
				});
			}
		};

		event.waitUntil(checkVersion());
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
