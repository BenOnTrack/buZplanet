/**
 * CategoryFilterStore.svelte.ts
 *
 * Centralized store for managing category filtering functionality.
 * Handles category selection, filter application, and result fetching.
 */

import { _CATEGORY } from '$lib/assets/class_subclass_category';

// Types
interface CategoryFilterState {
	selectedCategories: string[];
	isActive: boolean;
	isDrawerOpen: boolean;
}

interface CategoryFilterResults {
	features: any[];
	isLoading: boolean;
	lastFetchBounds: number[] | null;
	lastFetchCategories: string[];
	error: string | null;
}

class CategoryFilterStore {
	// Filter state
	private _state = $state<CategoryFilterState>({
		selectedCategories: [],
		isActive: false,
		isDrawerOpen: false
	});

	// Results state
	private _results = $state<CategoryFilterResults>({
		features: [],
		isLoading: false,
		lastFetchBounds: null,
		lastFetchCategories: [],
		error: null
	});

	// Map instance for querying features
	private _map: any = null;

	// Debounce timer for map move events
	private _moveTimeout: ReturnType<typeof setTimeout> | null = null;

	// Map event handlers for proper cleanup
	private _mapEventHandlers: {
		handleMapMove: () => void;
		handleMapMoveEnd: () => void;
		handleMapZoomEnd: () => void;
	} | null = null;

	// Getters for state (reactive)
	get selectedCategories() {
		return this._state.selectedCategories;
	}
	get isActive() {
		return this._state.isActive;
	}
	get isDrawerOpen() {
		return this._state.isDrawerOpen;
	}

	get features() {
		return this._results.features;
	}
	get isLoading() {
		return this._results.isLoading;
	}
	get error() {
		return this._results.error;
	}
	get hasResults() {
		return this._results.features.length > 0;
	}

	/**
	 * Set the map instance for querying features
	 */
	setMap(map: any) {
		// Only set up if map is different or not already set
		if (this._map === map) return;

		const wasMapMissing = !this._map;
		this._map = map;
		this.setupMapEventListeners();

		// If filter was already active but we didn't have a map, fetch features now
		if (wasMapMissing && this._state.isActive && this._state.selectedCategories.length > 0) {
			console.log('CategoryFilter: Map set for active filter - triggering immediate fetch');
			this.fetchFeatures(true); // Force refresh since this is the first time we have a map
		}
	}

	/**
	 * Set selected categories
	 */
	setCategories(categories: string[]) {
		this._state.selectedCategories = [...categories];
		console.log('CategoryFilter: Categories updated:', categories.length);
	}

	/**
	 * Apply the filter (activate it)
	 */
	async applyFilter() {
		this._state.isActive = true;
		console.log(
			'CategoryFilter: Filter applied with',
			this._state.selectedCategories.length,
			'categories'
		);

		// Fetch features immediately if we have categories and a map
		if (this._state.selectedCategories.length > 0 && this._map) {
			console.log('CategoryFilter: Triggering immediate feature fetch after apply');
			await this.fetchFeatures(true); // Force refresh to ensure immediate results
		} else {
			console.log('CategoryFilter: No immediate fetch - missing categories or map:', {
				categoriesCount: this._state.selectedCategories.length,
				hasMap: !!this._map
			});
		}
	}

	/**
	 * Clear the filter
	 */
	clearFilter() {
		this._state.isActive = false;
		this._state.selectedCategories = [];
		this._results.features = [];
		this._results.error = null;
		console.log('CategoryFilter: Filter cleared');
	}

	/**
	 * Toggle drawer open/closed
	 */
	setDrawerOpen(open: boolean) {
		this._state.isDrawerOpen = open;
	}

	/**
	 * Select all categories
	 */
	selectAllCategories() {
		this.setCategories([..._CATEGORY]);
	}

	/**
	 * Clear all categories
	 */
	selectNoCategories() {
		this.setCategories([]);
	}

	/**
	 * Check if current results are valid for the given bounds and categories
	 */
	private areResultsValid(bounds: number[], categories: string[]): boolean {
		// Check if categories match
		if (categories.length !== this._results.lastFetchCategories.length) return false;
		if (!categories.every((cat) => this._results.lastFetchCategories.includes(cat))) return false;

		// Check if bounds are similar (within tolerance)
		if (!this._results.lastFetchBounds) return false;

		const tolerance = 0.001; // Adjust as needed
		for (let i = 0; i < 4; i++) {
			if (Math.abs(bounds[i] - this._results.lastFetchBounds[i]) > tolerance) {
				return false;
			}
		}

		return true;
	}

	/**
	 * Helper function to split category string into components
	 */
	private splitCategoryString(categoryString: string) {
		const parts = categoryString.split('-');
		return {
			class: parts[0] || '',
			subclass: parts[1] || '',
			category: parts[2] || ''
		};
	}

	/**
	 * Fetch features from the map based on selected categories
	 */
	async fetchFeatures(forceRefresh = false) {
		if (!this._map || !this._state.selectedCategories.length || !this._state.isActive) {
			this._results.features = [];
			return;
		}

		// Check zoom level - require at least zoom 14 to prevent performance issues
		const currentZoom = this._map.getZoom();
		const minRequiredZoom = 14;
		if (currentZoom < minRequiredZoom) {
			console.log(
				`⚠️ CategoryFilter: Zoom level ${currentZoom.toFixed(1)} is below minimum required ${minRequiredZoom}. Clearing results.`
			);
			this._results.features = [];
			this._results.error = `Zoom to level ${minRequiredZoom} or higher to see category filter results`;
			return;
		}

		// Get current map bounds
		const bounds = this._map.getBounds();
		const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];

		// Check if we need to refresh results
		if (!forceRefresh && this.areResultsValid(bbox, this._state.selectedCategories)) {
			console.log('CategoryFilter: Using cached results');
			return;
		}

		this._results.isLoading = true;
		this._results.error = null;

		try {
			// Split selected categories into their components for matching
			const categoryMatchers = this._state.selectedCategories.map(this.splitCategoryString);
			console.log(
				'🎯 CategoryFilter: Looking for',
				categoryMatchers.length,
				'category combinations at zoom',
				currentZoom.toFixed(1)
			);

			// POI source layers to query
			const POI_SOURCE_LAYERS = [
				'poi_attraction',
				'poi_education',
				'poi_entertainment',
				'poi_facility',
				'poi_food_and_drink',
				'poi_healthcare',
				'poi_leisure',
				'poi_lodging',
				'poi_natural',
				'poi_place',
				'poi_shop',
				'poi_transportation'
			];

			let allSourceFeatures = [];

			// Query each POI source layer
			for (const sourceLayer of POI_SOURCE_LAYERS) {
				try {
					const sourceFeatures = this._map.querySourceFeatures('poi', {
						validate: false,
						sourceLayer: sourceLayer,
						zoom: Math.floor(currentZoom) // Specify zoom level for vector tiles
					});

					if (sourceFeatures && sourceFeatures.length > 0) {
						allSourceFeatures.push(...sourceFeatures);
					}
				} catch (error) {
					console.warn(`CategoryFilter: Failed to query ${sourceLayer}:`, error);
				}
			}

			console.log(`🔍 CategoryFilter: Found ${allSourceFeatures.length} total POI features`);

			// Remove duplicates and filter by viewport bounds
			const uniqueFeatures = [];
			const seen = new Set();

			for (const feature of allSourceFeatures) {
				if (!feature.geometry?.coordinates) continue;

				const coords = feature.geometry.coordinates;
				const props = feature.properties || {};

				// Check if feature is within viewport bounds
				const inBounds =
					coords[0] >= bbox[0] &&
					coords[0] <= bbox[2] &&
					coords[1] >= bbox[1] &&
					coords[1] <= bbox[3];

				if (!inBounds) continue;

				// Create unique key to avoid duplicates
				const key = `${coords[0]}-${coords[1]}-${props.class}-${props.subclass}-${props.category}`;
				if (seen.has(key)) continue;
				seen.add(key);

				uniqueFeatures.push(feature);
			}

			console.log(`🔍 CategoryFilter: ${uniqueFeatures.length} unique features in viewport`);

			// Filter by selected categories
			const matchingFeatures = [];
			const maxResults = 500; // Limit results to prevent performance issues

			for (const feature of uniqueFeatures) {
				// Stop processing if we've reached the limit
				if (matchingFeatures.length >= maxResults) {
					console.log(
						`⚠️ CategoryFilter: Reached maximum results limit (${maxResults}), stopping processing`
					);
					break;
				}

				const props = feature.properties || {};

				// Get the feature's classification
				const featureClass = props.class || '';
				const featureSubclass = props.subclass || '';
				const featureCategory = props.category || '';

				// Skip if no classification
				if (!featureClass) continue;

				// Check if this feature matches any of our selected category combinations
				const matches = categoryMatchers.some(
					(matcher) =>
						matcher.class === featureClass &&
						matcher.subclass === featureSubclass &&
						matcher.category === featureCategory
				);

				if (!matches) continue;

				// Exclude our own GeoJSON sources to avoid conflicts
				const excludedSources = [
					'bookmarksSource',
					'visitedSource',
					'todoSource',
					'selectedFeatureSource',
					'searchResultsSource',
					'categoryFilterSource'
				];

				if (excludedSources.includes(feature.source)) continue;

				matchingFeatures.push(feature);
			}

			const resultMessage =
				matchingFeatures.length >= maxResults
					? `✅ CategoryFilter: Found ${matchingFeatures.length} matching features (limited to ${maxResults})`
					: `✅ CategoryFilter: Found ${matchingFeatures.length} matching features`;
			console.log(resultMessage);

			// Transform to GeoJSON format
			const features = matchingFeatures.map((feature, index) => {
				const props = feature.properties || {};
				const coords = feature.geometry?.coordinates || [0, 0];

				return {
					type: 'Feature' as const,
					id: `category-filter-${index}`,
					geometry: {
						type: 'Point' as const,
						coordinates: coords
					},
					properties: {
						id: props.id || `category-filter-${index}`,
						class: props.class,
						subclass: props.subclass,
						category: props.category,
						// Preserve ALL properties including all name variants (name, name:en, name:fr, etc.)
						...props,
						// Mark as category filtered
						isCategoryFiltered: true,
						filterCategories: this._state.selectedCategories,
						// Add performance info
						_limitReached: matchingFeatures.length >= maxResults
					}
				};
			});

			// Update results
			this._results.features = features;
			this._results.lastFetchBounds = [...bbox];
			this._results.lastFetchCategories = [...this._state.selectedCategories];
			this._results.error = null;

			// Add warning if results were limited
			if (matchingFeatures.length >= maxResults) {
				this._results.error = `Showing first ${maxResults} results. Zoom in further or refine your category selection to see more specific results.`;
			}

			console.log(`🎯 CategoryFilter: Updated with ${features.length} filtered features`);
		} catch (error) {
			console.error('❌ CategoryFilter: Error fetching features:', error);
			this._results.error = error instanceof Error ? error.message : 'Unknown error';
			this._results.features = [];
		} finally {
			this._results.isLoading = false;
		}
	}

	/**
	 * Setup map event listeners for auto-refresh on pan/zoom
	 */
	private setupMapEventListeners() {
		if (!this._map) return;

		// Clean up existing listeners first
		this.cleanupMapEventListeners();

		const handleMapMove = () => {
			// Debounce map move events
			if (this._moveTimeout) {
				clearTimeout(this._moveTimeout);
			}

			this._moveTimeout = setTimeout(() => {
				if (this._state.isActive && this._state.selectedCategories.length > 0) {
					this.fetchFeatures();
				}
			}, 500); // Wait 500ms after map stops moving
		};

		const handleMapMoveEnd = () => {
			// Immediate update when map movement ends
			if (this._moveTimeout) {
				clearTimeout(this._moveTimeout);
			}
			if (this._state.isActive && this._state.selectedCategories.length > 0) {
				this.fetchFeatures();
			}
		};

		const handleMapZoomEnd = () => {
			// Update on zoom changes
			if (this._state.isActive && this._state.selectedCategories.length > 0) {
				this.fetchFeatures();
			}
		};

		// Store references for cleanup
		this._mapEventHandlers = {
			handleMapMove,
			handleMapMoveEnd,
			handleMapZoomEnd
		};

		// Add event listeners
		this._map.on('move', handleMapMove);
		this._map.on('moveend', handleMapMoveEnd);
		this._map.on('zoomend', handleMapZoomEnd);

		console.log('🗺️ CategoryFilter: Map event listeners attached');
	}

	/**
	 * Clean up map event listeners
	 */
	private cleanupMapEventListeners() {
		if (!this._map || !this._mapEventHandlers) return;

		this._map.off('move', this._mapEventHandlers.handleMapMove);
		this._map.off('moveend', this._mapEventHandlers.handleMapMoveEnd);
		this._map.off('zoomend', this._mapEventHandlers.handleMapZoomEnd);

		this._mapEventHandlers = null;
		console.log('🧹 CategoryFilter: Map event listeners removed');
	}

	/**
	 * Get GeoJSON formatted data for map layers
	 */
	get geoJSON() {
		return {
			type: 'FeatureCollection' as const,
			features: this._results.features
		};
	}

	/**
	 * Get feature count by category for statistics
	 */
	get categoryStats() {
		const stats: Record<string, number> = {};

		for (const feature of this._results.features) {
			const props = feature.properties || {};
			const categoryKey = `${props.class}-${props.subclass}-${props.category}`;
			stats[categoryKey] = (stats[categoryKey] || 0) + 1;
		}

		return stats;
	}

	/**
	 * Clean up resources
	 */
	destroy() {
		this.cleanupMapEventListeners();
		if (this._moveTimeout) {
			clearTimeout(this._moveTimeout);
		}
		this._map = null;
		console.log('🧹 CategoryFilter: Store destroyed');
	}
}

// Create and export the store instance
export const categoryFilterStore = new CategoryFilterStore();

// Legacy exports for backward compatibility (will be deprecated)
export const categoryFilter = {
	subscribe: (callback: (state: CategoryFilterState) => void) => {
		// This is for backward compatibility - new code should use the store directly
		console.warn('categoryFilter.subscribe is deprecated, use categoryFilterStore directly');
		return () => {};
	},
	setCategories: (categories: string[]) => categoryFilterStore.setCategories(categories),
	applyFilter: () => categoryFilterStore.applyFilter(),
	clearFilter: () => categoryFilterStore.clearFilter()
};

export const isCategoryFilterActive = {
	subscribe: (callback: (active: boolean) => void) => {
		// This is for backward compatibility - new code should use the store directly
		console.warn(
			'isCategoryFilterActive.subscribe is deprecated, use categoryFilterStore.isActive directly'
		);
		return () => {};
	}
};
