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
		showTypesColumn = true
	}: {
		features: (StoredFeature | SearchResult | TableFeature)[];
		onRowClick: (feature: any, event: Event) => void;
		maxResults?: number;
		showHeader?: boolean;
		showListsColumn?: boolean;
		showTypesColumn?: boolean;
	} = $props();

	let bookmarkLists = $state<BookmarkList[]>([]);
	let storedFeaturesMap = $state<Map<string, StoredFeature>>(new Map());

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
		return features.map((feature) => processFeature(feature));
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

	// Create unique key for each feature to avoid duplicate key errors
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
	<table class="w-full min-w-[600px] text-sm">
		{#if showHeader}
			<thead class="sticky top-0 bg-gray-50">
				<tr class="border-b border-gray-200">
					<th class="min-w-[140px] pr-4 pb-2 text-left font-medium text-gray-700">Name</th>
					{#if showListsColumn}
						<th class="min-w-[60px] pr-2 pb-2 text-center font-medium text-gray-700">Lists</th>
					{/if}
					{#if showTypesColumn}
						<th class="min-w-[60px] pr-2 pb-2 text-center font-medium text-gray-700">Type</th>
					{/if}
					<th
						class="hidden min-w-[80px] pr-2 pb-2 text-left font-medium text-gray-700 sm:table-cell"
						>Class</th
					>
					<th
						class="hidden min-w-[100px] pr-2 pb-2 text-left font-medium text-gray-700 md:table-cell"
						>Subclass</th
					>
					<th
						class="hidden min-w-[80px] pr-2 pb-2 text-left font-medium text-gray-700 lg:table-cell"
						>Category</th
					>
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
					<td class="py-3 pr-4">
						<div class="flex items-center gap-2">
							<div class="flex-1">
								<div class="leading-tight font-medium text-gray-900">
									{getFeatureName(feature)}
								</div>
								{#if secondaryName}
									<div class="mt-1 text-xs text-gray-500">
										{secondaryName}
									</div>
								{/if}
							</div>
							<div class="text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
								<span class="text-xs">🔍</span>
							</div>
						</div>
					</td>

					{#if showListsColumn}
						<td class="py-3 pr-2">
							<div class="flex flex-wrap justify-center gap-1">
								{#each feature.lists || [] as list}
									<div
										class="h-3 w-3 rounded-full border border-gray-200 shadow-sm"
										style="background-color: {list.color}"
										title={list.name}
									></div>
								{/each}
								{#if !feature.lists || feature.lists.length === 0}
									<span class="text-xs text-gray-300">-</span>
								{/if}
							</div>
						</td>
					{/if}

					{#if showTypesColumn}
						<td class="py-3 pr-2">
							<div class="flex justify-center gap-1">
								{#each feature.types || [] as type}
									<PropertyIcon key={'type'} value={type} size={16} color={'black'} />
								{/each}
								{#if !feature.types || feature.types.length === 0}
									<span class="text-xs text-gray-300">-</span>
								{/if}
							</div>
						</td>
					{/if}

					<td class="hidden py-3 pr-2 text-xs text-gray-600 sm:table-cell">
						<div
							class="flex max-w-20 justify-center truncate"
							title={feature.class ? formatFeatureProperty(feature.class) : '-'}
						>
							<PropertyIcon key={'class'} value={feature.class} size={20} color="black" />
						</div>
					</td>

					<td class="hidden py-3 pr-2 text-xs text-gray-600 md:table-cell">
						<div
							class="flex max-w-20 justify-center truncate"
							title={feature.subclass ? formatFeatureProperty(feature.subclass) : '-'}
						>
							<PropertyIcon key={'subclass'} value={feature.subclass} size={20} color="black" />
						</div>
					</td>

					<td class="hidden py-3 text-xs text-gray-600 lg:table-cell">
						<div
							class="flex max-w-24 justify-center truncate"
							title={feature.category ? formatFeatureProperty(feature.category) : '-'}
						>
							<PropertyIcon key={'category'} value={feature.category} size={20} color="black" />
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
