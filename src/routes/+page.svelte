<script lang="ts">
	import MapView from '$lib/components/map/MapView.svelte';
	import BottomNavigation from '$lib/components/nav/BottomNavigation.svelte';
	import AuthDialog from '$lib/components/dialogs/AuthDialog.svelte';
	import UserStoreManager from '$lib/components/stores/UserStoreManager.svelte';
	import FileManagerDialog from '$lib/components/dialogs/FileManagerDialog.svelte';
	import SettingsDialog from '$lib/components/nav/SettingsDialog.svelte';
	import MapFilterDialog from '$lib/components/nav/MapFilterDialog.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import SearchBar from '$lib/components/nav/SearchBar.svelte';
	import SearchResultsDrawer from '$lib/components/drawers/SearchResultsDrawer.svelte';
	import SelectedFeatureDrawer from '$lib/components/drawers/SelectedFeatureDrawer.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { searchControl } from '$lib/stores/SearchControl.svelte';
	import { appInitializer } from '$lib/utils/app-initialization';
	import { appState } from '$lib/stores/AppState.svelte';
	import { authState } from '$lib/stores/auth.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { Z_INDEX } from '$lib/styles/z-index.js';
	import { onMount, onDestroy } from 'svelte';

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
	let showDebugPanel = $state(false);

	// Tile cache debugging state
	let cacheStats = $state<any>({});
	let cacheContents = $state<any[]>([]);
	let recentTiles = $state<any[]>([]);
	let popularTiles = $state<any[]>([]);
	let debugUpdateInterval: ReturnType<typeof setInterval> | null = null;
	let activeCacheTab = $state<'stats' | 'contents' | 'recent' | 'popular'>('stats');

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

		// Start initialization with proper auth sequence
		try {
			initializeAppWithAuth().then((result) => {
				if (!result.success) {
					console.error('App initialization failed:', result.error);
				}
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

	// Clean up worker when component is destroyed
	onDestroy(async () => {
		console.log('🧹 Main app destroying - cleaning up');

		// Save any pending app state before cleanup
		if (typeof window !== 'undefined') {
			// Trigger a final save of any pending state
			const event = new CustomEvent('app-cleanup');
			window.dispatchEvent(event);
		}

		if (debugUpdateInterval) {
			clearInterval(debugUpdateInterval);
			debugUpdateInterval = null;
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
	 * Initialize app with proper auth -> AppState -> worker sequence
	 */
	async function initializeAppWithAuth() {
		try {
			// Step 1: Wait for auth state to be determined
			initState.status = 'auth-waiting';
			console.log('🔐 Waiting for authentication to be determined...');

			// Wait for auth loading to complete
			while (authState.loading) {
				await new Promise((resolve) => setTimeout(resolve, 50)); // Poll every 50ms
			}

			const currentUser = authState.user;
			console.log(`✅ Auth determined: ${currentUser ? `User ${currentUser.uid}` : 'Anonymous'}`);

			// Step 2: Load AppState for the authenticated user
			initState.status = 'appstate-loading';
			console.log('🔧 Loading AppState for user...');

			await appState.handleUserChange(currentUser);
			console.log(
				`✅ AppState loaded! Map view: [${appState.mapView.center.join(', ')}] @ z${appState.mapView.zoom}`
			);

			// Step 2.5: Initialize databases with the authenticated user
			console.log('💾 Initializing databases for user...');
			featuresDB.handleUserChange(currentUser);
			storiesDB.handleUserChange(currentUser);

			// Step 3: Now initialize the worker and rest of the app
			console.log('🚀 Starting worker initialization...');
			const result = await appInitializer.initialize();

			return result;
		} catch (error) {
			console.error('❌ Auth-based initialization failed:', error);
			initState.status = 'error';
			initState.error = error instanceof Error ? error.message : 'Unknown error';
			return { success: false, error: initState.error };
		}
	}

	// Development testing functions
	// Simple offline status tracking
	let isOnline = $state(navigator?.onLine ?? true);

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

	// Development testing functions
	async function testWorker() {
		try {
			const { getWorker } = await import('$lib/utils/worker');
			const worker = getWorker();

			const pingResponse = await worker.ping();

			const taskResponse = await worker.processTask(
				`Test task at ${new Date().toLocaleTimeString()}`
			);

			// Test tile request if databases are available
			try {
				const testTile = await worker.requestTile('basemap', 0, 0, 0);
			} catch (tileError) {
				// Tile test skipped if no basemap.mbtiles found
			}
		} catch (error) {
			console.error('Test failed:', error);
		}
	}

	function clearLogs() {
		if (initState.logs) {
			initState = { ...initState, logs: [] };
		}
	}

	// Tile cache debugging functions
	async function updateCacheData() {
		if (!showDebugPanel || !isAppReady) return;

		try {
			const { getWorker } = await import('$lib/utils/worker');
			const worker = getWorker();

			if (activeCacheTab === 'stats') {
				cacheStats = await worker.getTileCacheStats();
			} else if (activeCacheTab === 'contents') {
				cacheContents = await worker.getCacheContents();
			} else if (activeCacheTab === 'recent') {
				recentTiles = await worker.getRecentTiles(10);
			} else if (activeCacheTab === 'popular') {
				popularTiles = await worker.getPopularTiles(10);
			}
		} catch (error) {
			console.debug('Failed to update cache data:', error);
		}
	}

	async function clearTileCache() {
		try {
			const { getWorker } = await import('$lib/utils/worker');
			const worker = getWorker();
			await worker.clearTileCache();
			await updateCacheData(); // Refresh after clearing
			console.log('🧹 Tile cache cleared');
		} catch (error) {
			console.error('Failed to clear tile cache:', error);
		}
	}

	function switchCacheTab(tab: typeof activeCacheTab) {
		activeCacheTab = tab;
		updateCacheData();
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function formatTileKey(key: string): { source: string; z: number; x: number; y: number } {
		const [source, z, x, y] = key.split('-');
		return { source, z: Number(z), x: Number(x), y: Number(y) };
	}

	// Watch showDebugPanel changes to start/stop cache updates
	$effect(() => {
		if (showDebugPanel && isAppReady) {
			// Start cache data updates
			updateCacheData();
			debugUpdateInterval = setInterval(updateCacheData, 3000);

			// Add global console function
			if (typeof window !== 'undefined') {
				(window as any).inspectTileCache = async () => {
					try {
						const { getWorker } = await import('$lib/utils/worker');
						const worker = getWorker();
						const stats = await worker.getTileCacheStats();
						const contents = await worker.getCacheContents();
						const recent = await worker.getRecentTiles(10);

						console.group('🚀 Tile Cache Inspector');
						console.log('📊 Stats:', stats);
						console.log('📦 Contents:', contents);
						console.log('🕐 Recent:', recent);
						console.log('💡 Usage: window.inspectTileCache() to run this again');
						console.groupEnd();

						return { stats, contents, recent };
					} catch (error) {
						console.error('Failed to inspect cache:', error);
					}
				};
				console.log('💡 Use window.inspectTileCache() to inspect the tile cache from console');
			}
		} else {
			// Stop cache data updates
			if (debugUpdateInterval) {
				clearInterval(debugUpdateInterval);
				debugUpdateInterval = null;
			}
		}
	});
</script>

<main class="app-container">
	{#if !isAppReady}
		<LoadingScreen state={initState} showLogs={import.meta.env.DEV} />
	{:else}
		<AuthDialog />
		<UserStoreManager />
		<FileManagerDialog />
		<SettingsDialog />
		<MapFilterDialog />

		<!-- Search Bar -->
		<div class="search-bar-container" style="z-index: {Z_INDEX.SEARCH_BAR}">
			<SearchBar
				bind:value={searchControl.query}
				onSearch={handleSearch}
				onClear={handleClearSearch}
				placeholder="Search places, addresses, points of interest..."
			/>
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

	<!-- Worker Debug Panel - only show in development when app is ready -->
	{#if import.meta.env.DEV && isAppReady}
		<div class="worker-debug-panel" style="z-index: {Z_INDEX.DEBUG_PANEL}">
			<button
				class="debug-toggle"
				onclick={() => (showDebugPanel = !showDebugPanel)}
				onkeydown={(e) => e.key === 'Enter' && (showDebugPanel = !showDebugPanel)}
				aria-label="Toggle worker debug panel"
			>
				🔧 Worker: {initState.status}
			</button>

			{#if showDebugPanel}
				<div class="debug-content">
					<div class="debug-controls">
						<button onclick={testWorker} onkeydown={(e) => e.key === 'Enter' && testWorker()}
							>Test Worker</button
						>
						<button onclick={clearLogs} onkeydown={(e) => e.key === 'Enter' && clearLogs()}
							>Clear Logs</button
						>
						<button
							onclick={clearTileCache}
							onkeydown={(e) => e.key === 'Enter' && clearTileCache()}>Clear Cache</button
						>
					</div>

					<!-- Tile Cache Section -->
					<div class="cache-section">
						<h4>🚀 Tile Cache</h4>

						<!-- Cache Tabs -->
						<div class="cache-tabs">
							<button
								class:active={activeCacheTab === 'stats'}
								onclick={() => switchCacheTab('stats')}
							>
								📊 Stats
							</button>
							<button
								class:active={activeCacheTab === 'contents'}
								onclick={() => switchCacheTab('contents')}
							>
								📦 All ({cacheContents.length})
							</button>
							<button
								class:active={activeCacheTab === 'recent'}
								onclick={() => switchCacheTab('recent')}
							>
								🕐 Recent
							</button>
							<button
								class:active={activeCacheTab === 'popular'}
								onclick={() => switchCacheTab('popular')}
							>
								🔥 Popular
							</button>
						</div>

						<!-- Cache Content -->
						<div class="cache-content">
							{#if activeCacheTab === 'stats'}
								<div class="cache-stats">
									<div class="stat-row">
										<span>Memory Hits:</span>
										<span class="stat-value hit"
											>{cacheStats.memoryHits?.toLocaleString() || 0}</span
										>
									</div>
									<div class="stat-row">
										<span>OPFS Fetches:</span>
										<span class="stat-value fetch"
											>{cacheStats.opfsFetches?.toLocaleString() || 0}</span
										>
									</div>
									<div class="stat-row">
										<span>Hit Ratio:</span>
										<span class="stat-value ratio">
											{cacheStats.memoryHits && cacheStats.opfsFetches
												? (
														(cacheStats.memoryHits /
															(cacheStats.memoryHits + cacheStats.opfsFetches)) *
														100
													).toFixed(1)
												: 0}%
										</span>
									</div>
									<div class="stat-row">
										<span>Memory Size:</span>
										<span class="stat-value">{cacheStats.memorySizeFormatted || '0 B'}</span>
									</div>
									<div class="stat-row">
										<span>Tiles Cached:</span>
										<span class="stat-value">{cacheStats.tilesInMemory?.toLocaleString() || 0}</span
										>
									</div>
									<div class="stat-row">
										<span>Prefetch Queue:</span>
										<span class="stat-value">{cacheStats.prefetchQueueSize || 0}</span>
									</div>
									<div class="stat-row">
										<span>Prefetching:</span>
										<span class="stat-value" class:active={cacheStats.isPrefetching}>
											{cacheStats.isPrefetching ? '🟢 Active' : '🔴 Idle'}
										</span>
									</div>
								</div>
							{:else if activeCacheTab === 'contents'}
								<div class="tile-list">
									{#each cacheContents.slice(0, 20) as { key, tile }}
										{@const parsed = formatTileKey(key)}
										<div class="tile-item">
											<div class="tile-key">{parsed.source}-{parsed.z}/{parsed.x}/{parsed.y}</div>
											<div class="tile-meta">
												<span>{formatBytes(tile.size)}</span>
												<span>×{tile.accessCount}</span>
											</div>
										</div>
									{/each}
									{#if cacheContents.length > 20}
										<div class="tile-item more">...and {cacheContents.length - 20} more tiles</div>
									{/if}
									{#if cacheContents.length === 0}
										<div class="tile-item empty">No tiles cached yet</div>
									{/if}
								</div>
							{:else if activeCacheTab === 'recent'}
								<div class="tile-list">
									{#each recentTiles as { key, tile, accessedAgo }}
										{@const parsed = formatTileKey(key)}
										<div class="tile-item">
											<div class="tile-key">{parsed.source}-{parsed.z}/{parsed.x}/{parsed.y}</div>
											<div class="tile-meta">
												<span class="recent-time">{accessedAgo}</span>
												<span>×{tile.accessCount}</span>
											</div>
										</div>
									{/each}
									{#if recentTiles.length === 0}
										<div class="tile-item empty">No recent tiles</div>
									{/if}
								</div>
							{:else if activeCacheTab === 'popular'}
								<div class="tile-list">
									{#each popularTiles as { key, tile }, index}
										{@const parsed = formatTileKey(key)}
										<div class="tile-item">
											<div class="tile-key">
												#{index + 1}
												{parsed.source}-{parsed.z}/{parsed.x}/{parsed.y}
											</div>
											<div class="tile-meta">
												<span class="popular-count">×{tile.accessCount}</span>
												<span>{formatBytes(tile.size)}</span>
											</div>
										</div>
									{/each}
									{#if popularTiles.length === 0}
										<div class="tile-item empty">No popular tiles yet</div>
									{/if}
								</div>
							{/if}
						</div>
					</div>

					<!-- Sync Status Section -->
					<div class="sync-status-section">
						<h4>🔄 Sync Status</h4>

						<div class="status-row">
							<strong>Connection:</strong>
							{isOnline ? '🌐 Online' : '📴 Offline'}
						</div>

						<div class="status-row">
							<strong>Firestore:</strong>
							✅ Native Offline Support Enabled
						</div>
					</div>

					<div class="debug-logs">
						{#each initState.logs as log}
							<div class="log-entry">{log}</div>
						{/each}
						{#if initState.logs.length === 0}
							<div class="log-entry empty">No logs yet...</div>
						{/if}
					</div>

					<!-- Console Helper -->
					<div class="console-helper">
						<div class="helper-title">🔧 Console Commands</div>
						<code>window.inspectTileCache()</code> - Full cache inspection
					</div>
				</div>
			{/if}
		</div>
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

	.worker-debug-panel {
		position: fixed;
		top: 20px;
		right: 20px;
		font-family: monospace;
		font-size: 12px;
	}

	.debug-toggle {
		background: rgba(0, 0, 0, 0.8);
		color: white;
		border: none;
		padding: 8px 12px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 11px;
		font-family: monospace;
		transition: background-color 0.2s;
	}

	.debug-toggle:hover {
		background: rgba(0, 0, 0, 0.9);
	}

	.debug-content {
		background: rgba(0, 0, 0, 0.9);
		color: white;
		border-radius: 4px;
		padding: 12px;
		margin-top: 8px;
		width: 450px;
		max-height: 600px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		overflow-y: auto;
	}

	.debug-controls {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.debug-controls button {
		background: #007acc;
		color: white;
		border: none;
		padding: 6px 10px;
		border-radius: 3px;
		cursor: pointer;
		font-size: 10px;
		font-family: monospace;
		transition: background-color 0.2s;
	}

	.debug-controls button:hover {
		background: #005a9e;
	}

	/* Tile Cache Styles */
	.cache-section {
		margin: 12px 0;
		padding: 8px 0;
		border-top: 1px solid #333;
		border-bottom: 1px solid #333;
	}

	.cache-section h4 {
		margin: 0 0 8px 0;
		font-size: 11px;
		font-weight: bold;
	}

	.cache-tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 8px;
		flex-wrap: wrap;
	}

	.cache-tabs button {
		background: #333;
		color: #ccc;
		border: 1px solid #555;
		padding: 4px 8px;
		border-radius: 3px;
		cursor: pointer;
		font-size: 9px;
		font-family: monospace;
		transition: all 0.2s;
	}

	.cache-tabs button:hover {
		background: #444;
		color: white;
	}

	.cache-tabs button.active {
		background: #007acc;
		color: white;
		border-color: #007acc;
	}

	.cache-content {
		max-height: 200px;
		overflow-y: auto;
		background: rgba(0, 0, 0, 0.3);
		border-radius: 3px;
		padding: 8px;
	}

	.cache-stats {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.stat-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 10px;
		line-height: 1.3;
	}

	.stat-value {
		font-weight: bold;
		font-family: monospace;
	}

	.stat-value.hit {
		color: #4ade80;
	}

	.stat-value.fetch {
		color: #60a5fa;
	}

	.stat-value.ratio {
		color: #f59e0b;
	}

	.stat-value.active {
		color: #4ade80;
	}

	.tile-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.tile-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 6px;
		background: rgba(255, 255, 255, 0.05);
		border-radius: 2px;
		font-size: 9px;
		font-family: monospace;
		line-height: 1.2;
	}

	.tile-item.empty {
		color: #666;
		font-style: italic;
		justify-content: center;
	}

	.tile-item.more {
		color: #888;
		justify-content: center;
	}

	.tile-key {
		color: #e5e7eb;
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tile-meta {
		display: flex;
		gap: 8px;
		color: #9ca3af;
		flex-shrink: 0;
	}

	.recent-time {
		color: #4ade80;
	}

	.popular-count {
		color: #f59e0b;
		font-weight: bold;
	}

	/* Console Helper */
	.console-helper {
		margin-top: 12px;
		padding: 8px;
		background: rgba(0, 0, 0, 0.5);
		border-radius: 3px;
		border: 1px solid #333;
	}

	.helper-title {
		font-size: 10px;
		font-weight: bold;
		margin-bottom: 4px;
		color: #f59e0b;
	}

	.console-helper code {
		font-size: 9px;
		color: #4ade80;
		background: rgba(0, 0, 0, 0.8);
		padding: 2px 4px;
		border-radius: 2px;
	}

	.debug-logs {
		max-height: 150px;
		overflow-y: auto;
		border: 1px solid #333;
		border-radius: 3px;
		padding: 8px;
		background: rgba(0, 0, 0, 0.5);
	}

	/* Sync Status Styles */
	.sync-status-section {
		margin: 12px 0;
		padding: 8px 0;
		border-top: 1px solid #333;
		border-bottom: 1px solid #333;
	}

	.sync-status-section h4 {
		margin: 0 0 8px 0;
		font-size: 11px;
		font-weight: bold;
	}

	.status-row {
		margin: 4px 0;
		line-height: 1.3;
		font-size: 10px;
	}

	.log-entry {
		padding: 2px 0;
		border-bottom: 1px solid #222;
		font-size: 10px;
		line-height: 1.4;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.log-entry.empty {
		color: #666;
		font-style: italic;
	}

	/* Search Bar Styling */
	.search-bar-container {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		width: 100%;
		max-width: 500px;
		padding: 0 20px;
		pointer-events: none;
		/* Ensure visibility above map controls */
		opacity: 1 !important;
		visibility: visible !important;
		/* Force above MapLibre controls which typically use z-index 1 */
		z-index: 200 !important;
		/* Ensure proper centering even with side buttons */
		margin-left: 0;
		margin-right: 0;
	}

	.search-bar-container :global(.search-container) {
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
		.search-bar-container {
			top: 16px;
			/* Reset to normal centering but with margin to avoid buttons */
			left: 80px; /* Start after buttons */
			right: 20px; /* Right margin */
			transform: none; /* Remove transform */
			width: auto; /* Auto width */
			max-width: none; /* Remove max-width constraint */
			padding: 0; /* Remove padding since we're using left/right positioning */
		}
	}

	@media (max-width: 640px) {
		.search-bar-container {
			top: 14px;
			left: 80px; /* Start after buttons */
			right: 16px; /* Right margin */
			transform: none;
			width: auto;
			max-width: none;
			padding: 0;
		}
	}

	@media (max-width: 480px) {
		.search-bar-container {
			top: 12px;
			left: 80px; /* Start after buttons */
			right: 12px; /* Right margin */
			transform: none;
			width: auto;
			max-width: none;
			padding: 0;
		}
	}

	@media (max-width: 360px) {
		.search-bar-container {
			left: 80px; /* Start after buttons */
			right: 10px; /* Right margin */
			transform: none;
			width: auto;
			max-width: none;
			padding: 0;
		}
	}

	/* Ensure search bar stays centered on larger screens */
	@media (min-width: 769px) {
		.search-bar-container {
			/* Remove the debug panel constraint and keep centered */
			max-width: 500px;
			/* Add some padding to avoid overlapping with side buttons */
			padding: 0 80px; /* Account for left side buttons */
		}
	}
</style>
