<!-- BuildingVectorTileSource.svelte -->
<script lang="ts">
	// @ts-nocheck
	import { VectorTileSource, FillExtrusionLayer } from 'svelte-maplibre';
	let { nameExpression }: { nameExpression: any } = $props();
</script>

<VectorTileSource
	id="building"
	tiles={['mbtiles://./building/{z}/{x}/{y}']}
	minzoom={8}
	maxzoom={14}
	promoteId={'id'}
>
	<FillExtrusionLayer
		id="building-building-fill-3d"
		sourceLayer={'building'}
		paint={{
			'fill-extrusion-color': [
				'interpolate',
				['linear'],
				['get', 'render_height'],
				0,
				'#D6D4D2',
				70,
				'#D6D4D2'
			],
			'fill-extrusion-height': [
				'interpolate',
				['linear'],
				['zoom'],
				13,
				0,
				14,
				['get', 'render_height']
			],
			'fill-extrusion-base': [
				'interpolate',
				['linear'],
				['zoom'],
				13,
				0,
				14,
				['get', 'render_min_height']
			],
			'fill-extrusion-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, 0.6]
		}}
		layout={{
			visibility: 'visible'
		}}
		beforeLayerType="symbol"
	></FillExtrusionLayer>
	<!-- <FillLayer
    id="building-building-fill"
    sourceLayer={"building"}
    beforeLayerType="symbol"
    paint={{
      "fill-color": userConfiguration.getLayerColor("building"),
      "fill-opacity": 0.3,
      "fill-outline-color": {
        base: 1,
        stops: [
          [15, "hsla(35, 6%, 79%, 0.32)"],
          [18, "hsl(35, 6%, 79%)"],
        ],
      },
    }}
    layout={{ visibility: userConfiguration.getLayerVisibility("building") }}
  /> -->
</VectorTileSource>
