<script lang="ts">
	import { Dialog, Label, Separator } from 'bits-ui';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';

	let {
		open = $bindable(false),
		onListCreated
	}: {
		open?: boolean;
		onListCreated?: (list: BookmarkList) => void;
	} = $props();

	// Form state
	let formData = $state({
		name: '',
		description: '',
		category: '',
		color: '#3B82F6' // Default blue color
	});

	let formErrors = $state({
		name: ''
	});

	let isSubmitting = $state(false);

	// Available colors for lists
	const availableColors = [
		{ name: 'Blue', value: '#3B82F6' },
		{ name: 'Green', value: '#10B981' },
		{ name: 'Red', value: '#EF4444' },
		{ name: 'Yellow', value: '#F59E0B' },
		{ name: 'Purple', value: '#8B5CF6' },
		{ name: 'Pink', value: '#EC4899' },
		{ name: 'Indigo', value: '#6366F1' },
		{ name: 'Gray', value: '#6B7280' }
	];

	// Reset form when dialog opens
	$effect(() => {
		if (open) {
			formData.name = '';
			formData.description = '';
			formData.category = '';
			formData.color = '#3B82F6';
			formErrors.name = '';
		}
	});

	function validateForm(): boolean {
		formErrors.name = '';

		if (!formData.name.trim()) {
			formErrors.name = 'List name is required';
			return false;
		}

		if (formData.name.trim().length < 2) {
			formErrors.name = 'List name must be at least 2 characters';
			return false;
		}

		return true;
	}

	async function handleSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (!validateForm()) return;

		try {
			isSubmitting = true;

			// Import featuresDB here to avoid circular imports
			const { featuresDB } = await import('$lib/stores/FeaturesDB.svelte.ts');

			// Ensure database is initialized
			await featuresDB.ensureInitialized();

			console.log('Creating bookmark list with data:', {
				name: formData.name.trim(),
				description: formData.description.trim() || undefined,
				category: formData.category.trim() || undefined,
				color: formData.color
			});

			// Debug: Check if database is properly initialized
			const debugInfo = featuresDB.getDebugInfo();
			console.log('FeaturesDB debug info:', debugInfo);

			const newList = await featuresDB.createBookmarkList({
				name: formData.name.trim(),
				description: formData.description.trim() || undefined,
				category: formData.category.trim() || undefined,
				color: formData.color
			});

			console.log('Successfully created bookmark list:', newList);

			// Debug: Verify the list was stored by trying to retrieve it
			try {
				const retrievedList = await featuresDB.getBookmarkListById(newList.id);
				console.log('Retrieved list after creation:', retrievedList);

				const allLists = await featuresDB.getAllBookmarkLists();
				console.log('All lists after creation:', allLists);
				console.log('Updated debug info:', featuresDB.getDebugInfo());
			} catch (debugError) {
				console.error('Debug retrieval failed:', debugError);
			}

			// Notify parent component
			onListCreated?.(newList);

			// Close dialog
			open = false;
		} catch (error) {
			console.error('Failed to create bookmark list:', error);
			// Show user-friendly error message
			if (error instanceof Error) {
				formErrors.name = `Failed to create list: ${error.message}`;
			} else {
				formErrors.name = 'Failed to create list. Please try again.';
			}
		} finally {
			isSubmitting = false;
		}
	}

	function handleCancel() {
		open = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit(event as unknown as SubmitEvent);
		}
	}
</script>

<Dialog.Root bind:open>
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
				Create Bookmark List
			</Dialog.Title>
			<Separator.Root class="bg-muted -mx-5 mt-5 mb-6 block h-px" />

			<Dialog.Description class="text-foreground-alt mb-6 text-sm">
				Create a new bookmark list to organize your saved features.
			</Dialog.Description>

			<form onsubmit={handleSubmit} class="space-y-6">
				<!-- List Name -->
				<div class="flex flex-col items-start gap-2">
					<Label.Root for="listName" class="text-sm font-medium">
						List Name <span class="text-red-500">*</span>
					</Label.Root>
					<input
						id="listName"
						bind:value={formData.name}
						onkeydown={handleKeydown}
						class="h-input rounded-card-sm border-border-input bg-background placeholder:text-foreground-alt/50 hover:border-dark-40 focus:ring-foreground focus:ring-offset-background inline-flex w-full items-center border px-4 text-base focus:ring-2 focus:ring-offset-2 focus:outline-hidden sm:text-sm"
						placeholder="e.g., Favorite Restaurants, To Visit"
						required
						disabled={isSubmitting}
					/>
					{#if formErrors.name}
						<div class="mt-2 rounded-md bg-red-50 p-3">
							<div class="text-sm text-red-600">{formErrors.name}</div>
						</div>
					{/if}
				</div>

				<!-- Description -->
				<div class="flex flex-col items-start gap-2">
					<Label.Root for="listDescription" class="text-sm font-medium">
						Description (Optional)
					</Label.Root>
					<textarea
						id="listDescription"
						bind:value={formData.description}
						class="rounded-card-sm border-border-input bg-background placeholder:text-foreground-alt/50 hover:border-dark-40 focus:ring-foreground focus:ring-offset-background min-h-[80px] w-full resize-none border px-4 py-2 text-base focus:ring-2 focus:ring-offset-2 focus:outline-hidden sm:text-sm"
						placeholder="Brief description of this list..."
						disabled={isSubmitting}
					></textarea>
				</div>

				<!-- Category -->
				<div class="flex flex-col items-start gap-2">
					<Label.Root for="listCategory" class="text-sm font-medium">
						Category (Optional)
					</Label.Root>
					<input
						id="listCategory"
						bind:value={formData.category}
						class="h-input rounded-card-sm border-border-input bg-background placeholder:text-foreground-alt/50 hover:border-dark-40 focus:ring-foreground focus:ring-offset-background inline-flex w-full items-center border px-4 text-base focus:ring-2 focus:ring-offset-2 focus:outline-hidden sm:text-sm"
						placeholder="e.g., Food, Travel, Business"
						disabled={isSubmitting}
					/>
				</div>

				<!-- Color Selection -->
				<div class="flex flex-col items-start gap-2">
					<Label.Root class="text-sm font-medium">Color</Label.Root>
					<div class="flex flex-wrap gap-2">
						{#each availableColors as colorOption}
							<button
								type="button"
								onclick={() => (formData.color = colorOption.value)}
								class="h-8 w-8 rounded-full border-2 transition-all hover:scale-110 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
								class:border-gray-300={formData.color !== colorOption.value}
								class:border-gray-900={formData.color === colorOption.value}
								class:ring-2={formData.color === colorOption.value}
								class:ring-gray-400={formData.color === colorOption.value}
								style="background-color: {colorOption.value}"
								title={colorOption.name}
								disabled={isSubmitting}
							>
								{#if formData.color === colorOption.value}
									<span class="text-xs text-white">✓</span>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Form Actions -->
				<div class="flex gap-3 pt-4">
					<button
						type="button"
						onclick={handleCancel}
						disabled={isSubmitting}
						class="h-input rounded-input focus-visible:ring-offset-background inline-flex flex-1 items-center justify-center bg-gray-100 px-4 text-[15px] font-semibold text-gray-700 transition-all hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={isSubmitting}
						class="h-input rounded-input bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-dark focus-visible:ring-offset-background inline-flex flex-1 items-center justify-center px-4 text-[15px] font-semibold transition-all focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
					>
						{isSubmitting ? 'Creating...' : 'Create List'}
					</button>
				</div>
			</form>

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
