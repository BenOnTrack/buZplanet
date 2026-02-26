<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { categoryFilterStore } from '$lib/stores/CategoryFilterStore.svelte';
	import FilterManager from '$lib/components/drawers/filters/FilterManager.svelte';
	import FilterStats from '$lib/components/drawers/filters/FilterStats.svelte';
	import FeaturesTable from '$lib/components/table/FeaturesTable.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte.js';

	let {
		open = $bindable(false),
		selectedCategories = []
	}: {
		open?: boolean;
		selectedCategories?: string[];
	} = $props();

	// Get reactive data from the category filter store
	let categoryResults = $derived(categoryFilterStore.features);
	let isLoading = $derived(categoryFilterStore.isLoading);
	let activeCategories = $derived(categoryFilterStore.selectedCategories);
	let filterError = $derived(categoryFilterStore.error);

	// Local filter state (similar to SearchResultsDrawer)
	let allStoredFeatures = $state<StoredFeature[]>([]);
	let bookmarkLists = $state<BookmarkList[]>([]);
	let localSearchQuery = $state('');
	let selectedClasses = $state<string[]>([]);
	let selectedSubclasses = $state<string[]>([]);
	let selectedCategoryFilters = $state<string[]>([]);
	let selectedTypes = $state<string[]>([]);
	let selectedListIds = $state<string[]>([]);
	let filtersExpanded = $state(false);

	// Derived trigger for data loading
	const dataLoadTrigger = $derived.by(() => ({
		initialized: featuresDB.initialized,
		open
	}));

	// Load stored features for matching (side effect)
	$effect(() => {
		const { initialized, open: drawerOpen } = dataLoadTrigger;

		if (initialized && drawerOpen) {
			loadStoredFeatures();
			loadBookmarkLists();
		}
	});

	async function loadStoredFeatures() {
		try {
			allStoredFeatures = await featuresDB.exportFeatures();
		} catch (error) {
			console.error('Failed to load stored features for matching:', error);
			allStoredFeatures = [];
		}
	}

	async function loadBookmarkLists() {
		try {
			bookmarkLists = await featuresDB.getAllBookmarkLists();
		} catch (error) {
			console.error('Failed to load bookmark lists:', error);
			bookmarkLists = [];
		}
	}

	// Convert category filter results to SearchResult format
	let enhancedResults = $derived.by(() => {
		return categoryResults.map((feature, index) => {
			const props = feature.properties || {};
			const coords = feature.geometry?.coordinates || [0, 0];

			// Extract ALL name properties (they should already be in correct format: name, name:en, name:fr, etc.)
			const names: Record<string, string> = {};
			for (const [key, value] of Object.entries(props)) {
				if (key.startsWith('name') && typeof value === 'string' && value.trim()) {
					names[key] = value.trim();
				}
			}

			// Create SearchResult-compatible object
			const searchResult: SearchResult = {
				id: props.id || `category-filter-${index}`,
				lng: coords[0],
				lat: coords[1],
				class: props.class || '',
				subclass: props.subclass || '',
				category: props.category || '',
				database: 'category-filter',
				layer: 'poi',
				zoom: 14,
				tileX: 0,
				tileY: 0,
				names: names // All name properties preserved in original format
			};

			// Find matching stored feature
			const storedFeature = allStoredFeatures.find((stored) => stored.id === searchResult.id);

			return {
				...searchResult,
				types: storedFeature ? getStoredFeatureTypes(storedFeature) : [],
				lists: storedFeature ? getStoredFeatureLists(storedFeature) : [],
				isCategoryFiltered: true,
				searchResult,
				storedFeature
			};
		});
	});

	// Apply filters (similar to SearchResultsDrawer)
	let finalFilteredResults = $derived.by(() => {
		let filtered = enhancedResults;

		// Apply search filter
		if (localSearchQuery.trim()) {
			const query = localSearchQuery.toLowerCase().trim();
			filtered = filtered.filter((result) => {
				const nameMatches = Object.values(result.names).some((name) =>
					name.toLowerCase().includes(query)
				);

				return (
					nameMatches ||
					result.class?.toLowerCase().includes(query) ||
					result.subclass?.toLowerCase().includes(query) ||
					result.category?.toLowerCase().includes(query)
				);
			});
		}

		// Apply class filter
		if (selectedClasses.length > 0) {
			filtered = filtered.filter((result) => selectedClasses.includes(result.class));
		}

		// Apply subclass filter
		if (selectedSubclasses.length > 0) {
			filtered = filtered.filter(
				(result) => result.subclass && selectedSubclasses.includes(result.subclass)
			);
		}

		// Apply category filter
		if (selectedCategoryFilters.length > 0) {
			filtered = filtered.filter(
				(result) => result.category && selectedCategoryFilters.includes(result.category)
			);
		}

		// Apply type filters
		if (selectedTypes.length > 0) {
			filtered = filtered.filter((result) => {
				return selectedTypes.some((selectedType) => {
					if (selectedType === 'none') {
						return !result.types || result.types.length === 0;
					} else {
						return result.types && result.types.includes(selectedType as any);
					}
				});
			});
		}

		// Apply list filters
		if (selectedListIds.length > 0) {
			filtered = filtered.filter((result) => {
				return selectedListIds.some((selectedListId) => {
					return result.lists && result.lists.some((list) => list.id === selectedListId);
				});
			});
		}

		return filtered;
	});

	// Get feature types for stored features
	function getStoredFeatureTypes(feature: StoredFeature): ('bookmarked' | 'todo' | 'visited')[] {
		const types: ('bookmarked' | 'todo' | 'visited')[] = [];
		if (feature.bookmarked) types.push('bookmarked');
		if (feature.todo) types.push('todo');
		if (feature.visitedDates && feature.visitedDates.length > 0) types.push('visited');
		return types;
	}

	// Get feature lists for stored features
	function getStoredFeatureLists(
		feature: StoredFeature
	): { id: string; name: string; color: string }[] {
		return feature.listIds.map((listId) => {
			const list = bookmarkLists.find((l) => l.id === listId);
			return {
				id: listId,
				name: list?.name || 'Unknown List',
				color: list?.color || '#6b7280'
			};
		});
	}

	// Clear all filters
	function clearAllFilters() {
		localSearchQuery = '';
		selectedClasses = [];
		selectedSubclasses = [];
		selectedCategoryFilters = [];
		selectedTypes = [];
		selectedListIds = [];
	}

	// Check if any filters are active
	let hasActiveFilters = $derived.by(() => {
		return (
			localSearchQuery.trim() !== '' ||
			selectedClasses.length > 0 ||
			selectedSubclasses.length > 0 ||
			selectedCategoryFilters.length > 0 ||
			selectedTypes.length > 0 ||
			selectedListIds.length > 0
		);
	});

	// Handle result row click - zoom to location and select feature
	function handleResultRowClick(result: SearchResult, event: Event) {
		// Prevent default if this was a button click or other interactive element
		if (event.target instanceof HTMLElement) {
			const interactiveElements = ['button', 'a', 'input', 'select', 'textarea'];
			if (interactiveElements.includes(event.target.tagName.toLowerCase())) {
				return;
			}
		}

		// Use MapControl to zoom to and select the result
		if (result.lng !== 0 && result.lat !== 0) {
			mapControl.zoomToAndSelectSearchResult(result);
		}
	}

	// Handle close button - clear all filters and close drawer
	function handleClose() {
		// Clear all category filters
		categoryFilterStore.clearFilter();
		// Close the drawer
		open = false;
		console.log('🏷️ SearchCategoryDrawer: Filters cleared and drawer closed');
	}

	// Watch for drawer open/close changes and clear filters when closed
	$effect(() => {
		if (!open) {
			// Drawer was closed (either by X button, collapse, or programmatically)
			// Clear all category filters to ensure clean state
			categoryFilterStore.clearFilter();
			console.log('🏷️ SearchCategoryDrawer: Drawer closed, filters cleared');
		}
	});
</script>

<!-- Search Category Drawer -->
<Drawer.Root bind:open modal={false}>
	<Drawer.Overlay class="fixed inset-0 bg-black/40" style="z-index: {Z_INDEX.DRAWER_OVERLAY}" />
	<Drawer.Portal>
		<Drawer.Content
			class="fixed right-0 bottom-0 left-0 flex h-[50vh] flex-col rounded-t-[10px] border border-gray-200 bg-white"
			style="z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div class="mx-auto flex h-full w-full max-w-full flex-col overflow-hidden">
				<!-- Sticky Header Section -->
				<div class="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-4">
					<!-- Header -->
					<div class="mb-4 flex items-center justify-between">
						<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
							<span>🏷️</span>
							Category Filter Results
						</Drawer.Title>
						<!-- Custom close button instead of Drawer.Close -->
						<button
							class="flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus:bg-gray-100 focus:text-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none"
							onclick={handleClose}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleClose();
								}
							}}
							title="Close drawer and clear filters"
							aria-label="Close category filter drawer and clear all filters"
						>
							<PropertyIcon key={'description'} value={'x'} size={20} class="text-current" />
						</button>
					</div>

					<div class="mb-4">
						<p class="text-sm text-gray-600">
							{#if isLoading}
								Loading category filter results...
							{:else if activeCategories.length > 0}
								Results for {activeCategories.length} selected categories ({categoryResults.length} features
								found)
							{:else}
								No categories selected for filtering
							{/if}
						</p>
					</div>

					{#if categoryResults.length > 0}
						<!-- Filters Section -->
						<FilterManager
							features={enhancedResults}
							{bookmarkLists}
							bind:searchQuery={localSearchQuery}
							bind:selectedListIds
							bind:selectedTypes
							bind:selectedClasses
							bind:selectedSubclasses
							bind:selectedCategories={selectedCategoryFilters}
							bind:expanded={filtersExpanded}
							filteredCount={finalFilteredResults.length}
							totalCount={categoryResults.length}
						/>
					{/if}
				</div>

				<!-- Content Area -->
				<div class="min-h-0 flex-1">
					{#if isLoading}
						<div class="flex flex-col items-center justify-center py-8 text-gray-500">
							<div
								class="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
							></div>
							<p>Loading category filter results...</p>
						</div>
					{:else if filterError && activeCategories.length > 0}
						<!-- Show zoom level or results limit error -->
						<div class="flex flex-col items-center justify-center py-8 text-gray-600">
							{#if filterError.includes('Zoom')}
								<span class="mb-3 text-3xl">🔍</span>
								<h3 class="mb-2 text-lg font-medium text-gray-800">Zoom In Required</h3>
								<p class="text-center text-sm">{filterError}</p>
								<div class="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">
									📝 <strong>Why?</strong> Category filtering queries thousands of features. Higher zoom
									levels help limit results for better performance.
								</div>
							{:else if filterError.includes('first')}
								<span class="mb-3 text-3xl">⚠️</span>
								<h3 class="mb-2 text-lg font-medium text-gray-800">Results Limited</h3>
								<p class="text-center text-sm">{filterError}</p>
								<div class="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
									💡 <strong>Tip:</strong> Zoom in further or refine your category selection to see more
									specific results.
								</div>
							{:else}
								<span class="mb-3 text-3xl">❌</span>
								<h3 class="mb-2 text-lg font-medium text-gray-800">Filter Error</h3>
								<p class="text-center text-sm text-red-600">{filterError}</p>
							{/if}
						</div>
					{:else if finalFilteredResults.length === 0 && categoryResults.length > 0 && hasActiveFilters}
						<div class="flex flex-col items-center justify-center py-8 text-gray-500">
							<span class="mb-2 text-2xl">🔍</span>
							<p>No results found with current filters</p>
							<p class="mt-1 text-sm">Try adjusting your filter settings</p>
							<button
								onclick={clearAllFilters}
								class="mt-2 text-sm text-blue-600 hover:text-blue-800"
							>
								Clear all filters
							</button>
						</div>
					{:else if categoryResults.length === 0 && activeCategories.length > 0}
						<div class="flex flex-col items-center justify-center py-8 text-gray-500">
							<span class="mb-2 text-2xl">😔</span>
							<p>No features found for selected categories</p>
							<p class="mt-1 text-sm">Try different category selections or move the map</p>
						</div>
					{:else if categoryResults.length === 0}
						<div class="flex flex-col items-center justify-center py-8 text-gray-500">
							<span class="mb-2 text-2xl">🏷️</span>
							<p>No categories selected for filtering</p>
							<p class="mt-1 text-sm">
								Use the category dialog to select categories and apply filters
							</p>
						</div>
					{:else}
						<div class="category-results-scrollable h-full overflow-auto">
							<div class="px-4">
								<FeaturesTable
									features={finalFilteredResults}
									onRowClick={handleResultRowClick}
									showHeader={true}
									showListsColumn={true}
									showTypesColumn={true}
									bind:selectedTypes
									bind:selectedListIds
									bind:selectedClasses
									bind:selectedSubclasses
									bind:selectedCategories={selectedCategoryFilters}
								/>
							</div>

							<div class="px-4 pb-4">
								{#if categoryResults.length > 0}
									<div class="mt-4">
										<FilterStats
											features={enhancedResults}
											{hasActiveFilters}
											{clearAllFilters}
											showStats={true}
											showClearAllButton={false}
										/>
									</div>
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	/* Ensure proper flex layout and scrolling - similar to SearchResultsDrawer */
	.category-results-scrollable {
		scrollbar-width: auto; /* For Firefox - use auto for better visibility */
		scrollbar-color: #6b7280 #e5e7eb; /* For Firefox - visible colors */
		position: relative; /* Ensure sticky positioning context */
	}

	/* WebKit scrollbar styling - make it always visible and prominent */
	.category-results-scrollable::-webkit-scrollbar {
		width: 14px; /* Make it visible but not too wide */
		-webkit-appearance: none;
	}

	.category-results-scrollable::-webkit-scrollbar-track {
		background: #f3f4f6; /* Light gray track - more visible */
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.category-results-scrollable::-webkit-scrollbar-thumb {
		background: #9ca3af; /* Medium gray thumb - more visible */
		border-radius: 8px;
		border: 2px solid #f3f4f6;
		min-height: 40px; /* Ensure minimum thumb size */
	}

	.category-results-scrollable::-webkit-scrollbar-thumb:hover {
		background: #6b7280; /* Darker on hover */
	}

	.category-results-scrollable::-webkit-scrollbar-thumb:active {
		background: #4b5563; /* Darkest when active */
	}

	.category-results-scrollable::-webkit-scrollbar-corner {
		background: #f3f4f6;
	}

	/* Ensure table headers are sticky within scrollable areas */
	.category-results-scrollable :global(table thead) {
		z-index: 20;
		position: sticky;
		top: 0;
		background-color: white !important;
		border-bottom: 1px solid #e5e7eb !important;
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	.category-results-scrollable :global(table thead tr) {
		background-color: white !important;
	}

	.category-results-scrollable :global(table thead th) {
		background-color: white !important;
	}
</style>
