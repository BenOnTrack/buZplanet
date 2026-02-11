<script lang="ts">
	import { Dialog, Tabs } from 'bits-ui';
	import ColorsSettings from '$lib/components/settings/ColorsSettings.svelte';
	import AppUpdateSettings from '$lib/components/settings/AppUpdateSettings.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
</script>

<Dialog.Root>
	<Dialog.Trigger
		class="bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background fixed top-36 left-4 inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
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
		aria-label="Open settings dialog"
	>
		<PropertyIcon key={'description'} value={'settings'} size={20} />
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
				Settings
			</Dialog.Title>

			<div class="pt-6">
				<Tabs.Root
					value="language"
					class="rounded-card border-muted bg-background-alt shadow-card w-full border p-3"
				>
					<Tabs.List
						class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full grid-cols-3 gap-1 p-1 text-sm leading-[0.01em] font-semibold dark:border dark:border-neutral-600/30"
					>
						<Tabs.Trigger
							value="language"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
							>Language</Tabs.Trigger
						>
						<Tabs.Trigger
							value="colors"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
							>Colors</Tabs.Trigger
						>
						<Tabs.Trigger
							value="updates"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
							>Updates</Tabs.Trigger
						>
					</Tabs.List>
					<Tabs.Content value="colors" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<ColorsSettings />
						</div>
					</Tabs.Content>
					<Tabs.Content value="language" class="pt-3 select-none">
						<div class="max-h-[60vh] overflow-y-auto p-4">
							<h4 class="mb-2 text-[20px] leading-none font-semibold tracking-[-0.01em]">
								Tab 2 Content
							</h4>
							<p class="text-muted-foreground text-sm">This is the content for the second tab.</p>
						</div>
					</Tabs.Content>
					<Tabs.Content value="updates" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<AppUpdateSettings />
						</div>
					</Tabs.Content>
				</Tabs.Root>
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
