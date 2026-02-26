<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { Tabs } from 'bits-ui';
	import { clsx } from 'clsx';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import StoriesList from '$lib/components/stories/StoriesList.svelte';
	import StoryViewer from '$lib/components/stories/StoryViewer.svelte';
	import StoryEditorDrawer from '$lib/components/drawers/StoryEditorDrawer.svelte';
	import {
		generateStoryConnectionPath,
		generateSequentialConnectionPath
	} from '$lib/utils/storyConnections';
	import FollowedStoryCategoryEditDialog from '$lib/components/dialogs/FollowedStoryCategoryEditDialog.svelte';
	import StoryCategoryManager from '$lib/components/stories/StoryCategoryManager.svelte';
	import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();

	// View state
	type ViewMode = 'list' | 'view' | 'edit';
	let viewMode = $state<ViewMode>('list');
	let currentStory = $state<Story | null>(null);

	// Tab state
	let activeTab = $state('stories');

	// Editor state
	let editorOpen = $state(false);
	let storyToEdit = $state<Story | null>(null);

	// Search and filter state
	let searchQuery = $state('');
	let selectedCategories = $state<string[]>([]);
	let availableCategories = $state<StoryCategory[]>([]);
	let filteredStoriesCount = $state<number | null>(null);

	// Load categories when drawer opens or when storiesDB changes
	$effect(() => {
		if (open) {
			// React to changes in storiesDB
			storiesDB.changeSignal;
			loadCategories();
		}
	});

	async function loadCategories() {
		try {
			availableCategories = await storiesDB.getAllCategories();
		} catch (error) {
			console.error('Failed to load categories:', error);
		}
	}

	// Check if current story is read-only (from a followed user)
	let isCurrentStoryReadOnly = $derived.by(() => {
		if (!currentStory) return false;
		return (currentStory as any).readOnly === true;
	});

	// Category edit dialog state for followed stories
	let categoryEditDialogOpen = $state(false);
	let storyToEditCategories = $state<Story | null>(null);

	// Category management state
	let categoryManagerError = $state<string | null>(null);

	// Confirmation dialog state
	let confirmDialogOpen = $state(false);
	let storyToDelete = $state<Story | null>(null);

	// Story connection state
	let storyConnectionVisible = $state(false);

	// Reset view when drawer closes - VALID SIDE EFFECT (external store mutation + state reset)
	$effect(() => {
		if (!open) {
			viewMode = 'list';
			currentStory = null;
			searchQuery = '';
			selectedCategories = [];
			activeTab = 'stories';
			storyConnectionVisible = false;
			// Clear any story connections when closing
			mapControl.clearStoryConnection();
			// Make sure to disable story insertion mode when closing stories drawer
			mapControl.setStoryInsertionMode(false);
		}
	});

	// Handle story selection from list
	function handleStorySelect(story: Story) {
		console.log('📜 Story selected:', story.id);
		currentStory = story;
		viewMode = 'view';
		console.log('📜 After story select, state:', { viewMode, currentStory: currentStory?.id });

		// Increment view count
		storiesDB.incrementViewCount(story.id).catch(console.error);
	}

	// Handle stories count update from StoriesList
	function handleStoriesCountUpdate(count: number) {
		filteredStoriesCount = count;
	}

	// Handle new story creation
	function handleNewStory() {
		storyToEdit = null;
		editorOpen = true;
	}

	// Handle story editing
	function handleEditStory(story: Story) {
		storyToEdit = story;
		editorOpen = true;
	}

	// Handle story save from editor
	function handleStorySave(story: Story) {
		console.log('✅ Story saved in drawer handler:', story.id);

		// If we were viewing the story, update it
		if (currentStory && currentStory.id === story.id) {
			currentStory = story;
		}

		// Close editor
		editorOpen = false;
		storyToEdit = null;

		// Note: StoriesList will automatically update due to reactive changeSignal in StoriesDB
		console.log('🔄 Story save handling complete - list should update automatically');
	}

	// Handle editor cancel
	function handleEditorCancel() {
		editorOpen = false;
		storyToEdit = null;
	}

	// Handle category editing for followed stories
	function handleEditFollowedStoryCategories(story: Story) {
		storyToEditCategories = story;
		categoryEditDialogOpen = true;
	}

	// Handle followed story category save
	function handleFollowedStoryCategorySave(updatedStory: Story) {
		console.log('✅ Followed story categories updated:', updatedStory.id);

		// If we were viewing this story, update it
		if (currentStory && currentStory.id === updatedStory.id) {
			currentStory = updatedStory;
		}

		// Close dialog
		categoryEditDialogOpen = false;
		storyToEditCategories = null;

		// Trigger UI update
		console.log('🔄 Followed story category update complete');
	}

	// Handle story deletion
	async function handleDeleteStory(story: Story) {
		// Show confirmation dialog
		storyToDelete = story;
		confirmDialogOpen = true;
	}

	// Perform the actual story deletion
	async function performStoryDeletion() {
		if (!storyToDelete) return;

		try {
			await storiesDB.deleteStory(storyToDelete.id);
			console.log(`✅ Successfully deleted story: ${storyToDelete.title}`);
			// Go back to list view
			backToList();
		} catch (error) {
			console.error('❌ Failed to delete story:', error);
			throw error; // Re-throw to prevent dialog from closing
		} finally {
			storyToDelete = null;
		}
	}

	// Handle story connection toggle
	function handleToggleStoryConnection() {
		if (!currentStory) return;

		if (storyConnectionVisible) {
			// Hide connections
			storyConnectionVisible = false;
			mapControl.clearStoryConnection();
			console.log('🔗 Story connections hidden');
		} else {
			// Show connections
			const connectionGeoJSON = generateStoryConnectionPath(currentStory);

			if (connectionGeoJSON.features.length > 0) {
				storyConnectionVisible = true;
				mapControl.setStoryConnection(connectionGeoJSON, true);
				console.log('🔗 Story connections displayed:', connectionGeoJSON);

				// Optionally zoom to fit all connections
				zoomToStoryConnections(connectionGeoJSON);
			} else {
				console.log('⚠️ No connections to display - story needs at least 2 features');
			}
		}
	}

	// Zoom map to fit story connections
	function zoomToStoryConnections(geoJSON: any) {
		const mapInstance = mapControl.getMapInstance();
		if (!mapInstance || geoJSON.features.length === 0) return;

		try {
			// Get coordinates from the LineString
			const feature = geoJSON.features[0];
			if (feature.geometry.type === 'LineString') {
				const coordinates = feature.geometry.coordinates as [number, number][];

				// Calculate bounds
				let minLng = Infinity,
					maxLng = -Infinity;
				let minLat = Infinity,
					maxLat = -Infinity;

				coordinates.forEach(([lng, lat]) => {
					if (lng < minLng) minLng = lng;
					if (lng > maxLng) maxLng = lng;
					if (lat < minLat) minLat = lat;
					if (lat > maxLat) maxLat = lat;
				});

				// Fit bounds with padding
				mapInstance.fitBounds(
					[
						[minLng, minLat],
						[maxLng, maxLat]
					],
					{
						padding: 100,
						duration: 1000,
						essential: true
					}
				);
			}
		} catch (error) {
			console.error('Failed to zoom to story connections:', error);
		}
	}
	function backToList() {
		console.log('⬅️ Back to list clicked, current state:', {
			viewMode,
			currentStory: currentStory?.id
		});
		// Clear any story connections when going back to list
		storyConnectionVisible = false;
		mapControl.clearStoryConnection();

		viewMode = 'list';
		currentStory = null;
		console.log('⬅️ After back to list, state:', { viewMode, currentStoryId: 'null' });
	}

	// Toggle category filter
	function toggleCategoryFilter(categoryId: string) {
		console.log('🏷️ Toggling category:', categoryId, 'Current selected:', selectedCategories);
		if (selectedCategories.includes(categoryId)) {
			selectedCategories = selectedCategories.filter((id) => id !== categoryId);
		} else {
			selectedCategories = [...selectedCategories, categoryId];
		}
		console.log('🏷️ After toggle, selected categories:', selectedCategories);
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		selectedCategories = [];
	}

	// Modern mobile keyboard detection using Visual Viewport API
	let isKeyboardOpen = $state(false);

	// Track viewport changes for mobile keyboard - industry standard approach
	$effect(() => {
		if (typeof window === 'undefined') return;

		// Use Visual Viewport API (modern standard) if available
		if (window.visualViewport) {
			function handleViewportChange() {
				// Standard calculation: keyboard open if visual viewport is significantly smaller
				const heightDifference =
					window.innerHeight - (window.visualViewport?.height ?? window.innerHeight);
				isKeyboardOpen = heightDifference > 150; // Industry standard threshold
			}

			window.visualViewport.addEventListener('resize', handleViewportChange);
			return () => window.visualViewport?.removeEventListener('resize', handleViewportChange);
		}

		// Fallback for older browsers
		let initialHeight = window.innerHeight;
		function handleResize() {
			const currentHeight = window.innerHeight;
			isKeyboardOpen = initialHeight - currentHeight > 150;
		}

		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	// Handle category changes from StoryCategoryManager
	function handleCategoriesChange(categories: StoryCategory[]) {
		availableCategories = categories;
		// Trigger reload of categories in stories list if needed
		loadCategories();
	}
</script>

<!-- Stories Drawer -->
<Drawer.Root bind:open modal={false}>
	<Drawer.Portal>
		<Drawer.Overlay
			class={clsx('fixed inset-0 bg-black/40 transition-opacity duration-300', {
				'keyboard-open': isKeyboardOpen
			})}
			style="z-index: {Z_INDEX.DRAWER_OVERLAY}"
		/>
		<Drawer.Content
			class={clsx(
				'story-viewer-drawer fixed right-0 bottom-0 left-0 flex h-[50vh] max-h-[50vh] flex-col rounded-t-[10px] border border-gray-200 bg-gray-100',
				{
					'keyboard-open': isKeyboardOpen
				}
			)}
			style="z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div class="mx-auto flex h-full w-full max-w-full flex-col overflow-hidden">
				<!-- Sticky Header Section -->
				<div class="flex-shrink-0 border-b border-gray-200 bg-gray-100 px-4 py-2">
					<!-- Header -->
					<div class="mb-2 flex items-center justify-between">
						<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
							<PropertyIcon key="description" value="stories" size={24} />
							{#if viewMode === 'view' && currentStory}
								{currentStory.title}
								{#if isCurrentStoryReadOnly}
									{@const authorName = (currentStory as any).authorName}
									{@const authorUsername = (currentStory as any).authorUsername}
									<span class="text-base font-normal text-blue-600">
										by {authorName}{authorUsername ? ` (@${authorUsername})` : ''}
									</span>
								{/if}
							{:else if activeTab === 'categories'}
								Manage Categories
							{:else}
								Stories
							{/if}
						</Drawer.Title>

						<div class="flex items-center gap-2">
							{#if viewMode === 'list' && activeTab === 'stories'}
								<button
									class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
									onclick={handleNewStory}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleNewStory();
										}
									}}
									title="Create new story"
									aria-label="Create new story"
								>
									NEW
								</button>
							{:else if currentStory}
								<!-- View connections button for any story view -->
								<button
									class="rounded px-3 py-1 text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none {storyConnectionVisible
										? 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500'
										: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500'}"
									onclick={handleToggleStoryConnection}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											handleToggleStoryConnection();
										}
									}}
									title={storyConnectionVisible
										? 'Hide feature connections'
										: 'View feature connections'}
									aria-label={storyConnectionVisible
										? 'Hide feature connections'
										: 'View feature connections'}
								>
									{storyConnectionVisible ? 'HIDE' : 'VIEW'}
								</button>

								{#if !isCurrentStoryReadOnly}
									<!-- Edit button for user's own stories -->
									<button
										class="rounded bg-blue-500 px-3 py-1 text-sm font-medium text-white hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => currentStory && handleEditStory(currentStory)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												currentStory && handleEditStory(currentStory);
											}
										}}
										title="Edit story"
										aria-label="Edit story"
									>
										EDIT
									</button>

									<!-- Delete button for user's own stories -->
									<button
										class="rounded bg-red-500 px-3 py-1 text-sm font-medium text-white hover:bg-red-600 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => currentStory && handleDeleteStory(currentStory)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												currentStory && handleDeleteStory(currentStory);
											}
										}}
										title="Delete story"
										aria-label="Delete story"
									>
										DELETE
									</button>
								{:else}
									<!-- Edit categories button for followed stories -->
									<button
										class="rounded bg-orange-500 px-3 py-1 text-sm font-medium text-white hover:bg-orange-600 focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => currentStory && handleEditFollowedStoryCategories(currentStory)}
										onkeydown={(e) => {
											if (e.key === 'Enter' || e.key === ' ') {
												e.preventDefault();
												currentStory && handleEditFollowedStoryCategories(currentStory);
											}
										}}
										title="Edit categories for this story"
										aria-label="Edit categories for this story"
									>
										EDIT
									</button>
								{/if}
							{/if}

							{#if currentStory}
								<!-- Back button for any story view -->
								<button
									class="rounded bg-gray-500 px-3 py-1 text-sm font-medium text-white hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
									onclick={backToList}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											backToList();
										}
									}}
									title="Back to stories list"
									aria-label="Back to stories list"
								>
									BACK
								</button>
							{/if}

							<Drawer.Close
								class="rounded-md p-1 text-gray-600 transition-colors hover:text-gray-800 focus:text-gray-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
							>
								<PropertyIcon key="description" value="x" size={20} class="text-foreground" />
								<span class="sr-only">Close</span>
							</Drawer.Close>
						</div>
					</div>

					<!-- Tabs -->
					{#if viewMode === 'list'}
						<div class="pb-2">
							<Tabs.Root
								bind:value={activeTab}
								class="rounded-card shadow-card w-full border border-gray-200 bg-gray-100 p-3"
							>
								<Tabs.List
									class="rounded-9px shadow-mini-inset grid w-full grid-cols-2 gap-1 border border-blue-400 bg-gray-300 p-1 text-sm leading-[0.01em] font-semibold"
								>
									<Tabs.Trigger
										value="stories"
										class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
									>
										<PropertyIcon key="description" value="stories" size={14} />
										Stories
										{#if filteredStoriesCount !== null && filteredStoriesCount > 0}
											<span
												class="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700"
											>
												{filteredStoriesCount}
											</span>
										{/if}
									</Tabs.Trigger>
									<Tabs.Trigger
										value="categories"
										class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
									>
										<PropertyIcon key="description" value="category" size={14} />
										Categories
										{#if availableCategories.length > 0}
											<span
												class="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700"
											>
												{availableCategories.length}
											</span>
										{/if}
									</Tabs.Trigger>
								</Tabs.List>
							</Tabs.Root>
						</div>
					{/if}

					<!-- Search and Filters (only in stories tab) -->
					{#if viewMode === 'list' && activeTab === 'stories'}
						<div class="space-y-2">
							<!-- Search -->
							<div class="relative">
								<PropertyIcon
									key="description"
									value="search"
									size={16}
									class="absolute top-1/2 left-3 -translate-y-1/2 transform text-gray-400"
								/>
								<input
									bind:value={searchQuery}
									placeholder="Search stories and authors..."
									class="w-full rounded-md border border-gray-300 py-2 pr-4 pl-10 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								/>
							</div>

							<!-- Category filters -->
							{#if availableCategories.length > 0}
								<div class="category-filters-container">
									<div class="category-filters-scroll">
										{#each availableCategories as category}
											<button
												class={clsx(
													'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
													{
														'text-white': selectedCategories.includes(category.id),
														'border border-gray-300 text-gray-700 hover:bg-gray-50':
															!selectedCategories.includes(category.id)
													}
												)}
												style={selectedCategories.includes(category.id)
													? `background-color: ${category.color}`
													: ''}
												onclick={() => toggleCategoryFilter(category.id)}
											>
												{category.icon || '📂'}
												{category.name}
											</button>
										{/each}

										{#if selectedCategories.length > 0 || searchQuery}
											<button
												class="flex items-center gap-1 rounded-full border border-gray-300 px-2 py-1 text-xs whitespace-nowrap text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
												onclick={clearFilters}
											>
												<PropertyIcon key="description" value="clear" size={12} />
												Clear
											</button>
										{/if}
									</div>
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Content Area -->
				<div class="flex min-h-0 flex-1 flex-col">
					<!-- Content based on view mode -->
					{#if viewMode === 'list'}
						<Tabs.Root bind:value={activeTab} class="flex h-full flex-col">
							<Tabs.Content
								value="stories"
								class="flex h-full flex-col pt-3 data-[state=inactive]:hidden"
							>
								<!-- Fixed Stories Header -->
								<div class="flex-shrink-0 border-b border-gray-200 bg-gray-100 px-4 py-2">
									<p class="text-sm text-gray-600">
										{filteredStoriesCount !== null ? filteredStoriesCount : '...'} stor{filteredStoriesCount !==
										1
											? 'ies'
											: 'y'}
										{selectedCategories.length > 0 || searchQuery ? ' (filtered)' : ''}
									</p>
								</div>

								<!-- Scrollable Stories Content -->
								<div class="stories-drawer-scrollable flex-1 overflow-auto px-4 py-4">
									<StoriesList
										onStorySelect={handleStorySelect}
										onNewStory={handleNewStory}
										onStoriesCountUpdate={handleStoriesCountUpdate}
										{selectedCategories}
										{searchQuery}
										hideHeader={true}
									/>
								</div>
							</Tabs.Content>

							<Tabs.Content
								value="categories"
								class="flex h-full flex-col pt-3 data-[state=inactive]:hidden"
							>
								<!-- Categories Management Content -->
								<div class="stories-drawer-scrollable flex-1 overflow-auto px-4 py-4">
									<StoryCategoryManager
										bind:availableCategories
										bind:error={categoryManagerError}
										onCategoriesChange={handleCategoriesChange}
										showSelection={false}
										allowDelete={true}
										class="w-full"
									/>
								</div>
							</Tabs.Content>
						</Tabs.Root>
					{:else if viewMode === 'view' && currentStory}
						<!-- Story viewer takes full height with its own internal scrolling -->
						<StoryViewer story={currentStory} showMetadata={true} class="h-full" />
					{/if}
				</div>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<!-- Story Editor Drawer -->
<StoryEditorDrawer
	bind:open={editorOpen}
	story={storyToEdit}
	onSave={handleStorySave}
	onCancel={handleEditorCancel}
/>

<!-- Followed Story Category Edit Dialog -->
<FollowedStoryCategoryEditDialog
	bind:open={categoryEditDialogOpen}
	story={storyToEditCategories}
	onSave={handleFollowedStoryCategorySave}
/>

<!-- Story Deletion Confirmation Dialog -->
<ConfirmDialog
	bind:open={confirmDialogOpen}
	title="Delete Story"
	message={storyToDelete
		? `Are you sure you want to delete "${storyToDelete.title}"?\n\nThis action cannot be undone.`
		: ''}
	variant="destructive"
	confirmText="Delete"
	onConfirm={performStoryDeletion}
/>

<style>
	/* Ensure proper flex layout and scrolling */
	.stories-drawer-scrollable {
		scrollbar-width: auto; /* For Firefox - use auto for better visibility */
		scrollbar-color: #6b7280 #e5e7eb; /* For Firefox - visible colors */
	}

	/* WebKit scrollbar styling - make it always visible and prominent */
	.stories-drawer-scrollable::-webkit-scrollbar {
		width: 14px; /* Make it visible but not too wide */
		-webkit-appearance: none;
	}

	.stories-drawer-scrollable::-webkit-scrollbar-track {
		background: #f3f4f6; /* Light gray track - more visible */
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.stories-drawer-scrollable::-webkit-scrollbar-thumb {
		background: #9ca3af; /* Medium gray thumb - more visible */
		border-radius: 8px;
		border: 2px solid #f3f4f6;
		min-height: 40px; /* Ensure minimum thumb size */
	}

	.stories-drawer-scrollable::-webkit-scrollbar-thumb:hover {
		background: #6b7280; /* Darker on hover */
	}

	.stories-drawer-scrollable::-webkit-scrollbar-thumb:active {
		background: #4b5563; /* Darkest when active */
	}

	.stories-drawer-scrollable::-webkit-scrollbar-corner {
		background: #f3f4f6;
	}

	/* Mobile keyboard handling - industry standard approach */
	.story-viewer-drawer {
		/* Fixed positioning that resists keyboard displacement */
		position: fixed !important;
		left: 0 !important;
		right: 0 !important;
		bottom: 0 !important;
		/* Use modern viewport units - industry standard 2023+ */
		height: min(50vh, 50dvh) !important;
		max-height: min(50vh, 50dvh) !important;
		/* Prevent iOS Safari repositioning */
		bottom: env(safe-area-inset-bottom, 0) !important;
		/* Ensure solid background */
		background: white !important;
		/* Standard mobile optimization */
		-webkit-overflow-scrolling: touch;
	}

	/* Keyboard open state - reduce height */
	.story-viewer-drawer.keyboard-open {
		height: min(45vh, 400px) !important;
		max-height: min(45vh, 400px) !important;
	}

	/* Ensure overlay stays visible when keyboard is open */
	:global(.fixed.inset-0.bg-black\/40.keyboard-open) {
		/* Keep overlay covering the visible area */
		position: fixed !important;
		top: 0 !important;
		left: 0 !important;
		right: 0 !important;
		bottom: 0 !important;
		background-color: rgba(0, 0, 0, 0.6) !important;
	}

	/* Mobile input optimizations - prevent iOS zoom */
	:global(.story-viewer-drawer input[type='text']),
	:global(.story-viewer-drawer input[type='email']),
	:global(.story-viewer-drawer input[type='password']),
	:global(.story-viewer-drawer textarea),
	:global(.story-viewer-drawer [contenteditable]) {
		font-size: 16px !important; /* Prevents iOS zoom - industry standard */
	}

	/* Responsive adjustments for mobile */
	@media screen and (max-width: 768px) {
		.story-viewer-drawer {
			/* Smaller height on mobile to account for keyboard */
			height: 45vh !important;
			max-height: 45vh !important;
			/* Minimum usable height */
			min-height: 300px !important;
		}
	}

	/* Category filters horizontal scrolling - specific to category sections only */
	.category-filters-container {
		overflow: hidden;
		width: 100%;
	}

	.category-filters-scroll {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		overflow-y: hidden;
		padding-bottom: 0.25rem;
		scrollbar-width: thin;
		scrollbar-color: #d1d5db transparent;
		/* Ensure this only affects this specific container */
		max-width: 100%;
	}

	.category-filters-scroll::-webkit-scrollbar {
		height: 4px;
		width: auto; /* Reset any inherited width */
	}

	.category-filters-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.category-filters-scroll::-webkit-scrollbar-thumb {
		background: #d1d5db;
		border-radius: 2px;
	}

	.category-filters-scroll::-webkit-scrollbar-thumb:hover {
		background: #9ca3af;
	}
</style>
