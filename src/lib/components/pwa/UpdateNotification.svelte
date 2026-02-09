<!-- UpdateNotification.svelte -->
<script lang="ts">
	import { swManager } from '$lib/utils/service-worker-manager.svelte';
	import { onMount } from 'svelte';

	let showUpdate = $state(false);
	let isUpdating = $state(false);

	onMount(() => {
		// Initialize service worker
		swManager.init();

		// Watch for updates
		$effect(() => {
			showUpdate = swManager.hasUpdate && !isUpdating;
		});
	});

	async function applyUpdate() {
		if (isUpdating) return; // Prevent multiple clicks

		isUpdating = true;
		try {
			await swManager.applyUpdate();
		} catch (error) {
			console.error('Failed to apply update:', error);
			// Reset states on error
			isUpdating = false;
			showUpdate = false;
		}
	}

	function dismissUpdate() {
		showUpdate = false;
	}
</script>

{#if showUpdate}
	<div
		class="fixed right-4 bottom-4 left-4 z-50 flex items-center justify-between rounded-lg bg-blue-600 p-4 text-white shadow-lg"
		role="alert"
		aria-live="assertive"
	>
		<div class="flex items-center gap-3">
			<div class="flex-shrink-0">
				{#if isUpdating}
					<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
				{:else}
					<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						/>
					</svg>
				{/if}
			</div>
			<div>
				<p class="font-medium">
					{isUpdating ? 'Updating App...' : 'App Update Available'}
				</p>
				<p class="text-sm text-blue-100">
					{isUpdating
						? 'Please wait while we update your app'
						: 'A new version of BuzPlanet is ready'}
				</p>
			</div>
		</div>
		<div class="flex gap-2">
			{#if !isUpdating}
				<button
					onclick={dismissUpdate}
					class="rounded bg-transparent px-3 py-2 text-sm font-medium text-blue-100 transition-colors hover:bg-blue-700"
					type="button"
					aria-label="Dismiss update notification"
				>
					Later
				</button>
			{/if}
			<button
				onclick={applyUpdate}
				class="rounded bg-white px-4 py-2 font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
				type="button"
				disabled={isUpdating}
				aria-label={isUpdating ? 'Updating app...' : 'Apply app update'}
			>
				{isUpdating ? 'Updating...' : 'Update'}
			</button>
		</div>
	</div>
{/if}
