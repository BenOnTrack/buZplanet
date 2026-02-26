<script lang="ts">
	// Debug settings component - only visible in development mode
	import { onMount, onDestroy } from 'svelte';
	import { appInitializer } from '$lib/utils/app-initialization';

	// Props from parent
	interface Props {
		initState: {
			status: string;
			logs: string[];
			error?: string;
		};
		isAppReady: boolean;
		isOnline: boolean;
	}

	let { initState, isAppReady, isOnline }: Props = $props();

	// Local state for debug functionality
	let cacheStats = $state<any>({});
	let cacheContents = $state<any[]>([]);
	let recentTiles = $state<any[]>([]);
	let popularTiles = $state<any[]>([]);
	let debugUpdateInterval: ReturnType<typeof setInterval> | null = null;
	let activeCacheTab = $state<'stats' | 'contents' | 'recent' | 'popular'>('stats');
	let autoUpdate = $state(false);

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
		// This would need to be passed from parent or handled via store
		console.log('Clear logs requested');
	}

	// Tile cache debugging functions
	async function updateCacheData() {
		if (!isAppReady) return;

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

	// Auto-update functionality
	$effect(() => {
		if (autoUpdate && isAppReady) {
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

	// Cleanup on destroy
	onDestroy(() => {
		if (debugUpdateInterval) {
			clearInterval(debugUpdateInterval);
			debugUpdateInterval = null;
		}
	});

	// Load initial data when component mounts
	onMount(() => {
		if (isAppReady) {
			updateCacheData();
		}
	});
</script>

<div class="debug-settings">
	<!-- Worker Status -->
	<div class="status-section">
		<h3 class="section-title">🔧 Worker Status</h3>
		<div class="status-badge" class:ready={initState.status === 'complete'}>
			{initState.status}
		</div>
	</div>

	<!-- Debug Controls -->
	<div class="controls-section">
		<h3 class="section-title">🎮 Debug Controls</h3>
		<div class="control-buttons">
			<button
				class="control-btn"
				onclick={testWorker}
				onkeydown={(e) => e.key === 'Enter' && testWorker()}
			>
				Test Worker
			</button>
			<button
				class="control-btn"
				onclick={clearLogs}
				onkeydown={(e) => e.key === 'Enter' && clearLogs()}
			>
				Clear Logs
			</button>
			<button
				class="control-btn danger"
				onclick={clearTileCache}
				onkeydown={(e) => e.key === 'Enter' && clearTileCache()}
			>
				Clear Cache
			</button>
		</div>

		<div class="auto-update-toggle">
			<label>
				<input type="checkbox" bind:checked={autoUpdate} />
				Auto-update cache data (3s intervals)
			</label>
		</div>
	</div>

	<!-- Tile Cache Section -->
	<div class="cache-section">
		<h3 class="section-title">🚀 Tile Cache</h3>

		<!-- Cache Tabs -->
		<div class="cache-tabs">
			<button
				class="cache-tab"
				class:active={activeCacheTab === 'stats'}
				onclick={() => switchCacheTab('stats')}
			>
				📊 Stats
			</button>
			<button
				class="cache-tab"
				class:active={activeCacheTab === 'contents'}
				onclick={() => switchCacheTab('contents')}
			>
				📦 All ({cacheContents.length})
			</button>
			<button
				class="cache-tab"
				class:active={activeCacheTab === 'recent'}
				onclick={() => switchCacheTab('recent')}
			>
				🕐 Recent
			</button>
			<button
				class="cache-tab"
				class:active={activeCacheTab === 'popular'}
				onclick={() => switchCacheTab('popular')}
			>
				🔥 Popular
			</button>
		</div>

		<!-- Refresh Button -->
		<button class="refresh-btn" onclick={updateCacheData}> 🔄 Refresh </button>

		<!-- Cache Content -->
		<div class="cache-content">
			{#if activeCacheTab === 'stats'}
				<div class="cache-stats">
					<div class="stat-item">
						<span class="stat-label">Memory Hits:</span>
						<span class="stat-value hit">{cacheStats.memoryHits?.toLocaleString() || 0}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">OPFS Fetches:</span>
						<span class="stat-value fetch">{cacheStats.opfsFetches?.toLocaleString() || 0}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Hit Ratio:</span>
						<span class="stat-value ratio">
							{cacheStats.memoryHits && cacheStats.opfsFetches
								? (
										(cacheStats.memoryHits / (cacheStats.memoryHits + cacheStats.opfsFetches)) *
										100
									).toFixed(1)
								: 0}%
						</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Memory Size:</span>
						<span class="stat-value">{cacheStats.memorySizeFormatted || '0 B'}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Tiles Cached:</span>
						<span class="stat-value">{cacheStats.tilesInMemory?.toLocaleString() || 0}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Prefetch Queue:</span>
						<span class="stat-value">{cacheStats.prefetchQueueSize || 0}</span>
					</div>
					<div class="stat-item">
						<span class="stat-label">Prefetching:</span>
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
	<div class="sync-section">
		<h3 class="section-title">🔄 Sync Status</h3>
		<div class="sync-status">
			<div class="status-item">
				<strong>Connection:</strong>
				<span class:online={isOnline} class:offline={!isOnline}>
					{isOnline ? '🌐 Online' : '📴 Offline'}
				</span>
			</div>
			<div class="status-item">
				<strong>Firestore:</strong>
				<span class="firestore-status">✅ Native Offline Support Enabled</span>
			</div>
		</div>
	</div>

	<!-- Logs Section -->
	<div class="logs-section">
		<h3 class="section-title">📋 Debug Logs</h3>
		<div class="logs-container">
			{#each initState.logs as log}
				<div class="log-entry">{log}</div>
			{/each}
			{#if initState.logs.length === 0}
				<div class="log-entry empty">No logs yet...</div>
			{/if}
		</div>
	</div>

	<!-- Console Helper -->
	<div class="console-section">
		<h3 class="section-title">💻 Console Commands</h3>
		<div class="console-helper">
			<code>window.inspectTileCache()</code>
			<p>Full cache inspection in console</p>
		</div>
	</div>
</div>

<style>
	.debug-settings {
		display: flex;
		flex-direction: column;
		gap: 20px;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
	}

	.section-title {
		margin: 0 0 12px 0;
		font-size: 14px;
		font-weight: 600;
		color: #374151;
		border-bottom: 1px solid #e5e7eb;
		padding-bottom: 4px;
	}

	/* Worker Status */
	.status-section {
		padding: 16px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.status-badge {
		display: inline-block;
		padding: 4px 12px;
		background: #fee2e2;
		color: #991b1b;
		border-radius: 20px;
		font-size: 12px;
		font-weight: 500;
		text-transform: capitalize;
	}

	.status-badge.ready {
		background: #dcfce7;
		color: #166534;
	}

	/* Debug Controls */
	.controls-section {
		padding: 16px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.control-buttons {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.control-btn {
		padding: 6px 12px;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 6px;
		font-size: 12px;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.control-btn:hover {
		background: #2563eb;
	}

	.control-btn.danger {
		background: #ef4444;
	}

	.control-btn.danger:hover {
		background: #dc2626;
	}

	.auto-update-toggle {
		margin-top: 12px;
	}

	.auto-update-toggle label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 12px;
		color: #6b7280;
		cursor: pointer;
	}

	/* Cache Section */
	.cache-section {
		padding: 16px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.cache-tabs {
		display: flex;
		gap: 4px;
		margin-bottom: 12px;
		flex-wrap: wrap;
	}

	.cache-tab {
		padding: 6px 10px;
		background: #e5e7eb;
		color: #6b7280;
		border: none;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.cache-tab:hover {
		background: #d1d5db;
	}

	.cache-tab.active {
		background: #3b82f6;
		color: white;
	}

	.refresh-btn {
		padding: 4px 8px;
		background: #10b981;
		color: white;
		border: none;
		border-radius: 4px;
		font-size: 11px;
		cursor: pointer;
		margin-bottom: 12px;
	}

	.refresh-btn:hover {
		background: #059669;
	}

	.cache-content {
		max-height: 200px;
		overflow-y: auto;
		background: white;
		border-radius: 6px;
		padding: 12px;
		border: 1px solid #e5e7eb;
	}

	.cache-stats {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.stat-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
	}

	.stat-label {
		color: #6b7280;
	}

	.stat-value {
		font-weight: 600;
		font-family: 'SF Mono', Monaco, monospace;
	}

	.stat-value.hit {
		color: #059669;
	}

	.stat-value.fetch {
		color: #3b82f6;
	}

	.stat-value.ratio {
		color: #f59e0b;
	}

	.stat-value.active {
		color: #059669;
	}

	.tile-list {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.tile-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 6px 8px;
		background: #f9fafb;
		border-radius: 4px;
		font-size: 11px;
		font-family: 'SF Mono', Monaco, monospace;
	}

	.tile-item.empty {
		color: #9ca3af;
		font-style: italic;
		justify-content: center;
	}

	.tile-item.more {
		color: #6b7280;
		justify-content: center;
	}

	.tile-key {
		color: #374151;
		flex: 1;
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.tile-meta {
		display: flex;
		gap: 12px;
		color: #6b7280;
		flex-shrink: 0;
	}

	.recent-time {
		color: #059669;
	}

	.popular-count {
		color: #f59e0b;
		font-weight: 600;
	}

	/* Sync Status */
	.sync-section {
		padding: 16px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.sync-status {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.status-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
	}

	.online {
		color: #059669;
	}

	.offline {
		color: #ef4444;
	}

	.firestore-status {
		color: #059669;
	}

	/* Logs */
	.logs-section {
		padding: 16px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.logs-container {
		max-height: 150px;
		overflow-y: auto;
		background: white;
		border-radius: 6px;
		padding: 12px;
		border: 1px solid #e5e7eb;
	}

	.log-entry {
		padding: 4px 0;
		border-bottom: 1px solid #f3f4f6;
		font-size: 11px;
		font-family: 'SF Mono', Monaco, monospace;
		line-height: 1.4;
		color: #374151;
	}

	.log-entry:last-child {
		border-bottom: none;
	}

	.log-entry.empty {
		color: #9ca3af;
		font-style: italic;
	}

	/* Console Helper */
	.console-section {
		padding: 16px;
		background: #f9fafb;
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.console-helper {
		background: #1f2937;
		color: #f9fafb;
		padding: 12px;
		border-radius: 6px;
	}

	.console-helper code {
		color: #10b981;
		background: none;
		font-size: 12px;
		font-family: 'SF Mono', Monaco, monospace;
	}

	.console-helper p {
		margin: 4px 0 0 0;
		font-size: 11px;
		color: #9ca3af;
	}
</style>
