<script lang="ts">
	import TypeFilters from './TypeFilters.svelte';
	import ListFilters from './ListFilters.svelte';
	import ClassFilters from './ClassFilters.svelte';
	import SubclassFilters from './SubclassFilters.svelte';
	import CategoryFilters from './CategoryFilters.svelte';
	import SearchFilter from './SearchFilter.svelte';
	import FilterStats from './FilterStats.svelte';

	// Props
	let {
		features,
		bookmarkLists,
		searchQuery = $bindable(''),
		selectedListIds = $bindable([]),
		selectedTypes = $bindable([]),
		selectedClasses = $bindable([]),
		selectedSubclasses = $bindable([]),
		selectedCategories = $bindable([]),
		showTypeFilters = true,
		showListFilters = true,
		showClassFilters = true,
		showSubclassFilters = true,
		showCategoryFilters = true,
		showSearchFilter = true,
		showStats = true,
		showClearAllButton = true
	}: {
		features: StoredFeature[];
		bookmarkLists: BookmarkList[];
		searchQuery?: string;
		selectedListIds?: string[];
		selectedTypes?: string[];
		selectedClasses?: string[];
		selectedSubclasses?: string[];
		selectedCategories?: string[];
		showTypeFilters?: boolean;
		showListFilters?: boolean;
		showClassFilters?: boolean;
		showSubclassFilters?: boolean;
		showCategoryFilters?: boolean;
		showSearchFilter?: boolean;
		showStats?: boolean;
		showClearAllButton?: boolean;
	} = $props();

	// Available filter options
	let availableTypes = $derived.by(() => {
		const types = new Set<string>();
		features.forEach((feature) => {
			if (feature.bookmarked) types.add('bookmarked');
			if (feature.todo) types.add('todo');
			if (feature.visitedDates && feature.visitedDates.length > 0) types.add('visited');
		});
		return Array.from(types);
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
				switch (value) {
					case 'bookmarked':
						return f.bookmarked;
					case 'todo':
						return f.todo;
					case 'visited':
						return f.visitedDates && f.visitedDates.length > 0;
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
</script>

<div class="space-y-4">
	<!-- Filter Statistics and Clear Button -->
	{#if showStats || (showClearAllButton && hasActiveFilters())}
		<FilterStats
			{features}
			hasActiveFilters={hasActiveFilters()}
			{clearAllFilters}
			{showStats}
			{showClearAllButton}
		/>
	{/if}

	<!-- Type Filters -->
	{#if showTypeFilters && availableTypes.length > 0}
		<TypeFilters {availableTypes} {selectedTypes} {getFilterCount} />
	{/if}

	<!-- List Filters -->
	{#if showListFilters && availableLists.length > 0}
		<ListFilters {availableLists} {selectedListIds} {getFilterCount} />
	{/if}

	<!-- Class Filters -->
	{#if showClassFilters && availableClasses.length > 0}
		<ClassFilters {availableClasses} {selectedClasses} {getFilterCount} />
	{/if}

	<!-- Subclass Filters -->
	{#if showSubclassFilters && availableSubclasses.length > 0}
		<SubclassFilters {availableSubclasses} {selectedSubclasses} {getFilterCount} />
	{/if}

	<!-- Category Filters -->
	{#if showCategoryFilters && availableCategories.length > 0}
		<CategoryFilters {availableCategories} {selectedCategories} {getFilterCount} />
	{/if}

	<!-- Search Filter -->
	{#if showSearchFilter}
		<SearchFilter bind:searchQuery />
	{/if}
</div>
