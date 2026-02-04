<script lang="ts">
	import MapView from '$lib/components/map/MapView.svelte';
	import BottomNavigation from '$lib/components/nav/BottomNavigation.svelte';
	import AuthDialog from '$lib/components/nav/AuthDialog.svelte';
	import UploadDialog from '$lib/components/nav/UploadDialog.svelte';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import { terminateWorker } from '$lib/utils/worker';
	import { appInitializer } from '$lib/utils/app-initialization';
	import { onMount, onDestroy } from 'svelte';

	// Import dev tools in development
	if (import.meta.env.DEV) {
		import('$lib/utils/worker/dev-tools');
	}

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
	onDestroy(() => {
		// Save any pending app state before cleanup
		if (typeof window !== 'undefined') {
			// Trigger a final save of any pending state
			const event = new CustomEvent('app-cleanup');
			window.dispatchEvent(event);
		}

		if (unsubscribe) {
			unsubscribe();
		}
		terminateWorker();
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
		<UploadDialog />
		<MapView ready={isAppReady} />
		<BottomNavigation />
	{/if}

	<!-- Worker Debug Panel - only show in development when app is ready -->
	{#if import.meta.env.DEV && isAppReady}
		<div class="worker-debug-panel">
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
		z-index: 10000;
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
</style>
