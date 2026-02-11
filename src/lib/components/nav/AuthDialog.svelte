<script lang="ts">
	import { Dialog, Label, Separator } from 'bits-ui';
	import LockKeyOpen from 'phosphor-svelte/lib/LockKeyOpen';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
</script>

<Dialog.Root>
	<Dialog.Trigger
		class="bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background fixed top-4 left-4 inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
		style="z-index: {Z_INDEX.DIALOG_TRIGGER}"
		onclick={(e) => {
			// Handle click
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				e.currentTarget.click();
			}
		}}
		aria-label="Open dialog"
	>
		<PropertyIcon key={'description'} value={'authentication'} size={20} />
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
				Create API key
			</Dialog.Title>
			<Separator.Root class="bg-muted -mx-5 mt-5 mb-6 block h-px" />
			<Dialog.Description class="text-foreground-alt text-sm">
				Create and manage API keys. You can create multiple keys to organize your applications.
			</Dialog.Description>
			<div class="flex flex-col items-start gap-1 pt-7 pb-11">
				<Label.Root for="apiKey" class="text-sm font-medium">API Key</Label.Root>
				<div class="relative w-full">
					<input
						id="apiKey"
						class="h-input rounded-card-sm border-border-input bg-background placeholder:text-foreground-alt/50 hover:border-dark-40 focus:ring-foreground focus:ring-offset-background inline-flex w-full items-center border px-4 text-base focus:ring-2 focus:ring-offset-2 focus:outline-hidden sm:text-sm"
						placeholder="secret_api_key"
						name="name"
					/>
					<LockKeyOpen class="text-dark/30 absolute top-[14px] right-4 size-[22px]" />
				</div>
			</div>
			<div class="flex w-full justify-end">
				<Dialog.Close
					class="h-input rounded-input bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-dark focus-visible:ring-offset-background inline-flex items-center justify-center px-[50px] text-[15px] font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
				>
					Save
				</Dialog.Close>
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
