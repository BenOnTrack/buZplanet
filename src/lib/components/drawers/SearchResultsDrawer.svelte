<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import FilterManager from '$lib/components/drawers/filters/FilterManager.svelte';
	import FilterStats from '$lib/components/drawers/filters/FilterStats.svelte';
	import FeaturesTable from '$lib/components/table/FeaturesTable.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte.js';

	let {
		open = $bindable(false),
		results = [],
		searchQuery = '',
		isSearching = false,
		currentSearchingDatabase = undefined
	}: {
		open?: boolean;
		results?: SearchResult[];
		searchQuery?: string;
		isSearching?: boolean;
		currentSearchingDatabase?: string;
	} = $props();

	let allStoredFeatures = $state<StoredFeature[]>([]);
	let bookmarkLists = $state<BookmarkList[]>([]);
	let localSearchQuery = $state('');
	let selectedClasses = $state<string[]>([]);
	let selectedSubclasses = $state<string[]>([]);
	let selectedCategories = $state<string[]>([]);
	let selectedTypes = $state<string[]>([]);
	let selectedListIds = $state<string[]>([]);
	let filtersExpanded = $state(false);

	// Deduplicate results by feature.id (keep first occurrence)
	function deduplicateResults(results: SearchResult[]): SearchResult[] {
		const seenIds = new Set<string>();
		const uniqueResults: SearchResult[] = [];

		for (const result of results) {
			if (!seenIds.has(result.id)) {
				seenIds.add(result.id);
				uniqueResults.push(result);
			}
		}

		return uniqueResults;
	}

	// Derived trigger for data loading
	const dataLoadTrigger = $derived.by(() => ({
		initialized: featuresDB.initialized,
		open
	}));

	// Load stored features for matching (side effect)
	$effect(() => {
		// Access trigger to create dependency
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

	// Apply ALL filters in one place to enhanced results
	let finalFilteredResults = $derived.by(() => {
		let filtered = enhancedResults;

		// Apply search filter
		if (localSearchQuery.trim()) {
			const query = localSearchQuery.toLowerCase().trim();
			filtered = filtered.filter((result) => {
				// Search through all name properties
				const nameMatches = Object.values(result.names).some((name) =>
					name.toLowerCase().includes(query)
				);

				return (
					nameMatches ||
					result.class?.toLowerCase().includes(query) ||
					result.subclass?.toLowerCase().includes(query) ||
					result.category?.toLowerCase().includes(query) ||
					result.database?.toLowerCase().includes(query)
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
		if (selectedCategories.length > 0) {
			filtered = filtered.filter(
				(result) => result.category && selectedCategories.includes(result.category)
			);
		}

		// Apply type filters
		if (selectedTypes.length > 0) {
			filtered = filtered.filter((result) => {
				return selectedTypes.some((selectedType) => {
					if (selectedType === 'none') {
						// Show results with no types
						return !result.types || result.types.length === 0;
					} else {
						// Show results that have this type
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

	// Clear all filters
	function clearAllFilters() {
		localSearchQuery = '';
		selectedClasses = [];
		selectedSubclasses = [];
		selectedCategories = [];
		selectedTypes = [];
		selectedListIds = [];
	}

	// Check if any filters are active
	let hasActiveFilters = $derived.by(() => {
		return (
			localSearchQuery.trim() !== '' ||
			selectedClasses.length > 0 ||
			selectedSubclasses.length > 0 ||
			selectedCategories.length > 0 ||
			selectedTypes.length > 0 ||
			selectedListIds.length > 0
		);
	});

	// Match search results with stored features based on feature ID (using raw deduplicated results)
	let enhancedResults = $derived.by(() => {
		return deduplicateResults(results).map((searchResult) => {
			const storedFeature = allStoredFeatures.find((stored) => stored.id === searchResult.id);
			return {
				...searchResult,
				types: storedFeature ? getStoredFeatureTypes(storedFeature) : [],
				lists: storedFeature ? getStoredFeatureLists(storedFeature) : [],
				isFromSearch: true,
				searchResult,
				storedFeature
			};
		});
	});

	// Get feature types for stored features
	function getStoredFeatureTypes(feature: StoredFeature): ('bookmarked' | 'todo' | 'visited')[] {
		const types: ('bookmarked' | 'todo' | 'visited')[] = [];
		if (feature.bookmarked) types.push('bookmarked');
		if (feature.todo) types.push('todo');
		if (feature.visitedDates && feature.visitedDates.length > 0) types.push('visited');
		return types;
	}

	// Get feature lists for stored features (with actual bookmark lists data)
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

	// Handle result row click - zoom to location and select feature
	function handleResultRowClick(result: SearchResult, event: Event) {
		// Prevent default if this was a button click or other interactive element
		if (event.target instanceof HTMLElement) {
			const interactiveElements = ['button', 'a', 'input', 'select', 'textarea'];
			if (interactiveElements.includes(event.target.tagName.toLowerCase())) {
				return;
			}
		}

		// Use MapControl to zoom to and select the search result
		// This will both zoom to the location AND trigger the selectedFeature
		if (result.lng !== 0 && result.lat !== 0) {
			mapControl.zoomToAndSelectSearchResult(result);
		}

		// Keep the drawer open so users can continue browsing search results
		// The drawer will only be closed when the user explicitly closes it
	}
</script>

<!-- Search Results Drawer -->
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
							<span>🔍</span>
							Search Results
						</Drawer.Title>
						<Drawer.Close class="text-gray-500 hover:text-gray-700">
							<PropertyIcon key={'description'} value={'x'} size={20} class="text-foreground" />
							<span class="sr-only">Close</span>
						</Drawer.Close>
					</div>

					<div class="mb-4">
						<p class="text-sm text-gray-600">
							{#if isSearching}
								{#if currentSearchingDatabase}
									Searching {currentSearchingDatabase.replace(/\.mbtiles$/i, '')}...
								{:else}
									Starting search...
								{/if}
							{:else if searchQuery}
								Results for "{searchQuery}"
								<!-- Show search completion indicator -->
								{#if results.length > 0}
									<span class="ml-2 text-xs text-green-600">✓ Complete</span>
								{/if}
							{:else}
								Enter a search query to find places
							{/if}
						</p>
					</div>

					{#if !isSearching && results.length > 0}
						<!-- Filters Section -->
						<FilterManager
							features={enhancedResults}
							{bookmarkLists}
							bind:searchQuery={localSearchQuery}
							bind:selectedListIds
							bind:selectedTypes
							bind:selectedClasses
							bind:selectedSubclasses
							bind:selectedCategories
							bind:expanded={filtersExpanded}
							filteredCount={finalFilteredResults.length}
							totalCount={deduplicateResults(results).length}
						/>
					{/if}
				</div>

				<!-- Content Area -->
				<div class="min-h-0 flex-1">
					{#if isSearching}
						<!-- Show progressive results during search -->
						{#if results.length > 0}
							<div class="search-results-scrollable h-full overflow-auto px-4 py-4">
								<div class="border-t border-gray-200 pt-4">
									<div class="mb-3 flex items-center justify-between">
										<p class="text-xs font-medium text-blue-600">Results found so far:</p>
										<div class="flex items-center gap-1 text-xs text-gray-500">
											<span>🔄</span>
											<span>Live results</span>
										</div>
									</div>
									<FeaturesTable
										features={finalFilteredResults}
										onRowClick={handleResultRowClick}
										maxResults={20}
										showHeader={true}
										showListsColumn={true}
										showTypesColumn={true}
										bind:selectedTypes
										bind:selectedListIds
										bind:selectedClasses
										bind:selectedSubclasses
										bind:selectedCategories
									/>

									<!-- Search status below table -->
									{#if currentSearchingDatabase}
										<div
											class="mt-3 flex items-center justify-center gap-2 rounded-lg bg-blue-50 px-3 py-2"
										>
											<div
												class="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
											></div>
											<span class="text-sm text-blue-700">
												Searching {currentSearchingDatabase.replace(/\.mbtiles$/i, '')}... ({results.length}
												results so far)
											</span>
										</div>
									{/if}
								</div>
							</div>
						{/if}
					{:else if finalFilteredResults.length === 0 && results.length > 0 && hasActiveFilters}
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
					{:else if results.length === 0 && searchQuery}
						<div class="flex flex-col items-center justify-center py-8 text-gray-500">
							<span class="mb-2 text-2xl">😔</span>
							<p>No results found for "{searchQuery}"</p>
							<p class="mt-1 text-sm">Try a different search term</p>
						</div>
					{:else if results.length === 0}
						<div class="flex flex-col items-center justify-center py-8 text-gray-500">
							<span class="mb-2 text-2xl">🔍</span>
							<p>Enter a search query to find places</p>
							<p class="mt-1 text-sm">Search through all your local map data</p>
						</div>
					{:else}
						<div class="search-results-scrollable h-full overflow-auto">
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
									bind:selectedCategories
								/>
							</div>

							<div class="px-4 pb-4">
								{#if results.length > 0}
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
	/* Ensure proper flex layout and scrolling */
	.search-results-scrollable {
		scrollbar-width: auto; /* For Firefox - use auto for better visibility */
		scrollbar-color: #6b7280 #e5e7eb; /* For Firefox - visible colors */
		position: relative; /* Ensure sticky positioning context */
	}

	/* WebKit scrollbar styling - make it always visible and prominent */
	.search-results-scrollable::-webkit-scrollbar {
		width: 14px; /* Make it visible but not too wide */
		-webkit-appearance: none;
	}

	.search-results-scrollable::-webkit-scrollbar-track {
		background: #f3f4f6; /* Light gray track - more visible */
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.search-results-scrollable::-webkit-scrollbar-thumb {
		background: #9ca3af; /* Medium gray thumb - more visible */
		border-radius: 8px;
		border: 2px solid #f3f4f6;
		min-height: 40px; /* Ensure minimum thumb size */
	}

	.search-results-scrollable::-webkit-scrollbar-thumb:hover {
		background: #6b7280; /* Darker on hover */
	}

	.search-results-scrollable::-webkit-scrollbar-thumb:active {
		background: #4b5563; /* Darkest when active */
	}

	.search-results-scrollable::-webkit-scrollbar-corner {
		background: #f3f4f6;
	}

	/* Ensure table headers are sticky within scrollable areas */
	.search-results-scrollable :global(table thead) {
		z-index: 20;
		position: sticky;
		top: 0;
		background-color: white !important;
		border-bottom: 1px solid #e5e7eb !important;
		box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
	}

	.search-results-scrollable :global(table thead tr) {
		background-color: white !important;
	}

	.search-results-scrollable :global(table thead th) {
		background-color: white !important;
	}
</style>
