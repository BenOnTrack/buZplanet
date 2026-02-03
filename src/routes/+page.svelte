<script lang="ts">
	import MapView from '$lib/components/map/MapView.svelte';
	import BottomNavigation from '$lib/components/nav/BottomNavigation.svelte';
	import AuthDialog from '$lib/components/nav/AuthDialog.svelte';
	import UploadDialog from '$lib/components/nav/UploadDialog.svelte';
	import { getWorker, terminateWorker } from '$lib/utils/worker';
	import { onMount, onDestroy } from 'svelte';

	// Import dev tools in development
	if (import.meta.env.DEV) {
		import('$lib/utils/worker/dev-tools');
	}

	// Worker status tracking
	let workerStatus = $state('initializing');
	let workerLogs = $state<string[]>([]);
	let showWorkerDebug = $state(false);

	function addLog(message: string) {
		const timestamp = new Date().toLocaleTimeString();
		workerLogs = [...workerLogs, `[${timestamp}] ${message}`];
		console.log(message);
	}

	// Initialize worker when component mounts
	onMount(async () => {
		try {
			addLog('🔄 Initializing worker...');
			workerStatus = 'connecting';
			
			const worker = getWorker();
			addLog('✅ Worker instance created');
			
			await worker.waitForReady();
			addLog('✅ Worker is ready!');
			workerStatus = 'ready';
			
			// Test initialization
			const initResponse = await worker.initializeWorker({ 
				appVersion: '1.0.0',
				timestamp: Date.now()
			});
			addLog(`✅ Init response: ${initResponse}`);
			
			// Test ping
			const pingResponse = await worker.ping();
			addLog(`✅ Ping response: ${pingResponse}`);
			
			// Test task processing
			const taskResponse = await worker.processTask('Hello from main thread!');
			addLog(`✅ Task response: ${taskResponse}`);
			
			workerStatus = 'working';
			addLog('🎉 Worker fully initialized and tested!');
			
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			addLog(`❌ Failed to initialize worker: ${errorMsg}`);
			workerStatus = 'error';
			console.error('Failed to initialize worker:', error);
		}
	});

	// Clean up worker when component is destroyed
	onDestroy(() => {
		addLog('🔄 Terminating worker...');
		terminateWorker();
		addLog('✅ Worker terminated');
	});

	async function testWorker() {
		try {
			addLog('🔄 Testing worker...');
			const worker = getWorker();
			
			const pingResponse = await worker.ping();
			addLog(`✅ Test ping: ${pingResponse}`);
			
			const taskResponse = await worker.processTask(`Test task at ${new Date().toLocaleTimeString()}`);
			addLog(`✅ Test task: ${taskResponse}`);
			
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			addLog(`❌ Test failed: ${errorMsg}`);
		}
	}

	function clearLogs() {
		workerLogs = [];
	}
</script>

<main class="app-container">
	<AuthDialog />
	<UploadDialog />
	<MapView />
	<BottomNavigation />
	
	<!-- Worker Debug Panel - only show in development -->
	{#if import.meta.env.DEV}
		<div class="worker-debug-panel">
			<button 
				class="debug-toggle"
				onclick={() => showWorkerDebug = !showWorkerDebug}
				onkeydown={(e) => e.key === 'Enter' && (showWorkerDebug = !showWorkerDebug)}
				aria-label="Toggle worker debug panel"
			>
				🔧 Worker: {workerStatus}
			</button>
			
			{#if showWorkerDebug}
				<div class="debug-content">
					<div class="debug-controls">
						<button onclick={testWorker} onkeydown={(e) => e.key === 'Enter' && testWorker()}>Test Worker</button>
						<button onclick={clearLogs} onkeydown={(e) => e.key === 'Enter' && clearLogs()}>Clear Logs</button>
					</div>
					<div class="debug-logs">
						{#each workerLogs as log}
							<div class="log-entry">{log}</div>
						{/each}
						{#if workerLogs.length === 0}
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