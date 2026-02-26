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
		type Map as MapStore,
		type MapGeoJSONFeature
	} from 'svelte-maplibre';
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createMapStyle } from '$lib/utils/map/mapStyle.js';
	import { appState } from '$lib/stores/AppState.svelte';
	import BasemapVectorTileSource from '$lib/components/map/BasemapVectorTileSource.svelte';
	import BuildingVectorTileSource from '$lib/components/map/BuildingVectorTileSource.svelte';
	import TransportationVectorTileSource from '$lib/components/map/TransportationVectorTileSource.svelte';
	import PoiVectorTileSource from '$lib/components/map/PoiVectorTileSource.svelte';
	import SelectedFeatureGeojsonSource from '$lib/components/map/SelectedFeatureGeojsonSource.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import BookmarksGeojsonSource from '$lib/components/map/BookmarksGeojsonSource.svelte';
	import VisitedGeojsonSource from '$lib/components/map/VisitedGeojsonSource.svelte';
	import TodoGeojsonSource from '$lib/components/map/TodoGeojsonSource.svelte';
	import SearchResultsGeojsonSource from '$lib/components/map/SearchResultsGeojsonSource.svelte';
	import SearchCategoryGeojsonSource from '$lib/components/map/SearchCategoryGeojsonSource.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { searchControl } from '$lib/stores/SearchControl.svelte';
	import { categoryFilterStore } from '$lib/stores/CategoryFilterStore.svelte';
	import CoastlineVectorTileSource from '$lib/components/map/CoastlineVectorTileSource.svelte';

	interface Props {
		ready?: boolean;
	}

	let { ready = true }: Props = $props();

	// Map instance reference
	let mapInstance = $state<MapStore | undefined>();

	// Zoom restriction for category filter
	let categoryFilterZoomRestriction = $derived(categoryFilterStore.isActive);
	let minZoomLevel = $derived(categoryFilterZoomRestriction ? 14 : 0);

	// Selected feature drawer state - use MapControl store
	let selectedFeature = $derived(mapControl.selectedFeature);
	const selectedFeatureGeoJSON = $derived.by(() => {
		if (!selectedFeature) {
			return {
				type: 'FeatureCollection',
				features: []
			};
		}

		// Use the actual selected feature data
		return {
			type: 'FeatureCollection',
			features: [
				{
					id: selectedFeature.id,
					type: 'Feature',
					properties: selectedFeature.properties,
					geometry: selectedFeature.geometry
				}
			]
		};
	});
	$inspect(selectedFeatureGeoJSON);

	let nameExpression = $derived.by(() => {
		const currentLanguage = appState.language;
		return ['coalesce', ['get', currentLanguage], ['get', 'name']];
	});

	// Bookmarks GeoJSON - reactive to bookmark changes
	let bookmarksFeaturesGeoJSON = $state({
		type: 'FeatureCollection' as const,
		features: []
	});

	// Visited features GeoJSON - reactive to visit changes
	let visitedFeaturesGeoJSON = $state({
		type: 'FeatureCollection' as const,
		features: []
	});

	// Todo features GeoJSON - reactive to todo changes
	let todoFeaturesGeoJSON = $state({
		type: 'FeatureCollection' as const,
		features: []
	});

	// Search results - get filtered results from search control for map display
	let searchResults = $derived(searchControl.filteredResults);
	let showSearchResults = $derived(searchControl.drawerOpen && searchResults.length > 0);

	// Category filter - get from store
	let categoryFilterVisible = $derived(categoryFilterStore.isActive);

	// Setup map in store when map instance is ready
	$effect(() => {
		if (mapInstance) {
			categoryFilterStore.setMap(mapInstance);
		}
	});

	async function loadBookmarkedFeatures() {
		try {
			await featuresDB.ensureInitialized();
			const bookmarkedFeatures = await featuresDB.getBookmarkedFeatures();

			// Convert stored features to GeoJSON format
			const geoJSONFeatures = bookmarkedFeatures.map((storedFeature) => ({
				id: storedFeature.id,
				type: 'Feature' as const,
				properties: {
					// Include original feature properties
					class: storedFeature.class,
					subclass: storedFeature.subclass,
					category: storedFeature.category,
					// Include all names
					...storedFeature.names,
					// Add bookmark metadata
					bookmarked: storedFeature.bookmarked,
					listIds: storedFeature.listIds,
					visitedDates: storedFeature.visitedDates,
					todo: storedFeature.todo,
					// Add source info for layer styling
					source: storedFeature.source,
					sourceLayer: storedFeature.sourceLayer
				},
				geometry: storedFeature.geometry
			}));

			bookmarksFeaturesGeoJSON = {
				type: 'FeatureCollection' as const,
				features: geoJSONFeatures as any
			};
		} catch (error) {
			console.error('Error loading bookmarked features:', error);
			bookmarksFeaturesGeoJSON = {
				type: 'FeatureCollection',
				features: []
			};
		}
	}

	async function loadVisitedFeatures() {
		try {
			await featuresDB.ensureInitialized();
			const visitedFeatures = await featuresDB.getVisitedFeatures();

			// Convert stored features to GeoJSON format
			const geoJSONFeatures = visitedFeatures.map((storedFeature) => ({
				id: storedFeature.id,
				type: 'Feature' as const,
				properties: {
					// Include original feature properties
					class: storedFeature.class,
					subclass: storedFeature.subclass,
					category: storedFeature.category,
					// Include all names
					...storedFeature.names,
					// Add visit metadata
					bookmarked: storedFeature.bookmarked,
					listIds: storedFeature.listIds,
					visitedDates: storedFeature.visitedDates,
					todo: storedFeature.todo,
					// Add source info for layer styling
					source: storedFeature.source,
					sourceLayer: storedFeature.sourceLayer
				},
				geometry: storedFeature.geometry
			}));

			visitedFeaturesGeoJSON = {
				type: 'FeatureCollection' as const,
				features: geoJSONFeatures as any
			};
		} catch (error) {
			console.error('Error loading visited features:', error);
			visitedFeaturesGeoJSON = {
				type: 'FeatureCollection',
				features: []
			};
		}
	}

	async function loadTodoFeatures() {
		try {
			await featuresDB.ensureInitialized();
			const todoFeatures = await featuresDB.getTodoFeatures();

			// Convert stored features to GeoJSON format
			const geoJSONFeatures = todoFeatures.map((storedFeature) => ({
				id: storedFeature.id,
				type: 'Feature' as const,
				properties: {
					// Include original feature properties
					class: storedFeature.class,
					subclass: storedFeature.subclass,
					category: storedFeature.category,
					// Include all names
					...storedFeature.names,
					// Add todo metadata
					bookmarked: storedFeature.bookmarked,
					listIds: storedFeature.listIds,
					visitedDates: storedFeature.visitedDates,
					todo: storedFeature.todo,
					// Add source info for layer styling
					source: storedFeature.source,
					sourceLayer: storedFeature.sourceLayer
				},
				geometry: storedFeature.geometry
			}));

			todoFeaturesGeoJSON = {
				type: 'FeatureCollection' as const,
				features: geoJSONFeatures as any
			};
		} catch (error) {
			console.error('Error loading todo features:', error);
			todoFeaturesGeoJSON = {
				type: 'FeatureCollection',
				features: []
			};
		}
	}

	// Default map configuration - use AppState for initial values
	let mapStyle: StyleSpecification = $state({
		version: 8,
		name: 'Loading',
		sources: {},
		glyphs: '',
		sprite: '',
		layers: []
	});

	// Get initial view from AppState - should be ready when this component renders
	let currentView = $derived.by(() => {
		try {
			const view = {
				center: appState.mapView.center as [number, number],
				zoom: appState.mapView.zoom,
				bearing: appState.mapView.bearing || 0,
				pitch: appState.mapView.pitch || 0
			};
			console.log(`🗺️ Initializing map with: [${view.center.join(', ')}] @ z${view.zoom}`);
			return view;
		} catch (error) {
			console.warn('Error accessing AppState, using defaults:', error);
			return {
				center: [0, 0] as [number, number],
				zoom: 2,
				bearing: 0,
				pitch: 0
			};
		}
	});

	// Only render map when ready prop is true
	let shouldRenderMap = $derived(ready);

	// Debounce timer for saving map state
	let saveTimer: number | undefined;
	let pendingMapState: any = null;

	// Viewport update for tile cache
	let viewportUpdateTimer: ReturnType<typeof setTimeout> | undefined;

	// Update tile cache with viewport information
	async function updateTileCacheViewport() {
		if (!mapInstance) return;

		try {
			const { getWorker } = await import('$lib/utils/worker');
			const worker = getWorker();

			// Get current map view
			const center = mapInstance.getCenter();
			const zoom = mapInstance.getZoom();

			// Calculate tile coordinates at current zoom
			const scale = Math.pow(2, zoom);
			const tileX = ((center.lng + 180) / 360) * scale;
			const tileY =
				((1 -
					Math.log(
						Math.tan((center.lat * Math.PI) / 180) + 1 / Math.cos((center.lat * Math.PI) / 180)
					) /
						Math.PI) /
					2) *
				scale;

			// Estimate viewport size in tiles
			const mapContainer = mapInstance.getContainer();
			const containerWidth = mapContainer.offsetWidth;
			const containerHeight = mapContainer.offsetHeight;
			const tileSize = 512; // Standard tile size
			const tilesX = Math.ceil(containerWidth / tileSize) + 1; // Add buffer
			const tilesY = Math.ceil(containerHeight / tileSize) + 1; // Add buffer

			// Update worker with viewport info
			await worker.updateViewport?.(
				Math.floor(zoom),
				Math.floor(tileX),
				Math.floor(tileY),
				tilesX,
				tilesY
			);
		} catch (error) {
			console.debug('Failed to update tile cache viewport:', error);
		}
	}

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

	// Main initialization and features loading effect
	$effect(() => {
		// Initialize map style when page URL is available
		if (page.url?.origin) {
			mapStyle = createMapStyle(page.url.origin);
		}

		// Ensure FeaturesDB is initialized
		featuresDB.ensureInitialized();

		// Load features data when FeaturesDB is ready
		if (featuresDB.initialized) {
			// Access reactive dependencies
			featuresDB.bookmarksVersion;

			// Load all feature types
			loadBookmarkedFeatures();
			loadVisitedFeatures();
			loadTodoFeatures();
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
				// Register map instance with MapControl
				mapControl.setMapInstance(mapInstance);

				// Configure additional cache settings not available as props
				try {
					// Access the underlying MapLibre GL JS map instance
					const glMap = (mapInstance as any)._map || mapInstance;

					if (glMap) {
						console.log('📋 Configuring MapLibre cache optimizations...');

						// 1. Reduce tile cache size (default ~500 tiles → 100 tiles)
						if (typeof glMap.setMaxTileCacheSize === 'function') {
							glMap.setMaxTileCacheSize(100);
							console.log('✅ MapLibre tile cache: 100 tiles (reduced from 500)');
						}

						// 2. Configure tile cache zoom levels (default 6 → 5)
						if ((glMap as any)._sourceCaches) {
							for (const sourceCache of Object.values((glMap as any)._sourceCaches)) {
								if (sourceCache && (sourceCache as any)._cache) {
									(sourceCache as any)._cache.max = 100; // Limit individual source caches
								}
							}
							console.log('✅ MapLibre source cache limits: 100 tiles each');
						}

						// 3. Reduce concurrent requests to prevent overwhelming our cache
						if ((glMap as any)._requestManager) {
							if (
								typeof (glMap as any)._requestManager.setMaxParallelImageRequests === 'function'
							) {
								(glMap as any)._requestManager.setMaxParallelImageRequests(6); // Default is 16
								console.log('✅ MapLibre parallel requests: 6 (reduced from 16)');
							}

							// Reduce request timeouts for faster failure recovery
							if ((glMap as any)._requestManager._transformRequestFn) {
								// Configure request options for better performance
								const originalTransform = (glMap as any)._requestManager._transformRequestFn;
								(glMap as any)._requestManager._transformRequestFn = (
									url: any,
									resourceType: any
								) => {
									const result = originalTransform ? originalTransform(url, resourceType) : { url };
									// Add cache-friendly headers
									result.headers = {
										...result.headers,
										'Cache-Control': 'max-age=86400' // 24 hours
									};
									return result;
								};
							}
						}

						// 4. Configure rendering optimizations
						if ((glMap as any)._painter) {
							// Disable resource timing collection for better performance
							(glMap as any)._collectResourceTiming = false;

							// Configure GL context for better performance
							if ((glMap as any)._painter.context && (glMap as any)._painter.context.gl) {
								const gl = (glMap as any)._painter.context.gl;
								// Enable optimizations
								gl.hint(gl.FRAGMENT_SHADER_DERIVATIVE_HINT, gl.FASTEST);
								gl.hint(gl.GENERATE_MIPMAP_HINT, gl.FASTEST);
								console.log('✅ WebGL optimizations enabled');
							}
						}

						// 5. Configure tile loading optimizations
						if ((glMap as any).style && (glMap as any).style.sourceCaches) {
							for (const [sourceId, sourceCache] of Object.entries(
								(glMap as any).style.sourceCaches
							)) {
								if (sourceCache && (sourceCache as any)._source) {
									// Configure vector tile sources for better performance
									if ((sourceCache as any)._source.type === 'vector') {
										// Reduce tile buffer for vector tiles (saves memory)
										if ((sourceCache as any)._source.tileSize === undefined) {
											(sourceCache as any)._source.tileSize = 512;
										}
									}
								}
							}
							console.log('✅ Vector tile sources optimized');
						}

						console.log('✅ MapLibre cache optimization complete!');
					}
				} catch (error) {
					console.debug('Could not configure advanced MapLibre cache settings:', error);
				}

				// Add zoom restriction handler for category filter
				const handleZoomRestriction = () => {
					if (!mapInstance || !categoryFilterStore.isActive) return;

					const currentZoom = mapInstance.getZoom();
					const minRequired = 14;
					if (currentZoom < minRequired) {
						console.log(
							`🚫 CategoryFilter: Preventing zoom below ${minRequired} (current: ${currentZoom.toFixed(1)})`
						);
						mapInstance.setZoom(minRequired);
					}
				};

				// Add zoom restriction listener
				mapInstance.on('zoom', handleZoomRestriction);

				// Add event handlers to update map state (but not save immediately)
				mapInstance.on('moveend', updateMapState);
				mapInstance.on('zoomend', updateMapState);
				mapInstance.on('rotateend', updateMapState);
				mapInstance.on('pitchend', updateMapState);

				// Add viewport update handlers for tile cache
				const handleViewportUpdate = () => {
					// Clear existing timer
					if (viewportUpdateTimer) {
						clearTimeout(viewportUpdateTimer);
					}
					// Debounce viewport updates to avoid overwhelming the cache
					viewportUpdateTimer = setTimeout(updateTileCacheViewport, 150);
				};

				mapInstance.on('moveend', handleViewportUpdate);
				mapInstance.on('zoomend', handleViewportUpdate);

				// Add click event handler to query features and open drawer
				mapInstance.on('click', async (e) => {
					// Query rendered features at the click point
					if (!mapInstance) return;
					const features = mapInstance.queryRenderedFeatures(e.point);

					// Get only the top feature (first in array)
					const topFeature = features.length > 0 ? features[0] : null;

					// Update selected feature using MapControl
					if (topFeature) {
						await handleFeatureClick(topFeature);
					} else {
						// Close drawer when clicking on empty area
						mapControl.clearSelection();
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

			if (viewportUpdateTimer) {
				clearTimeout(viewportUpdateTimer);
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

	/**
	 * Handle feature click - merge GeoJSON feature data with original vector tile data
	 */
	async function handleFeatureClick(clickedFeature: MapGeoJSONFeature) {
		try {
			// Check if this is from a GeoJSON source (bookmarks/visited/todo)
			const isGeoJSONSource = ['bookmarksSource', 'visitedSource', 'todoSource'].includes(
				clickedFeature.source
			);

			if (isGeoJSONSource && clickedFeature.id) {
				console.log('🔍 Clicked on GeoJSON feature, merging with original data...', clickedFeature);

				// Get stored feature data from database
				const storedFeature = await featuresDB.getFeatureById(String(clickedFeature.id));

				if (storedFeature) {
					console.log('✅ Found stored feature data:', storedFeature);

					// Query the original vector tile feature to get all properties
					const originalFeature = await queryOriginalVectorTileFeature(storedFeature);

					if (originalFeature) {
						console.log('✅ Found original vector tile feature:', originalFeature);

						// Add stored feature metadata to the original feature's properties
						originalFeature.properties = {
							// Start with original properties
							...originalFeature.properties,
							// Add stored feature metadata
							bookmarked: storedFeature.bookmarked,
							listIds: storedFeature.listIds,
							visitedDates: storedFeature.visitedDates,
							todo: storedFeature.todo,
							dateCreated: storedFeature.dateCreated,
							dateModified: storedFeature.dateModified
						};

						console.log(
							'✅ Using enhanced original feature with stored metadata:',
							originalFeature
						);
						mapControl.selectFeature(originalFeature);
						return;
					} else {
						console.warn('⚠️ Could not find original vector tile feature, using GeoJSON feature');
					}
				} else {
					console.warn('⚠️ Could not find stored feature data for ID:', clickedFeature.id);
				}
			}

			// Fallback: use the clicked feature as-is
			console.log('📍 Using clicked feature as-is:', clickedFeature);
			mapControl.selectFeature(clickedFeature);
		} catch (error) {
			console.error('❌ Error handling feature click:', error);
			// Fallback: use the clicked feature as-is
			mapControl.selectFeature(clickedFeature);
		}
	}

	/**
	 * Query the original vector tile feature for a stored feature
	 */
	async function queryOriginalVectorTileFeature(
		storedFeature: StoredFeature
	): Promise<MapGeoJSONFeature | null> {
		if (!mapInstance) return null;

		try {
			const sourceId = storedFeature.source;
			const sourceLayer = storedFeature.sourceLayer;
			const featureId = storedFeature.id;

			console.log(
				`🔍 Querying original feature from source: ${sourceId}${sourceLayer ? ', sourceLayer: ' + sourceLayer : ''}, ID: ${featureId}`
			);

			// Query all features from the vector tile source
			const queryOptions: any = {
				zoom: 14 // Specify zoom level for vector tile query
			};
			if (sourceLayer) {
				queryOptions.sourceLayer = sourceLayer;
			}

			const allFeatures = mapInstance.querySourceFeatures(sourceId, queryOptions);
			console.log(
				`📊 Found ${allFeatures.length} total features in source${sourceLayer ? '/layer ' + sourceLayer : ''}`
			);

			// Look for our specific feature by ID
			const targetFeature = allFeatures.find((f) => String(f.id) === String(featureId));

			if (targetFeature) {
				console.log('✅ Found original vector tile feature:', targetFeature);
				return targetFeature as MapGeoJSONFeature;
			} else {
				console.warn(`❌ Feature ID ${featureId} not found in ${allFeatures.length} features`);

				// Try coordinate-based query as fallback
				if (storedFeature.geometry?.type === 'Point') {
					const coordinates = storedFeature.geometry.coordinates as [number, number];
					const point = mapInstance.project(coordinates);
					const renderedFeatures = mapInstance.queryRenderedFeatures(point);

					console.log(`🔄 Trying coordinate-based query at [${coordinates[0]}, ${coordinates[1]}]`);
					console.log(`📊 Found ${renderedFeatures.length} rendered features at coordinate`);

					// Find matching feature by ID and exclude GeoJSON sources
					const originalFeature = renderedFeatures.find(
						(feature) =>
							String(feature.id) === String(featureId) &&
							!['bookmarksSource', 'visitedSource', 'todoSource', 'selectedFeatureSource'].includes(
								feature.source
							)
					);

					if (originalFeature) {
						console.log('✅ Found original feature via coordinate query:', originalFeature);
						return originalFeature as MapGeoJSONFeature;
					}
				}

				return null;
			}
		} catch (error) {
			console.error('❌ Error querying original vector tile feature:', error);
			return null;
		}
	}

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
	{#if shouldRenderMap}
		<MapLibre
			bind:map={mapInstance}
			style={mapStyle}
			center={currentView.center}
			zoom={currentView.zoom}
			bearing={currentView.bearing}
			pitch={currentView.pitch}
			class="map-instance"
			minZoom={minZoomLevel}
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
			<CoastlineVectorTileSource />
			<BasemapVectorTileSource {nameExpression} />
			<TransportationVectorTileSource {nameExpression} />
			<BuildingVectorTileSource {nameExpression} />
			<SelectedFeatureGeojsonSource {nameExpression} {selectedFeatureGeoJSON} />
			<PoiVectorTileSource {nameExpression} />
			<BookmarksGeojsonSource {nameExpression} {bookmarksFeaturesGeoJSON} />
			<VisitedGeojsonSource {nameExpression} {visitedFeaturesGeoJSON} />
			<TodoGeojsonSource {nameExpression} {todoFeaturesGeoJSON} />
			<SearchResultsGeojsonSource {nameExpression} {searchResults} visible={showSearchResults} />
			<SearchCategoryGeojsonSource
				{nameExpression}
				visible={categoryFilterVisible}
				map={mapInstance}
			/>
		</MapLibre>
	{:else}
		<div class="map-placeholder">
			<div class="placeholder-content">
				<div class="placeholder-icon">🗺️</div>
				{#if !ready}
					<p>Initializing map...</p>
				{:else}
					<p>Setting up map...</p>
				{/if}
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
		z-index: 0; /* zIndexClass('MAP'); */
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
