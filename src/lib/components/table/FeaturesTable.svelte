<script lang="ts">
	import { formatFeatureProperty } from '$lib/utils/text-formatting.js';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte.js';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let {
		features = [],
		onRowClick,
		maxResults = undefined,
		showHeader = true,
		showListsColumn = true,
		showTypesColumn = true,
		// Filter props for clickable filtering
		selectedTypes = $bindable([]),
		selectedListIds = $bindable([]),
		selectedClasses = $bindable([]),
		selectedSubclasses = $bindable([]),
		selectedCategories = $bindable([])
	}: {
		features: (StoredFeature | SearchResult | TableFeature)[];
		onRowClick: (feature: any, event: Event) => void;
		maxResults?: number;
		showHeader?: boolean;
		showListsColumn?: boolean;
		showTypesColumn?: boolean;
		// Filter bindings
		selectedTypes?: string[];
		selectedListIds?: string[];
		selectedClasses?: string[];
		selectedSubclasses?: string[];
		selectedCategories?: string[];
	} = $props();

	let bookmarkLists = $state<BookmarkList[]>([]);
	let storedFeaturesMap = $state<Map<string, StoredFeature>>(new Map());

	// Sorting state
	let sortColumn = $state<'name' | 'lists' | 'types' | 'class' | 'subclass' | 'category' | null>(
		null
	);
	let sortDirection = $state<'asc' | 'desc'>('asc');

	// Load bookmark lists and stored features when component mounts
	$effect(() => {
		if (featuresDB.initialized) {
			loadBookmarkLists();
			loadStoredFeatures();
		}
	});

	async function loadBookmarkLists() {
		try {
			bookmarkLists = await featuresDB.getAllBookmarkLists();
		} catch (error) {
			console.error('Failed to load bookmark lists:', error);
			bookmarkLists = [];
		}
	}

	async function loadStoredFeatures() {
		try {
			const allStoredFeatures = await featuresDB.exportFeatures();
			const newMap = new Map<string, StoredFeature>();
			allStoredFeatures.forEach((feature) => {
				newMap.set(feature.id, feature);
			});
			storedFeaturesMap = newMap;
		} catch (error) {
			console.error('Failed to load stored features:', error);
			storedFeaturesMap = new Map();
		}
	}

	// Convert features to unified TableFeature format with saved features integration
	let processedFeatures = $derived.by(() => {
		const processed = features.map((feature) => processFeature(feature));
		return sortFeatures(processed);
	});

	function processFeature(feature: StoredFeature | SearchResult | TableFeature): TableFeature {
		// If already processed as TableFeature, return as is
		if ('types' in feature || 'lists' in feature) {
			return feature as TableFeature;
		}

		const baseFeature: BaseFeature = {
			id: feature.id,
			class: feature.class,
			subclass: feature.subclass,
			category: feature.category,
			names: feature.names
		};

		// Check if this is a StoredFeature
		if ('bookmarked' in feature) {
			const storedFeature = feature as StoredFeature;
			return {
				...baseFeature,
				types: getFeatureTypes(storedFeature),
				lists: getFeatureLists(storedFeature),
				isFromSearch: false,
				storedFeature
			};
		}

		// This is a SearchResult - check if we have it saved
		const searchResult = feature as SearchResult;
		const matchedStoredFeature = findMatchingStoredFeature(searchResult);

		return {
			...baseFeature,
			types: matchedStoredFeature ? getFeatureTypes(matchedStoredFeature) : [],
			lists: matchedStoredFeature ? getFeatureLists(matchedStoredFeature) : [],
			isFromSearch: true,
			searchResult,
			storedFeature: matchedStoredFeature || undefined
		};
	}

	// Create unique key for each feature to avoid duplicate key errors

	// Filter toggle functions
	function toggleTypeFilter(type: string, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		if (selectedTypes.includes(type)) {
			selectedTypes = selectedTypes.filter((t) => t !== type);
		} else {
			selectedTypes = [...selectedTypes, type];
		}
	}

	function toggleListFilter(listId: string, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		if (selectedListIds.includes(listId)) {
			selectedListIds = selectedListIds.filter((id) => id !== listId);
		} else {
			selectedListIds = [...selectedListIds, listId];
		}
	}

	function toggleClassFilter(className: string, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		if (selectedClasses.includes(className)) {
			selectedClasses = selectedClasses.filter((c) => c !== className);
		} else {
			selectedClasses = [...selectedClasses, className];
		}
	}

	function toggleSubclassFilter(subclassName: string, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		if (selectedSubclasses.includes(subclassName)) {
			selectedSubclasses = selectedSubclasses.filter((s) => s !== subclassName);
		} else {
			selectedSubclasses = [...selectedSubclasses, subclassName];
		}
	}

	function toggleCategoryFilter(categoryName: string, event: Event) {
		event.preventDefault();
		event.stopPropagation();
		if (selectedCategories.includes(categoryName)) {
			selectedCategories = selectedCategories.filter((c) => c !== categoryName);
		} else {
			selectedCategories = [...selectedCategories, categoryName];
		}
	}

	// Find matching stored feature for a search result
	function findMatchingStoredFeature(searchResult: SearchResult): StoredFeature | null {
		return storedFeaturesMap.get(searchResult.id) || null;
	}

	// Get feature types (bookmarked, todo, visited) for a stored feature
	function getFeatureTypes(feature: StoredFeature): ('bookmarked' | 'todo' | 'visited')[] {
		const types: ('bookmarked' | 'todo' | 'visited')[] = [];
		if (feature.bookmarked) types.push('bookmarked');
		if (feature.todo) types.push('todo');
		if (feature.visitedDates && feature.visitedDates.length > 0) types.push('visited');
		return types;
	}

	// Get lists for a stored feature with their colors
	function getFeatureLists(feature: StoredFeature): { id: string; name: string; color: string }[] {
		return feature.listIds.map((listId) => {
			const list = bookmarkLists.find((l) => l.id === listId);
			return {
				id: listId,
				name: list?.name || 'Unknown List',
				color: list?.color || '#6b7280'
			};
		});
	}

	// Get feature's primary name (name:en first, then name, then formatted category)
	function getFeatureName(feature: TableFeature): string {
		return (
			feature.names['name:en'] ||
			feature.names.name ||
			(feature.category ? formatFeatureProperty(feature.category) : '') ||
			Object.values(feature.names)[0] ||
			'Unnamed'
		);
	}

	// Get feature's secondary name for display below primary name
	function getFeatureSecondaryName(feature: TableFeature): string | null {
		const primaryName = getFeatureName(feature);
		const regularName = feature.names.name;

		// Only show the regular 'name' if it exists and is different from the primary name
		if (regularName && regularName !== primaryName) {
			return regularName;
		}

		return null;
	}

	// Handle column header clicks for sorting
	function handleSort(column: 'name' | 'lists' | 'types' | 'class' | 'subclass' | 'category') {
		if (sortColumn === column) {
			// Toggle direction if same column
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			// New column, start with ascending
			sortColumn = column;
			sortDirection = 'asc';
		}
	}

	// Get sort indicator for column headers
	function getSortIndicator(
		column: 'name' | 'lists' | 'types' | 'class' | 'subclass' | 'category'
	): string {
		if (sortColumn !== column) return '↕️';
		return sortDirection === 'asc' ? '↑' : '↓';
	}

	// Sort processed features based on current sort settings
	function sortFeatures(features: TableFeature[]): TableFeature[] {
		if (!sortColumn) return features;

		return [...features].sort((a, b) => {
			let aValue: string;
			let bValue: string;

			switch (sortColumn) {
				case 'name':
					aValue = getFeatureName(a).toLowerCase();
					bValue = getFeatureName(b).toLowerCase();
					break;
				case 'lists':
					// Sort by first list name, or empty string if no lists
					aValue = a.lists && a.lists.length > 0 ? a.lists[0].name.toLowerCase() : '';
					bValue = b.lists && b.lists.length > 0 ? b.lists[0].name.toLowerCase() : '';
					break;
				case 'types':
					// Sort by first type, or empty string if no types
					aValue = a.types && a.types.length > 0 ? a.types[0] : '';
					bValue = b.types && b.types.length > 0 ? b.types[0] : '';
					break;
				case 'class':
					aValue = a.class ? formatFeatureProperty(a.class).toLowerCase() : '';
					bValue = b.class ? formatFeatureProperty(b.class).toLowerCase() : '';
					break;
				case 'subclass':
					aValue = a.subclass ? formatFeatureProperty(a.subclass).toLowerCase() : '';
					bValue = b.subclass ? formatFeatureProperty(b.subclass).toLowerCase() : '';
					break;
				case 'category':
					aValue = a.category ? formatFeatureProperty(a.category).toLowerCase() : '';
					bValue = b.category ? formatFeatureProperty(b.category).toLowerCase() : '';
					break;
				default:
					return 0;
			}

			// Handle empty values (put them at the end)
			if (!aValue && !bValue) return 0;
			if (!aValue) return 1;
			if (!bValue) return -1;

			const result = aValue.localeCompare(bValue);
			return sortDirection === 'asc' ? result : -result;
		});
	}
	function createUniqueKey(feature: TableFeature, index: number): string {
		// For search results, include more identifying info
		if (feature.isFromSearch && feature.searchResult) {
			return `${feature.id}-${feature.searchResult.database}-${feature.searchResult.layer}-${feature.searchResult.lng}-${feature.searchResult.lat}-${index}`;
		}
		// For stored features, just use the ID
		return `${feature.id}-${index}`;
	}

	// Apply max results limit if specified
	let displayFeatures = $derived.by(() => {
		if (maxResults && processedFeatures.length > maxResults) {
			return processedFeatures.slice(0, maxResults);
		}
		return processedFeatures;
	});
</script>

<div class="overflow-x-auto">
	<table class="w-full text-xs">
		{#if showHeader}
			<thead class="sticky top-0 bg-gray-50">
				<tr class="border-b border-gray-200">
					<!-- Name column: sortable -->
					<th class="w-32 pr-1 pb-1 text-left text-xs font-medium text-gray-700">
						<button
							class="flex w-full cursor-pointer items-center gap-1 text-left hover:text-blue-600"
							onclick={() => handleSort('name')}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleSort('name');
								}
							}}
							tabindex="0"
							aria-label="Sort by name"
						>
							<span>Name</span>
							<span class="text-xs text-gray-400">{getSortIndicator('name')}</span>
						</button>
					</th>
					{#if showListsColumn}
						<!-- Lists: sortable -->
						<th class="w-8 pr-1 pb-1 text-center text-xs font-medium text-gray-700">
							<button
								class="flex w-full cursor-pointer flex-col items-center hover:text-blue-600"
								onclick={() => handleSort('lists')}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleSort('lists');
									}
								}}
								tabindex="0"
								aria-label="Sort by lists"
							>
								<span>Lists</span>
								<span class="text-xs text-gray-400">{getSortIndicator('lists')}</span>
							</button>
						</th>
					{/if}
					{#if showTypesColumn}
						<!-- Type: sortable -->
						<th class="w-8 pr-1 pb-1 text-center text-xs font-medium text-gray-700">
							<button
								class="flex w-full cursor-pointer flex-col items-center hover:text-blue-600"
								onclick={() => handleSort('types')}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleSort('types');
									}
								}}
								tabindex="0"
								aria-label="Sort by type"
							>
								<span>Type</span>
								<span class="text-xs text-gray-400">{getSortIndicator('types')}</span>
							</button>
						</th>
					{/if}
					<!-- Class: sortable -->
					<th class="w-8 pr-1 pb-1 text-center text-xs font-medium text-gray-700">
						<button
							class="flex w-full cursor-pointer flex-col items-center hover:text-blue-600"
							onclick={() => handleSort('class')}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleSort('class');
								}
							}}
							tabindex="0"
							aria-label="Sort by class"
						>
							<span>Class</span>
							<span class="text-xs text-gray-400">{getSortIndicator('class')}</span>
						</button>
					</th>
					<!-- Subclass: sortable -->
					<th class="w-8 pr-1 pb-1 text-center text-xs font-medium text-gray-700">
						<button
							class="flex w-full cursor-pointer flex-col items-center hover:text-blue-600"
							onclick={() => handleSort('subclass')}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleSort('subclass');
								}
							}}
							tabindex="0"
							aria-label="Sort by subclass"
						>
							<span>Sub</span>
							<span class="text-xs text-gray-400">{getSortIndicator('subclass')}</span>
						</button>
					</th>
					<!-- Category: sortable -->
					<th class="w-8 pb-1 text-center text-xs font-medium text-gray-700">
						<button
							class="flex w-full cursor-pointer flex-col items-center hover:text-blue-600"
							onclick={() => handleSort('category')}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleSort('category');
								}
							}}
							tabindex="0"
							aria-label="Sort by category"
						>
							<span>Cat</span>
							<span class="text-xs text-gray-400">{getSortIndicator('category')}</span>
						</button>
					</th>
				</tr>
			</thead>
		{/if}
		<tbody class="divide-y divide-gray-100">
			{#each displayFeatures as feature, index (createUniqueKey(feature, index))}
				{@const secondaryName = getFeatureSecondaryName(feature)}
				<tr
					class="group cursor-pointer transition-colors hover:bg-blue-50 focus:bg-blue-50 focus:ring-2 focus:ring-blue-500 focus:outline-none focus:ring-inset active:bg-blue-100"
					onclick={(e) => {
						// For search results, pass the original SearchResult
						// For stored features, pass the StoredFeature
						if (feature.isFromSearch && feature.searchResult) {
							onRowClick(feature.searchResult, e);
						} else if (feature.storedFeature) {
							onRowClick(feature.storedFeature, e);
						} else {
							// Fallback for direct StoredFeature objects
							onRowClick(feature as StoredFeature, e);
						}
					}}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							// Same logic as onclick
							if (feature.isFromSearch && feature.searchResult) {
								onRowClick(feature.searchResult, e);
							} else if (feature.storedFeature) {
								onRowClick(feature.storedFeature, e);
							} else {
								// Fallback for direct StoredFeature objects
								onRowClick(feature as StoredFeature, e);
							}
						}
					}}
					tabindex="0"
					role="button"
					aria-label="Select and zoom to {getFeatureName(feature)}"
					title="Click to zoom to this feature on the map"
				>
					<!-- Name column: constrained width -->
					<td class="py-2 pr-1">
						<div class="w-32">
							<div
								class="truncate text-xs leading-tight font-medium text-gray-900"
								title={getFeatureName(feature)}
							>
								{getFeatureName(feature)}
							</div>
							{#if secondaryName}
								<div class="truncate text-xs text-gray-500" title={secondaryName}>
									{secondaryName}
								</div>
							{/if}
						</div>
					</td>

					{#if showListsColumn}
						<!-- Lists: ultra compact column -->
						<td class="py-2 pr-1 text-center">
							<div class="flex w-full flex-col items-center justify-center gap-px">
								{#each feature.lists?.slice(0, 2) || [] as list}
									<button
										class="h-1.5 w-1.5 cursor-pointer rounded-full border border-gray-200 transition-all duration-200 hover:scale-150 hover:border-blue-500 {selectedListIds.includes(
											list.id
										)
											? 'ring-2 ring-blue-400 ring-offset-1'
											: ''}"
										style="background-color: {list.color}"
										title="{list.name} - Click to filter"
										onclick={(e) => toggleListFilter(list.id, e)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												toggleListFilter(list.id, e);
											}
										}}
										tabindex="0"
										aria-label="Filter by {list.name}"
									></button>
								{/each}
								{#if feature.lists && feature.lists.length > 2}
									<span class="text-xs leading-none text-gray-400">+</span>
								{/if}
								{#if !feature.lists || feature.lists.length === 0}
									<span class="text-xs text-gray-300">-</span>
								{/if}
							</div>
						</td>
					{/if}

					{#if showTypesColumn}
						<!-- Type: ultra compact column -->
						<td class="py-2 pr-1 text-center">
							<div class="flex w-full flex-col items-center justify-center gap-px">
								{#each feature.types || [] as type}
									<button
										class="cursor-pointer rounded transition-all duration-200 hover:scale-125 hover:bg-blue-100 {selectedTypes.includes(
											type
										)
											? 'bg-blue-100 ring-1 ring-blue-400'
											: ''}"
										title="{type} - Click to filter"
										onclick={(e) => toggleTypeFilter(type, e)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												toggleTypeFilter(type, e);
											}
										}}
										tabindex="0"
										aria-label="Filter by {type}"
									>
										<PropertyIcon key={'type'} value={type} size={10} color={'black'} />
									</button>
								{/each}
								{#if !feature.types || feature.types.length === 0}
									<span class="text-xs text-gray-300">-</span>
								{/if}
							</div>
						</td>
					{/if}

					<!-- Class: ultra compact column -->
					<td class="py-2 pr-1 text-center">
						<div class="flex w-full items-center justify-center">
							{#if feature.class}
								<button
									class="flex cursor-pointer items-center justify-center rounded p-0.5 transition-all duration-200 hover:scale-125 hover:bg-blue-100 {selectedClasses.includes(
										feature.class
									)
										? 'bg-blue-100 ring-1 ring-blue-400'
										: ''}"
									title="{formatFeatureProperty(feature.class)} - Click to filter"
									onclick={(e) => toggleClassFilter(feature.class, e)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											toggleClassFilter(feature.class, e);
										}
									}}
									tabindex="0"
									aria-label="Filter by class: {formatFeatureProperty(feature.class)}"
								>
									<PropertyIcon key={'class'} value={feature.class} size={12} color="black" />
								</button>
							{:else}
								<span class="text-xs text-gray-300">-</span>
							{/if}
						</div>
					</td>

					<!-- Subclass: ultra compact column -->
					<td class="py-2 pr-1 text-center">
						<div class="flex w-full items-center justify-center">
							{#if feature.subclass}
								<button
									class="flex cursor-pointer items-center justify-center rounded p-0.5 transition-all duration-200 hover:scale-125 hover:bg-blue-100 {selectedSubclasses.includes(
										feature.subclass
									)
										? 'bg-blue-100 ring-1 ring-blue-400'
										: ''}"
									title="{formatFeatureProperty(feature.subclass)} - Click to filter"
									onclick={(e) => toggleSubclassFilter(feature.subclass, e)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											toggleSubclassFilter(feature.subclass, e);
										}
									}}
									tabindex="0"
									aria-label="Filter by subclass: {formatFeatureProperty(feature.subclass)}"
								>
									<PropertyIcon key={'subclass'} value={feature.subclass} size={12} color="black" />
								</button>
							{:else}
								<span class="text-xs text-gray-300">-</span>
							{/if}
						</div>
					</td>

					<!-- Category: ultra compact column -->
					<td class="py-2 text-center">
						<div class="flex w-full items-center justify-center">
							{#if feature.category}
								<button
									class="flex cursor-pointer items-center justify-center rounded p-0.5 transition-all duration-200 hover:scale-125 hover:bg-blue-100 {selectedCategories.includes(
										feature.category
									)
										? 'bg-blue-100 ring-1 ring-blue-400'
										: ''}"
									title="{formatFeatureProperty(feature.category)} - Click to filter"
									onclick={(e) => toggleCategoryFilter(feature.category, e)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											toggleCategoryFilter(feature.category, e);
										}
									}}
									tabindex="0"
									aria-label="Filter by category: {formatFeatureProperty(feature.category)}"
								>
									<PropertyIcon key={'category'} value={feature.category} size={12} color="black" />
								</button>
							{:else}
								<span class="text-xs text-gray-300">-</span>
							{/if}
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if maxResults && processedFeatures.length > maxResults}
		<div class="border-t bg-gray-50 py-2 text-center text-xs text-gray-500">
			Showing first {maxResults} of {processedFeatures.length} results{processedFeatures.length >
			displayFeatures.length
				? '. Search will continue...'
				: ''}
		</div>
	{/if}
</div>
