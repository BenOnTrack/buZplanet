<script lang="ts">
	import { clsx } from 'clsx';
	import { onMount } from 'svelte';
	import { storiesDB } from '$lib/stores/StoriesDB.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import ConfirmDialog from '$lib/components/dialogs/ConfirmDialog.svelte';

	let {
		availableCategories = $bindable([]),
		selectedCategories = $bindable([]),
		error = $bindable(null),
		onCategoriesChange = undefined,
		showSelection = true,
		allowDelete = false,
		class: className = ''
	}: {
		availableCategories?: StoryCategory[];
		selectedCategories?: string[];
		error?: string | null;
		onCategoriesChange?: (categories: StoryCategory[]) => void;
		showSelection?: boolean;
		allowDelete?: boolean;
		class?: string;
	} = $props();

	// Category creation state
	let showCreateCategory = $state(false);
	let newCategoryName = $state('');
	let newCategoryColor = $state('#3B82F6');
	let newCategoryIcon = $state('');
	let creating = $state(false);
	let deletingCategory = $state<string | null>(null);

	// Confirmation dialog state
	let confirmDialogOpen = $state(false);
	let confirmDialogTitle = $state('');
	let confirmDialogMessage = $state('');
	let confirmDialogVariant = $state<'destructive' | 'primary' | 'secondary'>('destructive');
	let confirmDialogConfirmText = $state('Confirm');
	let confirmDialogAction = $state<(() => Promise<void>) | null>(null);
	let categoryToDelete = $state<StoryCategory | null>(null);

	// Load categories and their usage information when component mounts
	onMount(() => {
		loadCategoriesWithUsage();
	});

	// Track category usage information
	let categoryUsage = $state<
		Map<string, { inUse: boolean; storyCount: number; storyTitles: string[] }>
	>(new Map());

	// Load available categories with usage information
	async function loadCategoriesWithUsage() {
		try {
			availableCategories = await storiesDB.getAllCategories();

			// Load usage information for each category (only if deletion is allowed)
			if (allowDelete) {
				const usagePromises = availableCategories.map(async (category) => {
					try {
						const usage = await storiesDB.isCategoryInUse(category.id);
						return [category.id, usage] as [
							string,
							{ inUse: boolean; storyCount: number; storyTitles: string[] }
						];
					} catch (err) {
						console.warn(`Failed to check usage for category ${category.id}:`, err);
						return [category.id, { inUse: false, storyCount: 0, storyTitles: [] }] as [
							string,
							{ inUse: boolean; storyCount: number; storyTitles: string[] }
						];
					}
				});

				const usageResults = await Promise.all(usagePromises);
				categoryUsage = new Map(usageResults);
			}
		} catch (err) {
			console.error('Failed to load categories:', err);
			error = 'Failed to load categories. Please try again.';
		}
	}

	// Toggle category selection
	function toggleCategory(categoryId: string) {
		if (!showSelection) return;

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
			creating = true;
			error = null;

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

			// Auto-select the new category if selection is enabled
			if (showSelection) {
				selectedCategories = [...selectedCategories, categoryId];
			}

			// Reset form
			cancelCreateCategory();

			// Notify parent of changes
			if (onCategoriesChange) {
				onCategoriesChange(availableCategories);
			}

			// Reload usage information after creation
			if (allowDelete) {
				loadCategoriesWithUsage();
			}

			console.log('✅ Created new category:', newCategory);
		} catch (err) {
			console.error('❌ Failed to create category:', err);
			error = 'Failed to create category. Please try again.';
		} finally {
			creating = false;
		}
	}

	// Delete category
	async function deleteCategory(category: StoryCategory) {
		try {
			error = null;

			// First check if category is in use
			const usageCheck = await storiesDB.isCategoryInUse(category.id);

			if (usageCheck.inUse) {
				const storyList =
					usageCheck.storyTitles.length <= 5
						? usageCheck.storyTitles.map((title) => `"${title}"`).join(', ')
						: `${usageCheck.storyTitles
								.slice(0, 5)
								.map((title) => `"${title}"`)
								.join(', ')} and ${usageCheck.storyCount - 5} more`;

				const message = `Cannot delete category "${category.name}" because it is used by ${usageCheck.storyCount} ${usageCheck.storyCount === 1 ? 'story' : 'stories'}:\n\n${storyList}\n\nPlease remove this category from all stories before deleting it.`;

				// Show info dialog (non-destructive)
				confirmDialogTitle = 'Cannot Delete Category';
				confirmDialogMessage = message;
				confirmDialogVariant = 'secondary';
				confirmDialogConfirmText = 'OK';
				confirmDialogAction = null; // No action, just info
				categoryToDelete = null;
				confirmDialogOpen = true;
				return;
			}

			// If not in use, show confirmation dialog
			categoryToDelete = category;
			confirmDialogTitle = 'Delete Category';
			confirmDialogMessage = `Are you sure you want to delete the category "${category.name}"?\n\nThis action cannot be undone.`;
			confirmDialogVariant = 'destructive';
			confirmDialogConfirmText = 'Delete';
			confirmDialogAction = performCategoryDeletion;
			confirmDialogOpen = true;
		} catch (err) {
			console.error('❌ Failed to check category usage:', err);
			error =
				err instanceof Error ? err.message : 'Failed to check category usage. Please try again.';
		}
	}

	// Perform the actual category deletion
	async function performCategoryDeletion() {
		if (!categoryToDelete) return;

		try {
			deletingCategory = categoryToDelete.id;
			error = null;

			await storiesDB.deleteCategory(categoryToDelete.id);

			// Remove from available categories
			availableCategories = availableCategories.filter((cat) => cat.id !== categoryToDelete!.id);

			// Remove from selected categories if it was selected
			if (selectedCategories.includes(categoryToDelete.id)) {
				selectedCategories = selectedCategories.filter((id) => id !== categoryToDelete!.id);
			}

			// Notify parent of changes
			if (onCategoriesChange) {
				onCategoriesChange(availableCategories);
			}

			// Reload usage information after deletion
			if (allowDelete) {
				loadCategoriesWithUsage();
			}

			console.log('✅ Deleted category:', categoryToDelete.name);
		} catch (err) {
			console.error('❌ Failed to delete category:', err);
			error = err instanceof Error ? err.message : 'Failed to delete category. Please try again.';
			throw err; // Re-throw to prevent dialog from closing
		} finally {
			deletingCategory = null;
			categoryToDelete = null;
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
</script>

<div class={clsx('category-manager', className)}>
	<!-- Error message -->
	{#if error}
		<div class="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
			<div class="flex items-center gap-2 text-red-700">
				<PropertyIcon key="description" value="error" size={16} />
				{error}
			</div>
		</div>
	{/if}

	<!-- Categories Selection/Display -->
	{#if availableCategories.length > 0}
		<fieldset class="mb-6">
			<legend class="mb-2 block text-xs font-medium text-gray-700 sm:mb-3 sm:text-sm">
				{showSelection ? 'Select Categories' : 'Available Categories'}
			</legend>
			<div class="flex flex-wrap gap-2">
				{#each availableCategories as category}
					<div class="flex items-center gap-1">
						<button
							type="button"
							class={clsx(
								'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition-colors focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none sm:px-3 sm:text-xs',
								{
									'cursor-pointer text-white':
										showSelection && selectedCategories.includes(category.id),
									'cursor-pointer border border-gray-300 text-gray-700 hover:bg-gray-50':
										showSelection && !selectedCategories.includes(category.id),
									'cursor-default text-white': !showSelection
								}
							)}
							style={selectedCategories.includes(category.id) || !showSelection
								? `background-color: ${category.color}`
								: ''}
							onclick={() => toggleCategory(category.id)}
							disabled={!showSelection}
							aria-pressed={showSelection ? selectedCategories.includes(category.id) : undefined}
							aria-label="{showSelection
								? (selectedCategories.includes(category.id) ? 'Remove' : 'Add') + ' category '
								: ''}{category.name}"
							title={allowDelete && categoryUsage.has(category.id)
								? `Used by ${categoryUsage.get(category.id)?.storyCount || 0} ${(categoryUsage.get(category.id)?.storyCount || 0) === 1 ? 'story' : 'stories'}`
								: category.name}
						>
							{category.icon || '📂'}
							{category.name}
							{#if allowDelete && categoryUsage.has(category.id) && categoryUsage.get(category.id)?.inUse}
								<span class="ml-1 rounded-full bg-white/20 px-1.5 py-0.5 text-xs">
									{categoryUsage.get(category.id)?.storyCount}
								</span>
							{/if}
						</button>

						{#if allowDelete}
							<button
								type="button"
								class={clsx(
									'ml-1 flex h-5 w-5 items-center justify-center rounded-full border text-xs focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed',
									{
										'border-red-300 bg-red-50 text-red-600 hover:bg-red-100 focus:ring-red-500':
											!categoryUsage.get(category.id)?.inUse,
										'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-400':
											categoryUsage.get(category.id)?.inUse
									}
								)}
								onclick={() => deleteCategory(category)}
								disabled={deletingCategory === category.id || categoryUsage.get(category.id)?.inUse}
								title={categoryUsage.get(category.id)?.inUse
									? `Cannot delete - used by ${categoryUsage.get(category.id)?.storyCount} ${(categoryUsage.get(category.id)?.storyCount || 0) === 1 ? 'story' : 'stories'}`
									: 'Delete category'}
								aria-label={categoryUsage.get(category.id)?.inUse
									? `Cannot delete category ${category.name} - in use`
									: `Delete category ${category.name}`}
							>
								{#if deletingCategory === category.id}
									<PropertyIcon key="description" value="loading" size={12} class="animate-spin" />
								{:else}
									<PropertyIcon key="description" value="x" size={12} />
								{/if}
							</button>
						{/if}
					</div>
				{/each}
			</div>
		</fieldset>
	{/if}

	<!-- Create New Category -->
	<fieldset>
		<legend class="mb-2 block text-xs font-medium text-gray-700 sm:mb-3 sm:text-sm"
			>Create New Category</legend
		>

		{#if !showCreateCategory}
			<button
				type="button"
				class="inline-flex items-center gap-1 rounded-md border border-dashed border-gray-300 px-2 py-1.5 text-xs text-gray-600 transition-colors hover:border-gray-400 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none sm:gap-2 sm:px-3 sm:py-2 sm:text-sm"
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
						class="mb-1 block text-xs font-medium text-gray-700 sm:text-sm"
					>
						Category Name *
					</label>
					<input
						id="category-name"
						type="text"
						bind:value={newCategoryName}
						placeholder="e.g., Photography, Work, Family"
						class="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:px-3 sm:py-2 sm:text-sm"
						required
					/>
				</div>

				<!-- Category Color and Icon -->
				<div class="grid grid-cols-2 gap-4">
					<div>
						<label
							for="category-color"
							class="mb-1 block text-xs font-medium text-gray-700 sm:text-sm"
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
							class="mb-1 block text-xs font-medium text-gray-700 sm:text-sm"
						>
							Icon (optional)
						</label>
						<input
							id="category-icon"
							type="text"
							bind:value={newCategoryIcon}
							placeholder="📸 💼 👨‍👩‍👧‍👦"
							maxlength="2"
							class="block w-full rounded-md border border-gray-300 px-2 py-1.5 text-center text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none sm:px-3 sm:py-2 sm:text-sm"
						/>
					</div>
				</div>

				<!-- Preview -->
				{#if newCategoryName}
					<div>
						<p class="mb-1 text-xs text-gray-700 sm:mb-2 sm:text-sm">Preview:</p>
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
						class="flex-1 rounded-md bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-400 sm:px-3 sm:py-2 sm:text-sm"
						onclick={createCategory}
						disabled={!newCategoryName.trim() || creating}
					>
						{#if creating}
							Creating...
						{:else}
							Create Category
						{/if}
					</button>
					<button
						type="button"
						class="rounded-md border border-gray-300 px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none sm:px-3 sm:py-2 sm:text-sm"
						onclick={cancelCreateCategory}
						disabled={creating}
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}
	</fieldset>
</div>

<!-- Confirmation Dialog -->
<ConfirmDialog
	bind:open={confirmDialogOpen}
	title={confirmDialogTitle}
	message={confirmDialogMessage}
	variant={confirmDialogVariant}
	confirmText={confirmDialogConfirmText}
	onConfirm={confirmDialogAction || undefined}
/>
