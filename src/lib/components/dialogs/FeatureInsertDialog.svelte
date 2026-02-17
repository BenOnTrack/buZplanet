<script lang="ts">
	import { Dialog, Label } from 'bits-ui';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { getFeatureDisplayName } from '$lib/utils/stories';

	let {
		open = $bindable(false),
		selectedFeature = null,
		onInsertFeature = undefined,
		customDisplayText = $bindable('')
	}: {
		open?: boolean;
		selectedFeature?: StoredFeature | SearchResult | null;
		onInsertFeature?: () => void;
		customDisplayText?: string;
	} = $props();

	// Handle form submission
	function handleSubmit(event: Event) {
		event.preventDefault();
		onInsertFeature?.();
	}

	// Handle cancel
	function handleCancel() {
		customDisplayText = '';
		open = false;
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/80"
			style="z-index: {Z_INDEX.STORY_FEATURE_DIALOG_OVERLAY}"
		/>
		<Dialog.Content
			class="rounded-card-lg bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] flex max-h-[80vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] flex-col border p-5 outline-hidden sm:max-w-md md:w-full"
			style="z-index: {Z_INDEX.STORY_FEATURE_DIALOG_CONTENT}"
		>
			<Dialog.Title
				class="flex w-full items-center justify-center text-lg font-semibold tracking-tight"
			>
				Insert Feature
			</Dialog.Title>
			<div class="bg-muted -mx-5 mt-5 mb-6 block h-px"></div>

			{#if selectedFeature}
				<form onsubmit={handleSubmit} class="space-y-4">
					<div class="flex items-center gap-2 text-sm text-gray-600">
						<PropertyIcon key="description" value="check" size={16} color="green" />
						Selected feature: <strong>{getFeatureDisplayName(selectedFeature)}</strong>
					</div>

					<div>
						<Label.Root for="custom-text" class="mb-1 block text-sm font-medium text-gray-700">
							Custom display text (optional)
						</Label.Root>
						<input
							id="custom-text"
							bind:value={customDisplayText}
							placeholder={getFeatureDisplayName(selectedFeature)}
							class="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
						/>
						<p class="mt-1 text-xs text-gray-500">Leave empty to use the default name</p>
					</div>

					<div class="flex items-center justify-end gap-3 pt-2">
						<button
							type="button"
							onclick={handleCancel}
							class="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
						>
							Cancel
						</button>
						<button
							type="submit"
							class="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
						>
							Insert Feature
						</button>
					</div>
				</form>
			{:else}
				<div class="space-y-4">
					<div class="text-sm text-gray-600">
						<div class="mb-2 flex items-center gap-2">
							<PropertyIcon key="description" value="info" size={16} />
							No feature selected
						</div>
						<p>Click on a feature on the map to select it for insertion.</p>
					</div>

					<div class="flex items-center justify-end">
						<button
							type="button"
							onclick={handleCancel}
							class="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:outline-none"
						>
							Close
						</button>
					</div>
				</div>
			{/if}

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
