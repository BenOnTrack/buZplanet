<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { clsx } from 'clsx';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import { mapControl } from '$lib/stores/MapControl.svelte';
	import { userStore } from '$lib/stores/UserStore.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import StoryEditor from '../stories/StoryEditor.svelte';

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

	// Available categories
	let availableCategories = $state<StoryCategory[]>([]);
	let newCategoryName = $state('');
	let newCategoryColor = $state('#3B82F6');
	let newCategoryIcon = $state('');
	let showCreateCategory = $state(false);

	// Mobile focus management
	let isMobileFocused = $state(false);
	let focusedElement = $state<HTMLElement | null>(null);
	let viewportHeight = $state('100vh');

	// Detect mobile device
	let isMobile = $state(false);
	$effect(() => {
		isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
			navigator.userAgent
		);
	});

	// Handle viewport height changes (for virtual keyboard)
	$effect(() => {
		if (!isMobile || typeof window === 'undefined') return;

		function updateViewportHeight() {
			// Use the actual viewport height, accounting for virtual keyboard
			const newHeight = window.visualViewport?.height || window.innerHeight;
			viewportHeight = `${newHeight}px`;
			console.log('📱 Viewport height updated:', viewportHeight);
		}

		updateViewportHeight();

		// Listen for viewport changes (virtual keyboard show/hide)
		const cleanup = [];
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', updateViewportHeight);
			cleanup.push(() => {
				window.visualViewport?.removeEventListener('resize', updateViewportHeight);
			});
		} else {
			// Fallback for browsers without visualViewport
			window.addEventListener('resize', updateViewportHeight);
			cleanup.push(() => {
				window.removeEventListener('resize', updateViewportHeight);
			});
		}

		return () => {
			cleanup.forEach((fn) => fn());
		};
	});

	// Handle mobile focus events
	function handleMobileFocus(event: FocusEvent) {
		if (!isMobile) return;

		const target = event.target as HTMLElement;

		// Only trigger mobile focus for specific form inputs, NOT the story editor
		if (
			target.matches('input[type="text"], input[type="email"], input[type="password"], textarea')
		) {
			// Also check if it's not inside the story editor
			const storyEditor = target.closest('.story-editor');
			if (!storyEditor) {
				console.log('📱 Mobile focus detected:', target);
				isMobileFocused = true;
				focusedElement = target;

				// Add mobile focus class to drawer
				setTimeout(() => {
					const drawer = document.querySelector('.story-editor-drawer-mobile');
					if (drawer) {
						drawer.classList.add('mobile-focused');
					}
				}, 100);
			}
		}
	}

	function handleMobileBlur(event: FocusEvent) {
		if (!isMobile) return;

		// Small delay to prevent flickering when focus moves between elements
		setTimeout(() => {
			const activeElement = document.activeElement as HTMLElement;
			if (
				!activeElement ||
				!activeElement.matches(
					'input[type="text"], input[type="email"], input[type="password"], textarea'
				)
			) {
				console.log('📱 Mobile blur detected - removing focus');
				isMobileFocused = false;
				focusedElement = null;

				// Remove mobile focus class
				const drawer = document.querySelector('.story-editor-drawer-mobile');
				if (drawer) {
					drawer.classList.remove('mobile-focused');
				}
			} else {
				// Check if the focused element is inside story editor
				const storyEditor = activeElement.closest('.story-editor');
				if (storyEditor) {
					console.log('📱 Focus moved to story editor - removing mobile focus');
					isMobileFocused = false;
					focusedElement = null;

					// Remove mobile focus class
					const drawer = document.querySelector('.story-editor-drawer-mobile');
					if (drawer) {
						drawer.classList.remove('mobile-focused');
					}
				}
			}
		}, 150);
	}

	// Handle viewport changes on mobile - improved version
	$effect(() => {
		if (!isMobile) return;

		function handleViewportChange() {
			// Force redraw to handle keyboard appearance/disappearance
			const drawer = document.querySelector('.story-editor-drawer-mobile');
			if (drawer) {
				// Force reflow and ensure proper height
				drawer.scrollTop = drawer.scrollTop;

				// If keyboard disappeared but we're still marked as focused, check if we should unfocus
				if (isMobileFocused) {
					const activeElement = document.activeElement as HTMLElement;
					if (
						!activeElement ||
						!activeElement.matches(
							'input[type="text"], input[type="email"], input[type="password"], textarea'
						)
					) {
						console.log('📱 Keyboard disappeared - removing mobile focus');
						isMobileFocused = false;
						focusedElement = null;
						drawer.classList.remove('mobile-focused');
					}
				}
			}
		}

		// More aggressive event listening for mobile viewport changes
		const events = ['resize', 'orientationchange', 'scroll'];
		const cleanup = events.map((event) => {
			window.addEventListener(event, handleViewportChange);
			return () => window.removeEventListener(event, handleViewportChange);
		});

		// Also listen to visual viewport if available
		if (window.visualViewport) {
			window.visualViewport.addEventListener('resize', handleViewportChange);
			cleanup.push(() =>
				window.visualViewport?.removeEventListener('resize', handleViewportChange)
			);
		}

		return () => {
			cleanup.forEach((fn) => fn());
		};
	});

	// Editor mode
	let isEditing = $derived(story !== null);
	let hasUnsavedChanges = $state(false);

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
		hasUnsavedChanges = false;
	}

	// Check if form has changes
	function hasFormChanges(): boolean {
		if (!story) {
			// New story - has changes if any field is filled
			return !!(title || description || content.length > 0 || categories.length > 0);
		}

		// Editing - compare with original
		return (
			title !== story.title ||
			description !== (story.description || '') ||
			JSON.stringify(content) !== JSON.stringify(story.content) ||
			JSON.stringify(categories.sort()) !== JSON.stringify([...story.categories].sort()) ||
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
			hasUnsavedChanges = false;

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

	// Toggle category
	function toggleCategory(categoryId: string) {
		if (categories.includes(categoryId)) {
			categories = categories.filter((cat) => cat !== categoryId);
		} else {
			categories = [...categories, categoryId];
		}
	}

	// Create new category
	async function createCategory() {
		if (!newCategoryName.trim()) return;

		try {
			// Generate a unique ID for the category
			const categoryId = newCategoryName
				.trim()
				.toLowerCase()
				.replace(/\s+/g, '-')
				.replace(/[^a-z0-9-]/g, '');

			// Check if category already exists
			const existingCategory = availableCategories.find((cat) => cat.id === categoryId);
			if (existingCategory) {
				error = `Category "${newCategoryName}" already exists`;
				return;
			}

			// Create the category
			const newCategory = await storiesDB.createCategory({
				id: categoryId,
				name: newCategoryName.trim(),
				color: newCategoryColor,
				icon: newCategoryIcon.trim() || undefined,
				description: `Custom category: ${newCategoryName.trim()}`
			});

			// Add to available categories
			availableCategories = [...availableCategories, newCategory].sort((a, b) =>
				a.name.localeCompare(b.name)
			);

			// Auto-select the new category
			categories = [...categories, categoryId];

			// Reset form
			cancelCreateCategory();

			console.log('✅ Created new category:', newCategory);
		} catch (err) {
			console.error('❌ Failed to create category:', err);
			error = 'Failed to create category. Please try again.';
		}
	}

	// Cancel category creation
	function cancelCreateCategory() {
		showCreateCategory = false;
		newCategoryName = '';
		newCategoryColor = '#3B82F6';
		newCategoryIcon = '';
		error = null;
	}

	// Tab management
	let activeTab = $state<'metadata' | 'content'>('content');

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
			class={clsx('fixed inset-0 transition-opacity duration-300', {
				'bg-black/40': !isMobileFocused,
				'bg-black/20': isMobileFocused
			})}
			style="z-index: {Z_INDEX.DRAWER_OVERLAY}"
		/>
		<Drawer.Content
			class={clsx(
				'story-editor-drawer-mobile fixed right-0 bottom-0 left-0 flex flex-col rounded-t-[10px] border border-gray-200 bg-white transition-all duration-300 ease-in-out',
				{
					'h-[50vh]': !isMobileFocused || !isMobile,
					'h-[95vh]': isMobileFocused && isMobile
				}
			)}
			style="z-index: {Z_INDEX.DRAWER_CONTENT}; {isMobile
				? `max-height: min(95vh, ${viewportHeight});`
				: ''}"
			onfocusin={handleMobileFocus}
			onfocusout={handleMobileBlur}
		>
			<div class="mx-auto flex h-full w-full max-w-full flex-col overflow-hidden">
				<!-- Sticky Header Section -->
				<div class="flex-shrink-0 border-b border-gray-200 bg-white px-4 py-2">
					<!-- Header with action buttons -->
					<div class="flex items-center justify-between">
						<Drawer.Title class="flex items-center gap-2 text-2xl font-medium">
							<PropertyIcon key="description" value="edit" size={24} />
							{isEditing ? 'Edit Story' : 'New Story'}
						</Drawer.Title>

						<div class="flex items-center gap-2">
							{#if hasUnsavedChanges}
								<span class="flex items-center gap-1 text-xs text-orange-600">
									<PropertyIcon key="description" value="unsaved" size={12} />
									Unsaved
								</span>
							{/if}

							<button
								class="rounded bg-gray-500 px-3 py-1 text-sm font-medium text-white hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
								onclick={cancel}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										cancel();
									}
								}}
								title="Cancel editing"
								aria-label="Cancel editing"
								disabled={saving}
							>
								CANCEL
							</button>

							<button
								class={clsx(
									'rounded px-3 py-1 text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none',
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
								title={isEditing ? 'Update story' : 'Create story'}
								aria-label={isEditing ? 'Update story' : 'Create story'}
								disabled={saving || !title.trim()}
							>
								{#if saving}
									SAVING...
								{:else}
									{isEditing ? 'UPDATE' : 'CREATE'}
								{/if}
							</button>

							<Drawer.Close
								class="rounded-md p-1 text-gray-600 transition-colors hover:text-gray-800 focus:text-gray-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
								onclick={cancel}
							>
								<PropertyIcon key="description" value="x" size={20} class="text-foreground" />
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
								'border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
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
							title="Edit story content"
							aria-label="Edit story content"
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
								'border-b-2 px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
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
							title="Edit story details"
							aria-label="Edit story details"
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
				{#if activeTab === 'content'}
					<!-- Story Content Editor - Full Height -->
					<div class="flex flex-1 flex-col overflow-hidden">
						<div class="flex-1 overflow-hidden">
							<StoryEditor
								bind:content
								placeholder="Write your story here. Click 'Insert Feature' to add map features to your story..."
							/>
						</div>
					</div>
				{:else}
					<!-- Metadata Tab - Scrollable Content Area -->
					<div class="story-editor-scrollable flex-1 overflow-auto px-4 py-4">
						<div class="space-y-6 pb-8">
							<!-- Title Input -->
							<div>
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
											<span
												class={clsx(
													'inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors',
													{
														'text-white': categories.includes(category.id),
														'border border-gray-300 text-gray-700 hover:bg-gray-50':
															!categories.includes(category.id)
													}
												)}
												style={categories.includes(category.id)
													? `background-color: ${category.color}`
													: ''}
												role="button"
												tabindex="0"
												aria-label="{categories.includes(category.id)
													? 'Remove'
													: 'Add'} category {category.name}"
												onclick={() => toggleCategory(category.id)}
												onkeydown={(e) => {
													if (e.key === 'Enter' || e.key === ' ') {
														e.preventDefault();
														toggleCategory(category.id);
													}
												}}
											>
												{category.icon || '📂'}
												{category.name}
											</span>
										{/each}
									</div>
								</fieldset>
							{/if}

							<!-- Create New Category -->
							<fieldset>
								<legend class="mb-3 block text-sm font-medium text-gray-700"
									>Create New Category</legend
								>

								{#if !showCreateCategory}
									<button
										class="inline-flex items-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
										onclick={() => (showCreateCategory = true)}
									>
										<PropertyIcon key="description" value="plus" size={16} />
										Add Custom Category
									</button>
								{:else}
									<div class="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
										<!-- Category Name -->
										<div>
											<label
												for="category-name"
												class="mb-1 block text-sm font-medium text-gray-700"
											>
												Category Name *
											</label>
											<input
												id="category-name"
												bind:value={newCategoryName}
												placeholder="e.g., Photography, Work, Family"
												class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
												required
											/>
										</div>

										<!-- Category Color and Icon -->
										<div class="grid grid-cols-2 gap-4">
											<div>
												<label
													for="category-color"
													class="mb-1 block text-sm font-medium text-gray-700"
												>
													Color
												</label>
												<input
													id="category-color"
													type="color"
													bind:value={newCategoryColor}
													class="block h-10 w-full rounded-md border border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
												/>
											</div>
											<div>
												<label
													for="category-icon"
													class="mb-1 block text-sm font-medium text-gray-700"
												>
													Icon (optional)
												</label>
												<input
													id="category-icon"
													bind:value={newCategoryIcon}
													placeholder="📸 💼 👨‍👩‍👧‍👦"
													maxlength="2"
													class="block w-full rounded-md border border-gray-300 px-3 py-2 text-center text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
												/>
											</div>
										</div>

										<!-- Preview -->
										{#if newCategoryName}
											<div>
												<p class="mb-2 text-sm text-gray-700">Preview:</p>
												<span
													class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white"
													style="background-color: {newCategoryColor}"
												>
													{newCategoryIcon || '📂'}
													{newCategoryName}
												</span>
											</div>
										{/if}

										<!-- Actions -->
										<div class="flex gap-2">
											<button
												class="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
												onclick={createCategory}
												disabled={!newCategoryName.trim()}
											>
												Create Category
											</button>
											<button
												class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
												onclick={cancelCreateCategory}
											>
												Cancel
											</button>
										</div>
									</div>
								{/if}
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
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	/* Ensure proper flex layout and scrolling for main content */
	.story-editor-scrollable {
		scrollbar-width: auto; /* For Firefox - use auto for better visibility */
		scrollbar-color: #6b7280 #e5e7eb; /* For Firefox - visible colors */
		overflow-x: hidden; /* Prevent horizontal scrolling on main content */
		overflow-y: auto; /* Only vertical scrolling for main content */
	}

	/* WebKit scrollbar styling - make it always visible and prominent FOR MAIN CONTENT ONLY */
	.story-editor-scrollable::-webkit-scrollbar {
		width: 14px; /* Make it visible but not too wide */
		height: auto; /* Reset height to prevent horizontal scrollbar */
		-webkit-appearance: none;
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

	/* Mobile focus styles */
	.story-editor-drawer-mobile {
		/* Prevent iOS Safari from hiding the drawer behind the keyboard */
		position: fixed !important;
		bottom: 0 !important;
		transform: translateY(0) !important;
		/* Smooth transitions for height changes */
		transition:
			height 0.3s ease-in-out,
			max-height 0.3s ease-in-out;
	}

	.story-editor-drawer-mobile.mobile-focused {
		/* When mobile keyboard is open, take up more space */
		height: 95vh !important;
		max-height: 95vh !important;
		/* Ensure it stays visible */
		visibility: visible !important;
		opacity: 1 !important;
		/* Prevent Safari from moving the drawer */
		transform: translateY(0) !important;
		/* Force immediate layout recalculation */
		will-change: height, max-height;
	}

	/* When mobile focus is removed, ensure smooth transition back */
	.story-editor-drawer-mobile:not(.mobile-focused) {
		height: 50vh !important;
		max-height: 50vh !important;
		/* Force layout recalculation */
		will-change: auto;
	}

	/* Fix for iOS Safari viewport issues */
	@supports (-webkit-touch-callout: none) {
		.story-editor-drawer-mobile {
			/* Use fixed positioning to prevent Safari issues */
			position: fixed !important;
			top: auto !important;
			bottom: 0 !important;
			left: 0 !important;
			right: 0 !important;
			/* Prevent Safari from doing weird things with the drawer */
			-webkit-transform: translateZ(0);
			transform: translateZ(0);
			/* Ensure smooth transitions */
			transition:
				height 0.3s ease-in-out,
				max-height 0.3s ease-in-out;
		}

		.story-editor-drawer-mobile.mobile-focused {
			/* On iOS, when keyboard appears, use viewport height units that account for keyboard */
			height: 95vh !important;
			max-height: 95vh !important;
			/* Force hardware acceleration */
			-webkit-transform: translateZ(0);
			transform: translateZ(0);
			/* Prevent bouncing */
			-webkit-overflow-scrolling: touch;
		}

		/* Ensure proper restoration when keyboard disappears */
		.story-editor-drawer-mobile:not(.mobile-focused) {
			height: 50vh !important;
			max-height: 50vh !important;
			/* Force layout recalculation */
			-webkit-transform: translateZ(0);
			transform: translateZ(0);
		}
	}

	/* Ensure input elements are properly visible when focused */
	:global(.story-editor-drawer-mobile.mobile-focused input[type='text']),
	:global(.story-editor-drawer-mobile.mobile-focused input[type='email']),
	:global(.story-editor-drawer-mobile.mobile-focused input[type='password']),
	:global(.story-editor-drawer-mobile.mobile-focused textarea) {
		/* Ensure focused elements stay visible */
		background-color: white !important;
		border-color: #3b82f6 !important;
		box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1) !important;
		/* Prevent zoom on iOS */
		font-size: 16px !important;
	}

	/* Story editor should never trigger mobile expansion */
	:global(.story-editor [contenteditable]) {
		/* Prevent zoom on iOS for story editor */
		font-size: 16px !important;
		/* But don't apply the mobile focus styles */
	}

	/* Category filters horizontal scrolling - EXACT COPY from StoryViewer */
	.categories-tags-container {
		overflow: hidden;
		width: 100%;
	}

	.categories-tags-scroll {
		display: flex;
		gap: 0.5rem;
		overflow-x: auto;
		padding-bottom: 0.25rem;
		scrollbar-width: thin;
		scrollbar-color: #d1d5db transparent;
	}

	.categories-tags-scroll::-webkit-scrollbar {
		height: 4px;
	}

	.categories-tags-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.categories-tags-scroll::-webkit-scrollbar-thumb {
		background: #d1d5db;
		border-radius: 2px;
	}

	.categories-tags-scroll::-webkit-scrollbar-thumb:hover {
		background: #9ca3af;
	}
</style>
