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
	import FollowedStoryCategoryEditDialog from '$lib/components/dialogs/FollowedStoryCategoryEditDialog.svelte';
	import CategoryManager from '$lib/components/categories/CategoryManager.svelte';
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

	// Reset view when drawer closes - VALID SIDE EFFECT (external store mutation + state reset)
	$effect(() => {
		if (!open) {
			viewMode = 'list';
			currentStory = null;
			searchQuery = '';
			selectedCategories = [];
			activeTab = 'stories';
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

	// Back to list from story view
	function backToList() {
		console.log('⬅️ Back to list clicked, current state:', {
			viewMode,
			currentStory: currentStory?.id
		});
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

	// Handle category changes from CategoryManager
	function handleCategoriesChange(categories: StoryCategory[]) {
		availableCategories = categories;
		// Trigger reload of categories in stories list if needed
		loadCategories();
	}
</script>

<!-- Stories Drawer -->
<Drawer.Root bind:open modal={false}>
	<Drawer.Portal>
		<Drawer.Overlay class="fixed inset-0 bg-black/40" style="z-index: {Z_INDEX.DRAWER_OVERLAY}" />
		<Drawer.Content
			class="fixed right-0 bottom-0 left-0 flex h-[50vh] flex-col rounded-t-[10px] border border-gray-200 bg-white"
			style="z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div class="mx-auto flex h-full w-full max-w-full flex-col overflow-hidden">
				<!-- Sticky Header Section -->
				<div class="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-2">
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
							{:else if currentStory && !isCurrentStoryReadOnly}
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
							{:else if currentStory && isCurrentStoryReadOnly}
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
						<Tabs.Root bind:value={activeTab} class="w-full">
							<Tabs.List class="grid w-full grid-cols-2">
								<Tabs.Trigger
									value="stories"
									class="flex items-center justify-center gap-2 rounded-tl-md border-b-2 border-transparent bg-white px-3 py-2 text-sm font-medium transition-all hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600"
								>
									<PropertyIcon key="description" value="stories" size={16} />
									Stories
									{#if filteredStoriesCount !== null && filteredStoriesCount > 0}
										<span
											class="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700 data-[state=active]:bg-blue-200 data-[state=active]:text-blue-800"
										>
											{filteredStoriesCount}
										</span>
									{/if}
								</Tabs.Trigger>
								<Tabs.Trigger
									value="categories"
									class="flex items-center justify-center gap-2 rounded-tr-md border-b-2 border-transparent bg-white px-3 py-2 text-sm font-medium transition-all hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none data-[state=active]:border-blue-600 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-600"
								>
									<PropertyIcon key="description" value="category" size={16} />
									Categories
									{#if availableCategories.length > 0}
										<span
											class="ml-1 rounded-full bg-gray-200 px-1.5 py-0.5 text-xs text-gray-700 data-[state=active]:bg-blue-200 data-[state=active]:text-blue-800"
										>
											{availableCategories.length}
										</span>
									{/if}
								</Tabs.Trigger>
							</Tabs.List>
						</Tabs.Root>
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
									class="w-full rounded-md border border-gray-300 py-2 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
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
								class="flex h-full flex-col data-[state=inactive]:hidden"
							>
								<!-- Fixed Stories Header -->
								<div class="flex-shrink-0 border-b border-gray-100 bg-white px-4 py-2">
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
								class="flex h-full flex-col data-[state=inactive]:hidden"
							>
								<!-- Categories Management Content -->
								<div class="stories-drawer-scrollable flex-1 overflow-auto px-4 py-4">
									<CategoryManager
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
