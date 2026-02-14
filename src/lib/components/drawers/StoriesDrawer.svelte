<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import StoriesList from '$lib/components/stories/StoriesList.svelte';
	import StoryViewer from '$lib/components/stories/StoryViewer.svelte';
	import StoryEditorDrawer from '$lib/components/stories/StoryEditorDrawer.svelte';

	let { open = $bindable(false) }: { open?: boolean } = $props();
	let activeSnapPoint = $state<string | number>('400px');

	// View state
	type ViewMode = 'list' | 'view' | 'edit';
	let viewMode = $state<ViewMode>('list');
	let currentStory = $state<Story | null>(null);

	// Editor state
	let editorOpen = $state(false);
	let storyToEdit = $state<Story | null>(null);

	// Search and filter state
	let searchQuery = $state('');
	let selectedCategories = $state<string[]>([]);
	let availableCategories = $state<StoryCategory[]>([]);

	// Load categories when drawer opens
	$effect(() => {
		if (open) {
			loadCategories();
		}
	});

	// Reset view when drawer closes
	$effect(() => {
		if (!open) {
			viewMode = 'list';
			currentStory = null;
			searchQuery = '';
			selectedCategories = [];
			// Make sure to disable story insertion mode when closing stories drawer
			mapControl.setStoryInsertionMode(false);
		}
	});

	async function loadCategories() {
		try {
			availableCategories = await storiesDB.getAllCategories();
		} catch (error) {
			console.error('Failed to load categories:', error);
		}
	}

	// Handle story selection from list
	function handleStorySelect(story: Story) {
		currentStory = story;
		viewMode = 'view';

		// Increment view count
		storiesDB.incrementViewCount(story.id).catch(console.error);
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

	// Back to list from story view
	function backToList() {
		viewMode = 'list';
		currentStory = null;
	}

	// Toggle category filter
	function toggleCategoryFilter(categoryId: string) {
		if (selectedCategories.includes(categoryId)) {
			selectedCategories = selectedCategories.filter((id) => id !== categoryId);
		} else {
			selectedCategories = [...selectedCategories, categoryId];
		}
	}

	// Clear all filters
	function clearFilters() {
		searchQuery = '';
		selectedCategories = [];
	}

	// Get category info
	function getCategoryInfo(categoryId: string): StoryCategory | undefined {
		return availableCategories.find((cat) => cat.id === categoryId);
	}
</script>

<!-- Stories Drawer -->
<Drawer.Root bind:open snapPoints={['400px', '600px', 1]} bind:activeSnapPoint modal={false}>
	<Drawer.Overlay
		class="fixed inset-0 bg-black/40"
		style="pointer-events: none;z-index: {Z_INDEX.DRAWER_OVERLAY}"
	/>
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 mx-[-1px] flex h-full max-h-[97%] flex-col overflow-hidden rounded-t-[10px] border border-gray-200 bg-white"
			style="z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
				<!-- Sticky Header Section -->
				<div class="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-4">
					<!-- Header -->
					<div class="mb-4 flex items-center justify-between">
						<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
							<PropertyIcon key="description" value="stories" size={24} />
							{viewMode === 'view' && currentStory ? currentStory.title : 'Stories'}
						</Drawer.Title>

						<div class="flex items-center gap-2">
							{#if viewMode === 'view' && currentStory}
								<button
									class="text-gray-500 hover:text-gray-700"
									onclick={() => currentStory && handleEditStory(currentStory)}
									title="Edit story"
								>
									<PropertyIcon key="description" value="edit" size={20} />
								</button>
								<button
									class="text-gray-500 hover:text-gray-700"
									onclick={backToList}
									title="Back to stories list"
								>
									<PropertyIcon key="description" value="back" size={20} />
								</button>
							{/if}

							<Drawer.Close class="text-gray-500 hover:text-gray-700">
								<PropertyIcon key="description" value="x" size={20} class="text-foreground" />
								<span class="sr-only">Close</span>
							</Drawer.Close>
						</div>
					</div>

					<!-- Search and Filters (only in list view) -->
					{#if viewMode === 'list'}
						<div class="space-y-3">
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
									placeholder="Search stories..."
									class="w-full rounded-md border border-gray-300 py-2 pr-4 pl-10 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								/>
							</div>

							<!-- Category filters -->
							{#if availableCategories.length > 0}
								<div class="flex flex-wrap gap-2">
									{#each availableCategories as category}
										<button
											class={clsx(
												'flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
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
											class="flex items-center gap-1 rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
											onclick={clearFilters}
										>
											<PropertyIcon key="description" value="clear" size={12} />
											Clear
										</button>
									{/if}
								</div>
							{/if}
						</div>
					{/if}
				</div>

				<!-- Scrollable Content Area -->
				<div
					class="stories-drawer-scrollable flex-1 overflow-x-hidden overflow-y-scroll px-4 py-4"
					style="scrollbar-gutter: stable; min-height: 0; flex-basis: 0;"
				>
					<div class="space-y-4 pb-8" style="min-height: calc(100vh + 200px);">
						<!-- Content based on view mode -->
						{#if viewMode === 'list'}
							<StoriesList
								onStorySelect={handleStorySelect}
								onNewStory={handleNewStory}
								{selectedCategories}
								{searchQuery}
							/>
						{:else if viewMode === 'view' && currentStory}
							<StoryViewer story={currentStory} showMetadata={true} onEditStory={handleEditStory} />
						{/if}
					</div>
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

<style>
	/* Ensure proper flex layout and scrolling */
	.stories-drawer-scrollable {
		scrollbar-width: auto; /* For Firefox - use auto for better visibility */
		scrollbar-color: #6b7280 #e5e7eb; /* For Firefox - visible colors */
		/* Critical for proper flex scrolling */
		flex: 1 1 0;
		min-height: 0;
		max-height: 100%;
		/* Force scrollbar to always show */
		overflow-y: scroll !important;
	}

	/* WebKit scrollbar styling - make it always visible and prominent */
	.stories-drawer-scrollable::-webkit-scrollbar {
		width: 14px; /* Make it visible but not too wide */
		-webkit-appearance: none;
		display: block !important; /* Force it to show */
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
</style>
