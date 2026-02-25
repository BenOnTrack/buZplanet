import { appState } from './AppState.svelte';
import { mapControl } from './MapControl.svelte';

/**
 * Search Control store for managing search functionality
 * This centralizes all search-related state and operations
 */
class SearchControl {
	// Search state
	query = $state('');
	results = $state<any[]>([]);
	filteredResults = $state<any[]>([]); // For map display
	isSearching = $state(false);
	drawerOpen = $state(false);
	currentSearchingDatabase = $state<string | undefined>(undefined);

	// Temporary POI visibility control (only affects display while search drawer is open)
	poiVisible = $state(true);

	// Private variables for search management
	private currentSearchPromise: Promise<any[]> | null = null;

	// Getters for reactive state
	get searchQuery(): string {
		return this.query;
	}

	get searchResults(): any[] {
		return this.results;
	}

	get searchFilteredResults(): any[] {
		return this.filteredResults;
	}

	get searchDrawerOpen(): boolean {
		return this.drawerOpen;
	}

	get searchInProgress(): boolean {
		return this.isSearching;
	}

	get currentDatabase(): string | undefined {
		return this.currentSearchingDatabase;
	}

	get poiVisibility(): boolean {
		return this.poiVisible;
	}

	// Setter methods
	setQuery(query: string) {
		this.query = query;
	}

	setFilteredResults(filteredResults: any[]) {
		this.filteredResults = [...filteredResults]; // Ensure new array reference
	}

	setDrawerOpen(open: boolean) {
		this.drawerOpen = open;

		// If drawer is closed while searching, cancel the search
		if (!open && this.isSearching) {
			console.log('🚪 Search drawer closed, cancelling ongoing search...');
			this.cancelSearch();
		}

		// Clear filtered results when drawer is closed
		if (!open) {
			this.filteredResults = [];
			// Reset POI visibility to true when drawer is closed
			this.poiVisible = true;
		} else {
			// Hide POI by default when drawer is opened
			this.poiVisible = false;
		}
	}

	/**
	 * Toggle POI visibility (temporary override while search drawer is open)
	 */
	setPoiVisibility(visible: boolean) {
		this.poiVisible = visible;
	}

	/**
	 * Perform a search with location-aware prioritization
	 */
	async search(query: string) {
		console.log('🔍 Starting search for:', query);

		// Cancel any existing search
		await this.cancelSearch();

		// Set search state
		this.query = query;
		this.isSearching = true;
		this.drawerOpen = true;
		this.results = []; // Clear previous results
		this.currentSearchingDatabase = undefined;

		// Hide POI by default when search starts
		this.poiVisible = false;
		console.log('🔍 POI hidden for search focus');

		try {
			const { getWorker } = await import('$lib/utils/worker');
			const worker = getWorker();

			// Get current language preference from AppState
			const currentLanguage = appState.language;
			console.log(`🌐 Using language preference: ${currentLanguage}`);

			// Get user location for proximity-based search
			let userLocation: { lng: number; lat: number } | undefined;

			// Try to get current map center as user location
			const mapInstance = mapControl.getMapInstance();
			if (mapInstance) {
				const center = mapInstance.getCenter();
				userLocation = { lng: center.lng, lat: center.lat };
				console.log(
					`📍 Using map center as user location: [${center.lng.toFixed(4)}, ${center.lat.toFixed(4)}]`
				);
			} else {
				// Fallback to AppState map view center
				const [lng, lat] = appState.mapView.center;
				userLocation = { lng, lat };
				console.log(
					`📍 Using AppState center as user location: [${lng.toFixed(4)}, ${lat.toFixed(4)}]`
				);
			}

			// Start search with progress callback
			this.currentSearchPromise = worker.searchFeatures(
				query,
				1000, // 1000 results max
				currentLanguage,
				userLocation,
				// Progress callback for streaming results
				(progressData) => {
					const { results, isComplete, currentDatabase, total } = progressData;

					// Update search results progressively - create new array reference for reactivity
					this.results = [...results]; // Ensure new array reference
					this.currentSearchingDatabase = currentDatabase;
				}
			);

			// Wait for final results
			const finalResults = await this.currentSearchPromise;

			// Final results (should be same as last progress update) - ensure new array reference
			this.results = [...finalResults];
			this.currentSearchingDatabase = undefined;

			if (finalResults.length === 0) {
				console.log('No results found for:', query);
			} else {
				console.log(
					`✅ Search complete: ${finalResults.length} total results for "${query}" (prioritized by location)`
				);
			}
		} catch (error) {
			if (error instanceof Error && error.message.includes('cancelled')) {
				console.log('🛑 Search was cancelled');
			} else {
				console.error('Search error:', error);
				this.results = [];
			}
			this.currentSearchingDatabase = undefined;
		} finally {
			this.isSearching = false;
			this.currentSearchPromise = null;
		}
	}

	/**
	 * Cancel ongoing search
	 */
	async cancelSearch() {
		if (this.isSearching && this.currentSearchPromise) {
			try {
				const { getWorker } = await import('$lib/utils/worker');
				const worker = getWorker();
				await worker.cancelSearch();
				console.log('🛑 Search cancelled successfully');
			} catch (error) {
				console.warn('Failed to cancel search:', error);
			}
		}

		this.isSearching = false;
		this.currentSearchingDatabase = undefined;
		this.currentSearchPromise = null;
	}

	/**
	 * Auto-cancel search when user selects a result (called by MapControl)
	 * This is a performance optimization - stops search when user found what they want
	 */
	async autoAbortSearchOnSelection() {
		if (this.isSearching) {
			console.log('🎯 Auto-aborting search - user selected a result!');
			// Don't await this - let it run in background to avoid blocking UI
			this.cancelSearch().catch((error) => {
				console.debug('Auto-cancel completed:', error);
			});

			// Immediately update UI state to show search as stopped
			this.isSearching = false;
			this.currentSearchingDatabase = undefined;
		}
	}

	/**
	 * Clear search results and state
	 */
	clearSearch() {
		console.log('🧹 Search cleared');
		this.results = [];
		this.filteredResults = [];
		this.query = '';
		this.isSearching = false;
		this.drawerOpen = false;
		this.currentSearchingDatabase = undefined;
		this.cancelSearch();
	}
}

// Create singleton instance
export const searchControl = new SearchControl();
