<script lang="ts">
	import { Dialog } from 'bits-ui';
	import { Z_INDEX } from '$lib/styles/z-index';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let {
		open = $bindable(false),
		title = 'Confirm Action',
		message = 'Are you sure you want to proceed?',
		confirmText = 'Confirm',
		cancelText = 'Cancel',
		variant = 'destructive',
		icon = undefined,
		onConfirm = undefined,
		onCancel = undefined,
		disabled = false
	}: {
		open?: boolean;
		title?: string;
		message?: string;
		confirmText?: string;
		cancelText?: string;
		variant?: 'destructive' | 'primary' | 'secondary';
		icon?: string;
		onConfirm?: () => void | Promise<void>;
		onCancel?: () => void;
		disabled?: boolean;
	} = $props();

	let isProcessing = $state(false);

	async function handleConfirm() {
		if (disabled || isProcessing) return;

		try {
			isProcessing = true;
			if (onConfirm) {
				await onConfirm();
			}
			open = false;
		} catch (error) {
			console.error('Error in confirm action:', error);
			// Don't close dialog if there's an error
		} finally {
			isProcessing = false;
		}
	}

	function handleCancel() {
		if (isProcessing) return;

		if (onCancel) {
			onCancel();
		}
		open = false;
	}

	// Get button styles based on variant
	const confirmButtonClasses = $derived(() => {
		const base =
			'rounded-md px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50';

		switch (variant) {
			case 'destructive':
				return `${base} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500`;
			case 'primary':
				return `${base} bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500`;
			case 'secondary':
				return `${base} bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500`;
			default:
				return `${base} bg-red-600 text-white hover:bg-red-700 focus:ring-red-500`;
		}
	});

	const iconName = $derived(() => {
		if (icon) return icon;

		switch (variant) {
			case 'destructive':
				return 'warning';
			case 'primary':
				return 'info';
			case 'secondary':
				return 'info';
			default:
				return 'warning';
		}
	});

	const iconColor = $derived(() => {
		switch (variant) {
			case 'destructive':
				return 'text-red-600';
			case 'primary':
				return 'text-blue-600';
			case 'secondary':
				return 'text-gray-600';
			default:
				return 'text-red-600';
		}
	});
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 bg-black/50 transition-opacity duration-200"
			style="z-index: {Z_INDEX.DIALOG_OVERLAY}"
		/>
		<Dialog.Content
			class="fixed top-1/2 left-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-gray-200 bg-white p-6 shadow-lg transition-all duration-200"
			style="z-index: {Z_INDEX.DIALOG_CONTENT}"
		>
			<div class="flex items-start gap-4">
				<!-- Icon -->
				<div class="flex-shrink-0">
					<div class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
						<PropertyIcon key="description" value={iconName()} size={24} class={iconColor()} />
					</div>
				</div>

				<!-- Content -->
				<div class="min-w-0 flex-1">
					<Dialog.Title class="mb-2 text-lg font-semibold text-gray-900">
						{title}
					</Dialog.Title>

					<Dialog.Description class="text-sm leading-relaxed whitespace-pre-line text-gray-600">
						{message}
					</Dialog.Description>
				</div>
			</div>

			<!-- Actions -->
			<div class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
				<button
					type="button"
					class="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					onclick={handleCancel}
					disabled={isProcessing}
				>
					{cancelText}
				</button>

				<button
					type="button"
					class={confirmButtonClasses()}
					onclick={handleConfirm}
					disabled={disabled || isProcessing}
				>
					{#if isProcessing}
						<div class="flex items-center gap-2">
							<PropertyIcon key="description" value="loading" size={16} class="animate-spin" />
							Processing...
						</div>
					{:else}
						{confirmText}
					{/if}
				</button>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
