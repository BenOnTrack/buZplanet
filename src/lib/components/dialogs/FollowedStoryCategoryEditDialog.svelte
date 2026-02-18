<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { clsx } from 'clsx';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';

	let {
		open = $bindable(false),
		story,
		onSave = undefined
	}: {
		open?: boolean;
		story?: Story | null;
		onSave?: (updatedStory: Story) => void;
	} = $props();

	// Form state
	let selectedCategories = $state<string[]>([]);
	let availableCategories = $state<StoryCategory[]>([]);
	let saving = $state(false);
	let error = $state<string | null>(null);

	// Category creation state
	let showCreateCategory = $state(false);
	let newCategoryName = $state('');
	let newCategoryColor = $state('#3B82F6');
	let newCategoryIcon = $state('');

	// Load data when dialog opens
	$effect(() => {
		if (open && story) {
			loadCategoriesAndInitialize();
		}
	});

	// Initialize form with current story categories
	function initializeForm() {
		if (story) {
			selectedCategories = [...(story.categories || [])];
		}
		error = null;
	}

	// Load available categories
	async function loadCategoriesAndInitialize() {
		try {
			availableCategories = await storiesDB.getAllCategories();
			initializeForm();
		} catch (err) {
			console.error('Failed to load categories:', err);
			error = 'Failed to load categories. Please try again.';
		}
	}

	// Toggle category selection
	function toggleCategory(categoryId: string) {
		if (selectedCategories.includes(categoryId)) {
			selectedCategories = selectedCategories.filter((cat) => cat !== categoryId);
		} else {
			selectedCategories = [...selectedCategories, categoryId];
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
			selectedCategories = [...selectedCategories, categoryId];

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

	// Save category changes
	async function saveCategories() {
		if (!story) return;

		try {
			saving = true;
			error = null;

			// Get author and story IDs from the followed story
			const authorUserId = (story as any).authorUserId;
			const followedStoryId = story.id; // This is already the prefixed ID

			if (!authorUserId) {
				throw new Error('Cannot identify story author');
			}

			console.log(`💾 Saving categories for followed story:`, {
				authorUserId,
				followedStoryId,
				selectedCategories
			});

			// Update the followed story category locally
			// Pass the full followedStoryId as the second parameter since it's already prefixed
			const updatedStory = await storiesDB.updateFollowedStoryCategory(
				authorUserId,
				followedStoryId, // Pass the already-prefixed ID
				selectedCategories
			);

			if (!updatedStory) {
				throw new Error('Failed to update story category');
			}

			console.log('✅ Successfully updated followed story categories');

			// Call the save callback with updated story
			if (onSave) {
				onSave(updatedStory);
			}

			// Close dialog
			open = false;
		} catch (err) {
			console.error('❌ Failed to save categories:', err);
			error = err instanceof Error ? err.message : 'Failed to save categories';
		} finally {
			saving = false;
		}
	}

	// Cancel editing
	function cancel() {
		open = false;
		initializeForm();
	}
</script>

<!-- Category Edit Dialog -->
<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay class="fixed inset-0 bg-black/50" style="z-index: {Z_INDEX.DIALOG_OVERLAY}" />
		<Dialog.Content
			class="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-6 shadow-lg"
			style="z-index: {Z_INDEX.DIALOG_CONTENT}"
		>
			<div class="space-y-4">
				<!-- Header -->
				<div class="flex items-center justify-between">
					<Dialog.Title class="text-lg font-semibold text-gray-900">
						Edit Story Categories
					</Dialog.Title>
					<Dialog.Close
						class="rounded-md p-1 text-gray-400 transition-colors hover:text-gray-600 focus:text-gray-600 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
					>
						<PropertyIcon key="description" value="x" size={16} />
						<span class="sr-only">Close</span>
					</Dialog.Close>
				</div>

				<!-- Story info -->
				{#if story}
					{@const authorName = (story as any).authorName}
					{@const authorUsername = (story as any).authorUsername}
					<div class="rounded-md bg-blue-50 p-3">
						<div class="flex items-start gap-2">
							<PropertyIcon key="description" value="info" size={16} class="mt-0.5 text-blue-600" />
							<div class="flex-1 text-sm">
								<p class="font-medium text-blue-900">"{story.title}"</p>
								<p class="text-blue-700">
									by {authorName}{authorUsername ? ` (@${authorUsername})` : ''}
								</p>
								<p class="mt-1 text-blue-600">
									Assign your own categories to organize this story in your collection.
								</p>
							</div>
						</div>
					</div>
				{/if}

				<!-- Error message -->
				{#if error}
					<div class="rounded-md border border-red-200 bg-red-50 p-3">
						<div class="flex items-center gap-2 text-red-700">
							<PropertyIcon key="description" value="error" size={16} />
							{error}
						</div>
					</div>
				{/if}

				<!-- Categories Selection -->
				{#if availableCategories.length > 0}
					<fieldset>
						<legend class="mb-3 block text-sm font-medium text-gray-700">Select Categories</legend>
						<div class="flex flex-wrap gap-2">
							{#each availableCategories as category}
								<button
									type="button"
									class={clsx(
										'inline-flex cursor-pointer items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none',
										{
											'text-white': selectedCategories.includes(category.id),
											'border border-gray-300 text-gray-700 hover:bg-gray-50':
												!selectedCategories.includes(category.id)
										}
									)}
									style={selectedCategories.includes(category.id)
										? `background-color: ${category.color}`
										: ''}
									onclick={() => toggleCategory(category.id)}
									aria-pressed={selectedCategories.includes(category.id)}
									aria-label="{selectedCategories.includes(category.id)
										? 'Remove'
										: 'Add'} category {category.name}"
								>
									{category.icon || '📂'}
									{category.name}
								</button>
							{/each}
						</div>
					</fieldset>
				{/if}

				<!-- Create New Category -->
				<fieldset>
					<legend class="mb-3 block text-sm font-medium text-gray-700">Create New Category</legend>

					{#if !showCreateCategory}
						<button
							type="button"
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
								<label for="category-name" class="mb-1 block text-sm font-medium text-gray-700">
									Category Name *
								</label>
								<input
									id="category-name"
									type="text"
									bind:value={newCategoryName}
									placeholder="e.g., Photography, Work, Family"
									class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
									required
								/>
							</div>

							<!-- Category Color and Icon -->
							<div class="grid grid-cols-2 gap-4">
								<div>
									<label for="category-color" class="mb-1 block text-sm font-medium text-gray-700">
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
									<label for="category-icon" class="mb-1 block text-sm font-medium text-gray-700">
										Icon (optional)
									</label>
									<input
										id="category-icon"
										type="text"
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
									type="button"
									class="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400"
									onclick={createCategory}
									disabled={!newCategoryName.trim()}
								>
									Create Category
								</button>
								<button
									type="button"
									class="rounded-md border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
									onclick={cancelCreateCategory}
								>
									Cancel
								</button>
							</div>
						</div>
					{/if}
				</fieldset>

				<!-- Action buttons -->
				<div class="flex justify-end gap-2 pt-4">
					<button
						type="button"
						class="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
						onclick={cancel}
						disabled={saving}
					>
						Cancel
					</button>
					<button
						type="button"
						class={clsx(
							'rounded-md px-4 py-2 text-sm font-medium text-white transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none',
							{
								'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500': !saving,
								'cursor-not-allowed bg-blue-400': saving
							}
						)}
						onclick={saveCategories}
						disabled={saving}
					>
						{#if saving}
							Saving...
						{:else}
							Save Categories
						{/if}
					</button>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
