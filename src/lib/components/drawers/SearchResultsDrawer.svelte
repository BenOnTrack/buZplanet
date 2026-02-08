<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { formatFeatureProperty } from '$lib/utils/text-formatting.js';
	import { mapControl } from '$lib/stores/MapControl.svelte';

	interface SearchResult {
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
	}

	let {
		open = $bindable(false),
		results = [],
		searchQuery = '',
		isSearching = false
	}: {
		open?: boolean;
		results?: SearchResult[];
		searchQuery?: string;
		isSearching?: boolean;
	} = $props();

	let activeSnapPoint = $state<string | number>('400px');
	let filteredResults = $state<SearchResult[]>([]);
	let localSearchQuery = $state('');
	let selectedClasses = $state<string[]>([]);
	let selectedSubclasses = $state<string[]>([]);
	let selectedCategories = $state<string[]>([]);
	let selectedDatabases = $state<string[]>([]);
	let filtersExpanded = $state(false);

	// Update filtered results when results or filters change
	$effect(() => {
		filteredResults = applyFilters(results);
	});

	// Available filter options
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

	let availableDatabases = $derived.by(() => {
		const databases = new Set<string>();
		results.forEach((result) => {
			if (result.database) {
				databases.add(result.database);
			}
		});
		return Array.from(databases).sort();
	});

	function applyFilters(results: SearchResult[]): SearchResult[] {
		let filtered = [...results];

		// Apply local search filter
		if (localSearchQuery.trim()) {
			const query = localSearchQuery.toLowerCase().trim();
			filtered = filtered.filter((result) => {
				return (
					result.name.toLowerCase().includes(query) ||
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

		// Apply database filter
		if (selectedDatabases.length > 0) {
			filtered = filtered.filter((result) => selectedDatabases.includes(result.database));
		}

		return filtered;
	}

	// Clear all filters
	function clearAllFilters() {
		localSearchQuery = '';
		selectedClasses = [];
		selectedSubclasses = [];
		selectedCategories = [];
		selectedDatabases = [];
	}

	// Toggle filter functions
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

	function toggleDatabaseFilter(databaseName: string) {
		if (selectedDatabases.includes(databaseName)) {
			selectedDatabases = selectedDatabases.filter((d) => d !== databaseName);
		} else {
			selectedDatabases = [...selectedDatabases, databaseName];
		}
	}

	// Check if any filters are active
	let hasActiveFilters = $derived.by(() => {
		return (
			localSearchQuery.trim() !== '' ||
			selectedClasses.length > 0 ||
			selectedSubclasses.length > 0 ||
			selectedCategories.length > 0 ||
			selectedDatabases.length > 0
		);
	});

	// Toggle filters visibility
	function toggleFilters() {
		filtersExpanded = !filtersExpanded;
	}

	// Get count for a filter
	function getFilterCount(
		type: 'class' | 'subclass' | 'category' | 'database',
		value: string
	): number {
		if (type === 'class') {
			return results.filter((r) => r.class === value).length;
		} else if (type === 'subclass') {
			return results.filter((r) => r.subclass === value).length;
		} else if (type === 'category') {
			return results.filter((r) => r.category === value).length;
		} else if (type === 'database') {
			return results.filter((r) => r.database === value).length;
		}
		return 0;
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

		// Optionally close the search results drawer to give full focus to the selected feature
		// Comment this line if you want both drawers open simultaneously
		open = false;
	}

	// Get database display name (remove .mbtiles extension)
	function getDatabaseDisplayName(filename: string): string {
		return filename.replace(/\.mbtiles$/i, '');
	}

	// Get class icon based on class type
	function getClassIcon(className: string): string {
		switch (className.toLowerCase()) {
			case 'attraction':
				return '🎢';
			case 'education':
				return '🎓';
			case 'entertainment':
				return '🎭';
			case 'facility':
				return '🏢';
			case 'food_and_drink':
				return '🍽️';
			case 'healthcare':
				return '🏥';
			case 'leisure':
				return '⚽';
			case 'lodging':
				return '🏨';
			case 'natural':
				return '🌲';
			case 'place':
				return '📍';
			case 'shop':
				return '🛍️';
			case 'transportation':
				return '🚇';
			case 'poi':
			default:
				return '📍';
		}
	}
</script>

<!-- Search Results Drawer -->
<Drawer.Root bind:open snapPoints={['400px', '600px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay class="fixed inset-0 z-60 bg-black/40" style="pointer-events: none" />
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 z-60 mx-[-1px] flex h-full max-h-[97%] flex-col rounded-t-[10px] border border-gray-200 bg-white"
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
						<span class="sr-only">Close</span>
						<span aria-hidden="true" class="text-xl">✕</span>
					</Drawer.Close>
				</div>

				<div class="mb-4">
					<p class="text-sm text-gray-600">
						{#if isSearching}
							Searching...
						{:else if searchQuery}
							{hasActiveFilters
								? `${filteredResults.length} of ${results.length} results for "${searchQuery}"`
								: `${results.length} results for "${searchQuery}"`}
							{#if hasActiveFilters}
								<button
									onclick={clearAllFilters}
									class="ml-2 text-xs text-blue-600 hover:text-blue-800"
								>
									Clear filters
								</button>
							{/if}
						{:else}
							Enter a search query to find places
						{/if}
					</p>
				</div>

				{#if !isSearching && results.length > 0}
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
								<!-- Local Search -->
								<div>
									<label
										for="local-search-input"
										class="mb-2 block text-xs font-medium text-gray-600">Refine results:</label
									>
									<div class="relative">
										<input
											id="local-search-input"
											bind:value={localSearchQuery}
											type="text"
											placeholder="Further filter these results..."
											class="w-full rounded-lg border border-gray-300 bg-white py-2 pr-4 pl-10 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
										/>
										<div
											class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
										>
											<span class="text-gray-400">🔍</span>
										</div>
										{#if localSearchQuery}
											<button
												onclick={() => {
													localSearchQuery = '';
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														localSearchQuery = '';
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

								<!-- Database Filters -->
								{#if availableDatabases.length > 0}
									<div>
										<div class="mb-2 text-xs font-medium text-gray-600">Filter by Source:</div>
										<div class="flex flex-wrap gap-2">
											{#each availableDatabases as database}
												{@const count = getFilterCount('database', database)}
												{@const isSelected = selectedDatabases.includes(database)}
												<button
													onclick={() => toggleDatabaseFilter(database)}
													onkeydown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															toggleDatabaseFilter(database);
														}
													}}
													class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:outline-none {isSelected
														? 'border-blue-300 bg-blue-100 text-blue-800 shadow-sm'
														: 'border-gray-200 bg-white text-gray-700 hover:bg-gray-100'}"
													title="{getDatabaseDisplayName(database)} ({count} results)"
													tabindex="0"
												>
													<span class="max-w-24 truncate font-medium"
														>{getDatabaseDisplayName(database)}</span
													>
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
													title="{formatFeatureProperty(className)} ({count} results)"
													tabindex="0"
												>
													<span class="text-base">{getClassIcon(className)}</span>
													<span class="max-w-20 truncate font-medium"
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
													title="{formatFeatureProperty(subclassName)} ({count} results)"
													tabindex="0"
												>
													<span class="max-w-20 truncate font-medium"
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
													title="{formatFeatureProperty(categoryName)} ({count} results)"
													tabindex="0"
												>
													<span class="max-w-20 truncate font-medium"
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

				{#if isSearching}
					<div class="flex items-center justify-center py-8">
						<div class="flex items-center gap-2 text-gray-500">
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent"
							></div>
							<span>Searching databases...</span>
						</div>
					</div>
				{:else if filteredResults.length === 0 && results.length > 0 && hasActiveFilters}
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
					<div class="overflow-x-auto">
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
						<table class="w-full text-sm">
							<thead class="sticky top-0 z-10 bg-white">
								<tr class="border-b border-gray-200">
									<th class="pr-4 pb-2 text-left font-medium text-gray-700">Name</th>
									<th class="pr-2 pb-2 text-center font-medium text-gray-700">Type</th>
									<th class="hidden pr-2 pb-2 text-left font-medium text-gray-700 sm:table-cell"
										>Class</th
									>
									<th class="hidden pr-2 pb-2 text-left font-medium text-gray-700 md:table-cell"
										>Subclass</th
									>
									<th class="hidden pr-2 pb-2 text-left font-medium text-gray-700 lg:table-cell"
										>Category</th
									>
									<th class="hidden pb-2 text-left font-medium text-gray-700 xl:table-cell"
										>Source</th
									>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-100">
								{#each filteredResults as result (result.id)}
									<tr
										class="group cursor-pointer transition-colors hover:bg-blue-50 focus:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset active:bg-blue-100"
										onclick={(e) => handleResultRowClick(result, e)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleResultRowClick(result, e);
											}
										}}
										tabindex="0"
										role="button"
										aria-label="Select and zoom to {result.name}"
										title="Click to zoom to and select this feature on the map"
									>
										<td class="py-3 pr-4">
											<div class="flex items-center gap-2">
												<div class="flex-1">
													<div class="leading-tight font-medium text-gray-900">
														{result.name}
													</div>
													{#if result.lng !== 0 && result.lat !== 0}
														<div class="mt-1 text-xs text-gray-500">
															{result.lat.toFixed(4)}, {result.lng.toFixed(4)}
														</div>
													{/if}
												</div>
												<div
													class="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100"
												>
													<span class="text-xs">🔍</span>
												</div>
											</div>
										</td>
										<td class="py-3 pr-2">
											<div class="flex justify-center">
												<span class="text-lg" title={result.class}>
													{getClassIcon(result.class)}
												</span>
											</div>
										</td>
										<td class="hidden py-3 pr-2 text-xs text-gray-600 sm:table-cell">
											<div
												class="max-w-20 truncate"
												title={result.class ? formatFeatureProperty(result.class) : '-'}
											>
												{result.class ? formatFeatureProperty(result.class) : '-'}
											</div>
										</td>
										<td class="hidden py-3 pr-2 text-xs text-gray-600 md:table-cell">
											<div
												class="max-w-20 truncate"
												title={result.subclass ? formatFeatureProperty(result.subclass) : '-'}
											>
												{result.subclass ? formatFeatureProperty(result.subclass) : '-'}
											</div>
										</td>
										<td class="hidden py-3 pr-2 text-xs text-gray-600 lg:table-cell">
											<div
												class="max-w-24 truncate"
												title={result.category ? formatFeatureProperty(result.category) : '-'}
											>
												{result.category ? formatFeatureProperty(result.category) : '-'}
											</div>
										</td>
										<td class="hidden py-3 text-xs text-gray-600 xl:table-cell">
											<div class="max-w-20 truncate" title={result.database}>
												{getDatabaseDisplayName(result.database)}
											</div>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>

					{#if results.length > 0}
						<div class="mt-4 border-t border-gray-200 pt-4">
							<div class="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
								<div class="text-center">
									<div class="font-medium text-blue-600">{results.length}</div>
									<div class="text-xs text-gray-500">Total Results</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-green-600">{filteredResults.length}</div>
									<div class="text-xs text-gray-500">Filtered</div>
								</div>
								<div class="text-center">
									<div class="font-medium text-purple-600">{availableDatabases.length}</div>
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
