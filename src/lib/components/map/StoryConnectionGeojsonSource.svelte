<!-- StoryConnectionGeojsonSource.svelte -->
<script lang="ts">
	import { GeoJSON, LineLayer } from 'svelte-maplibre';

	interface Props {
		storyConnectionGeoJSON: any;
		visible?: boolean;
	}

	let { storyConnectionGeoJSON, visible = true }: Props = $props();
</script>

{#if visible}
	<GeoJSON id="storyConnectionSource" data={storyConnectionGeoJSON}>
		<LineLayer
			id="storyConnectionLine"
			paint={{
				'line-color': '#FF6B35', // Distinctive orange color for story connections
				'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 12, 3, 16, 4, 20, 6],
				'line-opacity': 0.8
			}}
			layout={{
				'line-cap': 'round',
				'line-join': 'round'
			}}
		/>

		<!-- Add animated dashes for better visual effect -->
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
	</GeoJSON>
{/if}
