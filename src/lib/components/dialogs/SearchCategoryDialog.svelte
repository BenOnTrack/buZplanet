<script lang="ts">
	import { Dialog } from 'bits-ui';
	import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
	import CategoryManager from '$lib/components/categories/CategoryManager.svelte';
	import SearchCategoryDrawer from '$lib/components/drawers/SearchCategoryDrawer.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { _CATEGORY } from '$lib/assets/class_subclass_category';
	import { categoryFilterStore } from '$lib/stores/CategoryFilterStore.svelte';

	// Dialog state
	let dialogOpen = $state(false);

	// Drawer state
	let drawerOpen = $state(false);

	// Get reactive state from the centralized store
	let selectedCategories = $derived(categoryFilterStore.selectedCategories);
	let isFilterActive = $derived(categoryFilterStore.isActive);

	// Handle category selection changes
	function handleCategoryChange(categories: string[]) {
		categoryFilterStore.setCategories(categories);
		console.log('Category filter selection changed:', categories);
	}

	// Apply the filter, close dialog, and open drawer
	async function applyFilter() {
		await categoryFilterStore.applyFilter();
		dialogOpen = false;
		drawerOpen = true;
		console.log('Category filter applied:', selectedCategories);
	}

	// Reset state when dialog closes without applying
	function handleOpenChange(open: boolean) {
		dialogOpen = open;
		// No need to load state - using reactive derivations
	}

	// Helper functions for select all/none
	function selectAllCategories() {
		categoryFilterStore.selectAllCategories();
	}

	function selectNoCategories() {
		categoryFilterStore.selectNoCategories();
	}
</script>

<Dialog.Root bind:open={dialogOpen} onOpenChange={handleOpenChange}>
	<Dialog.Trigger
		class="shadow-mini focus-visible:ring-offset-background inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98] {isFilterActive
			? 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-600'
			: 'bg-dark text-background hover:bg-dark/95 focus-visible:ring-foreground'}"
		style="z-index: {Z_INDEX.DIALOG_TRIGGER}"
		onclick={(e) => {
			dialogOpen = true;
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.currentTarget.click();
			}
		}}
		aria-label="Open search category dialog{isFilterActive ? ' (filter active)' : ''}"
	>
		<MagnifyingGlass size={18} />
		{#if isFilterActive}
			<div class="filter-indicator" aria-hidden="true"></div>
		{/if}
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/80"
			style="z-index: {Z_INDEX.DIALOG_OVERLAY}"
		/>
		<Dialog.Content
			class="rounded-card-lg bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] border p-5 outline-hidden sm:max-w-[490px] md:w-full"
			style="z-index: {Z_INDEX.DIALOG_CONTENT}"
		>
			<Dialog.Title
				class="flex w-full items-center justify-center text-lg font-semibold tracking-tight"
			>
				Search Categories
			</Dialog.Title>

			<Dialog.Description class="text-foreground-alt mt-3 mb-6 text-center text-sm">
				Select categories to filter your search results
			</Dialog.Description>

			<div class="space-y-4">
				<div class="space-y-2">
					<div class="flex items-center justify-between">
						<h3 class="text-sm font-medium">Category Filters</h3>
						<p class="text-sm text-gray-600">
							{selectedCategories.length} of {_CATEGORY.length} categories selected
						</p>
					</div>

					<div class="mb-4 flex gap-2">
						<button
							type="button"
							class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
							onclick={selectAllCategories}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectAllCategories();
								}
							}}
						>
							Select All
						</button>
						<button
							type="button"
							class="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
							onclick={selectNoCategories}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									selectNoCategories();
								}
							}}
						>
							Clear All
						</button>
						{#if isFilterActive}
							<button
								type="button"
								class="rounded-md border border-red-300 bg-red-50 px-3 py-1 text-sm font-medium text-red-700 hover:bg-red-100 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none"
								onclick={() => {
									categoryFilterStore.clearFilter();
									dialogOpen = false;
								}}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										categoryFilterStore.clearFilter();
										dialogOpen = false;
									}
								}}
							>
								Clear Filter
							</button>
						{/if}
					</div>

					<!-- Scrollable categories using CategoryManager -->
					<div class="max-h-80 overflow-y-auto">
						<CategoryManager
							{selectedCategories}
							onChange={handleCategoryChange}
							title=""
							showGroups={true}
						/>
					</div>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-2">
				<Dialog.Close
					class="h-input rounded-input focus-visible:ring-offset-background inline-flex items-center justify-center bg-gray-100 px-6 text-sm font-semibold text-gray-700 hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
				>
					Cancel
				</Dialog.Close>
				<Dialog.Close
					class="h-input rounded-input bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background inline-flex items-center justify-center px-6 text-sm font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
					onclick={applyFilter}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							applyFilter();
						}
					}}
				>
					Apply Filters ({selectedCategories.length})
				</Dialog.Close>
			</div>

			<Dialog.Close
				class="focus-visible:ring-foreground focus-visible:ring-offset-background absolute top-5 right-5 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
			>
				<div>
					<span class="sr-only">Close</span>
					<svg
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
						xmlns="http://www.w3.org/2000/svg"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path>
					</svg>
				</div>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<!-- Search Category Drawer -->
<SearchCategoryDrawer bind:open={drawerOpen} />

<style>
	.filter-indicator {
		position: absolute;
		top: 2px;
		right: 2px;
		width: 8px;
		height: 8px;
		background: #ef4444;
		border: 1.5px solid white;
		border-radius: 50%;
		pointer-events: none;
	}
</style>
