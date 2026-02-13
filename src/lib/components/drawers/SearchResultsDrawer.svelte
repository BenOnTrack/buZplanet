<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import Filters from '$lib/components/ui/Filters.svelte';
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

	let activeSnapPoint = $state<string | number>('400px');
	let allStoredFeatures = $state<StoredFeature[]>([]);
	let bookmarkLists = $state<BookmarkList[]>([]);
	let localSearchQuery = $state('');
	let selectedClasses = $state<string[]>([]);
	let selectedSubclasses = $state<string[]>([]);
	let selectedCategories = $state<string[]>([]);
	let selectedTypes = $state<string[]>([]);
	let selectedListIds = $state<string[]>([]);
	let filtersExpanded = $state(false);

	// Filtered results based on current filters (derived)
	let filteredResults = $derived.by(() => {
		return applyFilters(deduplicateResults(results));
	});

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

	// Available filter options based on enhanced results
	let availableTypes = $derived.by(() => {
		const types = new Set<string>();
		enhancedResults.forEach((result) => {
			if (result.types) {
				result.types.forEach((type) => types.add(type));
			}
			// Also add 'none' if there are results without types
			if (!result.types || result.types.length === 0) {
				types.add('none');
			}
		});
		return Array.from(types).sort((a, b) => {
			// Sort order: bookmarked, todo, visited, none
			const order: Record<string, number> = { bookmarked: 0, todo: 1, visited: 2, none: 3 };
			return order[a] - order[b];
		});
	});

	let availableLists = $derived.by(() => {
		const listMap = new Map<string, { name: string; color: string }>();
		enhancedResults.forEach((result) => {
			if (result.lists) {
				result.lists.forEach((list) => {
					listMap.set(list.id, { name: list.name, color: list.color });
				});
			}
		});
		return Array.from(listMap.entries())
			.map(([id, data]) => ({
				id,
				name: data.name,
				color: data.color
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	});
	let availableClasses = $derived.by(() => {
		const classes = new Set<string>();
		results.forEach((result) => {
			if (result.class) {
				classes.add(result.class);
			}
		});
		return Array.from(classes).sort();
	});

	let availableSubclasses = $derived.by(() => {
		const subclasses = new Set<string>();
		results.forEach((result) => {
			if (result.subclass) {
				subclasses.add(result.subclass);
			}
		});
		return Array.from(subclasses).sort();
	});

	let availableCategories = $derived.by(() => {
		const categories = new Set<string>();
		results.forEach((result) => {
			if (result.category) {
				categories.add(result.category);
			}
		});
		return Array.from(categories).sort();
	});

	function applyFilters(results: SearchResult[]): SearchResult[] {
		let filtered = [...results];

		// Apply local search filter
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
					result.database.toLowerCase().includes(query)
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

		return filtered;
	}

	// Apply additional filters to enhanced results (types and lists)
	let finalFilteredResults = $derived.by(() => {
		let filtered = enhancedResults;

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

	// Toggle filter functions
	function toggleFilter(type: string, value: string) {
		if (type === 'class') {
			toggleClassFilter(value);
		} else if (type === 'subclass') {
			toggleSubclassFilter(value);
		} else if (type === 'category') {
			toggleCategoryFilter(value);
		} else if (type === 'type') {
			toggleTypeFilter(value);
		} else if (type === 'list') {
			toggleListFilter(value);
		}
	}

	function clearSearch(type: string) {
		if (type === 'search') {
			localSearchQuery = '';
		}
	}

	function handleSearchChange(type: string, value: string) {
		if (type === 'search') {
			localSearchQuery = value;
		}
	}
	function toggleClassFilter(className: string) {
		if (selectedClasses.includes(className)) {
			selectedClasses = selectedClasses.filter((c) => c !== className);
		} else {
			selectedClasses = [...selectedClasses, className];
		}
	}

	function toggleSubclassFilter(subclassName: string) {
		if (selectedSubclasses.includes(subclassName)) {
			selectedSubclasses = selectedSubclasses.filter((s) => s !== subclassName);
		} else {
			selectedSubclasses = [...selectedSubclasses, subclassName];
		}
	}

	function toggleCategoryFilter(categoryName: string) {
		if (selectedCategories.includes(categoryName)) {
			selectedCategories = selectedCategories.filter((c) => c !== categoryName);
		} else {
			selectedCategories = [...selectedCategories, categoryName];
		}
	}

	// Toggle type filter
	function toggleTypeFilter(type: string) {
		if (selectedTypes.includes(type)) {
			selectedTypes = selectedTypes.filter((t) => t !== type);
		} else {
			selectedTypes = [...selectedTypes, type];
		}
	}

	// Toggle list filter
	function toggleListFilter(listId: string) {
		if (selectedListIds.includes(listId)) {
			selectedListIds = selectedListIds.filter((id) => id !== listId);
		} else {
			selectedListIds = [...selectedListIds, listId];
		}
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

	// Create filters array for the Filters component
	let filters = $derived.by(() => {
		const filterGroups: FilterGroup[] = [];

		// Search filter
		filterGroups.push({
			type: 'search' as const,
			label: 'Refine results',
			placeholder: 'Further filter these results...',
			searchValue: localSearchQuery,
			selectedValues: []
		});

		// Type filters (only show if there are types available)
		if (availableTypes.length > 0) {
			filterGroups.push({
				type: 'type' as const,
				label: 'Filter by Type',
				options: availableTypes.map((type) => ({
					value: type,
					count: getFilterCount('type', type)
				})),
				selectedValues: selectedTypes
			});
		}

		// List filters (only show if there are lists available)
		if (availableLists.length > 0) {
			filterGroups.push({
				type: 'list' as const,
				label: 'Filter by List',
				options: availableLists.map((list) => ({
					value: list.id,
					label: list.name,
					color: list.color,
					count: getFilterCount('list', list.id)
				})),
				selectedValues: selectedListIds
			});
		}

		// Class filters
		if (availableClasses.length > 0) {
			filterGroups.push({
				type: 'class' as const,
				label: 'Filter by Class',
				options: availableClasses.map((className) => ({
					value: className,
					count: getFilterCount('class', className)
				})),
				selectedValues: selectedClasses
			});
		}

		// Subclass filters
		if (availableSubclasses.length > 0) {
			filterGroups.push({
				type: 'subclass' as const,
				label: 'Filter by Subclass',
				options: availableSubclasses.map((subclassName) => ({
					value: subclassName,
					count: getFilterCount('subclass', subclassName)
				})),
				selectedValues: selectedSubclasses
			});
		}

		// Category filters
		if (availableCategories.length > 0) {
			filterGroups.push({
				type: 'category' as const,
				label: 'Filter by Category',
				options: availableCategories.map((categoryName) => ({
					value: categoryName,
					count: getFilterCount('category', categoryName)
				})),
				selectedValues: selectedCategories
			});
		}

		return filterGroups;
	});

	// Get count for a filter
	function getFilterCount(
		type: 'class' | 'subclass' | 'category' | 'type' | 'list',
		value: string
	): number {
		if (type === 'class') {
			return deduplicateResults(results).filter((r) => r.class === value).length;
		} else if (type === 'subclass') {
			return deduplicateResults(results).filter((r) => r.subclass === value).length;
		} else if (type === 'category') {
			return deduplicateResults(results).filter((r) => r.category === value).length;
		} else if (type === 'type') {
			return enhancedResults.filter((r) => {
				if (value === 'none') {
					return !r.types || r.types.length === 0;
				} else {
					return r.types && r.types.includes(value as any);
				}
			}).length;
		} else if (type === 'list') {
			return enhancedResults.filter((r) => r.lists && r.lists.some((list) => list.id === value))
				.length;
		}
		return 0;
	}

	// Match search results with stored features based on feature ID (using deduplicated results)
	let enhancedResults = $derived.by(() => {
		return filteredResults.map((searchResult) => {
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
<Drawer.Root bind:open snapPoints={['400px', '600px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay
		class="fixed inset-0 bg-black/40"
		style="pointer-events: none;z-index: {Z_INDEX.DRAWER_OVERLAY}"
	/>
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 mx-[-1px] flex h-full max-h-[97%] flex-col rounded-t-[10px] border border-gray-200 bg-white"
			style="pointer-events: none;z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div
				class={clsx('flex w-full flex-col p-4 pt-5', {
					'overflow-y-auto': activeSnapPoint === 1 || activeSnapPoint === '1',
					'overflow-hidden': activeSnapPoint !== 1 && activeSnapPoint !== '1'
				})}
			>
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
								Searching {currentSearchingDatabase.replace(/\.mbtiles$/i, '')}... ({results.length} results
								so far)
							{:else}
								Starting search...
							{/if}
						{:else if searchQuery}
							{hasActiveFilters
								? `${finalFilteredResults.length} of ${deduplicateResults(results).length} results for "${searchQuery}"`
								: `${deduplicateResults(results).length} results for "${searchQuery}"`}
							{#if hasActiveFilters}
								<button
									onclick={clearAllFilters}
									class="ml-2 text-xs text-blue-600 hover:text-blue-800"
								>
									Clear filters
								</button>
							{/if}
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
					<Filters
						{filters}
						bind:expanded={filtersExpanded}
						{hasActiveFilters}
						onToggleFilter={toggleFilter}
						onClearSearch={clearSearch}
						onClearAll={clearAllFilters}
						onSearchChange={handleSearchChange}
					/>
				{/if}

				{#if isSearching}
					<!-- Show progressive results during search -->
					{#if results.length > 0}
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

					{#if results.length > 0}
						<div class="mt-4 border-t border-gray-200 pt-4">
							<div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
								<div class="text-center">
									<div class="font-medium text-blue-600">{deduplicateResults(results).length}</div>
									<div class="text-xs text-gray-500">Total Results</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-green-600">{finalFilteredResults.length}</div>
									<div class="text-xs text-gray-500">Filtered</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-purple-600">
										{new Set(deduplicateResults(results).map((r) => r.database)).size}
									</div>
									<div class="text-xs text-gray-500">Sources</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-orange-600">{availableClasses.length}</div>
									<div class="text-xs text-gray-500">Types</div>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
