<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { onMount } from 'svelte';
	import { formatFeatureProperty } from '$lib/utils/text-formatting.js';
	import { featuresDB, type StoredFeature, type BookmarkList } from '$lib/stores/FeaturesDB.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { zIndexClass } from '$lib/styles/z-index.js';
	import PropertyIcon from '../ui/PropertyIcon.svelte';

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

	// Get feature's secondary name for display below primary name
	function getFeatureSecondaryName(feature: StoredFeature): string | null {
		const primaryName = getFeatureName(feature);
		const regularName = feature.names.name;

		// Only show the regular 'name' if it exists and is different from the primary name
		if (regularName && regularName !== primaryName) {
			return regularName;
		}

		return null;
	}

	// Get lists for a feature with their colors
	function getFeatureLists(feature: StoredFeature) {
		return feature.listIds.map((listId) => {
			const list = bookmarkLists.find((l) => l.id === listId);
			return {
				id: listId,
				name: list?.name || 'Unknown List',
				color: list?.color || '#6b7280'
			};
		});
	}

	// Get feature types (bookmarked, todo, visited)
	function getFeatureTypes(feature: StoredFeature) {
		const types = [];
		if (feature.bookmarked) types.push('bookmarked');
		if (feature.todo) types.push('todo');
		if (feature.visitedDates && feature.visitedDates.length > 0) types.push('visited');
		return types;
	}

	// Clear all filters
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

	// Toggle filters visibility
	function toggleFilters() {
		filtersExpanded = !filtersExpanded;
	}

	// Get type icon and label
	function getTypeInfo(type: string) {
		switch (type) {
			case 'bookmarked':
				return { icon: '⭐', label: 'Bookmarked' };
			case 'todo':
				return { icon: '✅', label: 'Todo' };
			case 'visited':
				return { icon: '📍', label: 'Visited' };
			case 'none':
				return { icon: '⚪', label: 'None' };
			default:
				return { icon: '?', label: 'Unknown' };
		}
	}

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

		// Optionally close the features drawer to give full focus to the selected feature
		// Comment this line if you want both drawers open simultaneously
		open = false;
	}
</script>

<!-- Features Drawer -->
<Drawer.Root bind:open snapPoints={['400px', '600px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay
		class="fixed inset-0 {zIndexClass('DRAWER_OVERLAY')} bg-black/40"
		style="pointer-events: none"
	/>
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 {zIndexClass(
				'DRAWER_CONTENT'
			)} mx-[-1px] flex h-full max-h-[97%] flex-col rounded-t-[10px] border border-gray-200 bg-white"
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
					<div class="mb-4 rounded-lg border border-gray-200 bg-gray-50">
						<!-- Filters Header -->
						<div class="flex items-center justify-between p-3">
							<button
								onclick={toggleFilters}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										toggleFilters();
									}
								}}
								class="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
								tabindex="0"
								aria-expanded={filtersExpanded}
								aria-controls="filters-content"
							>
								<span class="text-base">🔧</span>
								<span class="font-medium text-gray-900">Filters</span>
								{#if hasActiveFilters}
									<span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800"
										>Active</span
									>
								{/if}
								<span
									class="ml-1 text-gray-400 transition-transform duration-200 {filtersExpanded
										? 'rotate-180'
										: ''}"
								>
									▼
								</span>
							</button>

							{#if hasActiveFilters}
								<button
									onclick={clearAllFilters}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											clearAllFilters();
										}
									}}
									class="rounded px-2 py-1 text-xs text-blue-600 hover:text-blue-800 focus:ring-1 focus:ring-blue-500 focus:outline-none"
									tabindex="0"
									title="Clear all filters"
								>
									Clear all
								</button>
							{/if}
						</div>

						<!-- Filters Content -->
						{#if filtersExpanded}
							<div id="filters-content" class="space-y-3 px-3 pb-3">
								<!-- Text Search -->
								<div>
									<label for="search-input" class="mb-2 block text-xs font-medium text-gray-600"
										>Search:</label
									>
									<div class="relative">
										<input
											id="search-input"
											bind:value={searchQuery}
											type="text"
											placeholder="Search features by name, class, category, or list..."
											class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
										/>
										<div
											class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
										>
											<span class="text-gray-400">🔍</span>
										</div>
										{#if searchQuery}
											<button
												onclick={() => {
													searchQuery = '';
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														searchQuery = '';
													}
												}}
												class="absolute inset-y-0 right-0 flex items-center rounded pr-3 text-gray-400 hover:text-gray-600 focus:ring-1 focus:ring-blue-500 focus:outline-none"
												tabindex="0"
												title="Clear search"
											>
												<span class="text-sm">✕</span>
											</button>
										{/if}
									</div>
								</div>

								<!-- Type Filters -->
								{#if availableTypes.length > 0}
									<div>
										<div class="mb-2 text-xs font-medium text-gray-600">Filter by Type:</div>
										<div class="flex flex-wrap gap-2">
											{#each availableTypes as type}
												{@const typeInfo = getTypeInfo(type)}
												{@const count = getFilterCount('type', type)}
												{@const isSelected = selectedTypes.includes(type)}
												<button
													onclick={() => toggleTypeFilter(type)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															toggleTypeFilter(type);
														}
													}}
													class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none {isSelected
														? 'border-blue-300 bg-blue-100 text-blue-800 shadow-sm'
														: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}"
													title="{typeInfo.label} ({count} features)"
													tabindex="0"
												>
													<span class="text-base">{typeInfo.icon}</span>
													<span class="font-medium">{typeInfo.label}</span>
													<span class="bg-opacity-70 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs"
														>{count}</span
													>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<!-- List Filters -->
								{#if availableLists.length > 0}
									<div>
										<div class="mb-2 text-xs font-medium text-gray-600">Filter by List:</div>
										<div class="flex flex-wrap gap-2">
											{#each availableLists as list}
												{@const count = getFilterCount('list', list.id)}
												{@const isSelected = selectedListIds.includes(list.id)}
												<button
													onclick={() => toggleListFilter(list.id)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															toggleListFilter(list.id);
														}
													}}
													class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none {isSelected
														? 'border-blue-300 bg-blue-100 text-blue-800 shadow-sm'
														: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}"
													title="{list.name} ({count} features)"
													tabindex="0"
												>
													<div
														class="h-3 w-3 rounded-full border shadow-sm"
														style="background-color: {list.color}"
													></div>
													<span class="max-w-24 truncate font-medium">{list.name}</span>
													<span class="bg-opacity-70 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs"
														>{count}</span
													>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Class Filters -->
								{#if availableClasses.length > 0}
									<div>
										<div class="mb-2 text-xs font-medium text-gray-600">Filter by Class:</div>
										<div class="flex flex-wrap gap-2">
											{#each availableClasses as className}
												{@const count = getFilterCount('class', className)}
												{@const isSelected = selectedClasses.includes(className)}
												<button
													onclick={() => toggleClassFilter(className)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															toggleClassFilter(className);
														}
													}}
													class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none {isSelected
														? 'border-blue-300 bg-blue-100 text-blue-800 shadow-sm'
														: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}"
													title="{formatFeatureProperty(className)} ({count} features)"
													tabindex="0"
												>
													<span class="max-w-24 truncate font-medium"
														>{formatFeatureProperty(className)}</span
													>
													<span class="bg-opacity-70 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs"
														>{count}</span
													>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Subclass Filters -->
								{#if availableSubclasses.length > 0}
									<div>
										<div class="mb-2 text-xs font-medium text-gray-600">Filter by Subclass:</div>
										<div class="flex flex-wrap gap-2">
											{#each availableSubclasses as subclassName}
												{@const count = getFilterCount('subclass', subclassName)}
												{@const isSelected = selectedSubclasses.includes(subclassName)}
												<button
													onclick={() => toggleSubclassFilter(subclassName)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															toggleSubclassFilter(subclassName);
														}
													}}
													class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none {isSelected
														? 'border-blue-300 bg-blue-100 text-blue-800 shadow-sm'
														: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}"
													title="{formatFeatureProperty(subclassName)} ({count} features)"
													tabindex="0"
												>
													<span class="max-w-24 truncate font-medium"
														>{formatFeatureProperty(subclassName)}</span
													>
													<span class="bg-opacity-70 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs"
														>{count}</span
													>
												</button>
											{/each}
										</div>
									</div>
								{/if}

								<!-- Category Filters -->
								{#if availableCategories.length > 0}
									<div>
										<div class="mb-2 text-xs font-medium text-gray-600">Filter by Category:</div>
										<div class="flex flex-wrap gap-2">
											{#each availableCategories as categoryName}
												{@const count = getFilterCount('category', categoryName)}
												{@const isSelected = selectedCategories.includes(categoryName)}
												<button
													onclick={() => toggleCategoryFilter(categoryName)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															toggleCategoryFilter(categoryName);
														}
													}}
													class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none {isSelected
														? 'border-blue-300 bg-blue-100 text-blue-800 shadow-sm'
														: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}"
													title="{formatFeatureProperty(categoryName)} ({count} features)"
													tabindex="0"
												>
													<span class="max-w-24 truncate font-medium"
														>{formatFeatureProperty(categoryName)}</span
													>
													<span class="bg-opacity-70 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs"
														>{count}</span
													>
												</button>
											{/each}
										</div>
									</div>
								{/if}
							</div>
						{/if}
					</div>
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
					<div class="overflow-x-auto">
						<table class="w-full text-sm">
							<thead class="sticky top-0 z-10 bg-white">
								<tr class="border-b border-gray-200">
									<th class="pr-4 pb-2 text-left font-medium text-gray-700">Name</th>
									<th class="pr-2 pb-2 text-center font-medium text-gray-700">Lists</th>
									<th class="pr-2 pb-2 text-center font-medium text-gray-700">Type</th>
									<th class="hidden pr-2 pb-2 text-left font-medium text-gray-700 sm:table-cell"
										>Class</th
									>
									<th class="hidden pr-2 pb-2 text-left font-medium text-gray-700 md:table-cell"
										>Subclass</th
									>
									<th class="hidden pb-2 text-left font-medium text-gray-700 lg:table-cell"
										>Category</th
									>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each filteredFeatures as feature (feature.id)}
									{@const featureLists = getFeatureLists(feature)}
									{@const featureTypes = getFeatureTypes(feature)}
									{@const secondaryName = getFeatureSecondaryName(feature)}
									<tr
										class="group cursor-pointer transition-colors hover:bg-blue-50 focus:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset active:bg-blue-100"
										onclick={(e) => handleFeatureRowClick(feature, e)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleFeatureRowClick(feature, e);
											}
										}}
										tabindex="0"
										role="button"
										aria-label="Select and zoom to {getFeatureName(feature)}"
										title="Click to zoom to this feature on the map"
									>
										<td class="py-3 pr-4">
											<div class="flex items-center gap-2">
												<div class="flex-1">
													<div class="leading-tight font-medium text-gray-900">
														{getFeatureName(feature)}
													</div>
													<div class="mt-1 text-xs text-gray-500">
														{#if secondaryName}
															{secondaryName}
														{/if}
													</div>
												</div>
												<div
													class="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
												>
													<span class="text-xs">🔍</span>
												</div>
											</div>
										</td>
										<td class="py-3 pr-2">
											<div class="flex flex-wrap justify-center gap-1">
												{#each featureLists as list}
													<div
														class="h-3 w-3 rounded-full border border-gray-200 shadow-sm"
														style="background-color: {list.color}"
														title={list.name}
													></div>
												{/each}
												{#if featureLists.length === 0}
													<span class="text-xs text-gray-300">-</span>
												{/if}
											</div>
										</td>
										<td class="py-3 pr-2">
											<div class="flex justify-center gap-1">
												{#each featureTypes as type}
													{#if type === 'bookmarked'}
														<span class="text-yellow-500" title="Bookmarked">⭐</span>
													{:else if type === 'todo'}
														<span class="text-blue-500" title="Todo">✅</span>
													{:else if type === 'visited'}
														<span
															class="text-green-500"
															title="Visited ({feature.visitedDates.length} times)">📍</span
														>
													{/if}
												{/each}
												{#if featureTypes.length === 0}
													<span class="text-xs text-gray-300">-</span>
												{/if}
											</div>
										</td>
										<td class="hidden py-3 pr-2 text-xs text-gray-600 sm:table-cell">
											<div
												class="max-w-20 truncate"
												title={feature.class ? formatFeatureProperty(feature.class) : '-'}
											>
												<PropertyIcon key={'class'} value={feature.class} size={20} color="black" />
												<!-- {feature.class ? formatFeatureProperty(feature.class) : '-'} -->
											</div>
										</td>
										<td class="hidden py-3 pr-2 text-xs text-gray-600 md:table-cell">
											<div
												class="max-w-20 truncate"
												title={feature.subclass ? formatFeatureProperty(feature.subclass) : '-'}
											>
												<PropertyIcon
													key={'subclass'}
													value={feature.subclass}
													size={20}
													color="black"
												/>
												<!-- {feature.subclass ? formatFeatureProperty(feature.subclass) : '-'} -->
											</div>
										</td>
										<td class="hidden py-3 text-xs text-gray-600 lg:table-cell">
											<div
												class="max-w-24 truncate"
												title={feature.category ? formatFeatureProperty(feature.category) : '-'}
											>
												<PropertyIcon
													key={'category'}
													value={feature.category}
													size={20}
													color="black"
												/>
												<!-- {feature.category ? formatFeatureProperty(feature.category) : '-'} -->
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

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
