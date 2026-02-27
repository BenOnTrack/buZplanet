<script lang="ts">
	import { Dialog, Tabs } from 'bits-ui';
	import ColorsSettings from '$lib/components/settings/ColorsSettings.svelte';
	import LanguageSettings from '$lib/components/settings/LanguageSettings.svelte';
	import AppUpdateSettings from '$lib/components/settings/AppUpdateSettings.svelte';
	import DebugSettings from '$lib/components/settings/DebugSettings.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { appState } from '$lib/stores/AppState.svelte';

	// Props for debug functionality
	let { initState, isAppReady, isOnline } = $props<{
		initState?: {
			status: string;
			logs: string[];
			error?: string;
		};
		isAppReady?: boolean;
		isOnline?: boolean;
	}>();

	// Reset state
	let isResetting = $state(false);
	let showResetConfirm = $state(false);

	async function handleReset() {
		if (!showResetConfirm) {
			// First click - show confirmation
			showResetConfirm = true;
			// Auto-hide confirmation after 5 seconds
			setTimeout(() => {
				showResetConfirm = false;
			}, 5000);
			return;
		}

		// Second click - actually reset
		try {
			isResetting = true;
			showResetConfirm = false;

			console.log('🔄 Resetting AppState to defaults...');
			await appState.reset();

			console.log('✅ AppState reset completed');

			// Show success message briefly
			setTimeout(() => {
				// Reload the page to ensure all state is properly reset
				window.location.reload();
			}, 1000);
		} catch (error) {
			console.error('❌ Failed to reset AppState:', error);
			alert('Failed to reset settings. Please try again.');
		} finally {
			isResetting = false;
		}
	}
</script>

<Dialog.Root>
	<Dialog.Trigger
		class="bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background fixed top-32 left-4 inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
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
						class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full gap-1 p-1 text-sm leading-[0.01em] font-semibold dark:border dark:border-neutral-600/30"
						style="grid-template-columns: repeat({import.meta.env.DEV ? '5' : '4'}, 1fr);"
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
						<Tabs.Trigger
							value="reset"
							class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
							>Reset</Tabs.Trigger
						>
						{#if import.meta.env.DEV}
							<Tabs.Trigger
								value="debug"
								class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted h-8 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
								>Debug</Tabs.Trigger
							>
						{/if}
					</Tabs.List>
					<Tabs.Content value="colors" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<ColorsSettings />
						</div>
					</Tabs.Content>
					<Tabs.Content value="language" class="pt-3 select-none">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<LanguageSettings />
						</div>
					</Tabs.Content>
					<Tabs.Content value="updates" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<AppUpdateSettings />
						</div>
					</Tabs.Content>
					<Tabs.Content value="reset" class="pt-3">
						<div class="max-h-[60vh] overflow-y-auto px-1">
							<div class="space-y-4">
								<div class="text-center">
									<div class="mb-4 text-4xl">🔄</div>
									<h3 class="mb-2 text-lg font-medium text-gray-900">Reset All Settings</h3>
									<p class="mb-6 text-sm text-gray-600">
										This will reset all application settings to their default values, including:
									</p>
								</div>

								<div class="rounded-lg bg-gray-50 p-4 text-sm text-gray-700">
									<ul class="list-inside list-disc space-y-1">
										<li>Map view position and zoom level</li>
										<li>Language preferences</li>
										<li>Color mappings for categories</li>
										<li>Filter settings for all tabs</li>
										<li>Route relation settings</li>
									</ul>
								</div>

								<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
									<div class="flex items-start gap-3">
										<div class="text-lg text-yellow-600">⚠️</div>
										<div class="text-sm text-yellow-800">
											<strong>Note:</strong> This will NOT delete your bookmarked features, visits, todos,
											or bookmark lists. Only application settings will be reset.
										</div>
									</div>
								</div>

								<div class="text-center">
									{#if showResetConfirm}
										<button
											class="w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
											onclick={handleReset}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													handleReset();
												}
											}}
											disabled={isResetting}
											aria-label="Confirm reset all settings"
										>
											{#if isResetting}
												<div class="flex items-center justify-center gap-2">
													<PropertyIcon
														key={'description'}
														value={'loading'}
														size={16}
														class="animate-spin"
													/>
													Resetting...
												</div>
											{:else}
												💥 Click Again to Confirm Reset
											{/if}
										</button>
										<p class="mt-2 text-xs text-gray-500">Confirmation expires in 5 seconds</p>
									{:else}
										<button
											class="w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white transition-colors hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
											onclick={handleReset}
											onkeydown={(e) => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault();
													handleReset();
												}
											}}
											disabled={isResetting}
											aria-label="Reset all settings to defaults"
										>
											<div class="flex items-center justify-center gap-2">
												<PropertyIcon key={'description'} value={'delete'} size={16} />
												Reset All Settings
											</div>
										</button>
									{/if}
								</div>
							</div>
						</div>
					</Tabs.Content>
					{#if import.meta.env.DEV}
						<Tabs.Content value="debug" class="pt-3">
							<div class="max-h-[60vh] overflow-y-auto px-1">
								<DebugSettings {initState} {isAppReady} {isOnline} />
							</div>
						</Tabs.Content>
					{/if}
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
