<!-- Tile Cache Debug Panel - Shows cache performance in real-time -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getWorker } from '$lib/utils/worker/dualWorkerManager';

	let cacheStats = $state<any>({
		memoryHits: 0,
		opfsFetches: 0,
		prefetchedTiles: 0,
		evictions: 0,
		memorySize: 0,
		memorySizeFormatted: '0 B',
		tilesInMemory: 0,
		memoryUtilization: 0,
		prefetchQueueSize: 0,
		isPrefetching: false
	});

	let updateInterval: ReturnType<typeof setInterval> | null = null;
	let isVisible = $state(false);

	onMount(() => {
		// Update stats every 2 seconds
		updateInterval = setInterval(updateStats, 2000);
		updateStats(); // Initial load
	});

	onDestroy(() => {
		if (updateInterval) {
			clearInterval(updateInterval);
		}
	});

	async function updateStats() {
		try {
			const worker = getWorker();
			const stats = await worker.getTileCacheStats();
			cacheStats = stats;
		} catch (error) {
			console.debug('Failed to get cache stats:', error);
		}
	}

	async function clearCache() {
		try {
			const worker = getWorker();
			await worker.clearTileCache();
			await updateStats(); // Refresh stats
		} catch (error) {
			console.error('Failed to clear cache:', error);
		}
	}
</script>

<!-- Toggle Button -->
<button
	class="fixed top-4 right-4 z-50 rounded bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
	onclick={() => (isVisible = !isVisible)}
>
	{isVisible ? 'Hide' : 'Show'} Cache Stats
</button>

<!-- Debug Panel -->
{#if isVisible}
	<div
		class="fixed top-16 right-4 z-40 w-80 rounded-lg border bg-white/95 p-4 text-sm shadow-lg backdrop-blur"
	>
		<h3 class="mb-3 text-lg font-bold text-gray-800">🚀 Tile Cache Stats</h3>

		<!-- Performance Metrics -->
		<div class="mb-4 grid grid-cols-2 gap-2">
			<div class="rounded bg-green-50 p-2">
				<div class="text-xs text-gray-600">Memory Hits</div>
				<div class="font-bold text-green-700">{cacheStats.memoryHits.toLocaleString()}</div>
			</div>
			<div class="rounded bg-blue-50 p-2">
				<div class="text-xs text-gray-600">OPFS Fetches</div>
				<div class="font-bold text-blue-700">{cacheStats.opfsFetches.toLocaleString()}</div>
			</div>
			<div class="rounded bg-purple-50 p-2">
				<div class="text-xs text-gray-600">Prefetched</div>
				<div class="font-bold text-purple-700">{cacheStats.prefetchedTiles.toLocaleString()}</div>
			</div>
			<div class="rounded bg-orange-50 p-2">
				<div class="text-xs text-gray-600">Evictions</div>
				<div class="font-bold text-orange-700">{cacheStats.evictions.toLocaleString()}</div>
			</div>
		</div>

		<!-- Cache Status -->
		<div class="mb-4 space-y-2">
			<div class="flex justify-between">
				<span class="text-gray-600">Memory Usage:</span>
				<span class="font-semibold">{cacheStats.memorySizeFormatted}</span>
			</div>

			<div class="flex justify-between">
				<span class="text-gray-600">Tiles in Memory:</span>
				<span class="font-semibold">{cacheStats.tilesInMemory.toLocaleString()}</span>
			</div>

			<div class="flex justify-between">
				<span class="text-gray-600">Memory Utilization:</span>
				<span class="font-semibold">{cacheStats.memoryUtilization.toFixed(1)}%</span>
			</div>

			<!-- Memory Utilization Bar -->
			<div class="h-2 w-full rounded-full bg-gray-200">
				<div
					class="h-2 rounded-full bg-blue-600 transition-all duration-300"
					style="width: {Math.min(100, cacheStats.memoryUtilization)}%"
				></div>
			</div>
		</div>

		<!-- Prefetch Status -->
		<div class="mb-4 space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-gray-600">Prefetch Status:</span>
				<span class="flex items-center gap-1">
					{#if cacheStats.isPrefetching}
						<div class="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
						<span class="font-semibold text-green-700">Active</span>
					{:else}
						<div class="h-2 w-2 rounded-full bg-gray-400"></div>
						<span class="text-gray-500">Idle</span>
					{/if}
				</span>
			</div>

			<div class="flex justify-between">
				<span class="text-gray-600">Queue Size:</span>
				<span class="font-semibold">{cacheStats.prefetchQueueSize}</span>
			</div>
		</div>

		<!-- Performance Indicators -->
		<div class="mb-4 rounded bg-gray-50 p-2">
			<div class="mb-1 text-xs text-gray-600">Cache Hit Ratio</div>
			{#if cacheStats.memoryHits + cacheStats.opfsFetches > 0}
				{@const hitRatio =
					(cacheStats.memoryHits / (cacheStats.memoryHits + cacheStats.opfsFetches)) * 100}
				<div
					class="text-sm font-bold"
					class:text-green-600={hitRatio > 50}
					class:text-orange-600={hitRatio <= 50}
				>
					{hitRatio.toFixed(1)}%
				</div>
				<div class="text-xs text-gray-500">
					{hitRatio > 80 ? 'Excellent 🚀' : hitRatio > 50 ? 'Good 👍' : 'Warming up... 🔥'}
				</div>
			{:else}
				<div class="text-sm text-gray-500">No data yet</div>
			{/if}
		</div>

		<!-- Actions -->
		<div class="flex gap-2">
			<button
				onclick={clearCache}
				class="flex-1 rounded bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
			>
				Clear Cache
			</button>
			<button
				onclick={updateStats}
				class="rounded bg-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-300"
			>
				Refresh
			</button>
		</div>

		<!-- Instructions -->
		<div class="mt-4 rounded bg-blue-50 p-2 text-xs">
			<div class="mb-1 font-semibold text-blue-800">💡 Tips:</div>
			<div class="space-y-1 text-blue-700">
				<div>• Pan the map to see prefetching in action</div>
				<div>• Higher cache hit ratio = smoother experience</div>
				<div>• Green pulse = tiles being prefetched</div>
			</div>
		</div>
	</div>
{/if}
