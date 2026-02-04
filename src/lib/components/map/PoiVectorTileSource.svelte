<!-- PoiVectorTileSource.svelte -->
<script lang="ts">
	// @ts-nocheck
	import { VectorTileSource, HeatmapLayer, SymbolLayer, FillLayer } from 'svelte-maplibre';

	let iconImage = $state({
		attraction: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		education: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		entertainment: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		facility: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		food_and_drink: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		healthcare: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		leisure: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		lodging: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		natural: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		place: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		route: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		shop: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-bright-',
			'teal'
		],
		transportation: [
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
				'teal'
			],
			[
				'concat',
				['to-string', ['get', 'class']],
				'-',
				['to-string', ['get', 'subclass']],
				'-',
				['to-string', ['get', 'category']],
				'-bright-',
				'teal'
			]
		],
		bookmarks: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-dark-',
			'teal'
		],
		visited: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-dark-',
			'teal'
		],
		todo: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-dark-',
			'teal'
		],
		followed: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-dark-',
			'teal'
		],
		search: [
			'concat',
			['to-string', ['get', 'class']],
			'-',
			['to-string', ['get', 'subclass']],
			'-',
			['to-string', ['get', 'category']],
			'-dark-',
			'teal'
		]
	});
</script>

<VectorTileSource
	id="poi"
	tiles={['mbtiles://./poi/{z}/{x}/{y}']}
	minzoom={0}
	maxzoom={14}
	promoteId={'id'}
>
	<!-- attraction -->
	<HeatmapLayer
		id="heat_attraction"
		sourceLayer={'poi_attraction'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- education -->
	<HeatmapLayer
		id="heat_education"
		sourceLayer={'poi_education'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- entertainment -->
	<HeatmapLayer
		id="heat_entertainment"
		sourceLayer={'poi_entertainment'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- facility -->
	<HeatmapLayer
		id="heat_faciliy"
		sourceLayer={'poi_faciliy'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- food_and_drink -->
	<HeatmapLayer
		id="heat_food_and_drink"
		sourceLayer={'poi_food_and_drink'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- healthcare -->
	<HeatmapLayer
		id="heat_healthcare"
		sourceLayer={'poi_healthcare'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- leisure -->
	<HeatmapLayer
		id="heat_leisure"
		sourceLayer={'poi_leisure'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- lodging -->
	<HeatmapLayer
		id="heat_lodging"
		sourceLayer={'poi_lodging'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- natural -->
	<HeatmapLayer
		id="heat_natural"
		sourceLayer={'poi_natural'}
		minzoom={8}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': [
				'interpolate',
				['linear'],
				['zoom'],
				8,
				0.8, // Start showing at zoom 8 with low intensity
				12,
				1, // Increase intensity at medium zoom
				16,
				3 // Maximum intensity at high zoom
			],

			'heatmap-radius': [
				'interpolate',
				['linear'],
				['zoom'],
				8,
				15, // Start with small radius at zoom 8
				12,
				25, // Medium radius at zoom 12
				15,
				30 // Large radius at zoom 15
			],
			'heatmap-opacity': [
				'interpolate',
				['linear'],
				['zoom'],
				8,
				0.5, // Start with good visibility
				13,
				1 // Maintain opacity through zoom levels
			]
		}}
	></HeatmapLayer>
	<!-- place -->
	<HeatmapLayer
		id="heat_place"
		sourceLayer={'poi_place'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- shop -->
	<HeatmapLayer
		id="heat_shop"
		sourceLayer={'poi_shop'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- transportation -->
	<HeatmapLayer
		id="heat_transportation"
		sourceLayer={'poi_transportation'}
		layout={{ visibility: 'none' }}
		paint={{
			'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 1, 0, 16, 3],

			'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 0, 12, 2.3, 15, 15],
			'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 12, 1, 15, 0.7]
		}}
	></HeatmapLayer>
	<!-- attraction -->
	<SymbolLayer
		id="poi_attraction"
		sourceLayer={'poi_attraction'}
		minzoom={13.5}
		layout={{
			'icon-image': iconImage.attraction,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- education -->
	<SymbolLayer
		id="poi_education"
		sourceLayer={'poi_education'}
		minzoom={17}
		layout={{
			'icon-image': iconImage.education,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- entertainment -->
	<SymbolLayer
		id="poi_entertainment"
		sourceLayer={'poi_entertainment'}
		minzoom={16}
		layout={{
			'icon-image': iconImage.entertainment,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- facility -->
	<SymbolLayer
		id="poi_facility"
		sourceLayer={'poi_facility'}
		minzoom={18}
		layout={{
			'icon-image': iconImage.facility,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- food_and_drink -->
	<SymbolLayer
		id="poi_food_and_drink"
		sourceLayer={'poi_food_and_drink'}
		minzoom={14}
		layout={{
			'icon-image': iconImage.food_and_drink,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- healthcare -->
	<SymbolLayer
		id="poi_healthcare"
		sourceLayer={'poi_healthcare'}
		minzoom={15}
		layout={{
			'icon-image': iconImage.healthcare,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- leisure -->
	<SymbolLayer
		id="poi_leisure"
		sourceLayer={'poi_leisure'}
		minzoom={10}
		layout={{
			'icon-image': iconImage.leisure,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- lodging -->
	<SymbolLayer
		id="poi_lodging"
		sourceLayer={'poi_lodging'}
		minzoom={14}
		layout={{
			'icon-image': iconImage.lodging,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- natural -->
	<SymbolLayer
		id="poi_natural"
		sourceLayer={'poi_natural'}
		minzoom={8}
		layout={{
			'icon-image': iconImage.natural,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- shop -->
	<SymbolLayer
		id="poi_shop"
		sourceLayer={'poi_shop'}
		minzoom={17}
		layout={{
			'icon-image': iconImage.shop,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- transportation -->
	<SymbolLayer
		id="poi_transportation"
		sourceLayer={'poi_transportation'}
		minzoom={15.5}
		layout={{
			'icon-image': iconImage.transportation,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['literal', ['Noto Sans Regular']],
			'text-offset': [0, 1],
			'text-max-width': 9,
			'text-optional': true,
			'text-allow-overlap': false,
			'text-size': ['interpolate', ['linear'], ['zoom'], 10, 8, 22, 10]
		}}
		paint={{
			'text-color': '#666',
			'text-halo-blur': 0.5,
			'text-halo-color': '#ffffff',
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<!-- place -->
	<!-- General places (non-cities) -->
	<SymbolLayer
		id="poi_place_minor"
		sourceLayer={'poi_place'}
		filter={[
			[
				'!',
				[
					'in',
					['get', 'category'],
					[
						'literal',
						[
							'continent',
							'country',
							'county',
							'district',
							'island',
							'islet',
							'locality',
							'municipality',
							'ocean',
							'province',
							'region',
							'sea',
							'state',
							'subdistrict',
							'city',
							'town',
							'capital'
						]
					]
				]
			]
		]}
		layout={{
			'icon-image': iconImage.place,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
			'text-font': [
				'case',
				['==', ['get', 'subclass'], 'administrative'],
				['literal', ['Noto Sans Bold']],
				['==', ['get', 'subclass'], 'urban'],
				['literal', ['Noto Sans Bold']],
				['literal', ['Noto Sans Regular']]
			],
			'text-transform': [
				'case',
				['==', ['get', 'subclass'], 'administrative'],
				'uppercase',
				'none'
			],
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
	<!-- Cities layer (rendered on top) -->
	<SymbolLayer
		id="poi_place_major"
		sourceLayer={'poi_place'}
		filter={[
			[
				'in',
				['get', 'category'],
				[
					'literal',
					[
						'continent',
						'country',
						'county',
						'district',
						'island',
						'islet',
						'locality',
						'municipality',
						'ocean',
						'province',
						'region',
						'sea',
						'state',
						'subdistrict',
						'city',
						'town',
						'capital'
					]
				]
			]
		]}
		layout={{
			'icon-image': iconImage.place,
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.25, 14, 0.8, 18, 1],
			'text-anchor': 'top',
			'text-field': ['coalesce', ['get', 'name:en'], ['get', 'name']],
			'text-font': ['literal', ['Noto Sans Bold']],
			'text-transform': 'uppercase',
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
	<!-- route -->
	<!-- <SymbolLayer
    id="poi_route"
    sourceLayer={"poi_route"}
    minzoom={8}
    layout={{
      "icon-image": "{class}-{subclass}-{category}-bright-",
      "icon-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        8, 0.5,
        14, 0.8,
        18, 1,
      ],
      "text-anchor": "top",
      "text-field": [
        "coalesce",
        ["get", "name:en"], // Try to get name in the specified language
        ["get", "name"], // Fallback to default name if not available
      ],
      "text-font": [
  "case",
  ["==", ["get", "subclass"], "administrative"],
  ["literal", ["Noto Sans Bold"]],
  ["==", ["get", "subclass"], "urban"],
  ["literal", ["Noto Sans Bold"]],
  ["literal", ["Noto Sans Regular"]]
],
"text-transform": [
  "case",
  ["==", ["get", "subclass"], "administrative"],
  "uppercase",
  ["in", ["get", "category"], ["literal", ["city", "capital"]]],
  "uppercase",
  "none"
],
      "text-offset": [0, 1],
      "text-max-width": 9,
      "text-optional": true,
      "text-allow-overlap": false,
      "text-size": [
        "interpolate",
        ["linear"],
        ["zoom"],
        10,
        ["case", ["==", ["get", "class"], "place"], 10, 8],
        22,
        ["case", ["==", ["get", "class"], "place"], 15, 10],
      ],
    }}
    paint={{
      "text-color": "#666",
      "text-halo-blur": 0.5,
      "text-halo-color": "#ffffff",
      "text-halo-width": 2,
    }}
  ></SymbolLayer> -->
</VectorTileSource>
