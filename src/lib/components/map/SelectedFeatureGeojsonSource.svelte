<!-- SelectedFeatureGeojsonSource.svelte -->
<script lang="ts">
	import { getContext } from 'svelte';
	import type { Map } from 'maplibre-gl';
	import type { FeatureCollection } from 'geojson';

	// -- PROPS --
	interface Props {
		selectedFeatureGeoJSON: FeatureCollection | null;
	}

	let { selectedFeatureGeoJSON }: Props = $props();

	// Get map instance from context
	const map = getContext<Map>('map');

	const SOURCE_ID = 'selected-feature-source';
	const LAYER_ID = 'selected-feature-layer';

	// Effect to handle adding/updating/removing the source and layer
	$effect(() => {
		if (!map) {
			console.log('🗺️ [SelectedFeature] No map instance available');
			return;
		}

		console.log('🔍 [SelectedFeature] Effect triggered with GeoJSON:', selectedFeatureGeoJSON);

		// Clean up function
		const cleanup = () => {
			if (map.getLayer(LAYER_ID)) {
				console.log('🧹 [SelectedFeature] Removing existing layer:', LAYER_ID);
				map.removeLayer(LAYER_ID);
			}
			if (map.getSource(SOURCE_ID)) {
				console.log('🧹 [SelectedFeature] Removing existing source:', SOURCE_ID);
				map.removeSource(SOURCE_ID);
			}
		};

		// If no valid GeoJSON, just cleanup
		if (!selectedFeatureGeoJSON) {
			console.log('❌ [SelectedFeature] No GeoJSON provided, cleaning up');
			cleanup();
			return;
		}

		const isValid = isValidGeoJSON(selectedFeatureGeoJSON);
		console.log(`${isValid ? '✅' : '❌'} [SelectedFeature] GeoJSON validation result:`, isValid);

		if (!isValid) {
			console.log('🚫 [SelectedFeature] Invalid GeoJSON, cleaning up');
			cleanup();
			return;
		}

		try {
			console.log('🎯 [SelectedFeature] Adding valid GeoJSON to map...');
			// Remove existing source/layer if they exist
			cleanup();

			// Add new source
			console.log('📍 [SelectedFeature] Adding source with data:', selectedFeatureGeoJSON);
			map.addSource(SOURCE_ID, {
				type: 'geojson',
				data: selectedFeatureGeoJSON
			});

			// Add circle layer
			console.log('🎨 [SelectedFeature] Adding circle layer');
			map.addLayer({
				id: LAYER_ID,
				type: 'circle',
				source: SOURCE_ID,
				paint: {
					'circle-radius': 15,
					'circle-color': '#007cbf',
					'circle-stroke-width': 3,
					'circle-stroke-color': '#ffffff',
					'circle-opacity': 0.8
				}
			});
			console.log('✨ [SelectedFeature] Successfully added selected feature layer!');
		} catch (error) {
			console.error('💥 [SelectedFeature] Error adding selected feature layer:', error);
			cleanup();
		}

		// Return cleanup function
		return cleanup;
	});

	// Validation function
	function isValidGeoJSON(geoJSON: FeatureCollection): boolean {
		console.log('🔍 [SelectedFeature] Validating GeoJSON:', geoJSON);
		try {
			if (!geoJSON || typeof geoJSON !== 'object') {
				console.log('❌ [SelectedFeature] GeoJSON is null or not an object');
				return false;
			}

			if (geoJSON.type !== 'FeatureCollection') {
				console.log('❌ [SelectedFeature] Not a FeatureCollection, type is:', geoJSON.type);
				return false;
			}

			if (!Array.isArray(geoJSON.features)) {
				console.log('❌ [SelectedFeature] Features is not an array:', geoJSON.features);
				return false;
			}

			if (geoJSON.features.length === 0) {
				console.log('❌ [SelectedFeature] Features array is empty');
				return false;
			}

			const feature = geoJSON.features[0];
			console.log('🔍 [SelectedFeature] Validating first feature:', feature);

			if (!feature || feature.type !== 'Feature') {
				console.log('❌ [SelectedFeature] First item is not a Feature, type is:', feature?.type);
				return false;
			}

			if (!feature.geometry) {
				console.log('❌ [SelectedFeature] Feature has no geometry');
				return false;
			}

			if (feature.geometry.type !== 'Point') {
				console.log(
					'❌ [SelectedFeature] Geometry is not a Point, type is:',
					feature.geometry.type
				);
				return false;
			}

			if (!Array.isArray(feature.geometry.coordinates)) {
				console.log(
					'❌ [SelectedFeature] Coordinates is not an array:',
					feature.geometry.coordinates
				);
				return false;
			}

			if (feature.geometry.coordinates.length < 2) {
				console.log(
					'❌ [SelectedFeature] Coordinates array too short:',
					feature.geometry.coordinates.length
				);
				return false;
			}

			const [lng, lat] = feature.geometry.coordinates;
			if (typeof lng !== 'number' || typeof lat !== 'number') {
				console.log('❌ [SelectedFeature] Coordinates are not numbers:', {
					lng: typeof lng,
					lat: typeof lat,
					values: [lng, lat]
				});
				return false;
			}

			if (!isFinite(lng) || !isFinite(lat)) {
				console.log('❌ [SelectedFeature] Coordinates are not finite:', { lng, lat });
				return false;
			}

			console.log('✅ [SelectedFeature] GeoJSON validation passed! Coordinates:', [lng, lat]);
			return true;
		} catch (error) {
			console.error('💥 [SelectedFeature] GeoJSON validation error:', error);
			return false;
		}
	}
</script>

<!-- This component doesn't render any HTML - it just manages map layers via effects -->
