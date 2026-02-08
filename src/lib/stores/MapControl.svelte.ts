import type { Map as MapStore, MapGeoJSONFeature, LngLatBoundsLike } from 'svelte-maplibre';
import type { StoredFeature } from './FeaturesDB.svelte';

/**
 * Map Control store for managing map interactions and selected features
 * This provides a centralized way to control the map from different components
 */
class MapControl {
	private mapInstance = $state<MapStore | undefined>();

	// Selected feature state
	private _selectedFeature = $state<MapGeoJSONFeature | null>(null);
	private _selectedFeatureDrawerOpen = $state(false);

	// Getters for reactive state
	get selectedFeature(): MapGeoJSONFeature | null {
		return this._selectedFeature;
	}

	get selectedFeatureDrawerOpen(): boolean {
		return this._selectedFeatureDrawerOpen;
	}

	// Setter methods
	setSelectedFeature(feature: MapGeoJSONFeature | null) {
		this._selectedFeature = feature;
	}

	setSelectedFeatureDrawerOpen(open: boolean) {
		// Only update if state is actually changing
		if (this._selectedFeatureDrawerOpen !== open) {
			this._selectedFeatureDrawerOpen = open;
			// If drawer is being closed, also clear the selected feature
			if (!open) {
				this._selectedFeature = null;
			}
		}
	}

	// Register map instance
	setMapInstance(map: MapStore) {
		this.mapInstance = map;
	}

	// Get map instance
	getMapInstance(): MapStore | undefined {
		return this.mapInstance;
	}

	/**
	 * Select a feature and open the drawer
	 */
	selectFeature(feature: MapGeoJSONFeature) {
		// Only update if this is a different feature or drawer is closed
		if (this._selectedFeature !== feature || !this._selectedFeatureDrawerOpen) {
			this._selectedFeature = feature;
			this._selectedFeatureDrawerOpen = true;
		}
	}

	/**
	 * Clear selected feature and close drawer
	 */
	clearSelection() {
		// Only clear if there's actually something selected
		if (this._selectedFeature !== null || this._selectedFeatureDrawerOpen !== false) {
			this._selectedFeature = null;
			this._selectedFeatureDrawerOpen = false;
		}
	}

	/**
	 * Zoom map to feature bounds
	 */
	zoomToFeature(feature: StoredFeature | MapGeoJSONFeature) {
		if (!this.mapInstance) {
			console.warn('Map instance not available');
			return;
		}

		try {
			// Get geometry from feature
			const geometry =
				'geometry' in feature ? feature.geometry : (feature as StoredFeature).geometry;

			if (!geometry) {
				console.warn('Feature has no geometry');
				return;
			}

			// Handle different geometry types
			if (geometry.type === 'Point') {
				// For point features, center and zoom in
				const [lng, lat] = geometry.coordinates as [number, number];
				this.mapInstance.flyTo({
					center: [lng, lat],
					zoom: Math.max(this.mapInstance.getZoom(), 16), // Zoom to at least level 16
					duration: 1000,
					essential: true
				});
			} else if (geometry.type === 'LineString') {
				// For line features, fit to bounds
				const coordinates = geometry.coordinates as number[][];
				const bounds = this.calculateBounds(coordinates);
				this.mapInstance.fitBounds(bounds, {
					padding: 50,
					duration: 1000,
					essential: true
				});
			} else if (geometry.type === 'Polygon') {
				// For polygon features, fit to bounds of outer ring
				const coordinates = geometry.coordinates[0] as number[][]; // Outer ring
				const bounds = this.calculateBounds(coordinates);
				this.mapInstance.fitBounds(bounds, {
					padding: 50,
					duration: 1000,
					essential: true
				});
			} else if (geometry.type === 'MultiPoint') {
				// For multipoint, fit to all points
				const coordinates = geometry.coordinates as number[][];
				const bounds = this.calculateBounds(coordinates);
				this.mapInstance.fitBounds(bounds, {
					padding: 50,
					duration: 1000,
					essential: true
				});
			} else if (geometry.type === 'MultiLineString') {
				// For multilinestring, fit to all line segments
				const allCoordinates = geometry.coordinates.flat() as number[][];
				const bounds = this.calculateBounds(allCoordinates);
				this.mapInstance.fitBounds(bounds, {
					padding: 50,
					duration: 1000,
					essential: true
				});
			} else if (geometry.type === 'MultiPolygon') {
				// For multipolygon, fit to all polygons
				const allCoordinates = geometry.coordinates.flat(2) as number[][];
				const bounds = this.calculateBounds(allCoordinates);
				this.mapInstance.fitBounds(bounds, {
					padding: 50,
					duration: 1000,
					essential: true
				});
			} else {
				console.warn('Unknown geometry type:', geometry.type);
			}
		} catch (error) {
			console.error('Failed to zoom to feature:', error);
		}
	}

	/**
	 * Convert StoredFeature to MapGeoJSONFeature for selection
	 */
	createMapFeatureFromStored(storedFeature: StoredFeature): any {
		// Create a simplified feature object that can be used for selection
		return {
			id: storedFeature.id,
			type: 'Feature',
			properties: storedFeature.names, // Use names object as properties
			geometry: storedFeature.geometry,
			source: storedFeature.source,
			sourceLayer: storedFeature.sourceLayer || undefined,
			state: {},
			layer: storedFeature.layer
		};
	}

	/**
	 * Select a stored feature (converts to MapGeoJSONFeature and selects)
	 */
	selectStoredFeature(storedFeature: StoredFeature) {
		const mapFeature = this.createMapFeatureFromStored(storedFeature);

		// Set combined properties from StoredFeature
		mapFeature.properties = {
			...storedFeature.names,
			class: storedFeature.class,
			subclass: storedFeature.subclass,
			category: storedFeature.category,
			// Add any other properties from the original feature
			...mapFeature.properties
		};

		this.selectFeature(mapFeature);
	}

	/**
	 * Zoom to and select a stored feature by querying it from the map source
	 * This is the preferred method as it gets the current feature data from the map
	 */
	async zoomToAndSelectStoredFeature(storedFeature: StoredFeature) {
		if (!this.mapInstance) {
			console.warn('Map instance not available');
			return;
		}

		try {
			// First, zoom to the feature using stored geometry
			this.zoomToFeature(storedFeature);

			// Wait for the map to be idle (tiles loaded and rendered)
			const handleIdle = () => {
				// Remove the event listener to avoid multiple calls
				this.mapInstance?.off('idle', handleIdle);
				// Query and select the feature from the source
				this.queryAndSelectFeatureFromSource(storedFeature);
			};

			// Listen for idle event to know when tiles are fully loaded
			this.mapInstance.once('idle', handleIdle);
		} catch (error) {
			console.error('Failed to zoom to and select stored feature:', error);
		}
	}

	/**
	 * Query a feature from the map source by its ID and select it
	 */
	private queryAndSelectFeatureFromSource(storedFeature: StoredFeature) {
		if (!this.mapInstance) {
			console.warn('Map instance not available for querying');
			return;
		}

		console.log(
			`🔍 Querying feature from source: ${storedFeature.source}${storedFeature.sourceLayer ? ', sourceLayer: ' + storedFeature.sourceLayer : ''}, ID: ${storedFeature.id}`
		);
		console.log(`📍 Current map zoom: ${this.mapInstance.getZoom()}`);

		try {
			const sourceId = storedFeature.source;
			const sourceLayer = storedFeature.sourceLayer;

			// Check if our source exists
			const mapStyle = this.mapInstance.getStyle();
			if (!mapStyle.sources[sourceId]) {
				console.error(`❌ Source '${sourceId}' not found in map style`);
				throw new Error(`Source '${sourceId}' not found in map style`);
			}

			// Query all features from source
			const queryOptions: any = {};
			if (sourceLayer) {
				queryOptions.sourceLayer = sourceLayer;
			}

			const allFeatures = this.mapInstance.querySourceFeatures(sourceId, queryOptions);
			console.log(
				`📊 Found ${allFeatures.length} total features in source${sourceLayer ? '/layer ' + sourceLayer : ''}`
			);

			if (allFeatures.length === 0) {
				// Try without sourceLayer if it was specified
				if (sourceLayer) {
					console.log('🔄 No features found with sourceLayer, retrying without it...');
					const featuresNoLayer = this.mapInstance.querySourceFeatures(sourceId, {});
					console.log(`📊 Found ${featuresNoLayer.length} features without specifying sourceLayer`);

					if (featuresNoLayer.length > 0) {
						// Check what layers are available
						const availableLayers = [
							...new Set(featuresNoLayer.map((f) => (f as any).sourceLayer).filter(Boolean))
						];
						console.log('📋 Available source layers:', availableLayers);
						throw new Error(
							`No features found in sourceLayer '${sourceLayer}'. Available layers: ${availableLayers.join(', ')}`
						);
					}
				}
				throw new Error(
					`No features found in source ${sourceId}${sourceLayer ? ', sourceLayer: ' + sourceLayer : ''}`
				);
			}

			// Look for our specific feature by ID
			console.log(`🎯 Looking for target ID: ${storedFeature.id}`);
			const targetFeature = allFeatures.find((f) => String(f.id) === String(storedFeature.id));

			if (targetFeature) {
				console.log('✅ Found target feature:', targetFeature);
				this.selectFeature(targetFeature as MapGeoJSONFeature);
			} else {
				console.warn(
					`❌ Feature ID ${storedFeature.id} not found in ${allFeatures.length} features`
				);
				// Show sample IDs for debugging
				const ids = allFeatures
					.map((f) => f.id)
					.filter((id) => id !== undefined)
					.slice(0, 10);
				console.log('📋 Sample IDs from source:', ids);
				throw new Error(`Feature with ID ${storedFeature.id} not found in source`);
			}
		} catch (error) {
			console.error('❌ Failed to query feature from source:', error);
			// Try coordinate-based query as final fallback
			this.tryQueryByCoordinate(storedFeature);
		}
	}

	/**
	 * Try to query feature by coordinate (fallback method)
	 */
	private tryQueryByCoordinate(storedFeature: StoredFeature) {
		if (!this.mapInstance) return;

		console.log('🎯 Trying coordinate-based query as fallback...');

		try {
			// Check if we have valid geometry
			if (!storedFeature.geometry || !storedFeature.geometry.type) {
				console.warn('⚠️ Invalid or missing geometry in stored feature');
				this.selectStoredFeature(storedFeature);
				return;
			}

			// Only works for point geometries
			if (storedFeature.geometry.type === 'Point') {
				const coordinates = storedFeature.geometry.coordinates;
				if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 2) {
					console.warn('⚠️ Invalid point coordinates');
					this.selectStoredFeature(storedFeature);
					return;
				}

				const [lng, lat] = coordinates as [number, number];
				console.log(`📍 Querying at coordinates: [${lng}, ${lat}]`);

				// Convert to screen coordinates
				const point = this.mapInstance.project([lng, lat]);
				console.log(`📺 Screen coordinates: [${point.x}, ${point.y}]`);

				// Query rendered features at that point
				const features = this.mapInstance.queryRenderedFeatures(point);
				console.log(`📊 Found ${features.length} rendered features at coordinate`);

				if (features.length > 0) {
					console.log('🔍 Rendered features at this point:');
					features.slice(0, 5).forEach((f, i) => {
						console.log(
							`  ${i + 1}. ID: ${f.id}, source: ${f.source}, sourceLayer: ${f.sourceLayer}`
						);
					});
				}

				// Find matching feature by ID
				const targetFeature = features.find(
					(feature) => String(feature.id) === String(storedFeature.id)
				);

				if (targetFeature) {
					this.selectFeature(targetFeature);
					console.log('✅ Successfully selected feature by coordinate query:', targetFeature);
					return;
				}
			} else {
				console.log(
					`⚠️ Coordinate query not applicable for geometry type: ${storedFeature.geometry.type}`
				);
			}

			// Final fallback: use stored feature
			console.log('⚠️ Using stored feature data as final fallback');
			this.selectStoredFeature(storedFeature);
		} catch (error) {
			console.error('❌ Failed to query by coordinate:', error);
			console.log('⚠️ Using stored feature data as final fallback');
			this.selectStoredFeature(storedFeature);
		}
	}

	/**
	 * Create a MapGeoJSONFeature from a SearchResult
	 * This creates a minimal but complete feature that can be bookmarked
	 */
	createMapFeatureFromSearchResult(searchResult: {
		id: string;
		name: string;
		class: string;
		subclass?: string;
		category?: string;
		lng: number;
		lat: number;
		database: string;
		layer: string;
		zoom?: number;
		tileX?: number;
		tileY?: number;
	}): any {
		// Create a completely clean, serializable GeoJSON feature
		// Avoid any references that might not be cloneable by IndexedDB
		const cleanFeature = {
			id: String(searchResult.id), // Ensure string type
			type: 'Feature' as const,
			properties: {
				// Primary name properties for display and search
				name: String(searchResult.name || ''),
				'name:en': String(searchResult.name || ''), // Default to same name for English

				// Classification properties (ensure strings or undefined)
				class: searchResult.class ? String(searchResult.class) : undefined,
				subclass: searchResult.subclass ? String(searchResult.subclass) : undefined,
				category: searchResult.category ? String(searchResult.category) : undefined,

				// Mark as search result for debugging
				_fromSearch: true
			},
			geometry: {
				type: 'Point' as const,
				coordinates: [Number(searchResult.lng), Number(searchResult.lat)]
			},
			// Map-specific properties (simple values only)
			source: String(searchResult.database.replace(/\.mbtiles$/i, '')),
			sourceLayer: String(searchResult.layer),
			state: {}, // Empty object, fully cloneable
			layer: { id: String(searchResult.layer) } // Simple object structure
		};

		// Return a clean object with no function references or complex objects
		return JSON.parse(JSON.stringify(cleanFeature));
	}

	/**
	 * Select a search result (converts to MapGeoJSONFeature and selects)
	 */
	selectSearchResult(searchResult: {
		id: string;
		name: string;
		class: string;
		subclass?: string;
		category?: string;
		lng: number;
		lat: number;
		database: string;
		layer: string;
		zoom?: number;
		tileX?: number;
		tileY?: number;
	}) {
		const mapFeature = this.createMapFeatureFromSearchResult(searchResult);
		this.selectFeature(mapFeature);
	}

	/**
	 * Zoom to and select a search result
	 * This method both zooms to the location and triggers the selectedFeature
	 */
	zoomToAndSelectSearchResult(searchResult: {
		id: string;
		name: string;
		class: string;
		subclass?: string;
		category?: string;
		lng: number;
		lat: number;
		database: string;
		layer: string;
		zoom?: number;
		tileX?: number;
		tileY?: number;
	}) {
		// First zoom to the location
		this.zoomToLocation(searchResult.lng, searchResult.lat, 16);

		// Then select the feature (triggers selectedFeature and opens drawer)
		this.selectSearchResult(searchResult);
	}

	/**
	 * Calculate bounds from array of coordinates
	 */
	private calculateBounds(coordinates: number[][]): LngLatBoundsLike {
		let minLng = Infinity;
		let maxLng = -Infinity;
		let minLat = Infinity;
		let maxLat = -Infinity;

		coordinates.forEach(([lng, lat]) => {
			if (lng < minLng) minLng = lng;
			if (lng > maxLng) maxLng = lng;
			if (lat < minLat) minLat = lat;
			if (lat > maxLat) maxLat = lat;
		});

		// Return as LngLatBoundsLike format: [[west, south], [east, north]]
		return [
			[minLng, minLat],
			[maxLng, maxLat]
		] as LngLatBoundsLike;
	}

	/**
	 * Zoom map to specific coordinates
	 */
	zoomToLocation(lng: number, lat: number, zoom: number = 16) {
		if (!this.mapInstance) {
			console.warn('Map instance not available');
			return;
		}

		try {
			this.mapInstance.flyTo({
				center: [lng, lat],
				zoom: zoom,
				duration: 1000,
				essential: true
			});
		} catch (error) {
			console.error('Failed to zoom to location:', error);
		}
	}
}

// Create singleton instance
export const mapControl = new MapControl();
