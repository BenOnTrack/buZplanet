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
</div>
