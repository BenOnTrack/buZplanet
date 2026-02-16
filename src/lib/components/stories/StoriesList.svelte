<script lang="ts">
	import { clsx } from 'clsx';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { formatDate, getPreviewText, countFeatures } from '$lib/utils/stories';

	let {
		onStorySelect,
		onNewStory,
		onStoriesCountUpdate = undefined,
		selectedCategories = [],
		searchQuery = '',
		hideHeader = false,
		class: className = ''
	}: {
		onStorySelect: (story: Story) => void;
		onNewStory: () => void;
		onStoriesCountUpdate?: (count: number) => void;
		selectedCategories?: string[];
		searchQuery?: string;
		hideHeader?: boolean;
		class?: string;
	} = $props();

	// State
	let stories = $state<Story[]>([]);
	let categories = $state<StoryCategory[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Filtered stories based on search and categories
	let filteredStories = $derived.by(() => {
		let filtered = [...stories]; // Create a copy to avoid mutating the original

		console.log('🔍 Filtering stories:', {
			totalStories: stories.length,
			selectedCategories: selectedCategories,
			searchQuery: searchQuery.trim()
		});

		// Apply category filter (ALL selected categories must be present in the story)
		if (selectedCategories.length > 0) {
			filtered = filtered.filter((story) => {
				const hasAllCategories = selectedCategories.every((selectedCat) =>
					story.categories.includes(selectedCat)
				);
				console.log(
					`Story "${story.title}" categories: [${story.categories.join(', ')}], has all selected: ${hasAllCategories}`
				);
				return hasAllCategories;
			});
			console.log('After category filter:', filtered.length, 'stories remain');
		}

		// Apply search filter
		if (searchQuery.trim()) {
			const query = searchQuery.toLowerCase();
			filtered = filtered.filter(
				(story) =>
					story.title.toLowerCase().includes(query) ||
					story.description?.toLowerCase().includes(query) ||
					story.searchText.includes(query)
			);
			console.log('After search filter:', filtered.length, 'stories remain');
		}

		// Sort by date modified (newest first) - create new array to avoid mutation
		const result = [...filtered].sort((a, b) => b.dateModified - a.dateModified);
		console.log('Final filtered stories:', result.length);
		return result;
	});

	// Load data on mount and react to changes
	$effect(() => {
		// Access the change signal to create reactivity dependency
		storiesDB.changeSignal;
		loadStories();
		loadCategories();
	});

	// Notify parent of filtered stories count changes
	$effect(() => {
		// Track dependencies: filteredStories length, loading state
		const count = filteredStories.length;
		const isLoading = loading;

		// Only call the callback once we have loaded stories and computed filtered results
		if (onStoriesCountUpdate && !isLoading) {
			onStoriesCountUpdate(count);
		}
	});

	async function loadStories() {
		try {
			loading = true;
			error = null;
			console.log(
				'📚 Loading stories... (triggered by change signal:',
				storiesDB.changeSignal,
				')'
			);
			stories = await storiesDB.getAllStories();
			console.log('✅ Loaded', stories.length, 'stories');
		} catch (err) {
			console.error('Failed to load stories:', err);
			error = 'Failed to load stories';
		} finally {
			loading = false;
		}
	}

	async function loadCategories() {
		try {
			categories = await storiesDB.getAllCategories();
		} catch (err) {
			console.error('Failed to load categories:', err);
		}
	}

	// Get category display info
	function getCategoryInfo(categoryId: string): StoryCategory | undefined {
		return categories.find((cat) => cat.id === categoryId);
	}
</script>

<div class={clsx('stories-list', className)}>
	<!-- Header -->
	{#if !hideHeader}
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold text-gray-900">Your Stories</h2>
				<p class="text-sm text-gray-600">
					{filteredStories.length} stor{filteredStories.length !== 1 ? 'ies' : 'y'}
					{selectedCategories.length > 0 || searchQuery ? ' (filtered)' : ''}
				</p>
			</div>

			<button
				class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				onclick={onNewStory}
			>
				<PropertyIcon key="description" value="plus" size={16} />
				New Story
			</button>
		</div>
	{/if}

	<!-- Loading state -->
	{#if loading}
		<div class="flex items-center justify-center py-12">
			<div class="flex items-center gap-2 text-gray-500">
				<PropertyIcon key="description" value="loading" size={20} />
				Loading stories...
			</div>
		</div>
	{:else if error}
		<!-- Error state -->
		<div class="rounded-md border border-red-200 bg-red-50 p-4">
			<div class="flex items-center gap-2 text-red-700">
				<PropertyIcon key="description" value="error" size={20} />
				{error}
			</div>
			<button class="mt-2 text-sm text-red-600 underline hover:text-red-800" onclick={loadStories}>
				Try again
			</button>
		</div>
	{:else if filteredStories.length === 0}
		<!-- Empty state -->
		<div class="py-12 text-center">
			{#if stories.length === 0}
				<!-- No stories at all -->
				<div class="mb-4 text-4xl">📚</div>
				<h3 class="mb-2 text-lg font-medium text-gray-900">No Stories Yet</h3>
				<p class="mb-6 text-gray-600">
					Create your first story to start documenting your experiences with embedded map features.
				</p>
				<button
					class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
					onclick={onNewStory}
				>
					<PropertyIcon key="description" value="plus" size={16} />
					Create Your First Story
				</button>
			{:else}
				<!-- No matching stories -->
				<div class="mb-4 text-4xl">🔍</div>
				<h3 class="mb-2 text-lg font-medium text-gray-900">No Matching Stories</h3>
				<p class="text-gray-600">Try adjusting your filters or search terms.</p>
			{/if}
		</div>
	{:else}
		<!-- Stories list -->
		<div class="space-y-4">
			{#each filteredStories as story (story.id)}
				<button
					class="story-card w-full cursor-pointer rounded-lg border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
					onclick={() => onStorySelect(story)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onStorySelect(story);
						}
					}}
					aria-label="Open story: {story.title}"
				>
					<!-- Story header -->
					<header class="mb-3">
						<div class="flex items-start justify-between">
							<div class="min-w-0 flex-1">
								<h3 class="truncate font-semibold text-gray-900">{story.title}</h3>
								{#if story.description}
									<p class="truncate text-sm text-gray-600">{story.description}</p>
								{/if}
							</div>

							<div class="ml-4 flex-shrink-0 text-xs text-gray-500">
								{formatDate(story.dateModified, { short: true })}
							</div>
						</div>
					</header>

					<!-- Story preview -->
					{#if story.content.length > 0}
						<div class="mb-3 line-clamp-2 text-sm text-gray-600">
							{getPreviewText(story.content)}
						</div>
					{/if}

					<!-- Story metadata -->
					<footer class="flex items-center justify-between text-xs text-gray-500">
						<div class="flex items-center gap-4">
							<!-- Feature count -->
							{#if countFeatures(story.content) > 0}
								<div class="flex items-center gap-1">
									<PropertyIcon key="description" value="location" size={12} />
									{countFeatures(story.content)} feature{countFeatures(story.content) !== 1
										? 's'
										: ''}
								</div>
							{/if}

							<!-- View count -->
							{#if story.viewCount && story.viewCount > 0}
								<div class="flex items-center gap-1">
									<PropertyIcon key="description" value="eye" size={12} />
									{story.viewCount}
								</div>
							{/if}

							<!-- Version -->
							<div class="flex items-center gap-1">
								<PropertyIcon key="description" value="version" size={12} />
								v{story.currentVersion}
							</div>
						</div>

						<!-- Categories -->
						<div class="flex items-center gap-1">
							{#each story.categories.slice(0, 2) as categoryId}
								{@const categoryInfo = getCategoryInfo(categoryId)}
								{#if categoryInfo}
									<span
										class="inline-block h-2 w-2 rounded-full"
										style="background-color: {categoryInfo.color}"
										title={categoryInfo.name}
									></span>
								{/if}
							{/each}
							{#if story.categories.length > 2}
								<span class="text-xs">+{story.categories.length - 2}</span>
							{/if}
						</div>
					</footer>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.story-card:focus {
		outline: 2px solid #3b82f6;
		outline-offset: -2px;
	}

	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>
