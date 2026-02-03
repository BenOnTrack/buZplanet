<script lang="ts">
	import {
		MapLibre,
		BackgroundLayer,
		NavigationControl,
		GeolocateControl,
		FullscreenControl,
		ScaleControl,
		type StyleSpecification,
		type LngLatLike
	} from 'svelte-maplibre';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createMapStyle } from '$lib/utils/map/mapStyle.js';
	import BasemapVectorTileSource from '$lib/components/map/BasemapVectorTileSource.svelte';
	import BuildingVectorTileSource from '$lib/components/map/BuildingVectorTileSource.svelte';
	import TransportationVectorTileSource from '$lib/components/map/TransportationVectorTileSource.svelte';

	interface Props {
		ready?: boolean;
	}

	let { ready = true }: Props = $props();

	// Default map configuration
	let mapStyle: StyleSpecification = $state({
		version: 8,
		name: 'Loading',
		sources: {},
		glyphs: '',
		sprite: '',
		layers: []
	});

	const initialView = {
		center: [0, 0] as [number, number],
		zoom: 2
	};

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

		return () => {
			window.removeEventListener('resize', setVH);
			window.removeEventListener('orientationchange', setVH);
		};
	});
</script>

<div class="map-container" bind:this={mapContainer}>
	{#if ready}
		<MapLibre
		style={mapStyle}
		center={initialView.center}
		zoom={initialView.zoom}
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
		background: #FBF2E7;
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
