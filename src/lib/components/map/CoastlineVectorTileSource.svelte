<!-- CoastlineVectorTileSource.svelte -->
<script lang="ts">
	// @ts-nocheck
	import { VectorTileSource, FillLayer } from 'svelte-maplibre';
</script>

<VectorTileSource
	id="coastline"
	tiles={['mbtiles://./coastline/{z}/{x}/{y}']}
	minzoom={0}
	maxzoom={3}
	promoteId={'id'}
>
	<FillLayer
		id="coastline-landcover-fill-glacier"
		sourceLayer={'landcover'}
		beforeLayerType="symbol"
		filter={['all', ['==', 'category', 'glacier']]}
		paint={{
			'fill-color': '#fff',
			'fill-opacity': {
				base: 1,
				stops: [
					[0, 0.9],
					[10, 0.3]
				]
			}
		}}
	></FillLayer>
	<FillLayer
		id="coastline-landcover-fill-ice_shelf"
		sourceLayer={'landcover'}
		beforeLayerType="symbol"
		filter={['all', ['==', 'subclass', 'ice_shelf']]}
		paint={{
			'fill-color': '#fff',
			'fill-opacity': {
				base: 1,
				stops: [
					[0, 0.9],
					[10, 0.3]
				]
			}
		}}
	></FillLayer>
	<FillLayer
		id="coastline-water-fill"
		sourceLayer={'water'}
		beforeLayerType="symbol"
		filter={['all', ['!=', 'intermittent', 'yes'], ['!=', 'brunnel', 'tunnel']]}
		paint={{
			'fill-color': '#a6c3d8',
			'fill-opacity': 1
		}}
	></FillLayer>
</VectorTileSource>
