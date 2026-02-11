<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { onMount } from 'svelte';
	import { formatFeatureProperty } from '$lib/utils/text-formatting.js';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import FeaturesTable from '$lib/components/table/FeaturesTable.svelte';
	import Filters from '$lib/components/ui/Filters.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let activeSnapPoint = $state<string | number>('400px');
	let features = $state<StoredFeature[]>([]);
	let bookmarkLists = $state<BookmarkList[]>([]);
	let isLoading = $state(true);
	let searchQuery = $state('');
	let selectedListIds = $state<string[]>([]);
	let selectedTypes = $state<string[]>([]);
	let selectedClasses = $state<string[]>([]);
	let selectedSubclasses = $state<string[]>([]);
	let selectedCategories = $state<string[]>([]);
	let filtersExpanded = $state(false);

	// Available filter options
	let availableTypes = $derived.by(() => {
		const types = new Set<string>();
		let hasNoneType = false;

		features.forEach((feature) => {
			const isBookmarked = feature.bookmarked;
			const isTodo = feature.todo;
			const isVisited = feature.visitedDates && feature.visitedDates.length > 0;

			if (isBookmarked) types.add('bookmarked');
			if (isTodo) types.add('todo');
			if (isVisited) types.add('visited');

			// Check if this feature has none of the above types
			if (!isBookmarked && !isTodo && !isVisited) {
				hasNoneType = true;
			}
		});

		if (hasNoneType) {
			types.add('none');
		}

		return Array.from(types).sort((a, b) => {
			// Sort order: bookmarked, todo, visited, none
			const order: Record<string, number> = { bookmarked: 0, todo: 1, visited: 2, none: 3 };
			return order[a] - order[b];
		});
	});

	let availableLists = $derived.by(() => {
		// Get lists that actually have features
		const listsWithFeatures = new Set<string>();
		features.forEach((feature) => {
			feature.listIds.forEach((listId) => listsWithFeatures.add(listId));
		});
		return bookmarkLists.filter((list) => listsWithFeatures.has(list.id));
	});

	let availableClasses = $derived.by(() => {
		const classes = new Set<string>();
		features.forEach((feature) => {
			if (feature.class) {
				classes.add(feature.class);
			}
		});
		return Array.from(classes).sort();
	});

	let availableSubclasses = $derived.by(() => {
		const subclasses = new Set<string>();
		features.forEach((feature) => {
			if (feature.subclass) {
				subclasses.add(feature.subclass);
			}
		});
		return Array.from(subclasses).sort();
	});

	let availableCategories = $derived.by(() => {
		const categories = new Set<string>();
		features.forEach((feature) => {
			if (feature.category) {
				categories.add(feature.category);
			}
		});
		return Array.from(categories).sort();
	});

	// Filtered features based on search query and prefilters
	let filteredFeatures = $derived.by(() => {
		let result = features;

		// Apply list prefilter (AND logic - feature must be in ALL selected lists)
		if (selectedListIds.length > 0) {
			result = result.filter((feature) =>
				selectedListIds.every((listId) => feature.listIds.includes(listId))
			);
		}

		// Apply type prefilter (AND logic - feature must match ALL selected types)
		if (selectedTypes.length > 0) {
			result = result.filter((feature) => {
				return selectedTypes.every((type) => {
					switch (type) {
						case 'bookmarked':
							return feature.bookmarked;
						case 'todo':
							return feature.todo;
						case 'visited':
							return feature.visitedDates && feature.visitedDates.length > 0;
						case 'none':
							// Feature must have NONE of the other types
							return (
								!feature.bookmarked &&
								!feature.todo &&
								(!feature.visitedDates || feature.visitedDates.length === 0)
							);
						default:
							return true;
					}
				});
			});
		}

		// Apply class prefilter (AND logic - feature must match ALL selected classes)
		if (selectedClasses.length > 0) {
			result = result.filter((feature) =>
				selectedClasses.every((selectedClass) => feature.class === selectedClass)
			);
		}

		// Apply subclass prefilter (AND logic - feature must match ALL selected subclasses)
		if (selectedSubclasses.length > 0) {
			result = result.filter((feature) =>
				selectedSubclasses.every((selectedSubclass) => feature.subclass === selectedSubclass)
			);
		}

		// Apply category prefilter (AND logic - feature must match ALL selected categories)
		if (selectedCategories.length > 0) {
			result = result.filter((feature) =>
				selectedCategories.every((selectedCategory) => feature.category === selectedCategory)
			);
		}

		// Apply text search
		if (!searchQuery.trim()) {
			return result;
		}

		const query = searchQuery.toLowerCase().trim();
		return result.filter((feature) => {
			// Search in feature name
			const name = getFeatureName(feature).toLowerCase();
			if (name.includes(query)) return true;

			// Search in all name variants
			const allNames = Object.values(feature.names).join(' ').toLowerCase();
			if (allNames.includes(query)) return true;

			// Search in class, subclass, category
			if (feature.class?.toLowerCase().includes(query)) return true;
			if (feature.subclass?.toLowerCase().includes(query)) return true;
			if (feature.category?.toLowerCase().includes(query)) return true;

			// Search in source
			if (feature.source.toLowerCase().includes(query)) return true;
			if (feature.sourceLayer?.toLowerCase().includes(query)) return true;

			// Search in bookmark list names
			for (const listId of feature.listIds) {
				const list = bookmarkLists.find((l) => l.id === listId);
				if (list && list.name.toLowerCase().includes(query)) {
					return true;
				}
			}

			return false;
		});
	});

	// Reactive data loading - automatically updates when drawer opens or stats change
	$effect(() => {
		if (open && featuresDB.initialized) {
			loadData();
		}
	});

	// Watch for changes in database stats to trigger refresh
	$effect(() => {
		// This effect runs when featuresDB.stats changes
		const stats = featuresDB.stats;
		if (open && featuresDB.initialized && (stats.total > 0 || features.length > 0)) {
			loadData();
		}
	});

	onMount(async () => {
		await featuresDB.ensureInitialized();
		if (open) {
			loadData();
		}
	});

	async function loadData() {
		isLoading = true;
		try {
			const [allFeatures, allLists] = await Promise.all([
				featuresDB.exportFeatures(),
				featuresDB.getAllBookmarkLists()
			]);
			features = allFeatures.sort((a, b) => b.dateCreated - a.dateCreated);
			bookmarkLists = allLists;
		} catch (error) {
			console.error('Failed to load features data:', error);
		} finally {
			isLoading = false;
		}
	}

	// Get feature's primary name (name:en first, then name, then formatted category)
	function getFeatureName(feature: StoredFeature): string {
		return (
			feature.names['name:en'] ||
			feature.names.name ||
			(feature.category ? formatFeatureProperty(feature.category) : null) ||
			Object.values(feature.names)[0] ||
			'Unnamed'
		);
	}

	// Filter functions for the Filters component
	function toggleFilter(type: string, value: string) {
		if (type === 'type') {
			toggleTypeFilter(value);
		} else if (type === 'list') {
			toggleListFilter(value);
		} else if (type === 'class') {
			toggleClassFilter(value);
		} else if (type === 'subclass') {
			toggleSubclassFilter(value);
		} else if (type === 'category') {
			toggleCategoryFilter(value);
		}
	}

	function clearSearch(type: string) {
		if (type === 'search') {
			searchQuery = '';
		}
	}

	function handleSearchChange(type: string, value: string) {
		if (type === 'search') {
			searchQuery = value;
		}
	}

	// Create filters array for the Filters component
	let filters = $derived.by(() => {
		const filterGroups: FilterGroup[] = [];

		// Search filter
		filterGroups.push({
			type: 'search' as const,
			label: 'Search',
			placeholder: 'Search features by name, class, category, or list...',
			searchValue: searchQuery,
			selectedValues: []
		});

		// Type filters
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

		// List filters
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

	function clearAllFilters() {
		searchQuery = '';
		selectedListIds = [];
		selectedTypes = [];
		selectedClasses = [];
		selectedSubclasses = [];
		selectedCategories = [];
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

	// Toggle class filter
	function toggleClassFilter(className: string) {
		if (selectedClasses.includes(className)) {
			selectedClasses = selectedClasses.filter((c) => c !== className);
		} else {
			selectedClasses = [...selectedClasses, className];
		}
	}

	// Toggle subclass filter
	function toggleSubclassFilter(subclassName: string) {
		if (selectedSubclasses.includes(subclassName)) {
			selectedSubclasses = selectedSubclasses.filter((s) => s !== subclassName);
		} else {
			selectedSubclasses = [...selectedSubclasses, subclassName];
		}
	}

	// Toggle category filter
	function toggleCategoryFilter(categoryName: string) {
		if (selectedCategories.includes(categoryName)) {
			selectedCategories = selectedCategories.filter((c) => c !== categoryName);
		} else {
			selectedCategories = [...selectedCategories, categoryName];
		}
	}

	// Check if any filters are active
	let hasActiveFilters = $derived.by(() => {
		return (
			searchQuery.trim() !== '' ||
			selectedListIds.length > 0 ||
			selectedTypes.length > 0 ||
			selectedClasses.length > 0 ||
			selectedSubclasses.length > 0 ||
			selectedCategories.length > 0
		);
	});

	// Get count for a filter
	function getFilterCount(
		type: 'type' | 'list' | 'class' | 'subclass' | 'category',
		value: string
	): number {
		if (type === 'type') {
			return features.filter((f) => {
				switch (value) {
					case 'bookmarked':
						return f.bookmarked;
					case 'todo':
						return f.todo;
					case 'visited':
						return f.visitedDates && f.visitedDates.length > 0;
					case 'none':
						return !f.bookmarked && !f.todo && (!f.visitedDates || f.visitedDates.length === 0);
					default:
						return false;
				}
			}).length;
		} else if (type === 'list') {
			return features.filter((f) => f.listIds.includes(value)).length;
		} else if (type === 'class') {
			return features.filter((f) => f.class === value).length;
		} else if (type === 'subclass') {
			return features.filter((f) => f.subclass === value).length;
		} else if (type === 'category') {
			return features.filter((f) => f.category === value).length;
		}
		return 0;
	}

	// Handle feature row click - zoom to feature and open selected feature drawer
	function handleFeatureRowClick(feature: StoredFeature, event: Event) {
		// Prevent default if this was a button click or other interactive element
		if (event.target instanceof HTMLElement) {
			const interactiveElements = ['button', 'a', 'input', 'select', 'textarea'];
			if (interactiveElements.includes(event.target.tagName.toLowerCase())) {
				return;
			}
		}

		// Use MapControl to zoom to and select the feature
		mapControl.zoomToAndSelectStoredFeature(feature);

		// Keep the features drawer open so users can continue browsing
		// while the selected feature drawer opens alongside it
	}
</script>

<!-- Features Drawer -->
<Drawer.Root bind:open snapPoints={['400px', '600px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay
		class="fixed inset-0 bg-black/40"
		style="pointer-events: none; z-index: {Z_INDEX.DRAWER_OVERLAY}"
	/>
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none rounded-t-10px fixed right-0 bottom-0 left-0 -mx-px flex h-full max-h-[97%] flex-col border border-gray-200 bg-white"
			style="z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div
				class={clsx('flex w-full flex-col p-4 pt-5', {
					'overflow-y-auto': activeSnapPoint === 1 || activeSnapPoint === '1',
					'overflow-hidden': activeSnapPoint !== 1 && activeSnapPoint !== '1'
				})}
			>
				<div class="mb-4 flex items-center justify-between">
					<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
						<span>📍</span>
						Saved Features
					</Drawer.Title>
					<Drawer.Close class="text-gray-500 hover:text-gray-700">
						<PropertyIcon key={'description'} value={'x'} size={20} class="text-foreground" />
						<span class="sr-only">Close</span>
					</Drawer.Close>
				</div>

				<div class="mb-4">
					<p class="text-sm text-gray-600">
						{isLoading
							? 'Loading...'
							: hasActiveFilters
								? `${filteredFeatures.length} of ${features.length} features`
								: `${features.length} saved features`}
						{#if hasActiveFilters}
							<button
								onclick={clearAllFilters}
								class="ml-2 text-xs text-blue-600 hover:text-blue-800"
							>
								Clear all filters
							</button>
						{/if}
					</p>
				</div>

				{#if !isLoading && features.length > 0}
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

				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<div class="text-gray-500">Loading features...</div>
					</div>
				{:else if filteredFeatures.length === 0 && hasActiveFilters}
					<div class="flex flex-col items-center justify-center py-8 text-gray-500">
						<span class="mb-2 text-2xl">🔍</span>
						<p>No features found with current filters</p>
						<p class="mt-1 text-sm">Try adjusting your search or filter settings</p>
						<button
							onclick={clearAllFilters}
							class="mt-2 text-sm text-blue-600 hover:text-blue-800"
						>
							Clear all filters
						</button>
					</div>
				{:else if features.length === 0}
					<div class="flex flex-col items-center justify-center py-8 text-gray-500">
						<span class="mb-2 text-2xl">📍</span>
						<p>No saved features yet</p>
						<p class="mt-1 text-sm">Start exploring the map to bookmark features!</p>
					</div>
				{:else}
					<!-- Header instruction -->
					<div class="mb-3 flex items-center justify-between">
						<p class="text-xs text-gray-600">
							Click any row to zoom to and select the feature on the map
						</p>
						<div class="flex items-center gap-1 text-xs text-gray-500">
							<span>🔍</span>
							<span>Clickable rows</span>
						</div>
					</div>

					<FeaturesTable
						features={filteredFeatures}
						onRowClick={handleFeatureRowClick}
						showHeader={true}
						showListsColumn={true}
						showTypesColumn={true}
						bind:selectedTypes
						bind:selectedListIds
						bind:selectedClasses
						bind:selectedSubclasses
						bind:selectedCategories
					/>

					{#if featuresDB.stats.total > 0}
						<div class="mt-4 border-t border-gray-200 pt-4">
							<div class="grid grid-cols-2 gap-4 text-sm">
								<div class="text-center">
									<div class="font-medium text-yellow-600">{featuresDB.stats.bookmarked}</div>
									<div class="text-xs text-gray-500">Bookmarked</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-green-600">{featuresDB.stats.visited}</div>
									<div class="text-xs text-gray-500">Visited</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-blue-600">{featuresDB.stats.todo}</div>
									<div class="text-xs text-gray-500">Todo</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-purple-600">{featuresDB.stats.lists}</div>
									<div class="text-xs text-gray-500">Lists</div>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>
