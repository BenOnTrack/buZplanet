<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';

	let {
		open = $bindable(false),
		features = []
	}: {
		open?: boolean;
		features?: any[];
	} = $props();
	let activeSnapPoint = $state<string | number>('200px');

	// Derived values for display
	let hasFeatures = $derived(features && features.length > 0);
	let primaryFeature = $derived(features && features.length > 0 ? features[0] : null);
	let featureCount = $derived(features ? features.length : 0);

	// Helper function to get display name with fallbacks
	function getDisplayName(feature: any): string {
		if (!feature || !feature.properties) return 'Unknown Feature';

		const props = feature.properties;

		// Try name:en first
		if (props['name:en']) return props['name:en'];

		// Fallback to name
		if (props.name) return props.name;

		// Fallback to class
		if (props.class) return props.class;

		// Final fallback
		return 'Unknown Feature';
	}
</script>

<!-- Selected Feature Drawer -->
<Drawer.Root bind:open snapPoints={['200px', '400px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay class="fixed inset-0 z-60 bg-black/40" style="pointer-events: none" />
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 z-60 mx-[-1px] flex h-full max-h-[97%] flex-col rounded-t-[10px] border border-gray-200 bg-white"
		>
			<div
				class={clsx('flex w-full flex-col p-4 pt-5', {
					'overflow-y-auto': activeSnapPoint === 1 || activeSnapPoint === '1',
					'overflow-hidden': activeSnapPoint !== 1 && activeSnapPoint !== '1'
				})}
			>
				<div class="mb-4 flex items-center justify-between">
					<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
						<span>📍</span>
						{#if hasFeatures}
							{getDisplayName(primaryFeature)}
						{:else}
							Selected Feature
						{/if}
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<span class="sr-only">Close</span>
						<span aria-hidden="true" class="text-xl">✕</span>
					</Drawer.Close>
				</div>

				<div class="space-y-4">
					{#if hasFeatures}
						{#each features as feature, index}
							<div class="rounded-lg bg-gray-50 p-4">
								<h3 class="mb-2 flex items-center gap-2 font-medium">
									<span class="text-blue-500">{index === 0 ? '🎯' : '📌'}</span>
									{getDisplayName(feature)}
								</h3>
								<div class="space-y-1 text-sm text-gray-600">
									<p><strong>Layer:</strong> {feature.layer?.id || 'Unknown'}</p>
									<p><strong>Source:</strong> {feature.source || 'Unknown'}</p>
									{#if feature.properties?.type}
										<p><strong>Type:</strong> {feature.properties.type}</p>
									{/if}
									{#if feature.properties?.class}
										<p><strong>Class:</strong> {feature.properties.class}</p>
									{/if}
									{#if feature.properties?.name && feature.properties.name !== feature.properties?.['name:en']}
										<p><strong>Local Name:</strong> {feature.properties.name}</p>
									{/if}
								</div>
							</div>
						{/each}
					{:else}
						<div class="rounded-lg bg-gray-50 p-4">
							<h3 class="mb-2 flex items-center gap-2 font-medium">
								<span class="text-blue-500">ℹ️</span>
								Information
							</h3>
							<p class="text-sm text-gray-600">
								Click on map features to view detailed information about them.
							</p>
						</div>
					{/if}
				</div>

				<button
					class="mt-8 h-12 flex-shrink-0 rounded-md font-medium text-white"
					class:bg-black={hasFeatures}
					class:bg-gray-400={!hasFeatures}
					disabled={!hasFeatures}
				>
					{hasFeatures ? 'View Details' : 'No Features Selected'}
				</button>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
