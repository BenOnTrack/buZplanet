<script lang="ts">
	import { Dialog, Label, Separator } from 'bits-ui';
	import Plus from 'phosphor-svelte/lib/Plus';
	import BookmarkListDialog from '$lib/components/dialogs/BookmarkList.svelte';
	import { featuresDB } from '$lib/stores/FeaturesDB.svelte.js';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';

	let {
		open = $bindable(false),
		feature = null,
		onBookmarkUpdated
	}: {
		open?: boolean;
		feature?: any;
		onBookmarkUpdated?: (bookmarked: boolean, listIds: string[]) => void;
	} = $props();

	// Dialog state
	let availableLists = $state<BookmarkList[]>([]);
	let selectedListIds = $state<Set<string>>(new Set());
	let isLoading = $state(false);
	let isSaving = $state(false);
	let createListDialogOpen = $state(false);

	// Get feature display name
	function getFeatureDisplayName(feature: any): string {
		if (!feature || !feature.properties) return 'Selected Feature';
		const props = feature.properties;
		return props['name:en'] || props.name || props.category || 'Selected Feature';
	}

	// Load bookmark lists and current feature status when dialog opens
	$effect(() => {
		if (open && feature) {
			loadBookmarkLists();
		}
	});

	async function loadBookmarkLists() {
		try {
			isLoading = true;
			await featuresDB.ensureInitialized();

			// Load all available lists and sort by name
			const lists = await featuresDB.getAllBookmarkLists();
			availableLists = lists.sort((a, b) => a.name.localeCompare(b.name));

			// Load current feature's list memberships
			const featureId = getFeatureId(feature);
			const storedFeature = await featuresDB.getFeatureById(featureId);

			// Update selected lists
			selectedListIds = new Set(storedFeature?.listIds || []);
		} catch (error) {
			console.error('Failed to load bookmark lists:', error);
		} finally {
			isLoading = false;
		}
	}

	// Get feature ID (same logic as in FeaturesDB)
	function getFeatureId(feature: any): string {
		if (feature.id !== undefined && feature.id !== null) {
			return String(feature.id);
		}
		console.warn('Feature missing ID, generating fallback ID:', feature);
		return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	// Handle list selection toggle
	function toggleListSelection(listId: string) {
		const newSelectedIds = new Set(selectedListIds);
		if (newSelectedIds.has(listId)) {
			newSelectedIds.delete(listId);
		} else {
			newSelectedIds.add(listId);
		}
		selectedListIds = newSelectedIds;
	}

	// Handle new list creation
	function handleListCreated(newList: BookmarkList) {
		// Add to available lists and sort by name
		availableLists = [...availableLists, newList].sort((a, b) => a.name.localeCompare(b.name));
		// Auto-select the new list
		selectedListIds = new Set([...selectedListIds, newList.id]);
		// Close create list dialog
		createListDialogOpen = false;
	}

	// Save bookmark changes
	async function handleSave() {
		if (!feature) return;

		try {
			isSaving = true;
			await featuresDB.ensureInitialized();

			const featureId = getFeatureId(feature);
			const currentListIds = Array.from(selectedListIds);

			// Get current feature state
			let storedFeature = await featuresDB.getFeatureById(featureId);
			const previousListIds = storedFeature?.listIds || [];

			// Determine which lists to add/remove
			const listsToAdd = currentListIds.filter((id) => !previousListIds.includes(id));
			const listsToRemove = previousListIds.filter((id) => !currentListIds.includes(id));

			// Remove from old lists
			if (listsToRemove.length > 0) {
				await featuresDB.removeFeatureFromLists(feature, listsToRemove);
			}

			// Add to new lists
			if (listsToAdd.length > 0) {
				await featuresDB.addFeatureToLists(feature, listsToAdd);
			}

			// Update feature bookmark status
			const isBookmarked = currentListIds.length > 0;

			// Notify parent component
			onBookmarkUpdated?.(isBookmarked, currentListIds);

			// Close dialog
			open = false;
		} catch (error) {
			console.error('Failed to save bookmark changes:', error);
		} finally {
			isSaving = false;
		}
	}

	// Cancel changes
	function handleCancel() {
		open = false;
	}

	// Format list display
	function formatListDisplay(list: BookmarkList): string {
		if (list.category) {
			return `${list.name} (${list.category})`;
		}
		return list.name;
	}

	// Get list count text
	function getListCountText(): string {
		const count = selectedListIds.size;
		if (count === 0) return 'No lists selected';
		if (count === 1) return '1 list selected';
		return `${count} lists selected`;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/80"
			style="z-index: {Z_INDEX.DIALOG_OVERLAY}"
		/>
		<Dialog.Content
			class="rounded-card-lg bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] flex max-h-[80vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col border p-5 outline-hidden sm:max-w-[520px] md:w-full"
			style="z-index: {Z_INDEX.DIALOG_CONTENT}"
		>
			<Dialog.Title
				class="flex w-full items-center justify-center text-lg font-semibold tracking-tight"
			>
				Bookmark Feature
			</Dialog.Title>
			<Separator.Root class="bg-muted -mx-5 mt-5 mb-6 block h-px" />

			{#if feature}
				<Dialog.Description class="text-foreground-alt mb-4 text-sm">
					Add "<span class="text-foreground font-medium">{getFeatureDisplayName(feature)}</span>" to
					your bookmark lists.
				</Dialog.Description>
			{/if}

			<div class="flex flex-1 flex-col overflow-hidden">
				{#if isLoading}
					<div class="flex items-center justify-center py-8">
						<div class="flex items-center gap-2 text-gray-500">
							<div
								class="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600"
							></div>
							<span class="text-sm">Loading bookmark lists...</span>
						</div>
					</div>
				{:else}
					<!-- List Selection -->
					<div class="mb-6 flex flex-1 flex-col gap-3 overflow-hidden">
						<div class="flex items-center justify-between">
							<Label.Root class="text-sm font-medium">Select Bookmark Lists</Label.Root>
							<span class="text-xs text-gray-500">{getListCountText()}</span>
						</div>

						{#if availableLists.length === 0}
							<div class="rounded-lg border border-dashed border-gray-300 py-6 text-center">
								<div class="mb-2 text-gray-500">No bookmark lists yet</div>
								<button
									type="button"
									onclick={() => (createListDialogOpen = true)}
									class="text-sm font-medium text-blue-600 hover:text-blue-700"
								>
									Create your first list
								</button>
							</div>
						{:else}
							<div class="max-h-64 flex-1 space-y-2 overflow-y-auto pr-2">
								{#each availableLists as list (list.id)}
									<label
										class="flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-gray-50"
										class:bg-blue-50={selectedListIds.has(list.id)}
										class:border-blue-200={selectedListIds.has(list.id)}
									>
										<input
											type="checkbox"
											checked={selectedListIds.has(list.id)}
											onchange={() => toggleListSelection(list.id)}
											class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
										/>
										<div class="min-w-0 flex-1">
											<div class="flex items-center gap-2">
												{#if list.color}
													<div
														class="h-3 w-3 flex-shrink-0 rounded-full"
														style="background-color: {list.color}"
													></div>
												{/if}
												<span class="truncate text-sm font-medium">
													{formatListDisplay(list)}
												</span>
											</div>
											{#if list.description}
												<div class="mt-1 truncate text-xs text-gray-500">
													{list.description}
												</div>
											{/if}
											<div class="mt-1 text-xs text-gray-400">
												{list.featureIds.length}
												{list.featureIds.length === 1 ? 'item' : 'items'}
											</div>
										</div>
									</label>
								{/each}
							</div>
						{/if}

						<!-- Create New List Button -->
						<button
							type="button"
							onclick={() => (createListDialogOpen = true)}
							class="flex items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 p-3 text-gray-600 transition-colors hover:border-gray-400 hover:text-gray-800"
						>
							<Plus class="h-4 w-4" />
							<span class="text-sm font-medium">Create New List</span>
						</button>
					</div>
				{/if}

				<!-- Form Actions -->
				<div class="flex gap-3 border-t pt-4">
					<button
						type="button"
						onclick={handleCancel}
						disabled={isSaving}
						class="h-input rounded-input focus-visible:ring-offset-background inline-flex flex-1 items-center justify-center bg-gray-100 px-4 text-[15px] font-semibold text-gray-700 transition-all hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={handleSave}
						disabled={isSaving || isLoading}
						class="h-input rounded-input bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-dark focus-visible:ring-offset-background inline-flex flex-1 items-center justify-center px-4 text-[15px] font-semibold transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if isSaving}
							<div class="flex items-center gap-2">
								<div
									class="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"
								></div>
								Saving...
							</div>
						{:else}
							Save Bookmark
						{/if}
					</button>
				</div>
			</div>

			<Dialog.Close
				class="focus-visible:ring-foreground focus-visible:ring-offset-background absolute top-5 right-5 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
			>
				<div>
					<PropertyIcon key={'description'} value={'x'} size={20} class="text-foreground" />
					<span class="sr-only">Close</span>
				</div>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<!-- Create List Dialog -->
<BookmarkListDialog bind:open={createListDialogOpen} onListCreated={handleListCreated} />
