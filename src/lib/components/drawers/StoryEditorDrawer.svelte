<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { userStore } from '$lib/stores/UserStore.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import StoryEditor from '../stories/StoryEditor.svelte';
	import StoryCategoryManager from '$lib/components/stories/StoryCategoryManager.svelte';
	import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte';

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
	let categories = $state<string[]>([]);
	let isPublic = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Available categories state for StoryCategoryManager
	let availableCategories = $state<StoryCategory[]>([]);
	let categoryManagerError = $state<string | null>(null);

	// Confirmation dialog state
	let confirmDiscardOpen = $state(false);

	// Tab management
	let activeTab = $state<'metadata' | 'content'>('content');

	// Editor mode
	let isEditing = $derived(story !== null);

	// Track unsaved changes - CONVERTED TO DERIVED
	let hasUnsavedChanges = $derived.by(() => {
		if (!open) return false;
		return hasFormChanges();
	});

	// Modern mobile keyboard detection using Visual Viewport API
	let isKeyboardOpen = $state(false);

	// Track viewport changes for mobile keyboard - industry standard approach
	$effect(() => {
		if (typeof window === 'undefined') return;

		// Use Visual Viewport API (modern standard) if available
		if (window.visualViewport) {
			function handleViewportChange() {
				// Standard calculation: keyboard open if visual viewport is significantly smaller
				const heightDifference = window.innerHeight - window.visualViewport.height;
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

	// Load data when drawer opens - VALID SIDE EFFECT (calls async functions)
	$effect(() => {
		if (open) {
			loadAvailableData();
			initializeForm();
		}
	});

	// Initialize form based on story data
	function initializeForm() {
		if (story) {
			title = story.title;
			description = story.description || '';
			content = [...story.content];
			categories = [...story.categories];
			isPublic = story.isPublic;
		} else {
			// New story - start in content tab for better UX
			title = '';
			description = '';
			content = [];
			categories = [];
			isPublic = false;
			activeTab = 'content';
		}
		// Note: hasUnsavedChanges is now derived, no need to reset
	}

	// Check if form has changes - MADE PURE (no state mutations)
	function hasFormChanges(): boolean {
		if (!story) {
			// New story - has changes if any field is filled
			return !!(title || description || content.length > 0 || categories.length > 0);
		}

		// Editing - compare with original (using pure operations)
		return (
			title !== story.title ||
			description !== (story.description || '') ||
			JSON.stringify(content) !== JSON.stringify(story.content) ||
			JSON.stringify([...categories].sort()) !== JSON.stringify([...story.categories].sort()) ||
			isPublic !== story.isPublic
		);
	}

	// Load available categories
	async function loadAvailableData() {
		try {
			availableCategories = await storiesDB.getAllCategories();
		} catch (err) {
			console.error('Failed to load categories:', err);
		}
	}

	// Handle category changes from StoryCategoryManager
	function handleCategoriesChange(categories: StoryCategory[]) {
		availableCategories = categories;
	}

	// Save story
	async function saveStory() {
		console.log('💾 Starting story save process...');
		console.log('Title:', title.trim());
		console.log('Content:', content);
		console.log('Description:', description.trim());
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
					categories: [...categories],
					isPublic
				});

				// Create new story - saves locally immediately and queues background sync
				savedStory = await storiesDB.createStory(title.trim(), [...content], {
					description: description.trim() || undefined,
					categories: [...categories],
					isPublic
				});
				console.log('✅ storiesDB.createStory completed - story saved locally');
			}

			console.log('✅ Story saved successfully:', savedStory);
			// Note: hasUnsavedChanges is now derived, no need to set

			// Create social activity for the story (background operation - don't wait)
			try {
				const activityType = isEditing ? 'story_updated' : 'story_created';
				userStore
					.createActivity(activityType, {
						storyId: savedStory.id,
						itemTitle: savedStory.title,
						itemDescription: savedStory.description || undefined
					})
					.then(() => {
						console.log(`✅ Created social activity: ${activityType}`);
					})
					.catch((activityError) => {
						console.error('⚠️ Failed to create social activity:', activityError);
					});
			} catch (activityError) {
				console.error('⚠️ Failed to create social activity:', activityError);
				// Don't fail the story save if social activity fails
			}

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
			// Show confirmation dialog instead of browser confirm
			confirmDiscardOpen = true;
			return;
		}

		performCancel();
	}

	// Perform the actual cancel operation
	function performCancel() {
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

	// Toggle category
	function toggleCategory(categoryId: string) {
		if (categories.includes(categoryId)) {
			categories = categories.filter((cat) => cat !== categoryId);
		} else {
			categories = [...categories, categoryId];
		}
	}

	// Switch tabs
	function switchTab(tab: 'metadata' | 'content') {
		activeTab = tab;
	}
</script>

<!-- Story Editor Drawer -->
<Drawer.Root
	bind:open
	onOpenChange={(newOpen) => {
		if (!newOpen) handleDrawerClose();
	}}
	modal={false}
>
	<Drawer.Portal>
		<Drawer.Overlay
			class={clsx('fixed inset-0 bg-black/40 transition-opacity duration-300', {
				'keyboard-open': isKeyboardOpen
			})}
			style="z-index: {Z_INDEX.DRAWER_OVERLAY}"
		/>
		<Drawer.Content
			class={clsx(
				'story-editor-drawer fixed right-0 bottom-0 left-0 flex h-[50vh] max-h-[50vh] flex-col rounded-t-[10px] border border-gray-200 bg-white',
				{
					'keyboard-open': isKeyboardOpen
				}
			)}
			style="z-index: {Z_INDEX.DRAWER_CONTENT}"
		>
			<div class="mx-auto flex h-full w-full max-w-full flex-col overflow-hidden">
				<!-- Header -->
				<div class="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-3">
					<div class="flex items-center justify-between">
						<Drawer.Title class="flex items-center gap-2 text-xl font-semibold">
							<PropertyIcon key="description" value="edit" size={24} />
							{isEditing ? 'Edit Story' : 'New Story'}
						</Drawer.Title>

						<div class="flex items-center gap-3">
							{#if hasUnsavedChanges}
								<span class="flex items-center gap-1 text-xs text-orange-600">
									<PropertyIcon key="description" value="unsaved" size={12} />
									Unsaved
								</span>
							{/if}

							<button
								class="rounded bg-gray-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
								onclick={cancel}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										cancel();
									}
								}}
								disabled={saving}
							>
								CANCEL
							</button>

							<button
								class={clsx(
									'rounded px-3 py-1.5 text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none',
									{
										'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500': !saving && title.trim(),
										'cursor-not-allowed bg-gray-400': saving || !title.trim()
									}
								)}
								onclick={saveStory}
								onkeydown={(e) => {
									if ((e.key === 'Enter' || e.key === ' ') && !saving && title.trim()) {
										e.preventDefault();
										saveStory();
									}
								}}
								disabled={saving || !title.trim()}
							>
								{#if saving}
									SAVING...
								{:else}
									{isEditing ? 'UPDATE' : 'CREATE'}
								{/if}
							</button>

							<Drawer.Close
								class="rounded-md p-1 text-gray-600 transition-colors hover:text-gray-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
								onclick={cancel}
							>
								<PropertyIcon key="description" value="x" size={20} />
								<span class="sr-only">Close</span>
							</Drawer.Close>
						</div>
					</div>

					<!-- Error message -->
					{#if error}
						<div class="mt-3 rounded-md border border-red-200 bg-red-50 p-3">
							<div class="flex items-center gap-2 text-red-700">
								<PropertyIcon key="description" value="error" size={16} />
								{error}
							</div>
						</div>
					{/if}
				</div>

				<!-- Tab Navigation -->
				<div class="flex-shrink-0 border-b border-gray-200 bg-white">
					<div class="flex">
						<button
							class={clsx(
								'border-b-2 px-4 py-3 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
								{
									'border-blue-600 bg-blue-50 text-blue-600': activeTab === 'content',
									'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700':
										activeTab !== 'content'
								}
							)}
							onclick={() => switchTab('content')}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									switchTab('content');
								}
							}}
							role="tab"
							aria-selected={activeTab === 'content'}
						>
							<div class="flex items-center gap-2">
								<PropertyIcon key="description" value="edit" size={16} />
								Content
								{#if content.length > 0}
									<span
										class="inline-flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-xs text-white"
									>
										{content.length}
									</span>
								{/if}
							</div>
						</button>

						<button
							class={clsx(
								'border-b-2 px-4 py-3 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
								{
									'border-blue-600 bg-blue-50 text-blue-600': activeTab === 'metadata',
									'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700':
										activeTab !== 'metadata'
								}
							)}
							onclick={() => switchTab('metadata')}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									switchTab('metadata');
								}
							}}
							role="tab"
							aria-selected={activeTab === 'metadata'}
						>
							<div class="flex items-center gap-2">
								<PropertyIcon key="description" value="settings" size={16} />
								Details
								{#if title || description || categories.length > 0}
									<span
										class="inline-flex h-2 w-2 items-center justify-center rounded-full bg-blue-600"
									>
									</span>
								{/if}
							</div>
						</button>
					</div>
				</div>

				<!-- Tab Content -->
				<div class="flex flex-1 flex-col overflow-hidden">
					{#if activeTab === 'content'}
						<!-- Story Content Editor with sticky toolbar -->
						<div class="flex flex-1 flex-col overflow-hidden">
							<StoryEditor
								bind:content
								placeholder="Write your story here. Click 'Insert Feature' to add map features to your story..."
								class="story-editor-with-sticky-toolbar"
							/>
						</div>
					{:else}
						<!-- Metadata Tab -->
						<div class="flex-1 overflow-auto px-4 py-4">
							<div class="space-y-6">
								<!-- Title Input -->
								<div>
									<label for="story-title" class="mb-2 block text-sm font-medium text-gray-700">
										Story Title *
									</label>
									<input
										id="story-title"
										bind:value={title}
										placeholder="Enter your story title..."
										class="block w-full rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
										required
									/>
								</div>
								<!-- Description -->
								<div>
									<label
										for="story-description"
										class="mb-2 block text-sm font-medium text-gray-700"
									>
										Description (Optional)
									</label>
									<textarea
										id="story-description"
										bind:value={description}
										placeholder="Brief description of your story..."
										rows="3"
										class="block w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-base focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
									></textarea>
								</div>

								<!-- Categories -->
								<fieldset>
									<legend class="mb-3 block text-sm font-medium text-gray-700">Categories</legend>
									<StoryCategoryManager
										bind:availableCategories
										bind:selectedCategories={categories}
										bind:error={categoryManagerError}
										onCategoriesChange={handleCategoriesChange}
										showSelection={true}
										allowDelete={false}
										class="w-full"
									/>
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
										<PropertyIcon
											key="description"
											value={isPublic ? 'public' : 'private'}
											size={14}
										/>
									</label>
									<p class="mt-1 text-xs text-gray-500">
										Public stories can be shared with other users in the future.
									</p>
								</div>
							</div>
						</div>
					{/if}
				</div>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<!-- Discard Changes Confirmation Dialog -->
<ConfirmDialog
	bind:open={confirmDiscardOpen}
	title="Discard Changes"
	message="You have unsaved changes. Are you sure you want to discard them?"
	variant="destructive"
	confirmText="Discard"
	onConfirm={performCancel}
/>

<style>
	/* Mobile keyboard handling - industry standard approach */
	.story-editor-drawer {
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
	.story-editor-drawer.keyboard-open {
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
	:global(.story-editor-drawer input[type='text']),
	:global(.story-editor-drawer input[type='email']),
	:global(.story-editor-drawer input[type='password']),
	:global(.story-editor-drawer textarea),
	:global(.story-editor-drawer [contenteditable]) {
		font-size: 16px !important; /* Prevents iOS zoom - industry standard */
	}

	/* Responsive adjustments for mobile */
	@media screen and (max-width: 768px) {
		.story-editor-drawer {
			/* Smaller height on mobile to account for keyboard */
			height: 45vh !important;
			max-height: 45vh !important;
			/* Minimum usable height */
			min-height: 300px !important;
		}
	}

	/* Story Editor with sticky toolbar */
	:global(.story-editor-with-sticky-toolbar) {
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
	}

	/* Make the toolbar sticky */
	:global(.story-editor-with-sticky-toolbar .border-b.border-gray-200.bg-gray-50) {
		position: sticky;
		top: 0;
		z-index: 10;
		flex-shrink: 0;
	}

	/* Make the editor content scrollable */
	:global(.story-editor-with-sticky-toolbar [contenteditable]) {
		flex: 1;
		overflow-y: auto;
		min-height: 0;
	}
</style>
