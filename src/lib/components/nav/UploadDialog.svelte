<script lang="ts">
	import { Dialog, Label, Separator } from "bits-ui";
	import Upload from "phosphor-svelte/lib/Upload";
	import X from "phosphor-svelte/lib/X";
	import CloudArrowUp from "phosphor-svelte/lib/CloudArrowUp";
	import { opfsManager } from "$lib/utils/opfs";

	// State for upload functionality
	let selectedFile: File | null = $state(null);
	let isUploading = $state(false);
	let uploadError = $state('');
	let uploadSuccess = $state('');
	let dialogOpen = $state(false);

	// Handle file selection
	const handleFileChange = (event: Event) => {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files[0]) {
			selectedFile = input.files[0];
			uploadError = '';
			uploadSuccess = '';
		}
	};

	// Handle file upload to OPFS
	const handleUpload = async (event: Event) => {
		event.preventDefault();
		
		if (!selectedFile) {
			uploadError = 'Please select a file first';
			return;
		}

		isUploading = true;
		uploadError = '';
		uploadSuccess = '';

		try {
			// Save file to OPFS root
			const filePath = await opfsManager.saveFile(selectedFile);
			uploadSuccess = `File uploaded successfully: ${filePath}`;
			
			// Reset form
			selectedFile = null;
			const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
			if (fileInput) {
				fileInput.value = '';
			}
			
			// Close dialog after a short delay
			setTimeout(() => {
				dialogOpen = false;
				uploadSuccess = '';
			}, 1500);
			
		} catch (error) {
			uploadError = `Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
		} finally {
			isUploading = false;
		}
	};

	// Reset state when dialog closes
	const handleOpenChange = (open: boolean) => {
		dialogOpen = open;
		if (!open) {
			selectedFile = null;
			uploadError = '';
			uploadSuccess = '';
			const fileInput = document.getElementById('fileUpload') as HTMLInputElement;
			if (fileInput) {
				fileInput.value = '';
			}
		}
	};
</script>

<Dialog.Root bind:open={dialogOpen} onOpenChange={handleOpenChange}>
	<Dialog.Trigger
		class="fixed top-20 left-4 z-50 rounded-full bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background focus-visible:outline-hidden inline-flex h-12 w-12 items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
						onclick={(e) => {
					dialogOpen = true;
				}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.currentTarget.click();
			}
		}}
		aria-label="Open upload dialog"
	>
		<Upload class="size-5" />
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80"
		/>
		<Dialog.Content
			class="rounded-card-lg bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 outline-hidden fixed left-[50%] top-[50%] z-50 w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] border p-5 sm:max-w-[490px] md:w-full"
		>
			<Dialog.Title
				class="flex w-full items-center justify-center text-lg font-semibold tracking-tight"
			>
				Upload File
			</Dialog.Title>
			<Separator.Root class="bg-muted -mx-5 mb-6 mt-5 block h-px" />
			<Dialog.Description class="text-foreground-alt text-sm">
				Upload and manage your files. You can upload multiple files to organize
				your content.
			</Dialog.Description>
			<div class="flex flex-col items-start gap-1 pb-11 pt-7">
				<Label.Root for="fileUpload" class="text-sm font-medium">Choose File</Label.Root>
				<div class="relative w-full">
					<input
						id="fileUpload"
						type="file"
											class="h-input rounded-card-sm border-border-input bg-background placeholder:text-foreground-alt/50 hover:border-dark-40 focus:ring-foreground focus:ring-offset-background focus:outline-hidden inline-flex w-full items-center border px-4 text-base focus:ring-2 focus:ring-offset-2 sm:text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
					name="file"
					accept="*/*"
					onchange={handleFileChange}
					/>
					<CloudArrowUp
						class="text-dark/30 absolute right-4 top-[14px] size-[22px] pointer-events-none"
					/>
				</div>
			</div>
			
			<!-- Upload Status Messages -->
			{#if uploadError}
				<div class="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
					<p class="text-sm text-red-800">{uploadError}</p>
				</div>
			{/if}
			
			{#if uploadSuccess}
				<div class="mb-4 rounded-md bg-green-50 border border-green-200 p-3">
					<p class="text-sm text-green-800">{uploadSuccess}</p>
				</div>
			{/if}
			
			<div class="flex w-full justify-end">
				<button
					type="button"
					class="h-input rounded-input bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-dark focus-visible:ring-offset-background focus-visible:outline-hidden inline-flex items-center justify-center px-[50px] text-[15px] font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
					disabled={!selectedFile || isUploading}
					onclick={handleUpload}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleUpload(e);
						}
					}}
					aria-label="Upload selected file to storage"
				>
					{#if isUploading}
						Uploading...
					{:else}
						Upload
					{/if}
				</button>
			</div>
			<Dialog.Close
				class="focus-visible:ring-foreground focus-visible:ring-offset-background focus-visible:outline-hidden absolute right-5 top-5 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 active:scale-[0.98]"
			>
				<div>
					<X class="text-foreground size-5" />
					<span class="sr-only">Close</span>
				</div>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>