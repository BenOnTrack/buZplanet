<!-- Tile Cache Inspector - Deep dive into cache contents -->
<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getWorker } from '$lib/utils/worker/dualWorkerManager';

	let isVisible = $state(false);
	let activeTab = $state<'overview' | 'contents' | 'recent' | 'popular' | 'zoom'>('overview');
	let selectedZoom = $state(14);

	let cacheStats = $state<any>({});
	let cacheContents = $state<any[]>([]);
	let recentTiles = $state<any[]>([]);
	let popularTiles = $state<any[]>([]);
	let zoomTiles = $state<any[]>([]);

	let updateInterval: ReturnType<typeof setInterval> | null = null;

	onMount(() => {
		updateInterval = setInterval(updateData, 3000);
		updateData();
	});

	onDestroy(() => {
		if (updateInterval) clearInterval(updateInterval);
	});

	async function updateData() {
		if (!isVisible) return;

		try {
			const worker = getWorker();

			// Update based on active tab
			if (activeTab === 'overview') {
				cacheStats = await worker.getTileCacheStats();
			} else if (activeTab === 'contents') {
				cacheContents = await worker.getCacheContents();
			} else if (activeTab === 'recent') {
				recentTiles = await worker.getRecentTiles(20);
			} else if (activeTab === 'popular') {
				popularTiles = await worker.getPopularTiles(20);
			} else if (activeTab === 'zoom') {
				zoomTiles = await worker.getTilesByZoom(selectedZoom);
			}
		} catch (error) {
			console.debug('Failed to update cache inspector:', error);
		}
	}

	function switchTab(tab: typeof activeTab) {
		activeTab = tab;
		updateData();
	}

	function formatTileKey(key: string): { source: string; z: number; x: number; y: number } {
		const [source, z, x, y] = key.split('-');
		return { source, z: Number(z), x: Number(x), y: Number(y) };
	}

	function formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	// Global function for console debugging
	if (typeof window !== 'undefined') {
		(window as any).inspectTileCache = async () => {
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
		};

		console.log('💡 Use window.inspectTileCache() to inspect the tile cache from console');
	}
</script>

<!-- Toggle Button -->
<button
	class="fixed right-4 bottom-4 z-50 rounded bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-700"
	onclick={() => {
		isVisible = !isVisible;
		if (isVisible) updateData();
	}}
>
	{isVisible ? 'Hide' : 'Show'} Cache Inspector
</button>

<!-- Inspector Panel -->
{#if isVisible}
	<div
		class="fixed inset-4 z-40 overflow-hidden rounded-lg border bg-white/98 shadow-xl backdrop-blur"
	>
		<!-- Header -->
		<div class="bg-purple-600 p-4 text-white">
			<h2 class="text-xl font-bold">🔍 Tile Cache Inspector</h2>
			<p class="text-sm text-purple-100">Deep dive into memory cache contents</p>
		</div>

		<!-- Tabs -->
		<div class="flex border-b bg-gray-50">
			<button
				class="px-4 py-2 text-sm font-medium transition-colors"
				class:bg-white={activeTab === 'overview'}
				class:text-purple-600={activeTab === 'overview'}
				class:text-gray-600={activeTab !== 'overview'}
				onclick={() => switchTab('overview')}
			>
				📊 Overview
			</button>
			<button
				class="px-4 py-2 text-sm font-medium transition-colors"
				class:bg-white={activeTab === 'contents'}
				class:text-purple-600={activeTab === 'contents'}
				class:text-gray-600={activeTab !== 'contents'}
				onclick={() => switchTab('contents')}
			>
				📦 All Tiles ({cacheContents.length})
			</button>
			<button
				class="px-4 py-2 text-sm font-medium transition-colors"
				class:bg-white={activeTab === 'recent'}
				class:text-purple-600={activeTab === 'recent'}
				class:text-gray-600={activeTab !== 'recent'}
				onclick={() => switchTab('recent')}
			>
				🕐 Recent
			</button>
			<button
				class="px-4 py-2 text-sm font-medium transition-colors"
				class:bg-white={activeTab === 'popular'}
				class:text-purple-600={activeTab === 'popular'}
				class:text-gray-600={activeTab !== 'popular'}
				onclick={() => switchTab('popular')}
			>
				🔥 Popular
			</button>
			<button
				class="px-4 py-2 text-sm font-medium transition-colors"
				class:bg-white={activeTab === 'zoom'}
				class:text-purple-600={activeTab === 'zoom'}
				class:text-gray-600={activeTab !== 'zoom'}
				onclick={() => switchTab('zoom')}
			>
				🔍 By Zoom
			</button>
		</div>

		<!-- Content -->
		<div class="h-96 overflow-y-auto p-4">
			{#if activeTab === 'overview'}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
					<div class="rounded-lg bg-green-50 p-4">
						<h3 class="mb-2 font-semibold text-green-800">Cache Performance</h3>
						<div class="space-y-1 text-sm">
							<div>
								Memory Hits: <span class="font-bold text-green-700"
									>{cacheStats.memoryHits?.toLocaleString()}</span
								>
							</div>
							<div>
								OPFS Fetches: <span class="font-bold text-blue-700"
									>{cacheStats.opfsFetches?.toLocaleString()}</span
								>
							</div>
							<div>
								Hit Ratio: <span class="font-bold text-green-700"
									>{cacheStats.memoryHits && cacheStats.opfsFetches
										? (
												(cacheStats.memoryHits / (cacheStats.memoryHits + cacheStats.opfsFetches)) *
												100
											).toFixed(1)
										: 0}%</span
								>
							</div>
						</div>
					</div>

					<div class="rounded-lg bg-blue-50 p-4">
						<h3 class="mb-2 font-semibold text-blue-800">Memory Usage</h3>
						<div class="space-y-1 text-sm">
							<div>Size: <span class="font-bold">{cacheStats.memorySizeFormatted}</span></div>
							<div>
								Tiles: <span class="font-bold">{cacheStats.tilesInMemory?.toLocaleString()}</span>
							</div>
							<div>
								Utilization: <span class="font-bold"
									>{cacheStats.memoryUtilization?.toFixed(1)}%</span
								>
							</div>
						</div>
					</div>

					<div class="rounded-lg bg-purple-50 p-4">
						<h3 class="mb-2 font-semibold text-purple-800">Prefetch Status</h3>
						<div class="space-y-1 text-sm">
							<div>Queue: <span class="font-bold">{cacheStats.prefetchQueueSize}</span></div>
							<div>
								Prefetched: <span class="font-bold text-purple-700"
									>{cacheStats.prefetchedTiles?.toLocaleString()}</span
								>
							</div>
							<div>
								Active: <span
									class="font-bold"
									class:text-green-700={cacheStats.isPrefetching}
									class:text-gray-500={!cacheStats.isPrefetching}
								>
									{cacheStats.isPrefetching ? 'Yes' : 'No'}
								</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Console Helper -->
				<div class="mt-6 rounded-lg bg-gray-50 p-4">
					<h3 class="mb-2 font-semibold text-gray-800">🔧 Console Debugging</h3>
					<p class="mb-2 text-sm text-gray-600">Use these commands in your browser console:</p>
					<div class="rounded bg-gray-800 p-3 font-mono text-sm text-green-400">
						<div>window.inspectTileCache() // Full cache inspection</div>
					</div>
				</div>
			{:else if activeTab === 'contents'}
				<div class="space-y-2">
					{#each cacheContents as { key, tile }}
						{@const parsed = formatTileKey(key)}
						<div class="rounded-lg bg-gray-50 p-3 text-sm">
							<div class="flex items-start justify-between">
								<div class="font-mono text-xs text-gray-600">
									{parsed.source}-{parsed.z}/{parsed.x}/{parsed.y}
								</div>
								<div class="text-xs text-gray-500">
									{formatBytes(tile.size)}
								</div>
							</div>
							<div class="mt-1 flex justify-between text-xs">
								<span>Accessed: {tile.accessCount} times</span>
								<span>Age: {Math.floor((Date.now() - tile.timestamp) / 1000)}s</span>
							</div>
						</div>
					{/each}

					{#if cacheContents.length === 0}
						<div class="py-8 text-center text-gray-500">
							No tiles in cache yet. Start panning the map to see cached tiles appear here!
						</div>
					{/if}
				</div>
			{:else if activeTab === 'recent'}
				<div class="space-y-2">
					{#each recentTiles as { key, tile, accessedAgo }}
						{@const parsed = formatTileKey(key)}
						<div class="rounded-lg bg-gray-50 p-3 text-sm">
							<div class="flex items-start justify-between">
								<div class="font-mono text-xs text-gray-600">
									{parsed.source}-{parsed.z}/{parsed.x}/{parsed.y}
								</div>
								<div class="text-xs font-semibold text-green-600">
									{accessedAgo}
								</div>
							</div>
							<div class="mt-1 text-xs text-gray-500">
								{formatBytes(tile.size)} • Used {tile.accessCount} times
							</div>
						</div>
					{/each}
				</div>
			{:else if activeTab === 'popular'}
				<div class="space-y-2">
					{#each popularTiles as { key, tile }, index}
						{@const parsed = formatTileKey(key)}
						<div class="rounded-lg bg-gray-50 p-3 text-sm">
							<div class="flex items-start justify-between">
								<div class="flex items-center gap-2">
									<div class="font-bold text-orange-600">#{index + 1}</div>
									<div class="font-mono text-xs text-gray-600">
										{parsed.source}-{parsed.z}/{parsed.x}/{parsed.y}
									</div>
								</div>
								<div class="text-xs font-bold text-orange-600">
									{tile.accessCount} hits
								</div>
							</div>
							<div class="mt-1 text-xs text-gray-500">
								{formatBytes(tile.size)} • Last: {Math.floor(
									(Date.now() - tile.lastAccessed) / 1000
								)}s ago
							</div>
						</div>
					{/each}
				</div>
			{:else if activeTab === 'zoom'}
				<div class="mb-4 flex items-center gap-4">
					<label for="zoom-select" class="text-sm font-medium">Zoom Level:</label>
					<select
						id="zoom-select"
						bind:value={selectedZoom}
						onchange={() => updateData()}
						class="rounded border px-2 py-1 text-sm"
					>
						{#each Array.from({ length: 23 }, (_, i) => i) as zoom}
							<option value={zoom}>Zoom {zoom}</option>
						{/each}
					</select>
					<div class="text-sm text-gray-600">
						({zoomTiles.length} tiles cached)
					</div>
				</div>

				<div class="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
					{#each zoomTiles as { key, tile }}
						{@const parsed = formatTileKey(key)}
						<div class="rounded bg-gray-50 p-2 text-xs">
							<div class="font-mono text-gray-600">
								{parsed.x},{parsed.y}
							</div>
							<div class="text-gray-500">
								{formatBytes(tile.size)} • {tile.accessCount}x
							</div>
						</div>
					{/each}
				</div>

				{#if zoomTiles.length === 0}
					<div class="py-8 text-center text-gray-500">
						No tiles cached at zoom level {selectedZoom}
					</div>
				{/if}
			{/if}
		</div>

		<!-- Footer -->
		<div class="flex items-center justify-between border-t bg-gray-50 p-3">
			<div class="text-xs text-gray-600">
				Auto-refresh every 3s • Memory cache only (OPFS not shown)
			</div>
			<button
				onclick={() => updateData()}
				class="rounded bg-purple-600 px-3 py-1 text-xs text-white transition-colors hover:bg-purple-700"
			>
				Refresh Now
			</button>
		</div>
	</div>
{/if}
