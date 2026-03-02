<script lang="ts">
	import { Dialog, Tabs } from 'bits-ui';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { authState } from '$lib/stores/auth.svelte';
	import { userStore } from '$lib/stores/UserStore.svelte';
	import AuthForm from '$lib/components/auth/AuthForm.svelte';
	import UserProfile from '$lib/components/auth/UserProfile.svelte';
	import UserSearch from '$lib/components/UserSearch.svelte';
	import ActivityFeed from '$lib/components/ActivityFeed.svelte';
	import NotificationsPanel from '$lib/components/NotificationsPanel.svelte';
	import ProfileEditor from '$lib/components/ProfileEditor.svelte';

	const currentUser = $derived(authState.user);
	const isLoading = $derived(authState.loading);

	let activeTab = $state('auth');
	let showNotifications = $state(false);

	// Online/offline status for icon color
	let isOnline = $state(navigator?.onLine ?? true);

	// Determine icon color based on online status
	let authIconColor = $derived(isOnline ? '#10b981' : '#ef4444'); // green-500 : red-500

	function toggleNotifications() {
		showNotifications = !showNotifications;
	}

	// Auto-switch to appropriate tab based on auth state
	$effect(() => {
		if (!currentUser && activeTab !== 'auth') {
			activeTab = 'auth';
		}
	});

	// Listen for online/offline events
	$effect(() => {
		if (typeof window === 'undefined') return;

		// Initialize status
		isOnline = navigator.onLine;

		function handleOnline() {
			isOnline = true;
		}

		function handleOffline() {
			isOnline = false;
		}

		window.addEventListener('online', handleOnline);
		window.addEventListener('offline', handleOffline);

		return () => {
			window.removeEventListener('online', handleOnline);
			window.removeEventListener('offline', handleOffline);
		};
	});
</script>

<Dialog.Root>
	<Dialog.Trigger
		class="bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background fixed top-4 left-4 inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
		style="z-index: {Z_INDEX.DIALOG_TRIGGER}"
		aria-label="{isOnline ? 'Online' : 'Offline'} - Open account and social features"
	>
		<div class="relative">
			<PropertyIcon
				key={'description'}
				value={'authentication'}
				size={20}
				color={authIconColor}
				class="transition-colors duration-300"
			/>

			<!-- Notification Badge -->
			{#if currentUser && userStore.unreadNotificationCount > 0}
				<span
					class="border-background absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full border-2 bg-red-500 text-xs text-white"
				>
					{userStore.unreadNotificationCount > 9 ? '9+' : userStore.unreadNotificationCount}
				</span>
			{/if}
		</div>
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay
			class="data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 bg-black/80"
			style="z-index: {Z_INDEX.DIALOG_OVERLAY}"
		/>
		<Dialog.Content
			class="rounded-card-lg bg-background shadow-popover data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] max-h-[90vh] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] overflow-hidden border p-0 outline-hidden sm:max-w-[800px] md:w-full"
			style="z-index: {Z_INDEX.DIALOG_CONTENT}"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-gray-200 p-5">
				<Dialog.Title class="flex items-center text-lg font-semibold tracking-tight">
					{#if activeTab === 'auth'}
						<PropertyIcon key={'description'} value={'lock'} size={20} class="mr-2" />
						{currentUser ? 'Account' : 'Authentication'}
					{:else if activeTab === 'feed'}
						<PropertyIcon key={'description'} value={'home'} size={20} class="mr-2" />
						Activity Feed
					{:else if activeTab === 'search'}
						<PropertyIcon key={'description'} value={'search'} size={20} class="mr-2" />
						Find People
					{/if}
				</Dialog.Title>

				<div class="flex items-center space-x-2">
					{#if currentUser}
						<!-- Notifications button -->
						<button
							onclick={toggleNotifications}
							onkeydown={(e) => e.key === 'Enter' && toggleNotifications()}
							class="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
							aria-label="Open notifications"
						>
							<PropertyIcon key={'description'} value={'bell'} size={18} />
							{#if userStore.unreadNotificationCount > 0}
								<span
									class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white"
								>
									{userStore.unreadNotificationCount > 9 ? '9+' : userStore.unreadNotificationCount}
								</span>
							{/if}
						</button>
					{/if}

					<Dialog.Close
						class="focus-visible:ring-foreground focus-visible:ring-offset-background rounded-md p-2 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
					>
						<PropertyIcon key={'description'} value={'x'} size={18} class="text-foreground" />
						<span class="sr-only">Close</span>
					</Dialog.Close>
				</div>
			</div>

			{#if !currentUser}
				<!-- Not authenticated - show only auth content -->
				<div class="p-5">
					{#if isLoading}
						<div class="flex items-center justify-center py-8">
							<PropertyIcon
								key={'description'}
								value={'loading'}
								size={32}
								class="text-primary animate-spin"
							/>
						</div>
					{:else}
						<AuthForm />
					{/if}
				</div>
			{:else}
				<!-- Authenticated - show tabs and content -->
				<div class="flex h-full flex-col">
					<!-- Tab navigation and content using bits-ui Tabs -->
					<div class="p-3">
						<Tabs.Root
							bind:value={activeTab}
							class="rounded-card border-muted bg-background-alt shadow-card w-full border p-3"
						>
							<Tabs.List
								class="rounded-9px bg-dark-10 shadow-mini-inset dark:bg-background grid w-full grid-cols-3 gap-1 p-1 text-sm leading-[0.01em] font-semibold dark:border dark:border-neutral-600/30"
							>
								<Tabs.Trigger
									value="auth"
									class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
								>
									<PropertyIcon key={'description'} value={'lock'} size={14} />
									Account
								</Tabs.Trigger>
								<Tabs.Trigger
									value="feed"
									class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
								>
									<PropertyIcon key={'description'} value={'home'} size={14} />
									Feed
								</Tabs.Trigger>
								<Tabs.Trigger
									value="search"
									class="data-[state=active]:shadow-mini dark:data-[state=active]:bg-muted flex h-8 items-center justify-center gap-1 rounded-[7px] bg-transparent py-2 data-[state=active]:bg-white"
								>
									<PropertyIcon key={'description'} value={'search'} size={14} />
									People
								</Tabs.Trigger>
							</Tabs.List>

							<!-- Tab content with proper spacing -->
							<Tabs.Content value="auth" class="pt-3">
								<div class="max-h-[60vh] overflow-y-auto">
									<UserProfile />
								</div>
							</Tabs.Content>

							<Tabs.Content value="feed" class="pt-3">
								<div class="max-h-[60vh] overflow-y-auto">
									<ActivityFeed />
								</div>
							</Tabs.Content>

							<Tabs.Content value="search" class="pt-3">
								<div class="max-h-[60vh] space-y-4 overflow-y-auto">
									<!-- Profile Editor -->
									<ProfileEditor />

									<!-- User Search -->
									<div>
										<h3 class="mb-3 text-lg font-semibold text-gray-900">Find People</h3>
										<UserSearch />
									</div>
								</div>
							</Tabs.Content>
						</Tabs.Root>
					</div>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<!-- Notifications panel (outside dialog) -->
{#if showNotifications}
	<div style="z-index: {Z_INDEX.DIALOG_CONTENT + 1}">
		<NotificationsPanel isOpen={showNotifications} onClose={() => (showNotifications = false)} />
	</div>
{/if}
