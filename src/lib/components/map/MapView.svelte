<script lang="ts">
	import {
		MapLibre,
		BackgroundLayer,
		NavigationControl,
		GeolocateControl,
		FullscreenControl,
		ScaleControl,
		type StyleSpecification,
		type LngLatLike,
		type Map as MapStore
	} from 'svelte-maplibre';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createMapStyle } from '$lib/utils/map/mapStyle.js';
	import { appState } from '$lib/stores/AppState.svelte';
	import BasemapVectorTileSource from '$lib/components/map/BasemapVectorTileSource.svelte';
	import BuildingVectorTileSource from '$lib/components/map/BuildingVectorTileSource.svelte';
	import TransportationVectorTileSource from '$lib/components/map/TransportationVectorTileSource.svelte';
	import PoiVectorTileSource from './PoiVectorTileSource.svelte';
	import SelectedFeatureDrawer from '$lib/components/drawers/SelectedFeatureDrawer.svelte';

	interface Props {
		ready?: boolean;
	}

	let { ready = true }: Props = $props();

	// Map instance reference
	let mapInstance = $state<MapStore | undefined>();

	// Selected feature drawer state
	let selectedFeatureDrawerOpen = $state(false);
	let selectedFeatures = $state<any[]>([]);

	// Default map configuration - use AppState for initial values
	let mapStyle: StyleSpecification = $state({
		version: 8,
		name: 'Loading',
		sources: {},
		glyphs: '',
		sprite: '',
		layers: []
	});

	// Get initial view from AppState
	let currentView = $derived({
		center: appState.mapView.center as [number, number],
		zoom: appState.mapView.zoom,
		bearing: appState.mapView.bearing || 0,
		pitch: appState.mapView.pitch || 0
	});

	// Debounce timer for saving map state
	let saveTimer: number | undefined;
	let pendingMapState: any = null;

	// Save map state to IndexedDB only when app is closing/hidden
	function updateMapState() {
		if (!mapInstance) return;

		const center = mapInstance.getCenter();
		const zoom = mapInstance.getZoom();
		const bearing = mapInstance.getBearing();
		const pitch = mapInstance.getPitch();

		// Store pending state without saving to IndexedDB immediately
		pendingMapState = {
			center: [center.lng, center.lat],
			zoom: zoom,
			bearing: bearing,
			pitch: pitch
		};
	}

	// Actually save to IndexedDB
	function savePendingMapState() {
		if (pendingMapState) {
			appState.updateMapView(pendingMapState);
			pendingMapState = null;
		}
	}

	// Initialize map style with current page origin
	$effect(() => {
		if (page.url?.origin) {
			mapStyle = createMapStyle(page.url.origin);
		}
	});

	// Handle viewport height changes for mobile browsers
	let mapContainer: HTMLDivElement;

	onMount(() => {
		// Set CSS custom property for actual viewport height
		const setVH = () => {
			const vh = window.innerHeight * 0.01;
			document.documentElement.style.setProperty('--vh', `${vh}px`);
		};

		setVH();
		window.addEventListener('resize', setVH);
		window.addEventListener('orientationchange', setVH);

		// Add event listeners for saving map state when leaving the app
		const handleBeforeUnload = () => {
			savePendingMapState();
		};

		const handleVisibilityChange = () => {
			if (document.visibilityState === 'hidden') {
				savePendingMapState();
			}
		};

		const handlePageHide = () => {
			savePendingMapState();
		};

		const handleAppCleanup = () => {
			savePendingMapState();
		};

		// Listen for app closing/switching events
		window.addEventListener('beforeunload', handleBeforeUnload);
		window.addEventListener('pagehide', handlePageHide);
		window.addEventListener('app-cleanup', handleAppCleanup);
		document.addEventListener('visibilitychange', handleVisibilityChange);

		// Wait for map instance to be available
		$effect(() => {
			if (mapInstance) {
				// Add event handlers to update map state (but not save immediately)
				mapInstance.on('moveend', updateMapState);
				mapInstance.on('zoomend', updateMapState);
				mapInstance.on('rotateend', updateMapState);
				mapInstance.on('pitchend', updateMapState);

				// Add click event handler to query features and open drawer
				mapInstance.on('click', (e) => {
					// Query rendered features at the click point
					if (!mapInstance) return;
					const features = mapInstance.queryRenderedFeatures(e.point);

					// Get only the top feature (first in array)
					const topFeature = features.length > 0 ? features[0] : null;

					// Update selected features with only the top feature
					selectedFeatures = topFeature ? [topFeature] : [];

					// Open the drawer if we found a feature
					if (topFeature) {
						selectedFeatureDrawerOpen = true;
					}
				});
			}
		});

		return () => {
			// Save any pending state before cleanup
			savePendingMapState();

			if (saveTimer) {
				clearTimeout(saveTimer);
			}

			// Clean up event listeners
			window.removeEventListener('resize', setVH);
			window.removeEventListener('orientationchange', setVH);
			window.removeEventListener('beforeunload', handleBeforeUnload);
			window.removeEventListener('pagehide', handlePageHide);
			window.removeEventListener('app-cleanup', handleAppCleanup);
			document.removeEventListener('visibilitychange', handleVisibilityChange);
		};
	});

	// Map keyboard handler for accessibility
	function handleKeydown(event: KeyboardEvent) {
		if (!mapInstance) return;

		switch (event.key) {
			case 'ArrowUp':
				mapInstance.panBy([0, -100]);
				event.preventDefault();
				break;
			case 'ArrowDown':
				mapInstance.panBy([0, 100]);
				event.preventDefault();
				break;
			case 'ArrowLeft':
				mapInstance.panBy([-100, 0]);
				event.preventDefault();
				break;
			case 'ArrowRight':
				mapInstance.panBy([100, 0]);
				event.preventDefault();
				break;
			case '+':
			case '=':
				mapInstance.zoomIn();
				event.preventDefault();
				break;
			case '-':
				mapInstance.zoomOut();
				event.preventDefault();
				break;
		}
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="map-container"
	bind:this={mapContainer}
	tabindex="0"
	role="application"
	aria-label="Interactive map - Use arrow keys to pan, +/- to zoom"
	onkeydown={handleKeydown}
>
	{#if ready}
		<MapLibre
			bind:map={mapInstance}
			style={mapStyle}
			center={currentView.center}
			zoom={currentView.zoom}
			bearing={currentView.bearing}
			pitch={currentView.pitch}
			class="map-instance"
			minZoom={0}
			maxZoom={19}
			pitchWithRotate={true}
			bearingSnap={7}
			renderWorldCopies={true}
			dragRotate={true}
			interactive={true}
			projection={{ type: 'globe' }}
			attributionControl={false}
		>
			<NavigationControl position="top-right" />
			<GeolocateControl
				position="top-right"
				positionOptions={{ enableHighAccuracy: true }}
				fitBoundsOptions={{ maxZoom: 16 }}
				trackUserLocation={true}
			/>
			<BackgroundLayer
				id="background"
				paint={{
					'background-color': '#FBF2E7'
				}}
			></BackgroundLayer>
			<BasemapVectorTileSource />
			<TransportationVectorTileSource />
			<BuildingVectorTileSource />
			<PoiVectorTileSource />
		</MapLibre>
	{:else}
		<div class="map-placeholder">
			<div class="placeholder-content">
				<div class="placeholder-icon">🗺️</div>
				<p>Initializing map...</p>
			</div>
		</div>
	{/if}
</div>

<!-- Selected Feature Drawer -->
<SelectedFeatureDrawer bind:open={selectedFeatureDrawerOpen} features={selectedFeatures} />

<style>
	.map-container {
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		width: 100dvw;
		height: calc(100vh - 76px); /* Account for bottom navigation */
		height: calc(100dvh - 76px); /* Account for bottom navigation */
		height: calc(var(--vh, 1vh) * 100 - 76px); /* Fallback for older browsers */
		overflow: hidden;
		z-index: 0;
		/* Prevent scrolling and bouncing on mobile */
		-webkit-overflow-scrolling: touch;
		overscroll-behavior: none;
	}

	:global(.map-instance) {
		width: 100% !important;
		height: 100% !important;
	}

	/* Ensure the map canvas fills the container properly */
	:global(.map-instance canvas) {
		width: 100% !important;
		height: 100% !important;
		display: block;
	}

	/* Prevent text selection and context menus on map */
	:global(.map-instance) {
		-webkit-user-select: none;
		-moz-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
	}

	/* Optimize touch interactions for mobile */
	:global(.map-container *) {
		touch-action: pan-x pan-y;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;
	}

	/* Handle safe areas for devices with notches */
	@supports (padding: max(0px)) {
		.map-container {
			padding-top: max(env(safe-area-inset-top), 0px);
			padding-left: max(env(safe-area-inset-left), 0px);
			padding-right: max(env(safe-area-inset-right), 0px);
			height: calc(100vh - max(env(safe-area-inset-top), 0px) - 76px);
			height: calc(100dvh - max(env(safe-area-inset-top), 0px) - 76px);
		}
	}

	.map-placeholder {
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #fbf2e7;
		color: #666;
	}

	.placeholder-content {
		text-align: center;
	}

	.placeholder-icon {
		font-size: 3rem;
		margin-bottom: 1rem;
		opacity: 0.6;
	}

	.placeholder-content p {
		margin: 0;
		font-size: 1rem;
		opacity: 0.7;
	}

	/* Responsive adjustments for smaller screens */
	@media (max-width: 480px) {
		.map-container {
			height: calc(100vh - 72px); /* Slightly smaller on mobile */
			height: calc(100dvh - 72px);
			height: calc(var(--vh, 1vh) * 100 - 72px);
		}

		@supports (padding: max(0px)) {
			.map-container {
				height: calc(100vh - max(env(safe-area-inset-top), 0px) - 72px);
				height: calc(100dvh - max(env(safe-area-inset-top), 0px) - 72px);
			}
		}
	}
</style>
