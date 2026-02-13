<script lang="ts">
	import MapView from '$lib/components/map/MapView.svelte';
	import BottomNavigation from '$lib/components/nav/BottomNavigation.svelte';
	import AuthDialog from '$lib/components/dialogs/AuthDialog.svelte';
	import FileManagerDialog from '$lib/components/nav/FileManagerDialog.svelte';
	import SettingsDialog from '$lib/components/nav/SettingsDialog.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import SearchBar from '$lib/components/nav/SearchBar.svelte';
	import SearchResultsDrawer from '$lib/components/drawers/SearchResultsDrawer.svelte';
	import SelectedFeatureDrawer from '$lib/components/drawers/SelectedFeatureDrawer.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { appInitializer } from '$lib/utils/app-initialization';
	import { appState } from '$lib/stores/AppState.svelte';
	import { Z_INDEX } from '$lib/styles/z-index.js';
	import { onMount, onDestroy } from 'svelte';

	// Initialization state
	type InitState = {
		status:
			| 'pending'
			| 'initializing'
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
	let showDebugPanel = $state(false);

	// Search functionality
	let searchQuery = $state('');
	let searchResults = $state<any[]>([]);
	let isSearching = $state(false);
	let searchDrawerOpen = $state(false);
	let currentSearchingDatabase = $state<string | undefined>(undefined);

	async function handleSearch(query: string) {
		console.log('Searching for:', query);
		isSearching = true;
		searchDrawerOpen = true;
		searchResults = []; // Clear previous results
		currentSearchingDatabase = undefined;

		try {
			const { getWorker } = await import('$lib/utils/worker');
			const worker = getWorker();

			// Get current language preference from AppState
			const currentLanguage = appState.language;
			console.log(`🌐 Using language preference: ${currentLanguage}`);

			// Search for features with progressive results and language preference
			const finalResults = await worker.searchFeatures(
				query,
				5000, // 5000 results max
				currentLanguage, // Pass language preference to worker
				// Progress callback for streaming results
				(progressData) => {
					const { results, isComplete, currentDatabase, total } = progressData;

					// Update search results progressively
					searchResults = results;
					currentSearchingDatabase = currentDatabase;

					console.log(
						`🔄 Progress: ${total} results from ${currentDatabase || 'unknown'} (complete: ${isComplete})`
					);
				}
			);

			// Final results (should be same as last progress update)
			searchResults = finalResults;
			currentSearchingDatabase = undefined;

			if (finalResults.length === 0) {
				console.log('No results found for:', query);
			} else {
				console.log(`✅ Search complete: ${finalResults.length} total results for "${query}"`);
			}
		} catch (error) {
			console.error('Search error:', error);
			searchResults = [];
			currentSearchingDatabase = undefined;
		} finally {
			isSearching = false;
		}
	}

	function handleClearSearch() {
		console.log('Search cleared');
		searchResults = [];
		isSearching = false;
		searchDrawerOpen = false; // Close search results drawer
		currentSearchingDatabase = undefined;
	}

	// Subscribe to initialization state changes
	let unsubscribe: (() => void) | null = null;

	onMount(() => {
		// Subscribe to initialization state
		unsubscribe = appInitializer.subscribe((state) => {
			initState = state;
		});

		// Add global app cleanup handler
		const handleAppCleanup = () => {
			// This event can be caught by components that need to save state
			console.log('App cleanup triggered');
		};

		window.addEventListener('app-cleanup', handleAppCleanup);

		// Start initialization
		appInitializer
			.initialize()
			.then((result) => {
				if (!result.success) {
					console.error('App initialization failed:', result.error);
				}
			})
			.catch((error) => {
				console.error('Unexpected initialization error:', error);
			});

		return () => {
			window.removeEventListener('app-cleanup', handleAppCleanup);
		};
	});

	// Clean up worker when component is destroyed
	onDestroy(async () => {
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
		} catch (error) {
			console.warn('Failed to terminate worker:', error);
		}
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
</script>

<main class="app-container">
	{#if !isAppReady}
		<LoadingScreen state={initState} showLogs={import.meta.env.DEV} />
	{:else}
		<AuthDialog />
		<FileManagerDialog />
		<SettingsDialog />

		<!-- Search Bar -->
		<div class="search-bar-container" style="z-index: {Z_INDEX.SEARCH_BAR}">
			<SearchBar
				bind:value={searchQuery}
				onSearch={handleSearch}
				onClear={handleClearSearch}
				placeholder="Search places, addresses, points of interest..."
			/>
		</div>

		<MapView ready={isAppReady} />
		<BottomNavigation />

		<!-- Search Results Drawer -->
		<SearchResultsDrawer
			bind:open={searchDrawerOpen}
			results={searchResults}
			{searchQuery}
			{isSearching}
			{currentSearchingDatabase}
		/>

		<!-- Selected Feature Drawer - render after SearchResultsDrawer to ensure proper layering -->
		<SelectedFeatureDrawer
			open={mapControl.selectedFeatureDrawerOpen}
			feature={mapControl.selectedFeature}
			onOpenChange={(open) => mapControl.setSelectedFeatureDrawerOpen(open)}
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
					</div>
					<div class="debug-logs">
						{#each initState.logs as log}
							<div class="log-entry">{log}</div>
						{/each}
						{#if initState.logs.length === 0}
							<div class="log-entry empty">No logs yet...</div>
						{/if}
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
		width: 400px;
		max-height: 300px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	}

	.debug-controls {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
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

	.debug-logs {
		max-height: 200px;
		overflow-y: auto;
		border: 1px solid #333;
		border-radius: 3px;
		padding: 8px;
		background: rgba(0, 0, 0, 0.5);
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
			padding: 0 20px;
			max-width: 380px;
		}
	}

	@media (max-width: 640px) {
		.search-bar-container {
			top: 14px;
			padding: 0 16px;
			max-width: 320px;
		}
	}

	@media (max-width: 480px) {
		.search-bar-container {
			top: 12px;
			padding: 0 12px;
			max-width: 280px;
		}
	}

	@media (max-width: 360px) {
		.search-bar-container {
			padding: 0 10px;
			max-width: 240px;
		}
	}

	/* Ensure search bar doesn't interfere with debug panel */
	@media (min-width: 769px) {
		.search-bar-container {
			max-width: calc(100vw - 460px); /* Account for debug panel width */
		}
	}
</style>
