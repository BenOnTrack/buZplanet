<!--
	App Updates Settings Component
	
	Provides controls for managing app updates, including:
	- Auto-update preferences
	- Update notifications settings  
	- Manual update checks
	- Current version info
-->
<script lang="ts">
	import { swManager } from '$lib/utils/service-worker-manager.svelte.js';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	function handleToggleAutoUpdate() {
		swManager.updatePreferences({
			autoUpdate: !swManager.autoUpdateEnabled
		});
	}

	function handleToggleNotifications() {
		swManager.updatePreferences({
			showUpdateNotifications: !swManager.notificationsEnabled
		});
	}

	function handleInstallUpdate() {
		swManager.applyUpdate();
	}

	function handleDismissUpdate() {
		swManager.dismissUpdate();
	}

	async function handleCheckForUpdates() {
		await swManager.checkForUpdates();
	}
</script>

<div class="space-y-6">
	<div>
		<h4 class="mb-2 text-[20px] leading-none font-semibold tracking-[-0.01em]">App Updates</h4>
		<p class="text-muted-foreground mb-4 text-sm">
			Manage how the app handles updates and new versions.
		</p>
	</div>

	<!-- Update Preferences -->
	<!-- Auto Update Toggle -->
	<div class="flex items-center justify-between">
		<div class="flex-1">
			<label for="auto-update" class="text-foreground cursor-pointer text-sm font-medium">
				Automatic Updates
			</label>
			<p class="text-muted-foreground mt-0.5 text-xs">
				Install updates automatically without asking
			</p>
		</div>
		<button
			id="auto-update"
			onclick={handleToggleAutoUpdate}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleToggleAutoUpdate();
				}
			}}
			class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none {swManager.autoUpdateEnabled
				? 'bg-blue-500'
				: 'bg-gray-200 dark:bg-gray-700'}"
			role="switch"
			aria-checked={swManager.autoUpdateEnabled}
			aria-labelledby="auto-update"
		>
			<span
				class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform {swManager.autoUpdateEnabled
					? 'translate-x-5'
					: 'translate-x-1'}"
			></span>
		</button>
	</div>

	<!-- Notifications Toggle -->
	<div class="flex items-center justify-between">
		<div class="flex-1">
			<label for="show-notifications" class="text-foreground cursor-pointer text-sm font-medium">
				Update Notifications
			</label>
			<p class="text-muted-foreground mt-0.5 text-xs">
				Show notifications when updates are available
			</p>
		</div>
		<button
			id="show-notifications"
			onclick={handleToggleNotifications}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					handleToggleNotifications();
				}
			}}
			class="relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none {swManager.notificationsEnabled
				? 'bg-blue-500'
				: 'bg-gray-200 dark:bg-gray-700'}"
			role="switch"
			aria-checked={swManager.notificationsEnabled}
			aria-labelledby="show-notifications"
		>
			<span
				class="inline-block h-3 w-3 transform rounded-full bg-white transition-transform {swManager.notificationsEnabled
					? 'translate-x-5'
					: 'translate-x-1'}"
			></span>
		</button>
	</div>

	<!-- Update Actions -->
	<div class="space-y-3">
		<!-- Manual Update Check -->
		<div class="flex items-center justify-between">
			<div class="flex-1">
				<p class="text-foreground text-sm font-medium">Check for Updates</p>
				<p class="text-muted-foreground text-xs">
					{#if swManager.lastCheck}
						Last checked: {swManager.lastCheck.toLocaleString()}
					{:else}
						Checked automatically on app startup
					{/if}
				</p>
			</div>
			<button
				onclick={handleCheckForUpdates}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleCheckForUpdates();
					}
				}}
				disabled={swManager.isChecking}
				class="rounded-md bg-blue-500 px-3 py-1.5 text-sm text-white transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if swManager.isChecking}
					<PropertyIcon
						key={'description'}
						value={'loading'}
						size={14}
						class="mr-1 inline animate-spin"
					/>
					Checking...
				{:else}
					<PropertyIcon key={'description'} value={'refresh'} size={14} class="mr-1 inline" />
					Check Now
				{/if}
			</button>
		</div>

		<!-- Available Update -->
		{#if swManager.hasUpdate}
			<div
				class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
			>
				<div class="mb-2 flex items-center justify-between">
					<h5 class="text-sm font-semibold text-blue-900 dark:text-blue-100">Update Available</h5>
					<div class="flex space-x-2">
						<button
							onclick={handleInstallUpdate}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleInstallUpdate();
								}
							}}
							class="rounded bg-blue-500 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-600 focus-visible:ring-1 focus-visible:ring-blue-500 focus-visible:outline-none"
						>
							Install
						</button>
						<button
							onclick={handleDismissUpdate}
							onkeydown={(e) => {
								if (e.key === 'Enter' || e.key === ' ') {
									e.preventDefault();
									handleDismissUpdate();
								}
							}}
							class="rounded bg-gray-300 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-400 focus-visible:ring-1 focus-visible:ring-gray-500 focus-visible:outline-none"
						>
							Later
						</button>
					</div>
				</div>
				<p class="text-xs text-blue-800 dark:text-blue-200">
					A new version of the app is ready to install.
				</p>
			</div>
		{/if}

		<!-- Installing Status -->
		{#if swManager.isInstalling}
			<div
				class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20"
			>
				<div class="flex items-center">
					<PropertyIcon
						key={'description'}
						value={'loading'}
						size={16}
						class="mr-2 animate-spin text-yellow-600 dark:text-yellow-400"
					/>
					<p class="text-sm text-yellow-800 dark:text-yellow-200">Installing update...</p>
				</div>
			</div>
		{/if}

		<!-- Version Info -->
		<div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
			<h5 class="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
				Version Information
			</h5>
			<div class="space-y-1 text-xs text-gray-600 dark:text-gray-400">
				<p>
					<span class="font-medium">Current Version:</span>
					{swManager.version || 'Loading...'}
				</p>
				{#if swManager.lastCheck}
					<p>
						<span class="font-medium">Last Checked:</span>
						{swManager.lastCheck.toLocaleString()}
					</p>
				{/if}
			</div>
		</div>
	</div>
</div>
