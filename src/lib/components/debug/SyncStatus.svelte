<script lang="ts">
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { offlineSyncManager } from '$lib/utils/offline-sync';

	let queueStatus = $state<any>(null);
	let featuresStatus = $derived(featuresDB.getSyncStatus());
	let storiesStatus = $derived(storiesDB.getSyncStatus());

	async function refreshStatus() {
		queueStatus = await offlineSyncManager.getQueueStatus();
	}

	// Refresh status every 5 seconds
	setInterval(refreshStatus, 5000);
	refreshStatus(); // Initial load
</script>

{#if import.meta.env.DEV}
	<div class="sync-status-panel">
		<h4>🔄 Sync Status</h4>

		<div class="status-section">
			<strong>Connection:</strong>
			{featuresStatus.online ? '🌐 Online' : '📴 Offline'}
		</div>

		<div class="status-section">
			<strong>Features:</strong>
			{featuresStatus.syncing ? '🔄 Syncing' : '✅ Ready'}
			(Last: {featuresStatus.lastSync
				? new Date(featuresStatus.lastSync).toLocaleTimeString()
				: 'Never'})
		</div>

		<div class="status-section">
			<strong>Stories:</strong>
			{storiesStatus.syncing ? '🔄 Syncing' : '✅ Ready'}
			(Last: {storiesStatus.lastSync
				? new Date(storiesStatus.lastSync).toLocaleTimeString()
				: 'Never'})
		</div>

		{#if queueStatus}
			<div class="status-section">
				<strong>Queue:</strong>
				{queueStatus.totalItems} items pending
				{#if queueStatus.isProcessing}
					<span class="processing">🔄 Processing...</span>
				{/if}
			</div>

			{#if queueStatus.totalItems > 0}
				<div class="queue-details">
					{#each Object.entries(queueStatus.itemsByType) as [type, count]}
						<div class="queue-item">{type}: {count}</div>
					{/each}
				</div>
			{/if}
		{/if}

		<button
			onclick={() => offlineSyncManager.processSyncQueue()}
			class="sync-button"
			disabled={!featuresStatus.online}
		>
			Force Sync
		</button>
	</div>
{/if}

<style>
	.sync-status-panel {
		position: fixed;
		bottom: 20px;
		left: 20px;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 12px;
		border-radius: 8px;
		font-family: monospace;
		font-size: 11px;
		z-index: 9999;
		min-width: 200px;
	}

	.status-section {
		margin: 4px 0;
		line-height: 1.3;
	}

	.queue-details {
		margin-left: 10px;
		font-size: 10px;
		opacity: 0.8;
	}

	.queue-item {
		margin: 2px 0;
	}

	.processing {
		color: #ffa500;
		margin-left: 5px;
	}

	.sync-button {
		margin-top: 8px;
		background: #007acc;
		color: white;
		border: none;
		padding: 4px 8px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 10px;
	}

	.sync-button:disabled {
		background: #666;
		cursor: not-allowed;
	}

	.sync-button:hover:not(:disabled) {
		background: #005a9e;
	}
</style>
