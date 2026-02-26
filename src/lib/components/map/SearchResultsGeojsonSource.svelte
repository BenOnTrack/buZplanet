<!-- SearchResultsGeojsonSource.svelte -->
<script lang="ts">
	import { GeoJSON, CircleLayer, SymbolLayer } from 'svelte-maplibre';
	import { appState } from '$lib/stores/AppState.svelte.js';

	interface Props {
		nameExpression: any;
		searchResults: SearchResult[];
		visible?: boolean;
	}
	let { nameExpression, searchResults, visible = true }: Props = $props();

	// Convert search results to GeoJSON format
	let searchResultsGeoJSON = $derived.by(() => {
		if (!visible || !searchResults || searchResults.length === 0) {
			return {
				type: 'FeatureCollection' as const,
				features: []
			};
		}

		const features = searchResults
			.filter((result) => {
				// Handle both SearchResult and enhanced result formats
				const lng =
					result.lng || ((result as any).searchResult && (result as any).searchResult.lng);
				const lat =
					result.lat || ((result as any).searchResult && (result as any).searchResult.lat);
				return lng !== 0 && lat !== 0; // Filter out invalid coordinates
			})
			.map((result) => {
				// Handle both SearchResult and enhanced result formats
				const searchResult = (result as any).searchResult || result;
				const lng = searchResult.lng;
				const lat = searchResult.lat;
				const names = searchResult.names || {};

				return {
					type: 'Feature' as const,
					id: searchResult.id,
					geometry: {
						type: 'Point' as const,
						coordinates: [lng, lat]
					},
					properties: {
						id: searchResult.id,
						class: searchResult.class,
						subclass: searchResult.subclass,
						category: searchResult.category,
						database: searchResult.database,
						// Preserve all name properties from the search result
						...names,
						// Add search-specific properties
						isSearchResult: true,
						searchScore: searchResult.score || 0,
						// Add type information from enhanced result
						types: (result as any).types || [],
						lists: (result as any).lists || []
					}
				};
			});

		return {
			type: 'FeatureCollection' as const,
			features
		};
	});

	// Dynamic icon image expression based on search result properties
	const iconImage = $derived(() => {
		// Get current color mappings from AppState
		const colorMappings = appState.colorMappings;

		// Use search color for search results, but fall back to category colors if needed
		return [
			'case',
			// If it has types (bookmarked, todo, visited), use those colors
			['has', 'types'],
			[
				'case',
				['in', 'bookmarked', ['get', 'types']],
				[
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-dark-',
					colorMappings.bookmarks
				],
				['in', 'visited', ['get', 'types']],
				[
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-dark-',
					colorMappings.visited
				],
				['in', 'todo', ['get', 'types']],
				[
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-dark-',
					colorMappings.todo
				],
				// Default search result color
				[
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					colorMappings.search
				]
			],
			// Default search result color for results without types
			[
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.search
			]
		];
	});

	// Circle color for clusters - use search color (static value)
	let clusterCircleColor = $state('rgba(37, 99, 235, 0.6)'); // Default blue

	// Should render layers - only when visible AND has features
	const shouldRenderLayers = $derived.by(() => {
		return visible && searchResultsGeoJSON.features.length > 0;
	});

	$effect(() => {
		console.log('Search results GeoJSON updated:', {
			resultCount: searchResults.length,
			featureCount: searchResultsGeoJSON.features.length,
			visible,
			sampleResult: searchResults[0]
		});
	});
</script>

{#if shouldRenderLayers}
	<GeoJSON
		id="searchResultsSource"
		data={searchResultsGeoJSON}
		cluster={{ maxZoom: 12, radius: 50 }}
	>
		<!-- Cluster circles -->
		<CircleLayer
			id="searchResultsClusterCircles"
			beforeId="poi_place_major"
			applyToClusters
			paint={{
				'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
				'circle-color': clusterCircleColor,
				'circle-opacity': 0.7,
				'circle-stroke-width': 2,
				'circle-stroke-color': '#ffffff',
				'circle-stroke-opacity': 0.8
			}}
		/>

		<!-- Cluster labels -->
		<SymbolLayer
			id="searchResultsClusterLabels"
			beforeId="poi_place_major"
			interactive={false}
			applyToClusters
			layout={{
				'text-field': '{point_count}',
				'text-font': ['Noto Sans Bold'],
				'text-size': 12
			}}
			paint={{
				'text-color': '#ffffff',
				'text-halo-blur': 1,
				'text-halo-color': '#000000',
				'text-halo-width': 1
			}}
		/>

		<!-- Individual search result points -->
		<SymbolLayer
			id="searchResults"
			layout={{
				'icon-image': iconImage() as any,
				'icon-allow-overlap': true,
				'icon-size': [
					'interpolate',
					['linear'],
					['zoom'],
					0,
					0.7, // Slightly larger than bookmarks to make search results more prominent
					14,
					0.85,
					15,
					1.1,
					16,
					1.4,
					17,
					1.7
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
				'text-offset': [0, 1.2],
				'text-max-width': 10,
				'text-optional': true,
				'text-allow-overlap': false,
				'text-size': [
					'interpolate',
					['linear'],
					['zoom'],
					10,
					['case', ['==', ['get', 'class'], 'place'], 11, 9], // Slightly larger text
					22,
					['case', ['==', ['get', 'class'], 'place'], 16, 11]
				]
			}}
			paint={{
				'text-color': '#2563eb', // Blue color to distinguish search results
				'text-halo-blur': 0.5,
				'text-halo-color': '#ffffff',
				'text-halo-width': 2.5,
				'icon-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 0.8, 1]
			}}
		/>

		<!-- Highlight ring for search results -->
		<CircleLayer
			id="searchResultsHighlight"
			paint={{
				'circle-radius': [
					'interpolate',
					['linear'],
					['zoom'],
					0,
					8,
					14,
					12,
					15,
					16,
					16,
					20,
					17,
					24
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
					'#2563eb', // Blue for hover
					'transparent'
				],
				'circle-stroke-opacity': 0.8
			}}
		/>
	</GeoJSON>
{/if}
