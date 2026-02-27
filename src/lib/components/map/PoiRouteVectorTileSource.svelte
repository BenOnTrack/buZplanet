<!-- PoiRouteVectorTileSource.svelte -->
<script lang="ts">
	// @ts-nocheck
	import { VectorTileSource, SymbolLayer } from 'svelte-maplibre';
	import { appState } from '$lib/stores/AppState.svelte.js';
	import { searchControl } from '$lib/stores/SearchControl.svelte.js';
	import { buildMapFilter } from '$lib/utils/categories';

	let { nameExpression }: { nameExpression: any } = $props();

	// Type assertion helper for Mapbox expressions that TypeScript doesn't recognize
	const expr = (expression: any) => expression as any;

	// AppState is initialized by default in constructor

	// Check if POI should be visible (respects temporary search control override)
	const shouldShowPOI = $derived.by(() => {
		// If search drawer is open and POI is set to hidden, hide POI
		if (searchControl.searchDrawerOpen && !searchControl.poiVisibility) {
			return false;
		}
		// Otherwise show POI normally
		return true;
	});

	// Derived filter based on AppState map filter settings
	let featuresMapFilter = $derived.by(() => {
		try {
			// If POI should be hidden, return false filter
			if (!shouldShowPOI) {
				return expr(['==', ['literal', true], ['literal', false]]); // Always false - hide everything
			}

			const mapFilterSettings = appState.mapFilterSettings;
			const selectedCategories = Array.from(mapFilterSettings.categories);

			console.log('Map filter applied:', {
				categories: selectedCategories.length,
				poiVisible: shouldShowPOI
			});

			return buildMapFilter(selectedCategories);
		} catch (error) {
			console.error('Error building map filter:', error);
			return expr(['all']); // Fallback to show all
		}
	});

	const iconImage = $derived.by(() => {
		// Get current color mappings from AppState as plain objects (no proxies)
		const colorMappings = $state.snapshot(appState.colorMappings);

		// Create plain object without reactive references
		return {
			attraction: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.attraction
			]),
			education: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.education
			]),
			entertainment: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.entertainment
			]),
			facility: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.facility
			]),
			food_and_drink: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.food_and_drink
			]),
			healthcare: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.healthcare
			]),
			leisure: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.leisure
			]),
			lodging: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.lodging
			]),
			natural: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.natural
			]),
			place: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.place
			]),
			route: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.route
			]),
			shop: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				colorMappings.shop
			]),
			transportation: expr([
				'case',
				['has', 'relationChildId'],
				[
					'concat',
					'super-',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					colorMappings.transportation
				],
				[
					'concat',
					['to-string', ['get', 'class']],
					'-',
					['to-string', ['get', 'subclass']],
					'-',
					['to-string', ['get', 'category']],
					'-bright-',
					colorMappings.transportation
				]
			]),
			bookmarks: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.bookmarks
			]),
			visited: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.visited
			]),
			todo: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.todo
			]),
			followed: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.followed
			]),
			search: expr([
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-dark-',
				colorMappings.search
			])
		};
	});
</script>

<VectorTileSource
	id="poiRoute"
	tiles={['mbtiles://./poiRoute/{z}/{x}/{y}']}
	minzoom={8}
	maxzoom={14}
	promoteId={'id'}
>
	<!-- poi_route -->
	<SymbolLayer
		id="poi_route"
		sourceLayer={'poi_route'}
		minzoom={8}
		beforeId="poi_place_major"
		filter={featuresMapFilter}
		layout={{
			'icon-image': iconImage.route,
			'icon-size': expr(['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 0.8, 18, 1]),
			'text-anchor': 'top',
			'text-field': nameExpression,
			'text-font': [
				'case',
				['==', ['get', 'class'], 'place'],
				['literal', ['Noto Sans Bold']],
				['literal', ['Noto Sans Regular']]
			],
			'text-transform': ['case', ['==', ['get', 'class'], 'place'], 'uppercase', 'none'],
			'text-offset': [0, 1],
			'text-max-width': 9,
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
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
</VectorTileSource>
