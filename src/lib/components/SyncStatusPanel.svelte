<!-- Example component showing sync status and conflict resolution -->
<script lang="ts">
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { onMount } from 'svelte';

	// Reactive sync status
	$: syncStatus = featuresDB.getSyncStatus();
	$: conflicts = featuresDB.conflicts;
	$: stats = featuresDB.stats;

	// Handle conflict resolution
	async function resolveConflict(conflictId: string, resolution: 'local' | 'remote' | 'merge') {
		try {
			await featuresDB.resolveSyncConflict(conflictId, resolution);
		} catch (error) {
			console.error('Failed to resolve conflict:', error);
		}
	}

	// Force sync
	async function forcSync() {
		try {
			await featuresDB.forceSyncNow();
		} catch (error) {
			console.error('Failed to force sync:', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			alert('Sync failed: ' + errorMessage);
		}
	}

	// Format timestamp for display
	function formatTimestamp(timestamp: number): string {
		if (!timestamp) return 'Never';
		return new Date(timestamp).toLocaleString();
	}

	onMount(async () => {
		await featuresDB.ensureInitialized();
	});
</script>

<div class="sync-status-panel">
	<h3>Sync Status</h3>

	<div class="status-grid">
		<div class="status-item">
			<strong>Connection:</strong>
			<span class="status-indicator {syncStatus.online ? 'online' : 'offline'}">
				{syncStatus.online ? 'Online' : 'Offline'}
			</span>
		</div>

		<div class="status-item">
			<strong>Sync:</strong>
			<span class="status-indicator {syncStatus.syncing ? 'syncing' : 'idle'}">
				{syncStatus.syncing ? 'Syncing...' : 'Idle'}
			</span>
		</div>

		<div class="status-item">
			<strong>Auth:</strong>
			<span
				class="status-indicator {syncStatus.authenticated ? 'authenticated' : 'unauthenticated'}"
			>
				{syncStatus.authenticated ? 'Authenticated' : 'Not Authenticated'}
			</span>
		</div>

		<div class="status-item">
			<strong>Last Sync:</strong>
			<span>{formatTimestamp(syncStatus.lastSync)}</span>
		</div>
	</div>

	<div class="stats-grid">
		<div class="stat">
			<div class="stat-value">{stats.total}</div>
			<div class="stat-label">Total Features</div>
		</div>
		<div class="stat">
			<div class="stat-value">{stats.bookmarked}</div>
			<div class="stat-label">Bookmarked</div>
		</div>
		<div class="stat">
			<div class="stat-value">{stats.visited}</div>
			<div class="stat-label">Visited</div>
		</div>
		<div class="stat">
			<div class="stat-value">{stats.todo}</div>
			<div class="stat-label">Todo</div>
		</div>
		<div class="stat">
			<div class="stat-value">{stats.lists}</div>
			<div class="stat-label">Lists</div>
		</div>
	</div>

	{#if syncStatus.authenticated && syncStatus.online}
		<button onclick={forcSync} disabled={syncStatus.syncing} class="sync-button">
			{syncStatus.syncing ? 'Syncing...' : 'Force Sync Now'}
		</button>
	{/if}

	{#if conflicts.length > 0}
		<div class="conflicts-section">
			<h4>Sync Conflicts ({conflicts.length})</h4>

			{#each conflicts as conflict (conflict.id)}
				<div class="conflict-item">
					<div class="conflict-header">
						<strong>{conflict.type === 'feature' ? 'Feature' : 'List'}:</strong>
						{conflict.id}
						<span class="conflict-type">{conflict.conflictType}</span>
					</div>

					<div class="conflict-details">
						<div class="conflict-data">
							<h5>Local Version</h5>
							<pre>{JSON.stringify(conflict.localData, null, 2)}</pre>
						</div>
						<div class="conflict-data">
							<h5>Remote Version</h5>
							<pre>{JSON.stringify(conflict.remoteData, null, 2)}</pre>
						</div>
					</div>

					<div class="conflict-actions">
						<button
							onclick={() => resolveConflict(conflict.id, 'local')}
							class="resolve-button local"
						>
							Keep Local
						</button>
						<button
							onclick={() => resolveConflict(conflict.id, 'remote')}
							class="resolve-button remote"
						>
							Use Remote
						</button>
						<button
							onclick={() => resolveConflict(conflict.id, 'merge')}
							class="resolve-button merge"
						>
							Smart Merge
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.sync-status-panel {
		padding: 1rem;
		border: 1px solid #ddd;
		border-radius: 8px;
		background: white;
		margin: 1rem 0;
	}

	.status-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.5rem;
		margin: 1rem 0;
	}

	.status-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem;
		background: #f5f5f5;
		border-radius: 4px;
	}

	.status-indicator {
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.status-indicator.online,
	.status-indicator.authenticated {
		background: #dcfce7;
		color: #166534;
	}

	.status-indicator.offline,
	.status-indicator.unauthenticated {
		background: #fef2f2;
		color: #dc2626;
	}

	.status-indicator.syncing {
		background: #fef3c7;
		color: #d97706;
	}

	.status-indicator.idle {
		background: #f3f4f6;
		color: #374151;
	}

	.stats-grid {
		display: flex;
		gap: 1rem;
		margin: 1rem 0;
		flex-wrap: wrap;
	}

	.stat {
		text-align: center;
		padding: 0.75rem;
		background: #f8fafc;
		border-radius: 6px;
		min-width: 80px;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: bold;
		color: #1f2937;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6b7280;
		margin-top: 0.25rem;
	}

	.sync-button {
		background: #3b82f6;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
	}

	.sync-button:disabled {
		background: #9ca3af;
		cursor: not-allowed;
	}

	.conflicts-section {
		margin-top: 2rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}

	.conflict-item {
		border: 1px solid #f59e0b;
		border-radius: 6px;
		padding: 1rem;
		margin: 1rem 0;
		background: #fffbeb;
	}

	.conflict-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}

	.conflict-type {
		background: #f59e0b;
		color: white;
		padding: 0.25rem 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
	}

	.conflict-details {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1rem;
		margin: 1rem 0;
	}

	.conflict-data h5 {
		margin: 0 0 0.5rem 0;
		color: #374151;
	}

	.conflict-data pre {
		background: #f3f4f6;
		padding: 0.5rem;
		border-radius: 4px;
		font-size: 0.75rem;
		overflow-x: auto;
		max-height: 200px;
		overflow-y: auto;
	}

	.conflict-actions {
		display: flex;
		gap: 0.5rem;
		margin-top: 1rem;
	}

	.resolve-button {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 4px;
		cursor: pointer;
		font-weight: 500;
	}

	.resolve-button.local {
		background: #dc2626;
		color: white;
	}

	.resolve-button.remote {
		background: #2563eb;
		color: white;
	}

	.resolve-button.merge {
		background: #16a34a;
		color: white;
	}

	.resolve-button:hover {
		opacity: 0.9;
	}
</style>
