<script lang="ts">
	import TypeFilters from '$lib/components/drawers/filters/TypeFilters.svelte';
	import ListFilters from '$lib/components/drawers/filters/ListFilters.svelte';
	import ClassFilters from '$lib/components/drawers/filters/ClassFilters.svelte';
	import SubclassFilters from '$lib/components/drawers/filters/SubclassFilters.svelte';
	import CategoryFilters from '$lib/components/drawers/filters/CategoryFilters.svelte';
	import SearchFilter from '$lib/components/drawers/filters/SearchFilter.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	// Generic feature type that can be either StoredFeature or enhanced search results
	type GenericFeature = StoredFeature | TableFeature;

	// Props
	let {
		features,
		bookmarkLists = [],
		searchQuery = $bindable(''),
		selectedListIds = $bindable([]),
		selectedTypes = $bindable([]),
		selectedClasses = $bindable([]),
		selectedSubclasses = $bindable([]),
		selectedCategories = $bindable([]),
		expanded = $bindable(false),
		showTypeFilters = true,
		showListFilters = true,
		showClassFilters = true,
		showSubclassFilters = true,
		showCategoryFilters = true,
		showSearchFilter = true,
		showClearAllButton = true,
		// Optional counter display
		filteredCount = undefined,
		totalCount = undefined,
		// Optional custom handlers for search results
		customAvailableTypes = undefined,
		customAvailableLists = undefined
	}: {
		features: GenericFeature[];
		bookmarkLists?: BookmarkList[];
		searchQuery?: string;
		selectedListIds?: string[];
		selectedTypes?: string[];
		selectedClasses?: string[];
		selectedSubclasses?: string[];
		selectedCategories?: string[];
		expanded?: boolean;
		showTypeFilters?: boolean;
		showListFilters?: boolean;
		showClassFilters?: boolean;
		showSubclassFilters?: boolean;
		showCategoryFilters?: boolean;
		showSearchFilter?: boolean;
		showClearAllButton?: boolean;
		// Optional counter display
		filteredCount?: number;
		totalCount?: number;
		// Custom handlers for different feature types
		customAvailableTypes?: string[];
		customAvailableLists?: { id: string; name: string; color: string }[];
	} = $props();

	// Check if a feature is a StoredFeature
	function isStoredFeature(feature: GenericFeature): feature is StoredFeature {
		return 'bookmarked' in feature && 'todo' in feature && 'visitedDates' in feature;
	}

	// Check if a feature is a TableFeature (enhanced search result)
	function isTableFeature(feature: GenericFeature): feature is TableFeature {
		return 'types' in feature && 'lists' in feature;
	}

	// Available filter options
	let availableTypes = $derived.by(() => {
		if (customAvailableTypes) {
			return customAvailableTypes;
		}

		const types = new Set<string>();
		features.forEach((feature) => {
			if (isStoredFeature(feature)) {
				// Handle StoredFeature
				if (feature.bookmarked) types.add('bookmarked');
				if (feature.todo) types.add('todo');
				if (feature.visitedDates && feature.visitedDates.length > 0) types.add('visited');
			} else if (isTableFeature(feature)) {
				// Handle TableFeature (enhanced search result)
				if (feature.types) {
					feature.types.forEach((type) => types.add(type));
				}
				if (!feature.types || feature.types.length === 0) {
					types.add('none');
				}
			}
		});
		return Array.from(types).sort((a, b) => {
			// Sort order: bookmarked, todo, visited, none
			const order: Record<string, number> = { bookmarked: 0, todo: 1, visited: 2, none: 3 };
			return (order[a] ?? 99) - (order[b] ?? 99);
		});
	});

	let availableLists = $derived.by(() => {
		if (customAvailableLists) {
			return customAvailableLists;
		}

		// Get lists that actually have features
		const listsWithFeatures = new Set<string>();
		features.forEach((feature) => {
			if (isStoredFeature(feature)) {
				// Handle StoredFeature
				feature.listIds.forEach((listId) => listsWithFeatures.add(listId));
			} else if (isTableFeature(feature)) {
				// Handle TableFeature (enhanced search result)
				if (feature.lists) {
					feature.lists.forEach((list) => listsWithFeatures.add(list.id));
				}
			}
		});

		if (features.length === 0) {
			return [];
		}

		if (isStoredFeature(features[0])) {
			// For StoredFeatures, use bookmarkLists
			return bookmarkLists.filter((list) => listsWithFeatures.has(list.id));
		} else {
			// For TableFeatures, extract from the features themselves
			const listMap = new Map<string, { name: string; color: string }>();
			features.forEach((feature) => {
				if (isTableFeature(feature) && feature.lists) {
					feature.lists.forEach((list) => {
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
		}
	});

	let availableClasses = $derived.by(() => {
		const classes = new Set<string>();
		features.forEach((feature) => {
			if (feature.class && feature.class.trim()) {
				classes.add(feature.class);
			}
		});
		return Array.from(classes).sort();
	});

	let availableSubclasses = $derived.by(() => {
		const subclasses = new Set<string>();
		features.forEach((feature) => {
			if (feature.subclass && feature.subclass.trim()) {
				subclasses.add(feature.subclass);
			}
		});
		return Array.from(subclasses).sort();
	});

	let availableCategories = $derived.by(() => {
		const categories = new Set<string>();
		features.forEach((feature) => {
			if (feature.category && feature.category.trim()) {
				categories.add(feature.category);
			}
		});
		return Array.from(categories).sort();
	});

	// Check if any filters are active
	let hasActiveFilters = $derived(() => {
		return (
			searchQuery.trim() !== '' ||
			selectedListIds.length > 0 ||
			selectedTypes.length > 0 ||
			selectedClasses.length > 0 ||
			selectedSubclasses.length > 0 ||
			selectedCategories.length > 0
		);
	});

	// Toggle expanded state
	function toggleExpanded() {
		expanded = !expanded;
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

	// Get count for a filter
	function getFilterCount(
		type: 'type' | 'list' | 'class' | 'subclass' | 'category',
		value: string
	): number {
		if (type === 'type') {
			return features.filter((f) => {
				if (isStoredFeature(f)) {
					// Handle StoredFeature
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
				} else if (isTableFeature(f)) {
					// Handle TableFeature
					if (value === 'none') {
						return !f.types || f.types.length === 0;
					} else {
						return f.types && f.types.includes(value as any);
					}
				}
				return false;
			}).length;
		} else if (type === 'list') {
			return features.filter((f) => {
				if (isStoredFeature(f)) {
					return f.listIds.includes(value);
				} else if (isTableFeature(f)) {
					return f.lists && f.lists.some((list) => list.id === value);
				}
				return false;
			}).length;
		} else if (type === 'class') {
			return features.filter((f) => f.class === value).length;
		} else if (type === 'subclass') {
			return features.filter((f) => f.subclass === value).length;
		} else if (type === 'category') {
			return features.filter((f) => f.category === value).length;
		}
		return 0;
	}
</script>

<div class="mb-3 rounded-lg border border-gray-200 bg-gray-50">
	<!-- Filters Header -->
	<div class="flex items-center justify-between px-3 py-2">
		<button
			onclick={toggleExpanded}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					toggleExpanded();
				}
			}}
			class="flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
			tabindex="0"
			aria-expanded={expanded}
			aria-controls="filters-content"
		>
			<PropertyIcon key="description" value="filter" size={16} />
			<span class="font-medium text-gray-900">Filters</span>
			{#if hasActiveFilters()}
				<span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">Active</span>
			{/if}
			{#if filteredCount !== undefined && totalCount !== undefined}
				<span class="text-sm text-gray-600">
					{hasActiveFilters() ? `${filteredCount} of ${totalCount}` : `${totalCount}`} features
				</span>
			{/if}
			<PropertyIcon
				key="description"
				value={expanded ? 'chevron_up' : 'chevron_down'}
				size={16}
				class="ml-1 text-gray-400 transition-transform duration-200"
			/>
		</button>

		{#if showClearAllButton && hasActiveFilters()}
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
	{#if expanded}
		<div
			id="filters-content"
			class="filters-scrollable max-h-48 space-y-3 overflow-y-auto px-3 pb-3"
		>
			<!-- Search Filter -->
			{#if showSearchFilter}
				<SearchFilter bind:searchQuery />
			{/if}

			<!-- Type Filters -->
			{#if showTypeFilters && availableTypes.length > 0}
				<TypeFilters {availableTypes} bind:selectedTypes {getFilterCount} />
			{/if}

			<!-- List Filters -->
			{#if showListFilters && availableLists.length > 0}
				<ListFilters {availableLists} bind:selectedListIds {getFilterCount} />
			{/if}

			<!-- Class Filters -->
			{#if showClassFilters && availableClasses.length > 0}
				<ClassFilters {availableClasses} bind:selectedClasses {getFilterCount} />
			{/if}

			<!-- Subclass Filters -->
			{#if showSubclassFilters && availableSubclasses.length > 0}
				<SubclassFilters {availableSubclasses} bind:selectedSubclasses {getFilterCount} />
			{/if}

			<!-- Category Filters -->
			{#if showCategoryFilters && availableCategories.length > 0}
				<CategoryFilters {availableCategories} bind:selectedCategories {getFilterCount} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.filters-scrollable {
		scrollbar-width: thin;
		scrollbar-color: #9ca3af #f3f4f6;
	}

	.filters-scrollable::-webkit-scrollbar {
		width: 8px;
	}

	.filters-scrollable::-webkit-scrollbar-track {
		background: #f3f4f6;
		border-radius: 4px;
	}

	.filters-scrollable::-webkit-scrollbar-thumb {
		background: #9ca3af;
		border-radius: 4px;
	}

	.filters-scrollable::-webkit-scrollbar-thumb:hover {
		background: #6b7280;
	}
</style>
