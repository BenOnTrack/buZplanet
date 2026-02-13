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
	import { versionManager } from '$lib/utils/version-manager.js';

	let checking = $state(false);

	async function handleCheckForUpdates() {
		checking = true;
		try {
			await swManager.checkForUpdates();
		} finally {
			checking = false;
		}
	}

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

	// Format date helper
	function formatDate(date: Date | null) {
		if (!date) return 'Never';
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit'
		}).format(date);
	}
</script>

<div class="space-y-6">
	<div>
		<h4 class="mb-2 text-[20px] leading-none font-semibold tracking-[-0.01em]">App Updates</h4>
		<p class="text-muted-foreground mb-4 text-sm">
			Manage how the app handles updates and new versions.
		</p>
	</div>

	<!-- Update Status -->
	<div class="space-y-3">
		<h5 class="text-foreground text-sm font-medium">Update Status</h5>

		{#if swManager.hasUpdate}
			<div
				class="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-900/20"
			>
				<div class="flex items-start gap-3">
					<PropertyIcon
						key="description"
						value="download"
						size={20}
						class="mt-0.5 flex-shrink-0 text-blue-500"
					/>
					<div class="min-w-0 flex-1">
						<p class="text-sm font-medium text-blue-700 dark:text-blue-300">Update Available</p>
						<p class="mt-1 text-xs text-blue-600 dark:text-blue-400">
							A new version is ready to install.
						</p>
						<div class="mt-2 flex gap-2">
							<button
								onclick={handleInstallUpdate}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleInstallUpdate();
									}
								}}
								class="rounded bg-blue-500 px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-blue-600 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none"
								disabled={swManager.isInstalling}
								aria-label="Install update now"
							>
								{swManager.isInstalling ? 'Installing...' : 'Install Now'}
							</button>
							<button
								onclick={handleDismissUpdate}
								onkeydown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.preventDefault();
										handleDismissUpdate();
									}
								}}
								class="rounded bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
								disabled={swManager.isInstalling}
								aria-label="Postpone update"
							>
								Later
							</button>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<div
				class="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20"
			>
				<div class="flex items-center gap-2">
					<PropertyIcon key="description" value="check" size={16} class="text-green-500" />
					<span class="text-sm text-green-700 dark:text-green-300">App is up to date</span>
				</div>
				<button
					onclick={handleCheckForUpdates}
					onkeydown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							handleCheckForUpdates();
						}
					}}
					class="rounded px-1 text-xs font-medium text-green-600 hover:text-green-800 focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-green-400 dark:hover:text-green-200"
					disabled={checking}
					aria-label="Check for updates"
				>
					{checking ? 'Checking...' : 'Check Now'}
				</button>
			</div>
		{/if}
	</div>

	<!-- Update Preferences -->
	<div class="space-y-4">
		<h5 class="text-foreground text-sm font-medium">Preferences</h5>

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
	</div>

	<!-- Update Info -->
	<div class="space-y-2">
		<h5 class="text-foreground text-sm font-medium">Information</h5>
		<div class="space-y-2 rounded-lg bg-gray-50 p-3 dark:bg-gray-800/50">
			<div class="flex items-center justify-between">
				<span class="text-muted-foreground text-xs">Version:</span>
				<span class="text-foreground font-mono text-xs">
					v{versionManager.version}
				</span>
			</div>
			<div class="flex items-center justify-between">
				<span class="text-muted-foreground text-xs">Last Check:</span>
				<span class="text-foreground font-mono text-xs">
					{formatDate(swManager.lastCheck)}
				</span>
			</div>
			{#if swManager.isPostponed}
				<div class="flex items-center justify-between">
					<span class="text-muted-foreground text-xs">Update Status:</span>
					<span class="text-xs text-orange-600 dark:text-orange-400">
						Postponed until refresh
					</span>
				</div>
			{/if}
		</div>
	</div>
</div>
