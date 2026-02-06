<!-- SelectedFeatureGeojsonSource.svelte -->
<script lang="ts">
	import type { FeatureCollection } from 'geojson';
	import { GeoJSON, CircleLayer } from 'svelte-maplibre';

	interface Props {
		selectedFeatureGeoJSON: any;
	}
	let { selectedFeatureGeoJSON }: Props = $props();

	// Determine circle radius based on geometry type
	const circleRadius = $derived.by(() => {
		const firstFeature = selectedFeatureGeoJSON.features[0];
		const geometryType = firstFeature?.geometry?.type;

		// Use radius 5 for polygons, 15 for points and other geometries
		return geometryType === 'Polygon' || geometryType === 'MultiPolygon' ? 5 : 15;
	});
</script>

<GeoJSON id="selectedFeatureSource" data={selectedFeatureGeoJSON}>
	<CircleLayer
		id="selectedFeature"
		applyToClusters={false}
		paint={{
			'circle-radius': circleRadius,
			'circle-color': '#007cbf',
			'circle-stroke-width': 2,
			'circle-stroke-color': '#ffffff'
		}}
	/>
</GeoJSON>
