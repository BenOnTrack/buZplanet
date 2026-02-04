<!-- TransportationVectorTileSource.svelte -->
<script lang="ts">
	// @ts-nocheck
	import { VectorTileSource, LineLayer, SymbolLayer, FillLayer } from 'svelte-maplibre';

	// Type assertion helper for Mapbox GL expressions
	// These expressions are valid but TypeScript types are restrictive
	const expr = (expression: any) => expression as any;
</script>

<VectorTileSource
	id="transportation"
	tiles={['mbtiles://./transportation/{z}/{x}/{y}']}
	minzoom={8}
	maxzoom={14}
	promoteId={'id'}
>
	<!-- -- MARITIME -- -->
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-tunnel"
		sourceLayer={'transportation_maritime'}
		minzoom={14}
		filter={['all', ['in', 'category', 'river', 'stream', 'canal'], ['==', 'brunnel', 'tunnel']]}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': '#a6c3d8',
			'line-dasharray': [2, 4],
			'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 13, 0.5, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-other"
		sourceLayer={'transportation_maritime'}
		minzoom={14}
		filter={expr([
			'all',
			['!in', 'category', 'canal', 'river', 'stream'],
			['!=', 'intermittent', 'yes']
		])}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': '#a6c3d8',
			'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 13, 0.5, 20, 2]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-other-intermittent"
		sourceLayer={'transportation_maritime'}
		filter={expr([
			'all',
			['!in', 'category', 'canal', 'river', 'stream'],
			['==', 'intermittent', 'yes']
		])}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': '#a6c3d8',
			'line-dasharray': [4, 3],
			'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 13, 0.5, 20, 2]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-stream-canal"
		sourceLayer={'transportation_maritime'}
		filter={[
			'all',
			['in', 'category', 'canal', 'stream'],
			['!=', 'brunnel', 'tunnel'],
			['!=', 'intermittent', 'yes']
		]}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': '#a6c3d8',
			'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 13, 0.5, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-stream-canal-intermittent"
		sourceLayer={'transportation_maritime'}
		filter={[
			'all',
			['in', 'category', 'canal', 'stream'],
			['!=', 'brunnel', 'tunnel'],
			['==', 'intermittent', 'yes']
		]}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': '#a6c3d8',
			'line-dasharray': [4, 3],
			'line-width': ['interpolate', ['exponential', 1.3], ['zoom'], 13, 0.5, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-river"
		sourceLayer={'transportation_maritime'}
		filter={[
			'all',
			['==', 'category', 'river'],
			['!=', 'brunnel', 'tunnel'],
			['!=', 'intermittent', 'yes']
		]}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': '#a6c3d8',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 10, 0.8, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-river-intermittent"
		sourceLayer={'transportation_maritime'}
		filter={[
			'all',
			['==', 'category', 'river'],
			['!=', 'brunnel', 'tunnel'],
			['==', 'intermittent', 'yes']
		]}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': '#a6c3d8',
			'line-dasharray': [3, 2.5],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 10, 0.8, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-ferry"
		sourceLayer={'transportation_maritime'}
		filter={['all', ['in', 'category', 'ferry']]}
		layout={{
			'line-join': 'round'
		}}
		paint={{
			'line-color': 'rgba(108, 159, 182, 1)',
			'line-dasharray': [2, 2],
			'line-width': 1.1
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_maritime-line-maritime-pier"
		sourceLayer={'transportation_maritime'}
		filter={['all', ['==', '$type', 'LineString'], ['in', 'category', 'pier']]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#f8f4f0',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15, 1, 17, 4]
		}}
	></LineLayer>
	<FillLayer
		id="transportation-transportation_maritime-fill-maritime-area"
		sourceLayer={'transportation_maritime'}
		filter={expr(['all', ['==', '$type', 'Polygon'], ['!in', 'category', 'pier']])}
		paint={{
			'fill-antialias': false,
			'fill-color': 'hsla(0, 0%, 89%, 0.56)',
			'fill-opacity': 0.9,
			'fill-outline-color': '#cfcdca'
		}}
	></FillLayer>
	<FillLayer
		id="transportation-transportation_maritime-fill-road-area-pier"
		sourceLayer={'transportation_maritime'}
		filter={['all', ['==', '$type', 'Polygon'], ['==', 'category', 'pier']]}
		paint={{
			'fill-antialias': true,
			'fill-color': '#f8f4f0'
		}}
	></FillLayer>
	<SymbolLayer
		id="transportation-transportation_maritime-symbol-maritime-name"
		sourceLayer={'transportation_maritime'}
		minzoom={8}
		filter={['all', ['==', '$type', 'LineString']]}
		layout={{
			'symbol-placement': 'line',
			'symbol-spacing': 350,
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['Noto Sans Italic'],
			'text-letter-spacing': 0.2,
			'text-max-width': 5,
			'text-rotation-alignment': 'map',
			'text-size': 14
		}}
		paint={{
			'text-color': '#74aee9',
			'text-halo-color': 'rgba(255,255,255,0.7)',
			'text-halo-width': 2
		}}
	></SymbolLayer>

	<!-- -- RAIL -- -->
	<LineLayer
		id="transportation-transportation_rail-line-tunnel"
		sourceLayer={'transportation_rail'}
		filter={['all', ['==', 'brunnel', 'tunnel']]}
		layout={{
			'line-join': 'round'
		}}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.6)',
			'line-dasharray': [2, 2],
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_rail-line-transit"
		sourceLayer={'transportation_rail'}
		filter={expr([
			'all',
			['==', '$type', 'LineString'],
			['==', 'category', 'transit'],
			['!in', 'brunnel', 'tunnel']
		])}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.4)',
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_rail-line-transit-hatching"
		sourceLayer={'transportation_rail'}
		filter={expr([
			'all',
			['==', '$type', 'LineString'],
			['==', 'category', 'transit'],
			['!in', 'brunnel', 'tunnel']
		])}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.4)',
			'line-dasharray': [0.2, 8],
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_rail-line-service"
		sourceLayer={'transportation_rail'}
		filter={['all', ['==', '$type', 'LineString'], ['has', 'service']]}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.4)',
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_rail-line-service-hatching"
		sourceLayer={'transportation_rail'}
		filter={['all', ['==', '$type', 'LineString'], ['has', 'service']]}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.4)',
			'line-dasharray': [0.2, 8],
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_rail-line"
		sourceLayer={'transportation_rail'}
		filter={expr([
			'all',
			['==', '$type', 'LineString'],
			['!has', 'service'],
			['!in', 'brunnel', 'bridge', 'tunnel']
		])}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.6)',
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_rail-line-hatching"
		sourceLayer={'transportation_rail'}
		filter={expr([
			'all',
			['==', '$type', 'LineString'],
			['!has', 'service'],
			['!in', 'brunnel', 'bridge', 'tunnel']
		])}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.6)',
			'line-dasharray': [0.2, 8],
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<!-- // RAIL // -->

	<!-- -- HIGHWAY -- -->
	<LineLayer
		id="transportation-transportation_highway-line-highway-service-tunnel-casing"
		sourceLayer={'transportation_highway'}
		filter={['all', ['==', 'category', 'service'], ['==', 'brunnel', 'tunnel']]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#cfcdca',
			'line-dasharray': [0.5, 0.25],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15, 1, 16, 4, 20, 11]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-track-tunnel-casing"
		sourceLayer={'transportation_highway'}
		filter={['all', ['==', 'category', 'track'], ['==', 'brunnel', 'tunnel']]}
		layout={{
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#cfcdca',
			'line-dasharray': [0.5, 0.25],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15, 1, 16, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-motorway-link-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', 'brunnel', 'tunnel'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': 'rgba(200, 147, 102, 1)',
			'line-dasharray': [0.5, 0.25],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 12, 1, 13, 3, 14, 4, 20, 15]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-minor-casing"
		sourceLayer={'transportation_highway'}
		filter={['all', ['==', 'category', 'minor'], ['==', 'brunnel', 'tunnel']]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#cfcdca',
			'line-opacity': {
				stops: [
					[12, 0],
					[12.5, 1]
				]
			},
			'line-width': {
				base: 1.2,
				stops: [
					[12, 0.5],
					[13, 1],
					[14, 4],
					[20, 15]
				]
			},
			'line-dasharray': [0.5, 0.25]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-link-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'trunk', 'primary', 'secondary', 'tertiary'],
			['==', 'brunnel', 'tunnel'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-opacity': 1,
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 12, 1, 13, 3, 14, 4, 20, 15],

			'line-dasharray': [0.5, 0.25]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-secondary-tertiary-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'secondary', 'tertiary'],
			['==', 'brunnel', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-opacity': 1,
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 8, 1.5, 20, 17],

			'line-dasharray': [0.5, 0.25]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-trunk-primary-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'primary', 'trunk'],
			['==', 'brunnel', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 5, 0.4, 6, 0.6, 7, 1.5, 20, 22]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-motorway-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', 'brunnel', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-dasharray': [0.5, 0.25],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 5, 0.4, 6, 0.6, 7, 1.5, 20, 22]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-path"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'path'],
			['==', '$type', 'LineString'],
			['==', 'brunnel', 'tunnel']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-dasharray': [1.5, 0.75],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15, 1.2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-motorway-link"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', 'brunnel', 'tunnel'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': 'rgba(244, 209, 158, 1)',
			'line-width': [
				'interpolate',
				['exponential', 1.2],
				['zoom'],
				12.5,
				0,
				13,
				1.5,
				14,
				2.5,
				20,
				11.5
			]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-service"
		sourceLayer={'transportation_highway'}
		filter={['all', ['==', 'category', 'service'], ['==', 'brunnel', 'tunnel']]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#fff',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15.5, 0, 16, 2, 20, 7.5]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-track"
		sourceLayer={'transportation_highway'}
		filter={['all', ['==', 'category', 'track'], ['==', 'brunnel', 'tunnel']]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#fff',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15.5, 0, 16, 2, 20, 7.5]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-link"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'trunk', 'primary', 'secondary', 'tertiary'],
			['==', 'brunnel', 'tunnel'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#fff4c6',
			'line-width': [
				'interpolate',
				['exponential', 1.2],
				['zoom'],
				12.5,
				0,
				13,
				1.5,
				14,
				2.5,
				20,
				11.5
			]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-minor"
		sourceLayer={'transportation_highway'}
		filter={['all', ['==', 'category', 'minor'], ['==', 'brunnel', 'tunnel']]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#fff',
			'line-opacity': 1,
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 13.5, 0, 14, 2.5, 20, 11.5]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-secondary-tertiary"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'secondary', 'tertiary'],
			['==', 'brunnel', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#fff4c6',
			'line-width': {
				base: 1.2,
				stops: [
					[6.5, 0],
					[7, 0.5],
					[20, 10]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-trunk-primary"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'primary', 'trunk'],
			['==', 'brunnel', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#fff4c6',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6.5, 0, 7, 0.5, 20, 18]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-tunnel-motorway"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', 'brunnel', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#ffdaa6',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6.5, 0, 7, 0.5, 20, 18]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-motorway-link-casing"
		sourceLayer={'transportation_highway'}
		minzoom={12}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['!in', 'brunnel', 'bridge', 'tunnel'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-opacity': 1,
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 12, 1, 13, 3, 14, 4, 20, 15]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-link-casing"
		sourceLayer={'transportation_highway'}
		minzoom={13}
		filter={[
			'all',
			['in', 'category', 'trunk', 'primary', 'secondary', 'tertiary'],
			['!in', 'brunnel', 'bridge', 'tunnel'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-opacity': 1,
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 12, 1, 13, 3, 14, 4, 20, 15]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-path"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'path'],
			['==', '$type', 'LineString'],
			['!in', 'brunnel', 'bridge', 'tunnel']
		]}
		layout={{
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#b9a19c',
			'line-dasharray': [1.5, 0.75],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15, 1.2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-steps"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'steps'],
			['==', '$type', 'LineString'],
			['!in', 'brunnel', 'bridge', 'tunnel']
		]}
		layout={{
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#f3f6f4',
			'line-dasharray': [0.5, 0.5],
			'line-width': {
				base: 4,
				stops: [
					[15, 4],
					[20, 10]
				]
			}
		}}
	></LineLayer>
	<!-- <LineLayer
    id="transportation-transportation_highway-line-highway-cycleway-casing"
    sourceLayer={"transportation_highway"}
    filter={["all", ["==", "category", "cycleway"]]}
    layout={{
      "line-cap": "butt",
      "line-join": "round",
      visibility: "visible",
    }}
    paint={{
      "line-color": "#d9d2e9",
      "line-opacity": 1,
      "line-width": {
        base: 1,
        stops: [
          [8, 1.1],
          [20, 10],
        ],
      },
    }}
  ></LineLayer> -->
	<LineLayer
		id="transportation-transportation_highway-line-highway-cycleway"
		sourceLayer={'transportation_highway'}
		filter={['all', ['==', 'category', 'cycleway']]}
		layout={{
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#b4a7d6',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15, 1.2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-motorway-link"
		sourceLayer={'transportation_highway'}
		minzoom={12}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['!in', 'brunnel', 'bridge', 'tunnel'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#ab9892',
			'line-width': [
				'interpolate',
				['exponential', 1.2],
				['zoom'],
				12.5,
				0,
				13,
				1.5,
				14,
				2.5,
				20,
				11.5
			]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-link"
		sourceLayer={'transportation_highway'}
		minzoom={13}
		filter={[
			'all',
			['in', 'category', 'trunk', 'primary', 'secondary', 'tertiary'],
			['!in', 'brunnel', 'bridge', 'tunnel'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#d4b8ae',
			'line-width': [
				'interpolate',
				['exponential', 1.2],
				['zoom'],
				12.5,
				0,
				13,
				1.5,
				14,
				2.5,
				20,
				11.5
			]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-track"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'track'],
			['==', '$type', 'LineString'],
			['!=', 'brunnel', 'tunnel']
		]}
		layout={{
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-dasharray': [1.5, 0.75],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15, 1.2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-minor"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'minor', 'service'],
			['==', '$type', 'LineString'],
			['!=', 'brunnel', 'tunnel']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#ddc6be',
			'line-opacity': 1,
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 13.5, 0, 14, 2.5, 20, 11.5]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-secondary-tertiary"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'secondary', 'tertiary'],
			['!in', 'brunnel', 'bridge', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#cba99d',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6.5, 0, 8, 0.5, 20, 13]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-primary"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'primary'],
			['==', '$type', 'LineString'],
			['!in', 'brunnel', 'bridge', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#b97e6b',
			'line-width': {
				base: 1.2,
				stops: [
					[8.5, 0],
					[9, 0.5],
					[20, 18]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-trunk"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'trunk'],
			['==', '$type', 'LineString'],
			['!in', 'brunnel', 'bridge', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#c18d7c',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6.5, 0, 7, 0.5, 20, 18]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-highway-motorway"
		sourceLayer={'transportation_highway'}
		minzoom={7}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', '$type', 'LineString'],
			['!in', 'brunnel', 'bridge', 'tunnel'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#ab9892',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6.5, 0, 7, 0.5, 20, 18]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-motorway-link-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', 'brunnel', 'bridge'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-opacity': 1,
			'line-width': {
				base: 1.2,
				stops: [
					[12, 1],
					[13, 3],
					[14, 4],
					[20, 19]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-link-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'trunk', 'primary', 'secondary', 'tertiary'],
			['==', 'brunnel', 'bridge'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-opacity': 1,
			'line-width': {
				base: 1.2,
				stops: [
					[12, 1],
					[13, 3],
					[14, 4],
					[20, 19]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-secondary-tertiary-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'secondary', 'tertiary'],
			['==', 'brunnel', 'bridge'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-opacity': 1,
			'line-width': {
				base: 1.2,
				stops: [
					[5, 0.4],
					[7, 0.6],
					[8, 1.5],
					[20, 21]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-trunk-primary-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'primary', 'trunk'],
			['==', 'brunnel', 'bridge'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': 'hsl(28, 76%, 67%)',
			'line-width': {
				base: 1.2,
				stops: [
					[5, 0.4],
					[6, 0.6],
					[7, 1.5],
					[20, 26]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-motorway-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', 'brunnel', 'bridge'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#C7C9C9',
			'line-width': {
				base: 1.2,
				stops: [
					[5, 0.4],
					[6, 0.6],
					[7, 1.5],
					[20, 26]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-minor-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'minor', 'service'],
			['==', '$type', 'LineString'],
			['==', 'brunnel', 'bridge']
		]}
		layout={{
			'line-cap': 'butt',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#cfcdca',
			'line-opacity': {
				stops: [
					[12, 0],
					[12.5, 1]
				]
			},
			'line-width': {
				base: 1.2,
				stops: [
					[12, 0.5],
					[13, 1],
					[14, 6],
					[20, 24]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-track-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'track'],
			['==', '$type', 'LineString'],
			['==', 'brunnel', 'bridge']
		]}
		layout={{
			'line-cap': 'butt',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#cfcdca',
			'line-opacity': {
				stops: [
					[12, 0],
					[12.5, 1]
				]
			},
			'line-width': {
				base: 1.2,
				stops: [
					[12, 0.5],
					[13, 1],
					[14, 6],
					[20, 24]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-path-casing"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'path'],
			['==', '$type', 'LineString'],
			['==', 'brunnel', 'bridge']
		]}
		layout={{
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#f8f4f0',
			'line-width': {
				base: 1.2,
				stops: [
					[15, 1.2],
					[20, 18]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-path"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'path'],
			['==', '$type', 'LineString'],
			['==', 'brunnel', 'bridge']
		]}
		layout={{
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#d4b8ae',
			'line-dasharray': [1.5, 0.75],
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 15, 1.2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-motorway-link"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', 'brunnel', 'bridge'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#ab9892',
			'line-width': [
				'interpolate',
				['exponential', 1.2],
				['zoom'],
				12.5,
				0,
				13,
				1.5,
				14,
				2.5,
				20,
				11.5
			]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-link"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'trunk', 'primary', 'secondary', 'tertiary'],
			['==', 'brunnel', 'bridge'],
			['==', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#d4b8ae',
			'line-width': [
				'interpolate',
				['exponential', 1.2],
				['zoom'],
				12.5,
				0,
				13,
				1.5,
				14,
				2.5,
				20,
				11.5
			]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-minor"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'minor', 'service'],
			['==', '$type', 'LineString'],
			['==', 'brunnel', 'bridge']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#fff',
			'line-opacity': 1,
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 13.5, 0, 14, 2.5, 20, 11.5]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-track"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'track'],
			['==', '$type', 'LineString'],
			['==', 'brunnel', 'bridge']
		]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#fff',
			'line-opacity': 1,
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 13.5, 0, 14, 2.5, 20, 11.5]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-secondary-tertiary"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'secondary', 'tertiary'],
			['==', 'brunnel', 'bridge'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#d4b8ae',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6.5, 0, 8, 0.5, 20, 13]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-trunk-primary"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['in', 'category', 'primary', 'trunk'],
			['==', 'brunnel', 'bridge'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#c18d7c',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6.5, 0, 7, 0.5, 20, 18]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_highway-line-bridge-motorway"
		sourceLayer={'transportation_highway'}
		filter={[
			'all',
			['==', 'category', 'motorway'],
			['==', 'brunnel', 'bridge'],
			['!=', 'link', 'yes']
		]}
		layout={{
			'line-join': 'round',
			visibility: 'visible'
		}}
		paint={{
			'line-color': '#ab9892',
			'line-width': ['interpolate', ['exponential', 1.2], ['zoom'], 6.5, 0, 7, 0.5, 20, 18]
		}}
	></LineLayer>
	<SymbolLayer
		id="transportation-transportation_highway-symbol-road-oneway"
		sourceLayer={'transportation_highway'}
		minzoom={15}
		filter={[
			'all',
			['==', 'oneway', 'yes'],
			['==', 'subclass', 'highway'],
			[
				'in',
				'category',
				'motorway',
				'trunk',
				'primary',
				'secondary',
				'tertiary',
				'minor',
				'service'
			]
		]}
		layout={{
			'icon-image': 'oneway',
			'icon-padding': 2,
			'icon-rotation-alignment': 'map',
			'icon-size': {
				stops: [
					[15, 0.5],
					[19, 1]
				]
			},
			'symbol-placement': 'line',
			'symbol-spacing': 75,
			visibility: 'visible'
		}}
		paint={{
			'icon-opacity': 0.5
		}}
	></SymbolLayer>
	<SymbolLayer
		id="transportation-transportation_highway-symbol-road-oneway_opposite"
		sourceLayer={'transportation_highway'}
		minzoom={15}
		filter={[
			'all',
			['==', 'oneway', -1],
			[
				'in',
				'category',
				'motorway',
				'trunk',
				'primary',
				'secondary',
				'tertiary',
				'minor',
				'service'
			]
		]}
		layout={{
			'icon-image': 'oneway',
			'icon-padding': 2,
			'icon-rotate': -90,
			'icon-rotation-alignment': 'map',
			'icon-size': {
				stops: [
					[15, 0.5],
					[19, 1]
				]
			},
			'symbol-placement': 'line',
			'symbol-spacing': 75,
			visibility: 'visible'
		}}
		paint={{
			'icon-opacity': 0.5
		}}
	></SymbolLayer>
	<SymbolLayer
		id="transportation-transportation_highway-symbol-name_path"
		sourceLayer={'transportation_highway'}
		filter={['all', ['==', 'category', 'path']]}
		layout={{
			'symbol-placement': 'line',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['Noto Sans Regular'],
			'text-rotation-alignment': 'map',
			'text-size': {
				base: 1,
				stops: [
					[13, 12],
					[14, 13]
				]
			},
			visibility: 'visible'
		}}
		paint={{
			'text-color': 'hsl(30, 23%, 62%)',
			'text-halo-color': '#f8f4f0',
			'text-halo-width': 0.5
		}}
	></SymbolLayer>
	<SymbolLayer
		id="transportation-transportation_highway-symbol-name_minor"
		sourceLayer={'transportation_highway'}
		minzoom={15}
		filter={['all', ['==', '$type', 'LineString'], ['in', 'category', 'minor', 'service']]}
		layout={{
			'symbol-placement': 'line',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['Noto Sans Regular'],
			'text-rotation-alignment': 'map',
			'text-size': {
				base: 1,
				stops: [
					[13, 12],
					[14, 13]
				]
			},
			visibility: 'visible'
		}}
		paint={{
			'text-color': '#765',
			'text-halo-blur': 0.5,
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<SymbolLayer
		id="transportation-transportation_highway-symbol-highway-name_track"
		sourceLayer={'transportation_highway'}
		minzoom={15}
		filter={[
			'all',
			['==', 'subclass', 'highway'],
			['==', '$type', 'LineString'],
			['==', 'category', 'track']
		]}
		layout={{
			'symbol-placement': 'line',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['Noto Sans Regular'],
			'text-rotation-alignment': 'map',
			'text-size': {
				base: 1,
				stops: [
					[13, 12],
					[14, 13]
				]
			},
			visibility: 'visible'
		}}
		paint={{
			'text-color': '#765',
			'text-halo-blur': 0.5,
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<SymbolLayer
		id="transportation-transportation_highway-symbol-name_major"
		sourceLayer={'transportation_highway'}
		minzoom={12.2}
		filter={['all', ['in', 'category', 'primary', 'secondary', 'tertiary', 'trunk']]}
		layout={{
			'symbol-placement': 'line',
			'text-field': [
				'coalesce',
				['get', 'name:en'], // Try to get name in the specified language
				['get', 'name'] // Fallback to default name if not available
			],
			'text-font': ['Noto Sans Regular'],
			'text-rotation-alignment': 'map',
			'text-size': {
				base: 1,
				stops: [
					[13, 12],
					[14, 13]
				]
			},
			visibility: 'visible'
		}}
		paint={{
			'text-color': '#765',
			'text-halo-blur': 0.5,
			'text-halo-width': 2
		}}
	></SymbolLayer>
	<SymbolLayer
		id="transportation-transportation_highway-symbol-shield_us_interstate"
		sourceLayer={'transportation_highway'}
		minzoom={12}
		filter={[
			'all',
			['<=', 'ref_length', 6],
			['==', '$type', 'LineString'],
			['in', 'network', 'us-interstate']
		]}
		layout={{
			'icon-image': '{network}_{ref_length}',
			'icon-rotation-alignment': 'viewport',
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 0.8, 18, 1],
			'symbol-placement': {
				base: 1,
				stops: [
					[7, 'point'],
					[7, 'line'],
					[8, 'line']
				]
			},
			'symbol-spacing': 200,
			'text-field': '{ref}',
			'text-font': ['Noto Sans Regular'],
			'text-rotation-alignment': 'viewport',
			'text-size': 10,
			visibility: 'visible'
		}}
		paint={{
			'text-color': 'rgba(0, 0, 0, 1)'
		}}
	></SymbolLayer>
	<SymbolLayer
		id="transportation-transportation_highway-symbol-symbol_us_other"
		sourceLayer={'transportation_highway'}
		minzoom={9}
		filter={[
			'all',
			['<=', 'ref_length', 6],
			['==', '$type', 'LineString'],
			['in', 'network', 'us-highway', 'us-state']
		]}
		layout={{
			'icon-image': '{network}_{ref_length}',
			'icon-rotation-alignment': 'viewport',
			'icon-size': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 14, 0.8, 18, 1],
			'symbol-placement': {
				base: 1,
				stops: [
					[10, 'point'],
					[11, 'line']
				]
			},
			'symbol-spacing': 200,
			'text-field': '{ref}',
			'text-font': ['Noto Sans Regular'],
			'text-rotation-alignment': 'viewport',
			'text-size': 10,
			visibility: 'visible'
		}}
		paint={{
			'text-color': 'rgba(0, 0, 0, 1)'
		}}
	></SymbolLayer>
	<!-- // HIGHWAY // -->

	<!-- -- AIR -- -->
	<FillLayer
		id="transportation-transportation_air-fill-aeroway-area"
		sourceLayer={'transportation_air'}
		minzoom={4}
		filter={['all', ['in', 'category', 'runway', 'taxiway'], ['==', '$type', 'Polygon']]}
		paint={{
			'fill-color': 'rgba(255, 255, 255, 1)',
			'fill-opacity': {
				base: 1,
				stops: [
					[13, 0],
					[14, 1]
				]
			}
		}}
	></FillLayer>
	<LineLayer
		id="transportation-transportation_air-line-aeroway-taxiway"
		sourceLayer={'transportation_air'}
		minzoom={4}
		filter={['all', ['in', 'category', 'taxiway'], ['==', '$type', 'LineString']]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round'
		}}
		paint={{
			'line-color': 'rgba(255, 255, 255, 1)',
			'line-opacity': {
				base: 1,
				stops: [
					[11, 0],
					[12, 1]
				]
			},
			'line-width': {
				base: 1.5,
				stops: [
					[11, 1],
					[17, 10]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_air-line-aeroway-runway"
		sourceLayer={'transportation_air'}
		minzoom={4}
		filter={['all', ['in', 'category', 'runway'], ['==', '$type', 'LineString']]}
		layout={{
			'line-cap': 'round',
			'line-join': 'round'
		}}
		paint={{
			'line-color': 'rgba(255, 255, 255, 1)',
			'line-opacity': {
				base: 1,
				stops: [
					[11, 0],
					[12, 1]
				]
			},
			'line-width': {
				base: 1.5,
				stops: [
					[11, 4],
					[17, 50]
				]
			}
		}}
	></LineLayer>
	<!-- // AIR // -->
	<!-- -- AERIAL -- -->
	<LineLayer
		id="transportation-transportation_rail-line-bridge"
		sourceLayer={'transportation_rail'}
		filter={['all', ['==', 'brunnel', 'bridge']]}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.6)',
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_rail-line-bridge_hatching"
		sourceLayer={'transportation_rail'}
		filter={['all', ['==', 'brunnel', 'bridge']]}
		paint={{
			'line-color': 'rgba(85, 85, 85, 0.6)',
			'line-dasharray': [0.2, 8],
			'line-width': ['interpolate', ['linear'], ['zoom'], 14.5, 1.4, 15, 2, 20, 4]
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_aerial-line"
		sourceLayer={'transportation_aerial'}
		minzoom={10}
		filter={['all', ['==', '$type', 'LineString']]}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': 'hsl(0, 0%, 70%)',
			'line-width': {
				base: 1,
				stops: [
					[11, 1],
					[19, 2.5]
				]
			}
		}}
	></LineLayer>
	<LineLayer
		id="transportation-transportation_aerial-line-dash"
		sourceLayer={'transportation_aerial'}
		minzoom={10}
		filter={['all', ['==', '$type', 'LineString']]}
		layout={{
			'line-cap': 'round'
		}}
		paint={{
			'line-color': 'hsl(0, 0%, 70%)',
			'line-dasharray': [2, 3],
			'line-width': {
				base: 1,
				stops: [
					[11, 3],
					[19, 5.5]
				]
			}
		}}
	></LineLayer>
	<!-- // AERIAL // -->
</VectorTileSource>
