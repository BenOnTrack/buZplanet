<script lang="ts">
	import { Dialog, Tabs } from 'bits-ui';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import CategoryManager from '$lib/components/categories/CategoryManager.svelte';
	import { appState } from '$lib/stores/AppState.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { _CATEGORY } from '$lib/assets/class_subclass_category';

	let activeTab = $state('map');

	// AppState is initialized by default in constructor, no need for manual initialization

	// Reactive getters for all filter settings as arrays for binding
	let mapCategoriesArray = $derived(() => {
		if (!appState.initialized) return [];
		return Array.from(appState.filterSettings.map.categories);
	});

	let heatCategoriesArray = $derived(() => {
		if (!appState.initialized) return [];
		return Array.from(appState.filterSettings.heat.categories);
	});

	let bookmarkCategoriesArray = $derived(() => {
		if (!appState.initialized) return [];
		return Array.from(appState.filterSettings.bookmark.categories);
	});

	let todoCategoriesArray = $derived(() => {
		if (!appState.initialized) return [];
		return Array.from(appState.filterSettings.todo.categories);
	});

	let visitedCategoriesArray = $derived(() => {
		if (!appState.initialized) return [];
		return Array.from(appState.filterSettings.visited.categories);
	});

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

	function handleBookmarkCategoryChange(categories: string[]) {
		console.log('Bookmark filter selection changed:', categories);
		appState.updateFilterSettings('bookmark', { categories: new Set(categories) });
	}

	function handleTodoCategoryChange(categories: string[]) {
		console.log('Todo filter selection changed:', categories);
		appState.updateFilterSettings('todo', { categories: new Set(categories) });
	}

	function handleVisitedCategoryChange(categories: string[]) {
		console.log('Visited filter selection changed:', categories);
		appState.updateFilterSettings('visited', { categories: new Set(categories) });
	}
</script>

<Dialog.Root>
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
				Map Filters
			</Dialog.Title>

			<div class="pt-6">
				<Tabs.Root bind:value={activeTab}>
					<Tabs.List class="bg-muted grid w-full grid-cols-5 rounded-md p-1">
						<Tabs.Trigger
							value="map"
							class="data-[state=active]:bg-background data-[state=active]:text-foreground ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm"
						>
							<PropertyIcon key={'description'} value={'map-pin'} size={16} class="mr-1" />
							Map
						</Tabs.Trigger>
						<Tabs.Trigger
							value="heat"
							class="data-[state=active]:bg-background data-[state=active]:text-foreground ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm"
						>
							<PropertyIcon key={'description'} value={'thermometer'} size={16} class="mr-1" />
							Heat
						</Tabs.Trigger>
						<Tabs.Trigger
							value="bookmark"
							class="data-[state=active]:bg-background data-[state=active]:text-foreground ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm"
						>
							<PropertyIcon key={'description'} value={'bookmark'} size={16} class="mr-1" />
							Bookmark
						</Tabs.Trigger>
						<Tabs.Trigger
							value="todo"
							class="data-[state=active]:bg-background data-[state=active]:text-foreground ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm"
						>
							<PropertyIcon key={'description'} value={'circle'} size={16} class="mr-1" />
							Todo
						</Tabs.Trigger>
						<Tabs.Trigger
							value="visited"
							class="data-[state=active]:bg-background data-[state=active]:text-foreground ring-offset-background focus-visible:ring-ring inline-flex items-center justify-center rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm"
						>
							<PropertyIcon key={'description'} value={'check'} size={16} class="mr-1" />
							Visited
						</Tabs.Trigger>
					</Tabs.List>

					<div class="mt-4">
						<Tabs.Content value="map" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Map Category Filters</h3>
								<p class="text-sm text-gray-600">
									{mapCategoriesArray().length} of {_CATEGORY.length} categories selected
								</p>
								<!-- Fixed Select All/None buttons -->
								<div class="mb-4 flex gap-2">
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleMapCategoryChange([..._CATEGORY])}
									>
										Select All
									</button>
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleMapCategoryChange([])}
									>
										Select None
									</button>
								</div>
								<!-- Scrollable categories -->
								<div class="max-h-80 overflow-y-auto">
									<CategoryManager
										selectedCategories={mapCategoriesArray()}
										onChange={handleMapCategoryChange}
										title=""
										showGroups={true}
									/>
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="heat" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Heat Map Category Filters</h3>
								<p class="text-sm text-gray-600">
									{heatCategoriesArray().length} of {_CATEGORY.length} categories selected
								</p>
								<!-- Fixed Select All/None buttons -->
								<div class="mb-4 flex gap-2">
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleHeatCategoryChange([..._CATEGORY])}
									>
										Select All
									</button>
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleHeatCategoryChange([])}
									>
										Select None
									</button>
								</div>
								<!-- Scrollable categories -->
								<div class="max-h-80 overflow-y-auto">
									<CategoryManager
										selectedCategories={heatCategoriesArray()}
										onChange={handleHeatCategoryChange}
										title=""
										showGroups={true}
									/>
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="bookmark" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Bookmark Category Filters</h3>
								<p class="text-sm text-gray-600">
									{bookmarkCategoriesArray().length} of {_CATEGORY.length} categories selected
								</p>
								<!-- Fixed Select All/None buttons -->
								<div class="mb-4 flex gap-2">
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleBookmarkCategoryChange([..._CATEGORY])}
									>
										Select All
									</button>
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleBookmarkCategoryChange([])}
									>
										Select None
									</button>
								</div>
								<!-- Scrollable categories -->
								<div class="max-h-80 overflow-y-auto">
									<CategoryManager
										selectedCategories={bookmarkCategoriesArray()}
										onChange={handleBookmarkCategoryChange}
										title=""
										showGroups={true}
									/>
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="todo" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Todo Category Filters</h3>
								<p class="text-sm text-gray-600">
									{todoCategoriesArray().length} of {_CATEGORY.length} categories selected
								</p>
								<!-- Fixed Select All/None buttons -->
								<div class="mb-4 flex gap-2">
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleTodoCategoryChange([..._CATEGORY])}
									>
										Select All
									</button>
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleTodoCategoryChange([])}
									>
										Select None
									</button>
								</div>
								<!-- Scrollable categories -->
								<div class="max-h-80 overflow-y-auto">
									<CategoryManager
										selectedCategories={todoCategoriesArray()}
										onChange={handleTodoCategoryChange}
										title=""
										showGroups={true}
									/>
								</div>
							</div>
						</Tabs.Content>

						<Tabs.Content value="visited" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Visited Location Category Filters</h3>
								<p class="text-sm text-gray-600">
									{visitedCategoriesArray().length} of {_CATEGORY.length} categories selected
								</p>
								<!-- Fixed Select All/None buttons -->
								<div class="mb-4 flex gap-2">
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleVisitedCategoryChange([..._CATEGORY])}
									>
										Select All
									</button>
									<button
										type="button"
										class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => handleVisitedCategoryChange([])}
									>
										Select None
									</button>
								</div>
								<!-- Scrollable categories -->
								<div class="max-h-80 overflow-y-auto">
									<CategoryManager
										selectedCategories={visitedCategoriesArray()}
										onChange={handleVisitedCategoryChange}
										title=""
										showGroups={true}
									/>
								</div>
							</div>
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
