<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import StoryEditor from './StoryEditor.svelte';

	let {
		open = $bindable(false),
		story = null,
		onSave = undefined,
		onCancel = undefined
	}: {
		open?: boolean;
		story?: Story | null;
		onSave?: (story: Story) => void;
		onCancel?: () => void;
	} = $props();

	// Editor state
	let title = $state('');
	let description = $state('');
	let content = $state<StoryContentNode[]>([]);
	let tags = $state<string[]>([]);
	let categories = $state<string[]>([]);
	let isPublic = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Available categories and tags
	let availableCategories = $state<StoryCategory[]>([]);
	let recentTags = $state<string[]>([]);
	let newTag = $state('');

	// Editor mode
	let isEditing = $derived(story !== null);
	let hasUnsavedChanges = $state(false);

	// Drawer state
	let activeSnapPoint = $state<string | number>('400px');

	// Load data when drawer opens
	$effect(() => {
		if (open) {
			loadAvailableData();
			initializeForm();
		}
	});

	// Track unsaved changes
	$effect(() => {
		if (open) {
			hasUnsavedChanges = hasFormChanges();
		}
	});

	// Initialize form based on story data
	function initializeForm() {
		if (story) {
			title = story.title;
			description = story.description || '';
			content = [...story.content];
			tags = [...story.tags];
			categories = [...story.categories];
			isPublic = story.isPublic;
		} else {
			// New story
			title = '';
			description = '';
			content = [];
			tags = [];
			categories = [];
			isPublic = false;
		}
		hasUnsavedChanges = false;
	}

	// Check if form has changes
	function hasFormChanges(): boolean {
		if (!story) {
			// New story - has changes if any field is filled
			return !!(
				title ||
				description ||
				content.length > 0 ||
				tags.length > 0 ||
				categories.length > 0
			);
		}

		// Editing - compare with original
		return (
			title !== story.title ||
			description !== (story.description || '') ||
			JSON.stringify(content) !== JSON.stringify(story.content) ||
			JSON.stringify(tags.sort()) !== JSON.stringify([...story.tags].sort()) ||
			JSON.stringify(categories.sort()) !== JSON.stringify([...story.categories].sort()) ||
			isPublic !== story.isPublic
		);
	}

	// Load available categories and recent tags
	async function loadAvailableData() {
		try {
			availableCategories = await storiesDB.getAllCategories();

			// Get recent tags from existing stories
			const allStories = await storiesDB.getAllStories();
			const allTags = allStories.flatMap((s) => s.tags);
			const tagCounts = allTags.reduce(
				(acc, tag) => {
					acc[tag] = (acc[tag] || 0) + 1;
					return acc;
				},
				{} as Record<string, number>
			);

			recentTags = Object.entries(tagCounts)
				.sort(([, a], [, b]) => b - a)
				.slice(0, 10)
				.map(([tag]) => tag);
		} catch (err) {
			console.error('Failed to load categories and tags:', err);
		}
	}

	// Save story
	async function saveStory() {
		console.log('💾 Starting story save process...');
		console.log('Title:', title.trim());
		console.log('Content:', content);
		console.log('Description:', description.trim());
		console.log('Tags:', tags);
		console.log('Categories:', categories);

		if (!title.trim()) {
			error = 'Story title is required';
			console.error('❌ Title is required');
			return;
		}

		try {
			saving = true;
			error = null;
			console.log('🔄 Setting saving to true');

			let savedStory: Story;

			if (isEditing && story) {
				console.log('✏️ Updating existing story:', story.id);
				// Update existing story
				savedStory = await storiesDB.updateStory(
					story.id,
					{
						title: title.trim(),
						description: description.trim() || undefined,
						content: [...content],
						tags: [...tags],
						categories: [...categories],
						isPublic
					},
					'Story updated via editor'
				);
			} else {
				console.log('➕ Creating new story...');

				// Check if StoriesDB is initialized
				console.log('🔍 Checking StoriesDB initialization:', storiesDB.initialized);

				if (!storiesDB.initialized) {
					console.log('⌛ Initializing StoriesDB...');
					await storiesDB.ensureInitialized();
					console.log('✅ StoriesDB initialized');
				}

				// Create new story
				console.log('💾 Calling storiesDB.createStory with params:');
				console.log('  Title:', title.trim());
				console.log('  Content:', [...content]);
				console.log('  Options:', {
					description: description.trim() || undefined,
					tags: [...tags],
					categories: [...categories],
					isPublic
				});

				// Create new story with timeout
				const createStoryPromise = storiesDB.createStory(title.trim(), [...content], {
					description: description.trim() || undefined,
					tags: [...tags],
					categories: [...categories],
					isPublic
				});

				// Add timeout to prevent hanging
				const timeoutPromise = new Promise((_, reject) => {
					setTimeout(() => reject(new Error('Story creation timed out after 10 seconds')), 10000);
				});

				savedStory = (await Promise.race([createStoryPromise, timeoutPromise])) as Story;
				console.log('✅ storiesDB.createStory completed');
			}

			console.log('✅ Story saved successfully:', savedStory);
			hasUnsavedChanges = false;

			if (onSave) {
				console.log('📤 Calling onSave callback');
				onSave(savedStory);
			}

			// Close drawer
			console.log('🚪 Closing drawer');
			open = false;
		} catch (err) {
			console.error('❌ Failed to save story:', err);
			console.error('Error details:', err);
			error = err instanceof Error ? err.message : 'Failed to save story';
		} finally {
			console.log('🔄 Setting saving to false');
			saving = false;
		}
	}

	// Cancel editing
	function cancel() {
		if (hasUnsavedChanges) {
			const confirmDiscard = confirm(
				'You have unsaved changes. Are you sure you want to discard them?'
			);
			if (!confirmDiscard) return;
		}

		if (onCancel) {
			onCancel();
		}

		open = false;
	}

	// Handle drawer close
	function handleDrawerClose() {
		// Make sure to disable story insertion mode when closing drawer
		mapControl.setStoryInsertionMode(false);
		cancel();
	}

	// Add tag
	function addTag() {
		const tagToAdd = newTag.trim().toLowerCase();
		if (tagToAdd && !tags.includes(tagToAdd)) {
			tags = [...tags, tagToAdd];
			newTag = '';
		}
	}

	// Remove tag
	function removeTag(tagToRemove: string) {
		tags = tags.filter((tag) => tag !== tagToRemove);
	}

	// Toggle category
	function toggleCategory(categoryId: string) {
		if (categories.includes(categoryId)) {
			categories = categories.filter((cat) => cat !== categoryId);
		} else {
			categories = [...categories, categoryId];
		}
	}

	// Handle key events for tags
	function handleTagKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			addTag();
		}
	}
</script>

<!-- Story Editor Drawer -->
<Drawer.Root
	bind:open
	onOpenChange={(newOpen) => {
		if (!newOpen) handleDrawerClose();
	}}
	snapPoints={['400px', '600px', 1]}
	bind:activeSnapPoint
	modal={false}
>
	<Drawer.Overlay
		class="fixed inset-0 bg-black/40"
		style="pointer-events: none; z-index: {Z_INDEX.DRAWER_OVERLAY}"
	/>
	<Drawer.Portal>
		<Drawer.Content
			class="border-b-none fixed right-0 bottom-0 left-0 mx-[-1px] flex h-full max-h-[97%] flex-col overflow-hidden rounded-t-[10px] border border-gray-200 bg-white"
			style="z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div class="flex h-full min-h-0 w-full flex-col overflow-hidden">
				<!-- Sticky Header Section -->
				<div class="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-4">
					<!-- Header with title and close button -->
					<div class="mb-4 flex items-center justify-between">
						<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
							<PropertyIcon key="description" value="edit" size={24} />
							{isEditing ? 'Edit Story' : 'New Story'}
						</Drawer.Title>

						<div class="flex items-center gap-2">
							{#if hasUnsavedChanges}
								<span class="flex items-center gap-1 text-sm text-orange-600">
									<PropertyIcon key="description" value="unsaved" size={14} />
									Unsaved changes
								</span>
							{/if}

							<Drawer.Close class="text-gray-500 hover:text-gray-700" onclick={cancel}>
								<PropertyIcon key="description" value="x" size={20} class="text-foreground" />
								<span class="sr-only">Close</span>
							</Drawer.Close>
						</div>
					</div>

					<!-- Title Input -->
					<div class="mb-4">
						<label for="story-title" class="mb-2 block text-sm font-medium text-gray-700">
							Story Title *
						</label>
						<input
							id="story-title"
							bind:value={title}
							placeholder="Enter your story title..."
							class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							required
						/>
					</div>

					<!-- Action Buttons -->
					<div class="flex items-center justify-end gap-3">
						<button
							onclick={cancel}
							class="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
							disabled={saving}
						>
							<PropertyIcon key="description" value="x" size={16} />
							Cancel
						</button>

						<button
							onclick={saveStory}
							disabled={saving || !title.trim()}
							class="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
						>
							{#if saving}
								<PropertyIcon key="description" value="loading" size={16} />
								Saving...
							{:else}
								<PropertyIcon key="description" value="save" size={16} />
								{isEditing ? 'Update Story' : 'Create Story'}
							{/if}
						</button>
					</div>

					<!-- Error message -->
					{#if error}
						<div class="mt-4 rounded-md border border-red-200 bg-red-50 p-3">
							<div class="flex items-center gap-2 text-red-700">
								<PropertyIcon key="description" value="error" size={16} />
								{error}
							</div>
						</div>
					{/if}
				</div>

				<!-- Scrollable Content Area -->
				<div
					class="story-editor-scrollable flex-1 overflow-x-hidden overflow-y-scroll px-4 py-4"
					style="scrollbar-gutter: stable; min-height: 0; flex-basis: 0;"
				>
					<div class="space-y-6 pb-8" style="min-height: calc(100vh + 200px);">
						<!-- Description -->
						<div>
							<label for="story-description" class="mb-2 block text-sm font-medium text-gray-700">
								Description (Optional)
							</label>
							<textarea
								id="story-description"
								bind:value={description}
								placeholder="Brief description of your story..."
								rows="3"
								class="block w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
							></textarea>
						</div>

						<!-- Categories -->
						{#if availableCategories.length > 0}
							<fieldset>
								<legend class="mb-3 block text-sm font-medium text-gray-700">Categories</legend>
								<div class="flex flex-wrap gap-2">
									{#each availableCategories as category}
										<button
											class={clsx(
												'flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
												{
													'text-white': categories.includes(category.id),
													'border border-gray-300 text-gray-700 hover:bg-gray-50':
														!categories.includes(category.id)
												}
											)}
											style={categories.includes(category.id)
												? `background-color: ${category.color}`
												: ''}
											onclick={() => toggleCategory(category.id)}
										>
											{#if category.icon}
												<span>{category.icon}</span>
											{:else}
												<PropertyIcon key="description" value="category" size={14} />
											{/if}
											{category.name}
										</button>
									{/each}
								</div>
							</fieldset>
						{/if}

						<!-- Tags -->
						<fieldset>
							<legend class="mb-3 block text-sm font-medium text-gray-700">Tags</legend>

							<!-- Tag input -->
							<div class="mb-3 flex gap-2">
								<input
									bind:value={newTag}
									onkeydown={handleTagKeydown}
									placeholder="Add a tag..."
									class="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
								/>
								<button
									onclick={addTag}
									disabled={!newTag.trim()}
									class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-300"
								>
									Add
								</button>
							</div>

							<!-- Current tags -->
							{#if tags.length > 0}
								<div class="mb-3 flex flex-wrap gap-2">
									{#each tags as tag}
										<span
											class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 text-sm text-blue-800"
										>
											{tag}
											<button
												onclick={() => removeTag(tag)}
												class="text-blue-600 hover:text-blue-800"
												aria-label="Remove tag {tag}"
											>
												<PropertyIcon key="description" value="x" size={12} />
											</button>
										</span>
									{/each}
								</div>
							{/if}

							<!-- Recent tags -->
							{#if recentTags.length > 0}
								<div>
									<p class="mb-2 text-xs text-gray-500">Recent tags:</p>
									<div class="flex flex-wrap gap-1">
										{#each recentTags.filter((tag) => !tags.includes(tag)) as tag}
											<button
												onclick={() => {
													tags = [...tags, tag];
												}}
												class="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50 focus:ring-1 focus:ring-blue-500 focus:outline-none"
											>
												{tag}
											</button>
										{/each}
									</div>
								</div>
							{/if}
						</fieldset>

						<!-- Story Content Editor -->
						<fieldset>
							<legend class="mb-3 block text-sm font-medium text-gray-700">Story Content</legend>
							<div class="overflow-hidden rounded-md border border-gray-300">
								<StoryEditor
									bind:content
									placeholder="Write your story here. Click 'Insert Feature' to add map features to your story..."
								/>
							</div>
						</fieldset>

						<!-- Privacy Settings -->
						<div>
							<label class="flex items-center gap-2 text-sm font-medium text-gray-700">
								<input
									type="checkbox"
									bind:checked={isPublic}
									class="rounded border-gray-300 focus:border-blue-500 focus:ring-blue-500"
								/>
								Make this story public
								<PropertyIcon key="description" value={isPublic ? 'public' : 'private'} size={14} />
							</label>
							<p class="mt-1 text-xs text-gray-500">
								Public stories can be shared with other users in the future.
							</p>
						</div>
					</div>
				</div>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	/* Ensure proper flex layout and scrolling */
	.story-editor-scrollable {
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
	.story-editor-scrollable::-webkit-scrollbar {
		width: 14px; /* Make it visible but not too wide */
		-webkit-appearance: none;
		display: block !important; /* Force it to show */
	}

	.story-editor-scrollable::-webkit-scrollbar-track {
		background: #f3f4f6; /* Light gray track - more visible */
		border-radius: 8px;
		border: 1px solid #e5e7eb;
	}

	.story-editor-scrollable::-webkit-scrollbar-thumb {
		background: #9ca3af; /* Medium gray thumb - more visible */
		border-radius: 8px;
		border: 2px solid #f3f4f6;
		min-height: 40px; /* Ensure minimum thumb size */
	}

	.story-editor-scrollable::-webkit-scrollbar-thumb:hover {
		background: #6b7280; /* Darker on hover */
	}

	.story-editor-scrollable::-webkit-scrollbar-thumb:active {
		background: #4b5563; /* Darkest when active */
	}

	.story-editor-scrollable::-webkit-scrollbar-corner {
		background: #f3f4f6;
	}
</style>
