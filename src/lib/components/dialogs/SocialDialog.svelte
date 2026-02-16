<script lang="ts">
	import { Dialog } from 'bits-ui';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';
	import { Z_INDEX } from '$lib/styles/z-index';
	import { user } from '$lib/stores/auth';
	import { userStore } from '$lib/stores/UserStore.svelte';
	import UserSearch from '$lib/components/UserSearch.svelte';
	import FollowRequests from '$lib/components/FollowRequests.svelte';
	import ActivityFeed from '$lib/components/ActivityFeed.svelte';
	import NotificationsPanel from '$lib/components/NotificationsPanel.svelte';
	import ProfileEditor from '$lib/components/ProfileEditor.svelte';

	const currentUser = $derived($user);

	let activeTab = $state('feed');
	let showNotifications = $state(false);

	const tabs = [
		{ id: 'feed', label: 'Feed', icon: 'home' },
		{ id: 'search', label: 'Search', icon: 'search' },
		{ id: 'requests', label: 'Requests', icon: 'user-plus' }
	];

	function switchTab(tabId: string) {
		activeTab = tabId;
	}

	function toggleNotifications() {
		showNotifications = !showNotifications;
	}
</script>

<Dialog.Root>
	<Dialog.Trigger
		class="bg-dark text-background shadow-mini hover:bg-dark/95 focus-visible:ring-foreground focus-visible:ring-offset-background fixed top-4 right-4 inline-flex h-12 w-12 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
		style="z-index: {Z_INDEX.DIALOG_TRIGGER}"
		aria-label="Open social features"
	>
		<div class="relative">
			<PropertyIcon key={'description'} value={'users'} size={20} />
			{#if userStore.unreadNotificationCount > 0}
				<span
					class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
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
					<PropertyIcon key={'description'} value={'users'} size={20} class="mr-2" />
					Social
				</Dialog.Title>

				<div class="flex items-center space-x-2">
					<!-- Notifications button -->
					<button
						onclick={toggleNotifications}
						onkeydown={(e) => e.key === 'Enter' && toggleNotifications()}
						class="relative rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
						tabindex="0"
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

					<Dialog.Close
						class="focus-visible:ring-foreground focus-visible:ring-offset-background rounded-md p-2 hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden active:scale-[0.98]"
					>
						<PropertyIcon key={'description'} value={'x'} size={18} class="text-foreground" />
						<span class="sr-only">Close</span>
					</Dialog.Close>
				</div>
			</div>

			{#if !currentUser}
				<!-- Not authenticated -->
				<div class="p-8 text-center">
					<PropertyIcon
						key={'description'}
						value={'lock'}
						size={48}
						class="mx-auto mb-4 text-gray-400"
					/>
					<h3 class="mb-2 text-lg font-medium text-gray-900">Sign in to use social features</h3>
					<p class="mb-4 text-gray-600">
						Connect with other travelers, share your stories, and discover amazing places.
					</p>
					<p class="text-sm text-gray-500">
						Click the profile button to sign in or create an account.
					</p>
				</div>
			{:else}
				<!-- Main content -->
				<div class="flex h-full flex-col">
					<!-- Tab navigation -->
					<div class="flex border-b border-gray-200">
						{#each tabs as tab}
							<button
								onclick={() => switchTab(tab.id)}
								onkeydown={(e) => e.key === 'Enter' && switchTab(tab.id)}
								class="flex flex-1 items-center justify-center space-x-2 px-4 py-3 text-sm font-medium transition-colors
									{activeTab === tab.id
									? 'border-b-2 border-blue-600 bg-blue-50 text-blue-600'
									: 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'}"
								tabindex="0"
								role="tab"
								aria-selected={activeTab === tab.id}
								aria-label="Switch to {tab.label} tab"
							>
								<PropertyIcon key={'description'} value={tab.icon} size={16} />
								<span>{tab.label}</span>
								{#if tab.id === 'requests' && userStore.hasPendingRequests}
									<span
										class="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-800"
									>
										{userStore.pendingFollowRequests.length}
									</span>
								{/if}
							</button>
						{/each}
					</div>

					<!-- Tab content -->
					<div class="flex-1 overflow-y-auto">
						{#if activeTab === 'feed'}
							<div class="p-4">
								<ActivityFeed />
							</div>
						{:else if activeTab === 'search'}
							<div class="space-y-4 p-4">
								<!-- Profile Editor -->
								<ProfileEditor />

								<!-- User Search -->
								<div>
									<h3 class="mb-3 text-lg font-semibold text-gray-900">Find People</h3>
									<UserSearch />
								</div>
							</div>
						{:else if activeTab === 'requests'}
							<div class="p-4">
								<FollowRequests />
							</div>
						{/if}
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
