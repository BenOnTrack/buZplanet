<!-- SelectedFeatureGeojsonSource.svelte -->
<script lang="ts">
	import { GeoJSON, CircleLayer, FillLayer, LineLayer } from 'svelte-maplibre';

	interface Props {
		selectedFeatureGeoJSON: any;
	}
	let { selectedFeatureGeoJSON }: Props = $props();

	// Determine geometry type for conditional rendering
	const geometryType = $derived.by(() => {
		const firstFeature = selectedFeatureGeoJSON.features[0];
		return firstFeature?.geometry?.type;
	});

	const isPolygon = $derived.by(() => {
		return geometryType === 'Polygon' || geometryType === 'MultiPolygon';
	});

	const isPoint = $derived.by(() => {
		return geometryType === 'Point' || geometryType === 'MultiPoint';
	});
</script>

<GeoJSON id="selectedFeatureSource" data={selectedFeatureGeoJSON}>
	{#if isPoint}
		<CircleLayer
			id="selectedFeature"
			beforeLayerType="symbol"
			applyToClusters={false}
			paint={{
				'circle-radius': 15,
				'circle-color': '#007cbf',
				'circle-stroke-width': 2,
				'circle-stroke-color': '#ffffff'
			}}
		/>
	{:else if isPolygon}
		<FillLayer
			id="selectedFeatureFill"
			paint={{
				'fill-color': '#007cbf',
				'fill-opacity': 0.3
			}}
		/>
		<LineLayer
			id="selectedFeatureLine"
			paint={{
				'line-color': '#007cbf',
				'line-width': 5
			}}
		/>
	{:else}
		<!-- Fallback for other geometry types (LineString, etc.) -->
		<LineLayer
			id="selectedFeatureLine"
			paint={{
				'line-color': '#007cbf',
				'line-width': 5
			}}
		/>
	{/if}
</GeoJSON>
