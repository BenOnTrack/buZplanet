<script lang="ts">
	import MapView from '$lib/components/map/MapView.svelte';
	import BottomNavigation from '$lib/components/nav/BottomNavigation.svelte';
	import AuthDialog from '$lib/components/dialogs/AuthDialog.svelte';
	import UserStoreManager from '$lib/components/stores/UserStoreManager.svelte';
	import FileManagerDialog from '$lib/components/dialogs/FileManagerDialog.svelte';
	import SettingsDialog from '$lib/components/nav/SettingsDialog.svelte';
	import MapFilterDialog from '$lib/components/dialogs/MapFilterDialog.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import SearchBar from '$lib/components/nav/SearchBar.svelte';
	import SearchResultsDrawer from '$lib/components/drawers/SearchResultsDrawer.svelte';
	import SelectedFeatureDrawer from '$lib/components/drawers/SelectedFeatureDrawer.svelte';
	import OfflineInstallationRequired from '$lib/components/OfflineInstallationRequired.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { searchControl } from '$lib/stores/SearchControl.svelte';
	import { appInitializer } from '$lib/utils/app-initialization';
	import { appState } from '$lib/stores/AppState.svelte';
	import { authState } from '$lib/stores/auth.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { swManager } from '$lib/utils/service-worker-manager.svelte.js';
	import { onMount, onDestroy } from 'svelte';
	import SearchCategoryDialog from '$lib/components/dialogs/SearchCategoryDialog.svelte';

	// Initialization state
	type InitState = {
		status:
			| 'pending'
			| 'initializing'
			| 'auth-waiting'
			| 'appstate-loading'
			| 'worker-ready'
			| 'appstate-ready'
			| 'protocol-ready'
			| 'database-scanning'
			| 'complete'
			| 'error';
		logs: string[];
		error?: string;
	};

	let initState = $state<InitState>({
		status: 'pending',
		logs: []
	});

	let isAppReady = $derived(initState.status === 'complete');
	let isMapReady = $derived(isAppReady && !authState.loading && appState.isReady);

	// Check if app is installed (has cached resources)
	let isAppInstalled = $state(false);

	// Simple offline status tracking
	let isOnline = $state(navigator?.onLine ?? true);

	// Track if this is first install attempt
	let isFirstInstallAttempt = $state(false);

	// Simple handlers that delegate to search store
	async function handleSearch(query: string) {
		await searchControl.search(query);
	}

	function handleClearSearch() {
		searchControl.clearSearch();
	}

	// Subscribe to initialization state changes
	let unsubscribe: (() => void) | null = null;

	// Auth monitoring after initial setup
	let hasCompletedInitialAuth = false;
	$effect(() => {
		// Only handle changes after app is fully ready
		if (initState.status !== 'complete') return;

		const currentUser = authState.user;

		// Skip the first run after initialization is complete
		if (!hasCompletedInitialAuth) {
			hasCompletedInitialAuth = true;
			return;
		}

		console.log(
			`🔄 Auth change detected after initialization: ${currentUser ? `User ${currentUser.uid}` : 'Anonymous'}`
		);

		// Update AppState and databases
		appState.handleUserChange(currentUser);
		featuresDB.handleUserChange(currentUser);
		storiesDB.handleUserChange(currentUser);
	});

	onMount(() => {
		console.log('🚀 Main app mounting');

		// Subscribe to initialization state
		unsubscribe = appInitializer.subscribe((state) => {
			initState = state;
		});

		// Add global app cleanup handler
		const handleAppCleanup = () => {
			// This event can be caught by components that need to save state
			console.log('App cleanup triggered');
		};

		// Handle app visibility changes for better lifecycle management
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				console.log('📱 Main app going to background');
				// Trigger cleanup event for components to save state
				const event = new CustomEvent('app-cleanup');
				window.dispatchEvent(event);
			} else if (document.visibilityState === 'visible') {
				console.log('📱 Main app returning from background');
				// Check if worker is still responsive
				if (initState.status === 'complete') {
					checkWorkerHealth();
				}
			}
		};

		window.addEventListener('app-cleanup', handleAppCleanup);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Start initialization with proper sequence - check installation first
		try {
			// Check installation status first, then initialize
			checkAppInstallation()
				.then(() => {
					return initializeAppSafely();
				})
				.then((result) => {
					if (!result.success) {
						console.error('App initialization failed:', result.error);
					}
				})
				.catch((error) => {
					console.error('Unexpected initialization error:', error);
				});
		} catch (error) {
			console.error('Unexpected initialization error:', error);
		}

		return () => {
			console.log('🧹 Main app unmounting - cleaning up');
			window.removeEventListener('app-cleanup', handleAppCleanup);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	// Worker health check after returning from background
	async function checkWorkerHealth() {
		try {
			const { getWorker } = await import('$lib/utils/worker');
			const worker = getWorker();

			// Try a quick ping with short timeout
			const startTime = Date.now();
			await Promise.race([
				worker.ping(),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Ping timeout')), 2000))
			]);
			const responseTime = Date.now() - startTime;

			console.log(`✅ Worker health check passed (${responseTime}ms)`);
		} catch (error) {
			console.warn('⚠️ Worker health check failed, may need restart:', error);
			// Optionally restart worker or show notification to user
			// For now just log - you might want to implement worker restart logic
		}
	}

	// Clean up when component is destroyed
	onDestroy(async () => {
		console.log('🧹 Main app destroying - cleaning up');

		// Save any pending app state before cleanup
		if (typeof window !== 'undefined') {
			// Trigger a final save of any pending state
			const event = new CustomEvent('app-cleanup');
			window.dispatchEvent(event);
		}

		if (unsubscribe) {
			unsubscribe();
		}

		// Dynamically import to avoid static import issues
		try {
			const { terminateWorker } = await import('$lib/utils/worker');
			terminateWorker();
			console.log('✅ Worker terminated successfully');
		} catch (error) {
			console.warn('Failed to terminate worker:', error);
		}
	});

	/**
	 * Check if the app is properly installed (has cached resources)
	 */
	async function checkAppInstallation() {
		try {
			// Check if service worker is registered and has caches
			const registration = await navigator.serviceWorker?.ready;
			if (registration) {
				// Check for cached resources, not PWA installation status
				const cacheNames = await caches.keys();
				const hasCachedResources = cacheNames.some((name) => name.startsWith('cache-'));

				if (hasCachedResources) {
					// Verify at least some assets are cached
					try {
						const cache = await caches.open(cacheNames.find((name) => name.startsWith('cache-'))!);
						const keys = await cache.keys();
						isAppInstalled = keys.length > 0;
						console.log(
							`App installation check: ${isAppInstalled ? 'Installed' : 'Not installed'} (${keys.length} cached resources)`
						);
					} catch (error) {
						console.warn('Error checking cache contents:', error);
						isAppInstalled = hasCachedResources; // Fall back to just checking cache existence
					}
				} else {
					isAppInstalled = false;
					console.log('App installation check: Not installed (no caches found)');
				}
			} else {
				isAppInstalled = false;
				console.log('Service worker not available');
			}
		} catch (error) {
			console.warn('Failed to check app installation:', error);
			isAppInstalled = false;
		}
	}

	/**
	 * Safe initialization that handles offline scenarios
	 */
	async function initializeAppSafely() {
		// If offline and not installed, show installation required screen
		if (!isOnline && !isAppInstalled) {
			isFirstInstallAttempt = true;
			return { success: false, error: 'Installation required - please connect to internet' };
		}

		// If poor connection, try fast mode initialization
		const connectionQuality = await checkConnectionSpeed();
		const useFastMode = connectionQuality === 'poor' || !isOnline;

		if (useFastMode) {
			console.log('🗡️ Using fast offline-first initialization mode');
		}

		return initializeAppWithAuth(useFastMode);
	}

	/**
	 * Quick connection speed check
	 */
	async function checkConnectionSpeed(): Promise<'poor' | 'good'> {
		if (!navigator.onLine) return 'poor';

		try {
			const start = performance.now();
			await Promise.race([
				fetch('/favicon.ico', { cache: 'no-cache' }),
				new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 1500))
			]);
			const responseTime = performance.now() - start;
			return responseTime < 500 ? 'good' : 'poor';
		} catch {
			return 'poor';
		}
	}
	/**
	 * Initialize app with proper auth -> AppState -> worker sequence
	 */
	async function initializeAppWithAuth(fastMode = false) {
		try {
			// Step 1: Quick auth state check with timeout
			initState.status = 'auth-waiting';
			console.log('🔐 Checking authentication state...');

			// Set a reasonable timeout for auth loading
			const authTimeout = fastMode ? 3000 : 8000;
			const startTime = Date.now();

			// Wait for auth with timeout
			while (authState.loading && Date.now() - startTime < authTimeout) {
				await new Promise((resolve) => setTimeout(resolve, 100)); // Poll every 100ms
			}

			// If still loading after timeout, continue anyway
			if (authState.loading) {
				console.warn('⚠️ Auth loading timeout - continuing with unauthenticated state');
			}

			const currentUser = authState.user;
			console.log(
				`✅ Auth determined: ${currentUser ? `User ${currentUser.uid}` : 'Anonymous'} (${Date.now() - startTime}ms)`
			);

			// Step 2: Load AppState with timeout
			initState.status = 'appstate-loading';
			console.log('🔧 Loading AppState...');

			try {
				const appStateTimeout = fastMode ? 2000 : 5000;
				await Promise.race([
					appState.handleUserChange(currentUser),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error('AppState timeout')), appStateTimeout)
					)
				]);
				console.log(
					`✅ AppState loaded! Map view: [${appState.mapView.center.join(', ')}] @ z${appState.mapView.zoom}`
				);
			} catch (error) {
				console.warn('⚠️ AppState timeout - using defaults:', error);
				// Continue with defaults - not critical
			}

			// Step 2.5: Initialize databases quickly
			console.log('💾 Initializing databases...');
			try {
				featuresDB.handleUserChange(currentUser);
				storiesDB.handleUserChange(currentUser);
			} catch (error) {
				console.warn('Database initialization warning:', error);
			}

			// Step 3: Initialize worker and core functionality
			console.log('🚀 Starting core initialization...');
			const result = await appInitializer.initialize(fastMode);

			return result;
		} catch (error) {
			console.error('❌ Initialization failed:', error);
			initState.status = 'error';
			initState.error = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, error: initState.error };
		}
	}

	// Listen to browser online/offline events
	$effect(() => {
		if (typeof window === 'undefined') return;

		const handleOnline = () => {
			isOnline = true;
		};
		const handleOffline = () => {
			isOnline = false;
		};

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});
</script>

<main class="app-container">
	{#if !isOnline && !isAppInstalled && isFirstInstallAttempt}
		<OfflineInstallationRequired />
	{:else if !isAppReady}
		<LoadingScreen {initState} showLogs={import.meta.env.DEV} />
	{:else}
		<AuthDialog />
		<UserStoreManager />
		<FileManagerDialog />
		<SettingsDialog {initState} {isAppReady} {isOnline} />
		<MapFilterDialog />

		<!-- Search Bar and Category Button Container -->
		<div class="search-container" style="z-index: {Z_INDEX.SEARCH_BAR}">
			<div class="search-bar-wrapper">
				<SearchBar
					bind:value={searchControl.query}
					onSearch={handleSearch}
					onClear={handleClearSearch}
					placeholder="Search places, addresses, points of interest..."
				/>
			</div>
			<div class="search-category-wrapper">
				<SearchCategoryDialog />
			</div>
		</div>

		<MapView ready={isMapReady} />
		<BottomNavigation />

		<!-- Search Results Drawer -->
		<SearchResultsDrawer
			bind:open={searchControl.drawerOpen}
			results={searchControl.results}
			searchQuery={searchControl.query}
			isSearching={searchControl.isSearching}
			currentSearchingDatabase={searchControl.currentSearchingDatabase}
			showOnMap={true}
		/>

		<!-- Selected Feature Drawer - render after SearchResultsDrawer to ensure proper layering -->
		<SelectedFeatureDrawer
			bind:open={mapControl.selectedFeatureDrawerOpen}
			feature={mapControl.selectedFeature}
		/>
	{/if}
</main>

<style>
	.app-container {
		position: relative;
		width: 100%;
		height: 100vh;
		height: 100dvh;
		overflow: hidden;
	}

	/* Search Container Styling - replaces search-bar-container */
	.search-container {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 0; /* No gap - components should touch */
		width: auto; /* Let it size to content */
		max-width: none; /* Remove max-width so it can be truly centered */
		padding: 0;
		pointer-events: none;
		/* Ensure visibility above map controls */
		opacity: 1 !important;
		visibility: visible !important;
		/* Force above MapLibre controls which typically use z-index 1 */
		z-index: 200 !important;
	}

	.search-bar-wrapper {
		flex-shrink: 0; /* Don't shrink */
		width: 360px; /* Fixed width for search bar */
		pointer-events: auto;
	}

	.search-category-wrapper {
		flex-shrink: 0;
		pointer-events: auto;
		margin-left: 8px; /* Small gap to separate visually but keep them close */
	}

	.search-container :global(.search-container) {
		pointer-events: auto;
	}

	/* Override MapLibre control z-index globally */
	:global(.maplibregl-ctrl) {
		z-index: 5 !important; /* Lower than search bar */
	}

	:global(.maplibregl-ctrl-group) {
		z-index: 5 !important; /* Lower than search bar */
	}

	/* Responsive adjustments */
	@media (max-width: 768px) {
		.search-container {
			top: 16px;
			/* On mobile, position with margins instead of centering */
			left: 80px; /* Start after buttons */
			right: 80px; /* Right margin to account for category button */
			transform: none; /* Remove centering transform */
			width: auto;
			max-width: none;
			padding: 0;
			justify-content: space-between; /* Spread them out */
		}

		.search-bar-wrapper {
			width: auto; /* Let it flex on mobile */
			flex: 1; /* Take available space */
			min-width: 0; /* Allow shrinking */
		}

		.search-category-wrapper {
			margin-left: 8px; /* Keep consistent spacing */
			flex-shrink: 0; /* Don't let button shrink */
		}
	}

	@media (max-width: 640px) {
		.search-container {
			top: 14px;
			left: 70px; /* Slightly less margin */
			right: 50px;
		}
	}

	@media (max-width: 480px) {
		.search-container {
			top: 12px;
			left: 70px;
			right: 50px;
		}

		.search-category-wrapper {
			margin-left: 6px; /* Smaller gap on very small screens */
		}
	}

	@media (max-width: 360px) {
		.search-container {
			left: 60px;
			right: 40px;
		}
	}
</style>
