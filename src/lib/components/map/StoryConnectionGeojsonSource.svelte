<!-- StoryConnectionGeojsonSource.svelte -->
<script lang="ts">
	// @ts-nocheck
	import { GeoJSON, LineLayer } from 'svelte-maplibre';

	interface Props {
		storyConnectionGeoJSON: any;
		visible?: boolean;
	}

	let { storyConnectionGeoJSON, visible = true }: Props = $props();

	// Check if this is using new walking routes or old straight-line routes
	const hasWalkingRoutes = $derived.by(() =>
		storyConnectionGeoJSON?.features?.some((f: any) =>
			f.properties?.connectionType?.includes('walking_route')
		)
	);

	const hasFallbackRoutes = $derived.by(() =>
		storyConnectionGeoJSON?.features?.some((f: any) => f.properties?.fallback === true)
	);
</script>

{#if visible}
	<GeoJSON id="storyConnectionSource" data={storyConnectionGeoJSON}>
		<!-- Main route line (walking routes or straight lines) -->
		<LineLayer
			id="storyConnectionLine"
			paint={{
				// Use different colors based on route type
				'line-color': hasWalkingRoutes ? '#2563EB' : '#FF6B35', // Blue for walking routes, orange for straight lines
				'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 3, 16, 4, 20, 6],
				'line-opacity': 0.8
			}}
			layout={{
				'line-cap': 'round',
				'line-join': 'round'
			}}
		/>

		<!-- Highlight fallback segments (straight lines within walking routes) -->
		{#if hasWalkingRoutes && hasFallbackRoutes}
			<LineLayer
				id="storyConnectionFallback"
				filter={['==', ['get', 'fallback'], true]}
				paint={{
					'line-color': '#EF4444', // Red for fallback segments
					'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 2.5, 16, 3.5, 20, 5.5],
					'line-opacity': 0.7,
					'line-dasharray': [3, 3] // Dashed line for fallback segments
				}}
				layout={{
					'line-cap': 'round',
					'line-join': 'round'
				}}
			/>
		{/if}

		<!-- Add animated dashes for better visual effect -->
		{#if hasWalkingRoutes}
			<!-- Walking routes: subtle dashed overlay, excluding fallback segments -->
			<LineLayer
				id="storyConnectionLineDashed"
				filter={['!=', ['get', 'fallback'], true]}
				paint={{
					'line-color': '#2563EB',
					'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 3, 20, 4],
					'line-opacity': 0.4,
					'line-dasharray': [4, 8] // Creates a subtle dashed overlay
				}}
				layout={{
					'line-cap': 'round',
					'line-join': 'round'
				}}
			/>
		{:else}
			<!-- Straight-line routes: original dashed effect -->
			<LineLayer
				id="storyConnectionLineDashed"
				paint={{
					'line-color': '#FF6B35',
					'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1, 12, 2, 16, 3, 20, 4],
					'line-opacity': 0.6,
					'line-dasharray': [2, 4] // Creates a dashed line effect
				}}
				layout={{
					'line-cap': 'round',
					'line-join': 'round'
				}}
			/>
		{/if}
	</GeoJSON>
{/if}
