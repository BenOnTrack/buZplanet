<!-- RouteVectorTileSource.svelte -->
<script lang="ts">
	// @ts-nocheck
	import { VectorTileSource, LineLayer, SymbolLayer, FillLayer } from 'svelte-maplibre';
	import { appState } from '$lib/stores/AppState.svelte';

	interface Props {
		nameExpression: any;
	}
	let { nameExpression }: Props = $props();

	// Get child route IDs from appState
	let childRouteIds = $derived.by(() => appState.relationSettings.childRoute);
</script>

<VectorTileSource
	id="route"
	tiles={['mbtiles://./route/{z}/{x}/{y}']}
	minzoom={8}
	maxzoom={14}
	promoteId={'id'}
>
	<!-- Transportation -->
	<LineLayer
		id="route-route_foot-line-transportation-casing"
		sourceLayer={'route_transportation'}
		filter={['all', ['in', ['get', 'id'], ['literal', childRouteIds]]]}
		layout={{
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#000000',
			'line-gap-width': 4
		}}
	></LineLayer>
	<LineLayer
		id="route-route_transportation-line"
		sourceLayer={'route_transportation'}
		filter={['all', ['in', ['get', 'id'], ['literal', childRouteIds]]]}
		paint={{
			'line-color': ['coalesce', ['get', 'colour'], 'gray'],
			'line-width': 3
		}}
	></LineLayer>
	<SymbolLayer
		id="route-route_transportation-symbol"
		sourceLayer={'route_transportation'}
		filter={['all', ['in', ['get', 'id'], ['literal', childRouteIds]]]}
		layout={{
			'symbol-placement': 'line',
			'text-field': nameExpression,
			'text-font': ['Noto Sans Regular'],
			'text-size': 12,
			'text-rotation-alignment': 'map',
			'text-anchor': 'center'
		}}
		paint={{
			'text-color': '#000000',
			'text-halo-color': '#FFFFFF',
			'text-halo-width': 1
		}}
	></SymbolLayer>
	<!-- Water -->
	<LineLayer
		id="route-route_water-line"
		sourceLayer={'route_water'}
		filter={['all', ['in', ['get', 'id'], ['literal', childRouteIds]]]}
		paint={{
			'line-dasharray': [2, 3],
			'line-color': ['coalesce', ['get', 'colour'], '#719fc1'],
			'line-width': 3
		}}
	></LineLayer>
	<!-- Bicycle -->
	<LineLayer
		id="route-route_foot-line-bicycle-casing"
		sourceLayer={'route_bicycle'}
		filter={[
			'all',
			['==', ['get', 'category'], 'bicycle'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#000000',
			'line-gap-width': 4
		}}
	></LineLayer>
	<LineLayer
		id="route-route_bicycle-line"
		sourceLayer={'route_bicycle'}
		filter={['all', ['in', ['get', 'id'], ['literal', childRouteIds]]]}
		layout={{
			'line-cap': 'butt',
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#8a2be2',
			'line-opacity': 1,
			'line-width': {
				base: 1.2,
				stops: [
					[8, 5],
					[20, 25]
				]
			}
		}}
	></LineLayer>
	<SymbolLayer
		id="route-route_bicycle-symbol"
		sourceLayer={'route_bicycle'}
		filter={['all', ['in', ['get', 'id'], ['literal', childRouteIds]]]}
		layout={{
			'symbol-placement': 'line',
			'text-field': nameExpression,
			'text-font': ['Noto Sans Regular'],
			'text-size': 12,
			'text-rotation-alignment': 'map',
			'text-anchor': 'center'
		}}
		paint={{
			'text-color': '#000000',
			'text-halo-color': '#FFFFFF',
			'text-halo-width': 1
		}}
	></SymbolLayer>
	<!-- Walking -->
	<LineLayer
		id="route-route_foot-line-walking-casing"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'walking'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#000000',
			'line-gap-width': 4
		}}
	></LineLayer>
	<LineLayer
		id="route-route_foot-line-walking"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'walking'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'line-cap': 'butt',
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#8a2be2',
			'line-opacity': 1,
			'line-width': 3
		}}
	></LineLayer>
	<SymbolLayer
		id="route-route_foot-symbol-walking"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'walking'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'symbol-placement': 'line',
			'text-field': nameExpression,
			'text-font': ['Noto Sans Regular'],
			'text-size': 12,
			'text-rotation-alignment': 'map',
			'text-anchor': 'center'
		}}
		paint={{
			'text-color': '#000000',
			'text-halo-color': '#FFFFFF',
			'text-halo-width': 1
		}}
	></SymbolLayer>
	<!-- Running -->
	<LineLayer
		id="route-route_foot-line-running-casing"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'running'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#000000',
			'line-gap-width': 4
		}}
	></LineLayer>
	<LineLayer
		id="route-route_foot-line-running"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'running'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'line-cap': 'butt',
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#8a2be2',
			'line-opacity': 1,
			'line-width': 3
		}}
	></LineLayer>
	<SymbolLayer
		id="route-route_foot-symbol-running"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'running'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'symbol-placement': 'line',
			'text-field': nameExpression,
			'text-font': ['Noto Sans Regular'],
			'text-size': 12,
			'text-rotation-alignment': 'map',
			'text-anchor': 'center'
		}}
		paint={{
			'text-color': '#000000',
			'text-halo-color': '#FFFFFF',
			'text-halo-width': 1
		}}
	></SymbolLayer>
	<!-- Hiking -->
	<LineLayer
		id="route-route_foot-line-hiking-casing"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'hiking'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'line-join': 'round'
		}}
		paint={{
			'line-color': '#000000',
			'line-gap-width': 4
		}}
	></LineLayer>
	<LineLayer
		id="route-route_foot-line-hiking"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'hiking'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'line-cap': 'butt',
			'line-join': 'round'
		}}
		paint={{
			'line-color': [
				'match',
				['get', 'sac_scale'],
				'hiking',
				'#c09d96',
				'mountain_hiking',
				'#c6988f',
				'demanding_mountain_hiking',
				'#cd9489',
				'alpine_hiking',
				'#d39082',
				'demanding_alpine_hiking',
				'#da8c7c',
				'difficult_alpine_hiking',
				'#e08775',
				'#9cb9b0'
			],
			'line-opacity': 1,
			'line-width': 3
		}}
	></LineLayer>
	<SymbolLayer
		id="route-route_foot-symbol-hiking"
		sourceLayer={'route_foot'}
		filter={[
			'all',
			['==', ['get', 'category'], 'hiking'],
			['in', ['get', 'id'], ['literal', childRouteIds]]
		]}
		layout={{
			'symbol-placement': 'line',
			'text-field': nameExpression,
			'text-font': ['Noto Sans Regular'],
			'text-size': 12,
			'text-rotation-alignment': 'map',
			'text-anchor': 'center'
		}}
		paint={{
			'text-color': '#000000',
			'text-halo-color': '#FFFFFF',
			'text-halo-width': 1
		}}
	></SymbolLayer>
</VectorTileSource>
