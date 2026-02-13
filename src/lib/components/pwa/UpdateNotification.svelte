<!-- Enhanced UpdateNotification.svelte -->
<script lang="ts">
	import { swManager } from '$lib/utils/service-worker-manager.svelte';
	import { onMount } from 'svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	// Auto-hide notification after 10 seconds if no action taken
	let autoHideTimer: NodeJS.Timeout | null = null;

	// Derived state based on service worker manager
	let showUpdate = $derived.by(() => {
		return swManager.hasUpdate && swManager.notificationsEnabled && !isUpdating;
	});
	let isUpdating = $derived.by(() => swManager.isInstalling);

	onMount(() => {
		// Initialize service worker
		swManager.init();
	});

	// Handle auto-hide timer (side effect - legitimate as it manages external timer)
	$effect(() => {
		if (showUpdate) {
			// Clear any existing timer
			if (autoHideTimer) {
				clearTimeout(autoHideTimer);
			}

			// Set auto-hide timer
			autoHideTimer = setTimeout(() => {
				swManager.dismissUpdate();
			}, 10000);
		}

		return () => {
			if (autoHideTimer) {
				clearTimeout(autoHideTimer);
				autoHideTimer = null;
			}
		};
	});

	async function applyUpdate() {
		if (isUpdating) return; // Prevent multiple clicks

		if (autoHideTimer) {
			clearTimeout(autoHideTimer);
			autoHideTimer = null;
		}

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
		if (autoHideTimer) {
			clearTimeout(autoHideTimer);
			autoHideTimer = null;
		}
		swManager.dismissUpdate();
		showUpdate = false;
	}
</script>

{#if showUpdate}
	<div
		class="bg-background border-border shadow-popover rounded-card-lg fixed top-4 right-4 w-80 max-w-[calc(100vw-2rem)] border p-4"
		style="z-index: {Z_INDEX.SW_UPDATE_NOTIFICATION}"
		role="alert"
		aria-live="polite"
		aria-labelledby="update-title"
		aria-describedby="update-description"
	>
		<div class="flex items-start gap-3">
			<div class="mt-0.5 flex-shrink-0">
				{#if isUpdating}
					<div class="animate-spin">
						<PropertyIcon key="description" value="loading" size={20} class="text-blue-500" />
					</div>
				{:else}
					<PropertyIcon key="description" value="download" size={20} class="text-blue-500" />
				{/if}
			</div>

			<div class="min-w-0 flex-1">
				<h3 id="update-title" class="text-foreground text-sm font-semibold">
					{isUpdating ? 'Updating App...' : 'App Update Available'}
				</h3>
				<p id="update-description" class="text-muted-foreground mt-1 text-xs">
					{isUpdating
						? 'Please wait while we update your app'
						: 'A new version is ready to install. You can install it now or postpone until your next visit.'}
				</p>

				<div class="mt-3 flex gap-2">
					<button
						onclick={applyUpdate}
						onkeydown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') {
								e.preventDefault();
								applyUpdate();
							}
						}}
						class="rounded-md bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
						disabled={isUpdating}
						aria-label="Install update now"
					>
						{isUpdating ? 'Installing...' : 'Install Now'}
					</button>

					{#if !isUpdating}
						<button
							onclick={dismissUpdate}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									dismissUpdate();
								}
							}}
							class="rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
							aria-label="Postpone update"
						>
							Later
						</button>
					{/if}
				</div>
			</div>

			{#if !isUpdating}
				<button
					onclick={dismissUpdate}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							dismissUpdate();
						}
					}}
					class="flex-shrink-0 rounded-sm text-gray-400 transition-colors hover:text-gray-600 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-gray-500 dark:hover:text-gray-400"
					aria-label="Close notification"
				>
					<PropertyIcon key="description" value="x" size={16} />
				</button>
			{/if}
		</div>
	</div>
{/if}
