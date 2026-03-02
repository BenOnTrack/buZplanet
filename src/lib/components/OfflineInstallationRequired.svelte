<!--
	Offline Installation Required Component
	
	Displays when app is accessed offline but not yet installed
-->
<script lang="ts">
	import { swManager } from '$lib/utils/service-worker-manager.svelte.js';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';

	let showRetryButton = $state(false);

	// Show retry button after a few seconds
	setTimeout(() => {
		showRetryButton = true;
	}, 5000);

	function handleRetry() {
		window.location.reload();
	}
</script>

<div
	class="bg-background fixed inset-0 flex items-center justify-center p-4"
	style="z-index: {Z_INDEX.OFFLINE_INSTALL_SCREEN}"
>
	<div class="max-w-md space-y-6 text-center">
		<!-- App Icon -->
		<div class="flex justify-center">
			<div class="bg-primary/10 flex h-20 w-20 items-center justify-center rounded-2xl">
				<PropertyIcon key="description" value="map" size={40} class="text-primary" />
			</div>
		</div>

		<!-- Title -->
		<h1 class="text-foreground text-2xl font-bold">Installation Required</h1>

		<!-- Message -->
		<div class="text-muted-foreground space-y-4">
			<p>This app needs to be installed first to work offline.</p>
			<p>Please connect to the internet and refresh the page to install the app.</p>
		</div>

		<!-- Connection Status -->
		<div class="text-muted-foreground flex items-center justify-center space-x-2 text-sm">
			<div class="h-2 w-2 rounded-full bg-red-500"></div>
			<span>Currently offline</span>
		</div>

		<!-- Instructions -->
		<div class="bg-muted/50 rounded-lg p-4 text-left text-sm">
			<h3 class="text-foreground mb-2 font-semibold">To install:</h3>
			<ol class="text-muted-foreground list-inside list-decimal space-y-1">
				<li>Connect to a reliable internet connection</li>
				<li>Refresh this page or click "Retry" below</li>
				<li>Wait for the app to fully load and install</li>
				<li>Once installed, the app will work offline</li>
			</ol>
		</div>

		<!-- Retry Button (appears after delay) -->
		{#if showRetryButton}
			<button
				onclick={handleRetry}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleRetry();
					}
				}}
				class="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary w-full rounded-lg px-4 py-3 font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
			>
				<div class="flex items-center justify-center space-x-2">
					<PropertyIcon key="description" value="refresh" size={16} />
					<span>Retry Installation</span>
				</div>
			</button>
		{/if}

		<!-- Technical Details (collapsible) -->
		<details class="text-left">
			<summary
				class="text-muted-foreground hover:text-foreground cursor-pointer text-sm transition-colors"
			>
				Technical Details
			</summary>
			<div class="bg-muted/30 text-muted-foreground mt-2 space-y-1 rounded p-3 text-xs">
				<p><strong>Issue:</strong> Service worker not installed</p>
				<p><strong>Status:</strong> No cached resources available</p>
				<p><strong>Required:</strong> Initial online installation</p>
			</div>
		</details>
	</div>
</div>
