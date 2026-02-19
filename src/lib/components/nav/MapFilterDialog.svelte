<script lang="ts">
	import { Dialog, Tabs } from 'bits-ui';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import CategoryFilter from './CategoryFilter.svelte';
	import { appState } from '$lib/stores/AppState.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';

	let activeTab = $state('map');

	// Get filter settings from AppState and ensure initialization
	$effect(() => {
		appState.ensureInitialized();
		console.log('AppState initialized:', appState.initialized);
		console.log('AppState config:', appState.config);
		console.log('AppState filterSettings:', appState.filterSettings);
	});

	// Reactive getters for all filter settings
	const mapFilterSettings = $derived(() => {
		if (!appState.initialized)
			return {
				classes: new Set<string>(),
				subclasses: new Set<string>(),
				categories: new Set<string>()
			};
		return appState.filterSettings.map;
	});

	const heatFilterSettings = $derived(() => {
		if (!appState.initialized)
			return {
				classes: new Set<string>(),
				subclasses: new Set<string>(),
				categories: new Set<string>()
			};
		return appState.filterSettings.heat;
	});

	const bookmarkFilterSettings = $derived(() => {
		if (!appState.initialized)
			return {
				classes: new Set<string>(),
				subclasses: new Set<string>(),
				categories: new Set<string>()
			};
		return appState.filterSettings.bookmark;
	});

	const todoFilterSettings = $derived(() => {
		if (!appState.initialized)
			return {
				classes: new Set<string>(),
				subclasses: new Set<string>(),
				categories: new Set<string>()
			};
		return appState.filterSettings.todo;
	});

	const visitedFilterSettings = $derived(() => {
		if (!appState.initialized)
			return {
				classes: new Set<string>(),
				subclasses: new Set<string>(),
				categories: new Set<string>()
			};
		return appState.filterSettings.visited;
	});

	// Filter change handlers for each tab
	function handleMapCategoryChange(selection: {
		classes: Set<string>;
		subclasses: Set<string>;
		categories: Set<string>;
	}) {
		console.log('Map filter selection changed:', selection);
		console.log('Before update - AppState mapFilterSettings:', appState.mapFilterSettings);
		appState.updateMapFilterSettings(selection);
		console.log('After update - AppState mapFilterSettings:', appState.mapFilterSettings);
		console.log('After update - AppState config:', appState.config);
	}

	function handleHeatCategoryChange(selection: {
		classes: Set<string>;
		subclasses: Set<string>;
		categories: Set<string>;
	}) {
		console.log('Heat filter selection changed:', selection);
		appState.updateFilterSettings('heat', selection);
	}

	function handleBookmarkCategoryChange(selection: {
		classes: Set<string>;
		subclasses: Set<string>;
		categories: Set<string>;
	}) {
		console.log('Bookmark filter selection changed:', selection);
		appState.updateFilterSettings('bookmark', selection);
	}

	function handleTodoCategoryChange(selection: {
		classes: Set<string>;
		subclasses: Set<string>;
		categories: Set<string>;
	}) {
		console.log('Todo filter selection changed:', selection);
		appState.updateFilterSettings('todo', selection);
	}

	function handleVisitedCategoryChange(selection: {
		classes: Set<string>;
		subclasses: Set<string>;
		categories: Set<string>;
	}) {
		console.log('Visited filter selection changed:', selection);
		appState.updateFilterSettings('visited', selection);
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
								<h3 class="text-sm font-medium">Category Filters</h3>
								<CategoryFilter
									selectedItems={mapFilterSettings()}
									onSelectionChange={handleMapCategoryChange}
								/>
							</div>
						</Tabs.Content>

						<Tabs.Content value="heat" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Heat Map Filters</h3>
								<CategoryFilter
									selectedItems={heatFilterSettings()}
									onSelectionChange={handleHeatCategoryChange}
								/>
							</div>
						</Tabs.Content>

						<Tabs.Content value="bookmark" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Bookmark Filters</h3>
								<CategoryFilter
									selectedItems={bookmarkFilterSettings()}
									onSelectionChange={handleBookmarkCategoryChange}
								/>
							</div>
						</Tabs.Content>

						<Tabs.Content value="todo" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Todo Filters</h3>
								<CategoryFilter
									selectedItems={todoFilterSettings()}
									onSelectionChange={handleTodoCategoryChange}
								/>
							</div>
						</Tabs.Content>

						<Tabs.Content value="visited" class="space-y-4">
							<div class="space-y-2">
								<h3 class="text-sm font-medium">Visited Location Filters</h3>
								<CategoryFilter
									selectedItems={visitedFilterSettings()}
									onSelectionChange={handleVisitedCategoryChange}
								/>
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
