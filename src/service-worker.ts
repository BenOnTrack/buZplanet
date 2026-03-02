import { build, files, version } from '$service-worker';

// Create a unique cache name for this deployment
const CACHE = `cache-${version}`;
const CACHE_PREFIX = 'cache-';

// Assets to cache on install
const ASSETS = [
	...build, // the app itself
	...files // everything in static
];

console.log('SW: Service Worker starting, version:', version);
console.log('SW: Assets to cache:', ASSETS.length);

self.addEventListener('install', (event) => {
	// Create a new cache and add all files to it
	async function addFilesToCache() {
		console.log('Service Worker: Installing version', version);
		console.log('Cache name:', CACHE);
		console.log('Assets to cache:', ASSETS.length);

		try {
			const cache = await caches.open(CACHE);

			// Add all assets in smaller batches to avoid quota issues
			const batchSize = 10;
			const totalBatches = Math.ceil(ASSETS.length / batchSize);

			// Notify clients about installation start
			self.clients.matchAll().then((clients) => {
				clients.forEach((client) => {
					client.postMessage({
						type: 'SW_INSTALL_START',
						version,
						totalAssets: ASSETS.length,
						totalBatches
					});
				});
			});

			for (let i = 0; i < ASSETS.length; i += batchSize) {
				const batch = ASSETS.slice(i, i + batchSize);
				const currentBatch = Math.floor(i / batchSize) + 1;

				try {
					await cache.addAll(batch);
					console.log(`Cached batch ${currentBatch}/${totalBatches}`);

					// Notify clients about progress
					self.clients.matchAll().then((clients) => {
						clients.forEach((client) => {
							client.postMessage({
								type: 'SW_INSTALL_PROGRESS',
								version,
								currentBatch,
								totalBatches,
								progress: Math.round((currentBatch / totalBatches) * 100)
							});
						});
					});
				} catch (error) {
					console.error('Failed to cache batch:', batch, error);
					// Try to cache individual files from failed batch
					for (const asset of batch) {
						try {
							await cache.add(asset);
						} catch (individualError) {
							console.error('Failed to cache individual asset:', asset, individualError);
						}
					}

					// Still notify progress even if batch failed
					self.clients.matchAll().then((clients) => {
						clients.forEach((client) => {
							client.postMessage({
								type: 'SW_INSTALL_PROGRESS',
								version,
								currentBatch,
								totalBatches,
								progress: Math.round((currentBatch / totalBatches) * 100),
								hasErrors: true
							});
						});
					});
				}
			}

			// Store version info for update detection
			await cache.put(
				'/__SW_VERSION__',
				new Response(
					JSON.stringify({
						version,
						timestamp: Date.now(),
						build: build.length,
						files: files.length,
						cacheName: CACHE
					}),
					{
						headers: { 'Content-Type': 'application/json' }
					}
				)
			);

			console.log('Service Worker: Successfully installed version', version);

			// Notify clients about successful installation
			self.clients.matchAll().then((clients) => {
				clients.forEach((client) => {
					client.postMessage({
						type: 'SW_INSTALL_COMPLETE',
						version,
						totalAssets: ASSETS.length
					});
				});
			});

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
		} catch (error) {
			console.error('Service Worker: Installation failed:', error);
			throw error;
		}
	}

	event.waitUntil(addFilesToCache());
});

self.addEventListener('activate', (event) => {
	// Remove previous cached data from disk
	async function deleteOldCaches() {
		console.log('Service Worker: Activating version', version);

		// Get all cache keys
		const cacheKeys = await caches.keys();
		console.log('Found caches:', cacheKeys);

		// Delete all caches that start with our prefix but aren't the current cache
		const deletePromises = cacheKeys
			.filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE)
			.map(async (key) => {
				console.log('Service Worker: Deleting old cache:', key);
				try {
					const deleted = await caches.delete(key);
					if (deleted) {
						console.log('Successfully deleted cache:', key);
					} else {
						console.warn('Failed to delete cache:', key);
					}
					return deleted;
				} catch (error) {
					console.error('Error deleting cache:', key, error);
					return false;
				}
			});

		// Wait for all deletions to complete
		const results = await Promise.allSettled(deletePromises);
		console.log('Cache cleanup results:', results);
	}

	event.waitUntil(
		deleteOldCaches().then(() => {
			console.log('Service Worker: Activated and old caches cleared');
			// Claim all clients so the new SW takes control immediately
			return self.clients.claim().then(() => {
				console.log('Service Worker: Claimed all clients');
				// Notify all clients about the activation with version info
				return self.clients.matchAll().then((clients) => {
					console.log('Notifying', clients.length, 'clients about activation');
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
			// Skip URL variations for navigation requests to avoid mode errors
			if (event.request.mode !== 'navigate') {
				// Try with URL-encoded version (spaces become %20)
				try {
					const encodedRequest = new Request(event.request.url.replace(/ /g, '%20'), {
						method: event.request.method,
						headers: event.request.headers,
						cache: event.request.cache,
						credentials: event.request.credentials
						// Omit mode to avoid navigate mode issues
					});
					cachedResponse = await cache.match(encodedRequest);
				} catch (e) {
					console.warn('Failed to create encoded request:', e);
				}

				// Try with URL-decoded version (%20 becomes spaces)
				if (!cachedResponse) {
					try {
						const decodedRequest = new Request(decodeURIComponent(event.request.url), {
							method: event.request.method,
							headers: event.request.headers,
							cache: event.request.cache,
							credentials: event.request.credentials
							// Omit mode to avoid navigate mode issues
						});
						cachedResponse = await cache.match(decodedRequest);
					} catch (e) {
						console.warn('Failed to create decoded request:', e);
					}
				}
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

					if (isMapAsset && event.request.mode !== 'navigate') {
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
										credentials: event.request.credentials
										// Omit mode for navigation requests
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
		const versionInfo = {
			type: 'VERSION_INFO',
			version: version,
			timestamp: Date.now(),
			build: build.length,
			files: files.length
		};

		if (event.ports && event.ports[0]) {
			event.ports[0].postMessage(versionInfo);
		} else if (event.source) {
			event.source.postMessage(versionInfo);
		}
	} else if (event.data && event.data.type === 'CHECK_VERSION') {
		// Compare current version with cached version
		const checkVersion = async () => {
			try {
				const cache = await caches.open(CACHE);
				const cachedVersion = await cache.match('/__SW_VERSION__');

				const currentVersionData = {
					version: version,
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
