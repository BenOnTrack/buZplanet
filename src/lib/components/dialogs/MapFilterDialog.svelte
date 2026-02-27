<script lang="ts">
	import { Dialog, Tabs } from 'bits-ui';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import CategoryManager from '$lib/components/categories/CategoryManager.svelte';
	import FilteredCategoryManager from '$lib/components/categories/FilteredCategoryManager.svelte';
	import RouteFilterSettings from '$lib/components/dialogs/RouteFilterSettings.svelte';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import { appState } from '$lib/stores/AppState.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { _CATEGORY } from '$lib/assets/class_subclass_category';

	let activeTab = $state('map');
	let dialogOpen = $state(false); // Control dialog open state

	// Search states for each tab
	let mapSearchQuery = $state('');
	let heatSearchQuery = $state('');
	let storedSearchQuery = $state('');
	let routeSearchQuery = $state('');

	// AppState is initialized by default in constructor, no need for manual initialization

	// Filter categories based on search queries
	function getFilteredCategories(searchQuery: string) {
		if (!searchQuery.trim()) {
			return _CATEGORY;
		}

		const query = searchQuery.toLowerCase().trim();
		return _CATEGORY.filter((category) => {
			// Get the category display name (final part)
			const categoryName =
				category.split('-')[2] || category.split('-')[category.split('-').length - 1];
			const displayName = categoryName.replace(/_/g, ' ').toLowerCase();

			// Also check the full category string and individual parts
			const fullCategory = category.toLowerCase();
			const parts = category.split('-').map((part) => part.replace(/_/g, ' ').toLowerCase());

			return (
				displayName.includes(query) ||
				fullCategory.includes(query) ||
				parts.some((part) => part.includes(query))
			);
		});
	}

	let mapFilteredCategories = $derived.by(() => getFilteredCategories(mapSearchQuery));
	let heatFilteredCategories = $derived.by(() => getFilteredCategories(heatSearchQuery));
	let storedFilteredCategories = $derived.by(() => getFilteredCategories(storedSearchQuery));

	// Filter routes based on search query
	function getFilteredRoutes(searchQuery: string) {
		if (!appState.initialized) return [];
		const routes = appState.relationSettings.childRoute; // Now RouteInfo[] instead of string[]

		if (!searchQuery.trim()) {
			return routes;
		}

		const query = searchQuery.toLowerCase().trim();
		return routes.filter((route) => {
			// Search in route ID
			if (route.id.toLowerCase().includes(query)) {
				return true;
			}

			// Search in route names
			for (const name of Object.values(route.names)) {
				if (typeof name === 'string' && name.toLowerCase().includes(query)) {
					return true;
				}
			}

			// Search in classification
			if (route.class && route.class.toLowerCase().includes(query)) {
				return true;
			}
			if (route.subclass && route.subclass.toLowerCase().includes(query)) {
				return true;
			}
			if (route.category && route.category.toLowerCase().includes(query)) {
				return true;
			}

			return false;
		});
	}

	let filteredRoutes = $derived.by(() => getFilteredRoutes(routeSearchQuery));
	// Reactive getters for all filter settings as arrays for binding
	let mapCategoriesArray = $derived(() => {
		if (!appState.initialized) return [];
		return Array.from(appState.filterSettings.map.categories);
	});

	let heatCategoriesArray = $derived(() => {
		if (!appState.initialized) return [];
		return Array.from(appState.filterSettings.heat.categories);
	});

	let storedCategoriesArray = $derived(() => {
		if (!appState.initialized) return [];
		return Array.from(appState.filterSettings.stored.categories);
	});

	// Helper functions for filtered selections
	function selectAllFilteredCategories(
		searchQuery: string,
		handler: (categories: string[]) => void,
		selectedCategories: string[]
	) {
		if (!searchQuery.trim()) {
			handler([..._CATEGORY]);
			return;
		}

		const filteredCategories = getFilteredCategories(searchQuery);
		const newCategories = [...selectedCategories];
		filteredCategories.forEach((category) => {
			if (!newCategories.includes(category)) {
				newCategories.push(category);
			}
		});
		handler(newCategories);
	}

	function clearAllFilteredCategories(
		searchQuery: string,
		handler: (categories: string[]) => void,
		selectedCategories: string[]
	) {
		if (!searchQuery.trim()) {
			handler([]);
			return;
		}

		const filteredCategories = getFilteredCategories(searchQuery);
		const newCategories = selectedCategories.filter(
			(category) => !filteredCategories.includes(category)
		);
		handler(newCategories);
	}

	// Filter change handlers for each tab
	function handleMapCategoryChange(categories: string[]) {
		console.log('Map filter selection changed:', categories);
		console.log('Before update - AppState mapFilterSettings:', appState.mapFilterSettings);
		appState.updateMapFilterSettings({ categories: new Set(categories) });
		console.log('After update - AppState mapFilterSettings:', appState.mapFilterSettings);
		console.log('After update - AppState config:', appState.config);
	}

	function handleHeatCategoryChange(categories: string[]) {
		console.log('Heat filter selection changed:', categories);
		appState.updateFilterSettings('heat', { categories: new Set(categories) });
	}

	function handleStoredCategoryChange(categories: string[]) {
		console.log('Stored filter selection changed:', categories);
		appState.updateFilterSettings('stored', { categories: new Set(categories) });
	}
</script>

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Trigger
		class="bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background fixed top-46 left-4 inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
		style="z-index: {Z_INDEX.DIALOG_TRIGGER}"
		onclick={(e) => {
			// Handle click
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.currentTarget.click();
			}
		}}
		aria-label="Open filter dialog"
	>
		<PropertyIcon key={'description'} value={'filter'} size={20} />
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/80"
			style="z-index: {Z_INDEX.DIALOG_OVERLAY}"
		/>
		<Dialog.Content
			class="rounded-card-lg bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] border p-5 outline-hidden sm:max-w-[490px] md:w-full"
			style="z-index: {Z_INDEX.DIALOG_CONTENT}"
		>
			<Dialog.Title
				class="flex w-full items-center justify-center text-lg font-semibold tracking-tight"
			>
				Layer Filters
			</Dialog.Title>

			<div class="pt-6">
				<Tabs.Root
					bind:value={activeTab}
					class="rounded-card border-muted bg-background-alt shadow-card w-full border p-3"
				>
					<Tabs.List
						class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full grid-cols-4 gap-1 p-1 text-sm leading-[0.01em] font-semibold dark:border dark:border-neutral-600/30"
					>
						<Tabs.Trigger
							value="map"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
						>
							<PropertyIcon key={'description'} value={'map-pin'} size={14} />
							Map
						</Tabs.Trigger>
						<Tabs.Trigger
							value="heat"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
						>
							<PropertyIcon key={'description'} value={'thermometer'} size={14} />
							Heat
						</Tabs.Trigger>
						<Tabs.Trigger
							value="stored"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
						>
							<PropertyIcon key={'description'} value={'bookmark'} size={14} />
							Stored
						</Tabs.Trigger>
						<Tabs.Trigger
							value="route"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
						>
							<PropertyIcon key={'description'} value={'map-trifold'} size={14} />
							Route
						</Tabs.Trigger>
					</Tabs.List>

					<div class="mt-4">
						<Tabs.Content value="map" class="space-y-4 pt-3">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<h3 class="text-sm font-medium">Map Category Filters</h3>
									<p class="text-sm text-gray-600">
										{mapCategoriesArray().length} of {_CATEGORY.length} categories selected
										{#if mapSearchQuery.trim()}
											({mapCategoriesArray().filter((cat) => mapFilteredCategories.includes(cat))
												.length} of {mapFilteredCategories.length} shown)
										{/if}
									</p>
								</div>

								<!-- Select All/None buttons -->
								<div class="mb-4 flex flex-wrap gap-2">
									<!-- Always show Select All and Clear All -->
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleMapCategoryChange([..._CATEGORY])}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleMapCategoryChange([..._CATEGORY]);
											}
										}}
										title="Select all {_CATEGORY.length} categories"
									>
										Select All
									</button>
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleMapCategoryChange([])}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleMapCategoryChange([]);
											}
										}}
										title="Clear all selected categories"
									>
										Clear All
									</button>

									<!-- Show filtered buttons when search is active -->
									{#if mapSearchQuery.trim()}
										<button
											type="button"
											class="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
											onclick={() =>
												selectAllFilteredCategories(
													mapSearchQuery,
													handleMapCategoryChange,
													mapCategoriesArray()
												)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													selectAllFilteredCategories(
														mapSearchQuery,
														handleMapCategoryChange,
														mapCategoriesArray()
													);
												}
											}}
											title="Select all {mapFilteredCategories.length} filtered categories"
										>
											Select Filtered ({mapFilteredCategories.length})
										</button>
										<button
											type="button"
											class="rounded-md border border-orange-300 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-100 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
											onclick={() =>
												clearAllFilteredCategories(
													mapSearchQuery,
													handleMapCategoryChange,
													mapCategoriesArray()
												)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													clearAllFilteredCategories(
														mapSearchQuery,
														handleMapCategoryChange,
														mapCategoriesArray()
													);
												}
											}}
											title="Clear {mapCategoriesArray().filter((cat) =>
												mapFilteredCategories.includes(cat)
											).length} filtered selected categories"
										>
											Clear Filtered ({mapCategoriesArray().filter((cat) =>
												mapFilteredCategories.includes(cat)
											).length})
										</button>
									{/if}
								</div>

								<!-- Search bar -->
								<div class="mb-4">
									<div class="relative">
										<div
											class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
										>
											<MagnifyingGlass size={16} class="text-gray-400" />
										</div>
										<input
											type="text"
											bind:value={mapSearchQuery}
											class="block w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-10 text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
											placeholder="Search map categories..."
											aria-label="Search map categories"
										/>
										{#if mapSearchQuery.trim()}
											<button
												type="button"
												class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
												onclick={() => (mapSearchQuery = '')}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														mapSearchQuery = '';
													}
												}}
												aria-label="Clear search"
											>
												<PropertyIcon key="description" value="x" size={16} />
											</button>
										{/if}
									</div>
									{#if mapSearchQuery.trim() && mapFilteredCategories.length === 0}
										<p class="mt-2 text-center text-sm text-gray-500">
											No categories match "{mapSearchQuery}"
										</p>
									{:else if mapSearchQuery.trim()}
										<p class="mt-2 text-center text-sm text-gray-500">
											Showing {mapFilteredCategories.length} of {_CATEGORY.length} categories
										</p>
									{/if}
								</div>

								<!-- Scrollable categories -->
								<div class="max-h-80 overflow-y-auto">
									{#if mapFilteredCategories.length > 0}
										<FilteredCategoryManager
											categories={mapFilteredCategories}
											selectedCategories={mapCategoriesArray()}
											onChange={handleMapCategoryChange}
											showGroups={true}
										/>
									{:else if mapSearchQuery.trim()}
										<div class="flex items-center justify-center py-8 text-gray-500">
											<div class="text-center">
												<MagnifyingGlass size={32} class="mx-auto mb-2 text-gray-300" />
												<p class="text-sm">No categories found</p>
												<p class="text-xs text-gray-400">Try a different search term</p>
											</div>
										</div>
									{:else}
										<CategoryManager
											selectedCategories={mapCategoriesArray()}
											onChange={handleMapCategoryChange}
											title=""
											showGroups={true}
										/>
									{/if}
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="heat" class="space-y-4 pt-3">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<h3 class="text-sm font-medium">Heat Map Category Filters</h3>
									<p class="text-sm text-gray-600">
										{heatCategoriesArray().length} of {_CATEGORY.length} categories selected
										{#if heatSearchQuery.trim()}
											({heatCategoriesArray().filter((cat) => heatFilteredCategories.includes(cat))
												.length} of {heatFilteredCategories.length} shown)
										{/if}
									</p>
								</div>

								<!-- Select All/None buttons -->
								<div class="mb-4 flex flex-wrap gap-2">
									<!-- Always show Select All and Clear All -->
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleHeatCategoryChange([..._CATEGORY])}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleHeatCategoryChange([..._CATEGORY]);
											}
										}}
										title="Select all {_CATEGORY.length} categories"
									>
										Select All
									</button>
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleHeatCategoryChange([])}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleHeatCategoryChange([]);
											}
										}}
										title="Clear all selected categories"
									>
										Clear All
									</button>

									<!-- Show filtered buttons when search is active -->
									{#if heatSearchQuery.trim()}
										<button
											type="button"
											class="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
											onclick={() =>
												selectAllFilteredCategories(
													heatSearchQuery,
													handleHeatCategoryChange,
													heatCategoriesArray()
												)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													selectAllFilteredCategories(
														heatSearchQuery,
														handleHeatCategoryChange,
														heatCategoriesArray()
													);
												}
											}}
											title="Select all {heatFilteredCategories.length} filtered categories"
										>
											Select Filtered ({heatFilteredCategories.length})
										</button>
										<button
											type="button"
											class="rounded-md border border-orange-300 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-100 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
											onclick={() =>
												clearAllFilteredCategories(
													heatSearchQuery,
													handleHeatCategoryChange,
													heatCategoriesArray()
												)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													clearAllFilteredCategories(
														heatSearchQuery,
														handleHeatCategoryChange,
														heatCategoriesArray()
													);
												}
											}}
											title="Clear {heatCategoriesArray().filter((cat) =>
												heatFilteredCategories.includes(cat)
											).length} filtered selected categories"
										>
											Clear Filtered ({heatCategoriesArray().filter((cat) =>
												heatFilteredCategories.includes(cat)
											).length})
										</button>
									{/if}
								</div>

								<!-- Search bar -->
								<div class="mb-4">
									<div class="relative">
										<div
											class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
										>
											<MagnifyingGlass size={16} class="text-gray-400" />
										</div>
										<input
											type="text"
											bind:value={heatSearchQuery}
											class="block w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-10 text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
											placeholder="Search heat map categories..."
											aria-label="Search heat map categories"
										/>
										{#if heatSearchQuery.trim()}
											<button
												type="button"
												class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
												onclick={() => (heatSearchQuery = '')}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														heatSearchQuery = '';
													}
												}}
												aria-label="Clear search"
											>
												<PropertyIcon key="description" value="x" size={16} />
											</button>
										{/if}
									</div>
									{#if heatSearchQuery.trim() && heatFilteredCategories.length === 0}
										<p class="mt-2 text-center text-sm text-gray-500">
											No categories match "{heatSearchQuery}"
										</p>
									{:else if heatSearchQuery.trim()}
										<p class="mt-2 text-center text-sm text-gray-500">
											Showing {heatFilteredCategories.length} of {_CATEGORY.length} categories
										</p>
									{/if}
								</div>

								<!-- Scrollable categories -->
								<div class="max-h-80 overflow-y-auto">
									{#if heatFilteredCategories.length > 0}
										<FilteredCategoryManager
											categories={heatFilteredCategories}
											selectedCategories={heatCategoriesArray()}
											onChange={handleHeatCategoryChange}
											showGroups={true}
										/>
									{:else if heatSearchQuery.trim()}
										<div class="flex items-center justify-center py-8 text-gray-500">
											<div class="text-center">
												<MagnifyingGlass size={32} class="mx-auto mb-2 text-gray-300" />
												<p class="text-sm">No categories found</p>
												<p class="text-xs text-gray-400">Try a different search term</p>
											</div>
										</div>
									{:else}
										<CategoryManager
											selectedCategories={heatCategoriesArray()}
											onChange={handleHeatCategoryChange}
											title=""
											showGroups={true}
										/>
									{/if}
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="stored" class="space-y-4 pt-3">
							<div class="space-y-2">
								<div class="flex items-center justify-between">
									<h3 class="text-sm font-medium">Stored Features Category Filters</h3>
									<p class="text-sm text-gray-600">
										{storedCategoriesArray().length} of {_CATEGORY.length} categories selected
										{#if storedSearchQuery.trim()}
											({storedCategoriesArray().filter((cat) =>
												storedFilteredCategories.includes(cat)
											).length} of {storedFilteredCategories.length} shown)
										{/if}
									</p>
								</div>

								<!-- Select All/None buttons -->
								<div class="mb-4 flex flex-wrap gap-2">
									<!-- Always show Select All and Clear All -->
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleStoredCategoryChange([..._CATEGORY])}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleStoredCategoryChange([..._CATEGORY]);
											}
										}}
										title="Select all {_CATEGORY.length} categories"
									>
										Select All
									</button>
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleStoredCategoryChange([])}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												handleStoredCategoryChange([]);
											}
										}}
										title="Clear all selected categories"
									>
										Clear All
									</button>

									<!-- Show filtered buttons when search is active -->
									{#if storedSearchQuery.trim()}
										<button
											type="button"
											class="rounded-md border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
											onclick={() =>
												selectAllFilteredCategories(
													storedSearchQuery,
													handleStoredCategoryChange,
													storedCategoriesArray()
												)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													selectAllFilteredCategories(
														storedSearchQuery,
														handleStoredCategoryChange,
														storedCategoriesArray()
													);
												}
											}}
											title="Select all {storedFilteredCategories.length} filtered categories"
										>
											Select Filtered ({storedFilteredCategories.length})
										</button>
										<button
											type="button"
											class="rounded-md border border-orange-300 bg-orange-50 px-3 py-1 text-sm font-medium text-orange-700 hover:bg-orange-100 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
											onclick={() =>
												clearAllFilteredCategories(
													storedSearchQuery,
													handleStoredCategoryChange,
													storedCategoriesArray()
												)}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													clearAllFilteredCategories(
														storedSearchQuery,
														handleStoredCategoryChange,
														storedCategoriesArray()
													);
												}
											}}
											title="Clear {storedCategoriesArray().filter((cat) =>
												storedFilteredCategories.includes(cat)
											).length} filtered selected categories"
										>
											Clear Filtered ({storedCategoriesArray().filter((cat) =>
												storedFilteredCategories.includes(cat)
											).length})
										</button>
									{/if}
								</div>

								<!-- Search bar -->
								<div class="mb-4">
									<div class="relative">
										<div
											class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3"
										>
											<MagnifyingGlass size={16} class="text-gray-400" />
										</div>
										<input
											type="text"
											bind:value={storedSearchQuery}
											class="block w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-10 text-sm placeholder-gray-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
											placeholder="Search stored feature categories..."
											aria-label="Search stored feature categories"
										/>
										{#if storedSearchQuery.trim()}
											<button
												type="button"
												class="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
												onclick={() => (storedSearchQuery = '')}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														storedSearchQuery = '';
													}
												}}
												aria-label="Clear search"
											>
												<PropertyIcon key="description" value="x" size={16} />
											</button>
										{/if}
									</div>
									{#if storedSearchQuery.trim() && storedFilteredCategories.length === 0}
										<p class="mt-2 text-center text-sm text-gray-500">
											No categories match "{storedSearchQuery}"
										</p>
									{:else if storedSearchQuery.trim()}
										<p class="mt-2 text-center text-sm text-gray-500">
											Showing {storedFilteredCategories.length} of {_CATEGORY.length} categories
										</p>
									{/if}
								</div>

								<!-- Scrollable categories -->
								<div class="max-h-80 overflow-y-auto">
									{#if storedFilteredCategories.length > 0}
										<FilteredCategoryManager
											categories={storedFilteredCategories}
											selectedCategories={storedCategoriesArray()}
											onChange={handleStoredCategoryChange}
											showGroups={true}
										/>
									{:else if storedSearchQuery.trim()}
										<div class="flex items-center justify-center py-8 text-gray-500">
											<div class="text-center">
												<MagnifyingGlass size={32} class="mx-auto mb-2 text-gray-300" />
												<p class="text-sm">No categories found</p>
												<p class="text-xs text-gray-400">Try a different search term</p>
											</div>
										</div>
									{:else}
										<CategoryManager
											selectedCategories={storedCategoriesArray()}
											onChange={handleStoredCategoryChange}
											title=""
											showGroups={true}
										/>
									{/if}
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="route" class="space-y-4 pt-3">
							<RouteFilterSettings
								bind:searchQuery={routeSearchQuery}
								{filteredRoutes}
								onRouteNavigated={() => {
									// Close dialog when user navigates to a route
									dialogOpen = false;
								}}
							/>
						</Tabs.Content>
					</div>
				</Tabs.Root>
			</div>

			<Dialog.Close
				class="focus-visible:ring-foreground focus-visible:ring-offset-background absolute top-5 right-5 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
			>
				<div>
					<PropertyIcon key={'description'} value={'x'} size={20} class="text-foreground" />
					<span class="sr-only">Close</span>
				</div>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
