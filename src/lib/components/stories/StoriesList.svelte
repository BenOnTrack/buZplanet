<script lang="ts">
	import { clsx } from 'clsx';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { userStore } from '$lib/stores/UserStore.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { formatDate, getPreviewText, countFeatures } from '$lib/utils/stories';
	import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte';

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
	let userStories = $state<Story[]>([]);
	let followedStories = $state<Story[]>([]);
	let categories = $state<StoryCategory[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Confirmation dialog state
	let confirmDeleteOpen = $state(false);
	let storyToDelete = $state<Story | null>(null);

	// Combined and filtered stories
	let allStories = $derived.by(() => {
		// Combine user stories and followed stories
		const combined = [...userStories, ...followedStories];

		// Sort by date modified (newest first)
		return combined.sort((a, b) => b.dateModified - a.dateModified);
	});

	let filteredStories = $derived.by(() => {
		let filtered = [...allStories];

		console.log('🔍 Filtering social stories:', {
			totalStories: allStories.length,
			userStories: userStories.length,
			followedStories: followedStories.length,
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
					story.searchText.includes(query) ||
					// Also search author name for followed stories
					(story as any).authorName?.toLowerCase().includes(query)
			);
			console.log('After search filter:', filtered.length, 'stories remain');
		}

		console.log('Final filtered social stories:', filtered.length);
		return filtered;
	});

	// Load data on mount and react to changes
	$effect(() => {
		// Access the change signal to create reactivity dependency
		storiesDB.changeSignal;
		loadData();
	});

	// Notify parent of filtered stories count changes
	$effect(() => {
		const count = filteredStories.length;
		const isLoading = loading;

		if (onStoriesCountUpdate && !isLoading) {
			onStoriesCountUpdate(count);
		}
	});

	async function loadData() {
		try {
			loading = true;
			error = null;
			console.log('📚 Loading social stories data...');

			// Load user's own stories and categories first (these should always work)
			const [userStoriesResult, categoriesResult] = await Promise.all([
				storiesDB.getAllStories(),
				storiesDB.getAllCategories()
			]);

			userStories = userStoriesResult;
			categories = categoriesResult;

			// Try to load followed stories separately (this might fail due to permissions)
			try {
				// NEW: This now reads from local cache instead of making Firestore requests
				const followedStoriesResult = await storiesDB.getStoriesFromFollowedUsers(20);
				followedStories = followedStoriesResult;
				console.log('✅ Loaded followed stories from cache:', followedStories.length);
			} catch (followedError) {
				console.warn(
					'Failed to load followed stories from cache (continuing with user stories only):',
					followedError
				);
				followedStories = []; // Set to empty array so user stories still work
			}

			console.log('✅ Loaded social stories:', {
				userStories: userStories.length,
				followedStories: followedStories.length,
				categories: categories.length
			});
		} catch (err) {
			console.error('Failed to load social stories:', err);
			error = 'Failed to load stories';
			userStories = [];
			followedStories = [];
		} finally {
			loading = false;
		}
	}

	// Get category display info
	function getCategoryInfo(categoryId: string): StoryCategory | undefined {
		return categories.find((cat) => cat.id === categoryId);
	}

	// Check if story is from current user
	function isUserStory(story: Story): boolean {
		return !('authorName' in story) || !(story as any).readOnly;
	}

	// Get display name for story author
	function getAuthorDisplayName(story: Story): string | undefined {
		if (isUserStory(story)) {
			return undefined; // Don't show author for user's own stories
		}
		return (story as any).authorName || 'Unknown Author';
	}

	// Get author username for story author
	function getAuthorUsername(story: Story): string | undefined {
		if (isUserStory(story)) {
			return undefined;
		}
		return (story as any).authorUsername;
	}

	// Handle story deletion
	async function handleDeleteStory(story: Story, event: Event) {
		event.preventDefault();
		event.stopPropagation();

		// Only allow deletion of user's own stories
		if (!isUserStory(story)) {
			return;
		}

		// Show confirmation dialog
		storyToDelete = story;
		confirmDeleteOpen = true;
	}

	// Perform the actual story deletion
	async function performStoryDeletion() {
		if (!storyToDelete) return;

		try {
			await storiesDB.deleteStory(storyToDelete.id);
			console.log(`✅ Successfully deleted story: ${storyToDelete.title}`);
			// UI will automatically update due to reactivity
		} catch (error) {
			console.error('❌ Failed to delete story:', error);
			throw error; // Re-throw to prevent dialog from closing
		} finally {
			storyToDelete = null;
		}
	}
</script>

<div class={clsx('social-stories-list', className)}>
	<!-- Header -->
	{#if !hideHeader}
		<div class="mb-6 flex items-center justify-between">
			<div>
				<h2 class="text-xl font-semibold text-gray-900">Stories</h2>
				<p class="text-sm text-gray-600">
					{filteredStories.length} stor{filteredStories.length !== 1 ? 'ies' : 'y'}
					{selectedCategories.length > 0 || searchQuery ? ' (filtered)' : ''}
					{followedStories.length > 0
						? ` • ${userStories.length} yours, ${followedStories.length} from people you follow`
						: ' • all yours'}
				</p>
			</div>

			<button
				class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
				onclick={onNewStory}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						onNewStory();
					}
				}}
				aria-label="Create new story"
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
			<button
				class="mt-2 text-sm text-red-600 underline hover:text-red-800"
				onclick={loadData}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						loadData();
					}
				}}
				aria-label="Retry loading stories"
			>
				Try again
			</button>
		</div>
	{:else if filteredStories.length === 0}
		<!-- Empty state -->
		<div class="py-12 text-center">
			{#if allStories.length === 0}
				<!-- No stories at all -->
				<div class="mb-4 text-4xl">📚</div>
				<h3 class="mb-2 text-lg font-medium text-gray-900">No Stories Yet</h3>
				<p class="mb-6 text-gray-600">
					Create your first story to start documenting your experiences.
					{userStore.following && userStore.following.length > 0
						? 'Stories from people you follow will also appear here.'
						: 'Follow other users to see their public stories here too.'}
				</p>
				<button
					class="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
					onclick={onNewStory}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onNewStory();
						}
					}}
					aria-label="Create your first story"
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
				{@const authorName = getAuthorDisplayName(story)}
				{@const authorUsername = getAuthorUsername(story)}
				{@const isOwn = isUserStory(story)}

				<button
					class={clsx(
						'story-card w-full cursor-pointer rounded-lg border bg-white p-4 text-left shadow-sm transition-all hover:shadow-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
						isOwn
							? 'border-gray-200 hover:border-gray-300'
							: 'border-blue-100 bg-blue-50/30 hover:border-blue-200'
					)}
					onclick={() => onStorySelect(story)}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onStorySelect(story);
						}
					}}
					aria-label="Open story: {story.title}{authorName ? ` by ${authorName}` : ''}"
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

							<!-- Version (only for own stories) -->
							{#if isOwn}
								<div class="flex items-center gap-1">
									<PropertyIcon key="description" value="version" size={12} />
									v{story.currentVersion}
								</div>
							{/if}

							<!-- Author info (for followed stories) -->
							{#if !isOwn && authorName}
								<div class="flex items-center gap-1">
									<PropertyIcon key="description" value="user" size={12} />
									<span class="font-medium text-blue-600">
										{authorUsername ? `@${authorUsername}` : authorName}
									</span>
								</div>
							{/if}
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

					<!-- Author name at bottom (for followed stories) -->
					{#if !isOwn && authorName}
						<div class="mt-2 truncate border-t border-gray-100 pt-2 text-xs text-gray-500">
							<span class="text-blue-600">
								by {authorName}
								{authorUsername ? `(@${authorUsername})` : ''}
							</span>
						</div>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Story Deletion Confirmation Dialog -->
<ConfirmDialog
	bind:open={confirmDeleteOpen}
	title="Delete Story"
	message={storyToDelete
		? `Are you sure you want to delete "${storyToDelete.title}"?\n\nThis action cannot be undone.`
		: ''}
	variant="destructive"
	confirmText="Delete"
	onConfirm={performStoryDeletion}
/>

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
