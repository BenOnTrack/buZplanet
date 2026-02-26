<script lang="ts">
	import { GeoJSON, CircleLayer, SymbolLayer } from 'svelte-maplibre';
	import { appState } from '$lib/stores/AppState.svelte';
	import { categoryFilterStore } from '$lib/stores/CategoryFilterStore.svelte';
	import { onMount, onDestroy } from 'svelte';

	interface Props {
		nameExpression: any;
		visible?: boolean;
		map?: any; // Mapbox GL map instance
	}

	let { nameExpression, visible = true, map }: Props = $props();

	// Get reactive state from the centralized store
	let filteredGeoJSON = $derived(categoryFilterStore.geoJSON);
	let isLoading = $derived(categoryFilterStore.isLoading);
	let isFilterActive = $derived(categoryFilterStore.isActive);

	// Dynamic icon image expression (simplified, like SearchResultsGeojsonSource)
	const iconImage = $derived(() => {
		const colorMappings = appState.colorMappings;

		// Use purple/category filter color to distinguish from search results
		return [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			colorMappings.map || 'purple'
		];
	});

	// Should render layers - only when visible AND has features AND filter is active
	const shouldRenderLayers = $derived.by(() => {
		return visible && isFilterActive && filteredGeoJSON.features.length > 0;
	});

	// Track if map has been set to prevent duplicate setMap calls
	let mapSet = $state(false);

	// Setup map in store and trigger initial fetch if needed
	$effect(() => {
		if (map && !mapSet) {
			categoryFilterStore.setMap(map);
			mapSet = true;
			console.log('🗺️ CategoryFilter: Map set in store');
		}
	});

	// Cleanup on destroy
	onDestroy(() => {
		mapSet = false;
		console.log('🧹 CategoryFilter: Component destroyed');
	});
</script>

{#if shouldRenderLayers}
	<GeoJSON id="categoryFilterSource" data={filteredGeoJSON} cluster={{ maxZoom: 12, radius: 50 }}>
		<!-- Cluster circles -->
		<CircleLayer
			id="categoryFilterClusterCircles"
			beforeId="poi_place_major"
			applyToClusters
			paint={{
				'circle-radius': ['step', ['get', 'point_count'], 18, 100, 28, 750, 38],
				'circle-color': 'rgba(147, 51, 234, 0.6)', // Purple to distinguish from search
				'circle-opacity': 0.7,
				'circle-stroke-width': 2,
				'circle-stroke-color': '#ffffff',
				'circle-stroke-opacity': 0.8
			}}
		/>

		<!-- Cluster labels -->
		<SymbolLayer
			id="categoryFilterClusterLabels"
			beforeId="poi_place_major"
			interactive={false}
			applyToClusters
			layout={{
				'text-field': '{point_count}',
				'text-font': ['Noto Sans Bold'],
				'text-size': 11
			}}
			paint={{
				'text-color': '#ffffff',
				'text-halo-blur': 1,
				'text-halo-color': '#000000',
				'text-halo-width': 1
			}}
		/>

		<!-- Individual filtered points -->
		<SymbolLayer
			id="categoryFilterPoints"
			layout={{
				'icon-image': iconImage() as any,
				'icon-allow-overlap': true,
				'icon-size': [
					'interpolate',
					['linear'],
					['zoom'],
					0,
					0.6,
					14,
					0.8,
					15,
					1.0,
					16,
					1.3,
					17,
					1.6
				],
				'text-anchor': 'top',
				'text-field': nameExpression,
				'text-font': [
					'case',
					['==', ['get', 'class'], 'place'],
					['literal', ['Noto Sans Bold']],
					['literal', ['Noto Sans Regular']]
				],
				'text-transform': ['case', ['==', ['get', 'class'], 'place'], 'uppercase', 'none'],
				'text-offset': [0, 1.1],
				'text-max-width': 10,
				'text-optional': true,
				'text-allow-overlap': false,
				'text-size': [
					'interpolate',
					['linear'],
					['zoom'],
					10,
					['case', ['==', ['get', 'class'], 'place'], 10, 8],
					22,
					['case', ['==', ['get', 'class'], 'place'], 15, 10]
				]
			}}
			paint={{
				'text-color': '#7c3aed', // Purple text to distinguish from search
				'text-halo-blur': 0.5,
				'text-halo-color': '#ffffff',
				'text-halo-width': 2.5,
				'icon-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 1]
			}}
		/>

		<!-- Highlight ring for filtered features -->
		<CircleLayer
			id="categoryFilterHighlight"
			paint={{
				'circle-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					0,
					7,
					14,
					11,
					15,
					15,
					16,
					19,
					17,
					23
				],
				'circle-color': 'transparent',
				'circle-stroke-width': [
					'case',
					['boolean', ['feature-state', 'selected'], false],
					3,
					['boolean', ['feature-state', 'hover'], false],
					2,
					0
				],
				'circle-stroke-color': [
					'case',
					['boolean', ['feature-state', 'selected'], false],
					'#dc2626', // Red for selected
					['boolean', ['feature-state', 'hover'], false],
					'#7c3aed', // Purple for hover
					'transparent'
				],
				'circle-stroke-opacity': 0.8
			}}
		/>
	</GeoJSON>
{/if}

<!-- Loading indicator (optional) -->
{#if isLoading && visible}
	<div class="category-filter-loading">
		<div class="loading-spinner"></div>
	</div>
{/if}

<style>
	.category-filter-loading {
		position: fixed;
		top: 80px;
		right: 20px;
		background: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 8px 12px;
		border-radius: 6px;
		font-size: 12px;
		z-index: 1000;
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.loading-spinner {
		width: 14px;
		height: 14px;
		border: 2px solid rgba(255, 255, 255, 0.3);
		border-top: 2px solid white;
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>
