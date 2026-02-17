<script lang="ts">
	import { userStore } from '$lib/stores/UserStore.svelte';
	import { onMount } from 'svelte';

	// Reactive state
	let searchTerm = $state('');
	let showDropdown = $state(false);

	// Debounced search
	let searchTimeout: NodeJS.Timeout;

	function handleSearch(event: Event) {
		const target = event.target as HTMLInputElement;
		searchTerm = target.value;

		clearTimeout(searchTimeout);

		if (searchTerm.trim()) {
			showDropdown = true;
			searchTimeout = setTimeout(() => {
				userStore.searchUsers(searchTerm);
			}, 300);
		} else {
			showDropdown = false;
			userStore.clearUserSearch();
		}
	}

	function handleResultClick(user: UserProfile) {
		showDropdown = false;
		searchTerm = '';
		userStore.clearUserSearch();
		// You could emit an event or navigate to user profile here
		console.log('Selected user:', user);
	}

	async function handleFollowToggle(userId: string, currentStatus: string) {
		try {
			if (currentStatus === 'following') {
				await userStore.unfollowUser(userId);
			} else if (currentStatus === 'none' || currentStatus === 'follower') {
				await userStore.followUser(userId);
			}
		} catch (error) {
			console.error('Follow action failed:', error);
			// Show error message to user
		}
	}

	function getFollowButtonText(status: string): string {
		switch (status) {
			case 'following':
				return 'Unfollow';
			case 'mutual':
				return 'Following';
			case 'follower':
				return 'Follow Back';
			default:
				return 'Follow';
		}
	}

	function getFollowButtonClass(status: string): string {
		switch (status) {
			case 'following':
			case 'mutual':
				return 'bg-gray-200 text-gray-700 hover:bg-gray-300';
			case 'follower':
				return 'bg-blue-600 text-white hover:bg-blue-700';
			default:
				return 'bg-blue-600 text-white hover:bg-blue-700';
		}
	}

	// Close dropdown when clicking outside
	function handleOutsideClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.user-search-container')) {
			showDropdown = false;
		}
	}

	onMount(() => {
		document.addEventListener('click', handleOutsideClick);
		return () => {
			document.removeEventListener('click', handleOutsideClick);
			clearTimeout(searchTimeout);
		};
	});
</script>

<div class="user-search-container relative">
	<div class="relative">
		<input
			type="text"
			placeholder="Search users..."
			value={searchTerm}
			oninput={handleSearch}
			class="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
		/>

		{#if userStore.userSearchLoading}
			<div class="absolute top-2.5 right-3">
				<div
					class="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
				></div>
			</div>
		{/if}
	</div>

	{#if showDropdown && (userStore.userSearchResults.length > 0 || userStore.userSearchLoading)}
		<div
			class="absolute top-full right-0 left-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-lg border border-gray-300 bg-white shadow-lg"
		>
			{#if userStore.userSearchLoading}
				<div class="p-4 text-center text-gray-500">Searching users...</div>
			{:else if userStore.userSearchResults.length === 0}
				<div class="p-4 text-center text-gray-500">No users found</div>
			{:else}
				{#each userStore.userSearchResults as result (result.user.id)}
					<div
						class="flex items-center justify-between border-b border-gray-100 p-3 last:border-b-0 hover:bg-gray-50"
					>
						<button
							onclick={() => handleResultClick(result.user)}
							onkeydown={(e) => e.key === 'Enter' && handleResultClick(result.user)}
							class="flex flex-1 items-center space-x-3 text-left"
							tabindex="0"
							aria-label="View profile for {result.user.displayName}"
						>
							{#if result.user.avatarUrl}
								<img
									src={result.user.avatarUrl}
									alt="{result.user.displayName}'s avatar"
									class="h-10 w-10 rounded-full object-cover"
								/>
							{:else}
								<div
									class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-300 font-semibold text-gray-600"
								>
									{result.user.displayName.charAt(0).toUpperCase()}
								</div>
							{/if}

							<div class="min-w-0 flex-1">
								<div class="truncate font-medium text-gray-900">
									{result.user.displayName}
								</div>
								<div class="truncate text-sm text-gray-500">
									@{result.user.username}
								</div>
								{#if result.user.bio}
									<div class="mt-1 truncate text-xs text-gray-400">
										{result.user.bio}
									</div>
								{/if}
							</div>
						</button>

						<button
							onclick={() => handleFollowToggle(result.user.id, result.followStatus || 'none')}
							onkeydown={(e) =>
								e.key === 'Enter' &&
								handleFollowToggle(result.user.id, result.followStatus || 'none')}
							class="rounded-md px-3 py-1 text-sm transition-colors {getFollowButtonClass(
								result.followStatus || 'none'
							)}"
							tabindex="0"
							aria-label="{getFollowButtonText(result.followStatus || 'none')} {result.user
								.displayName}"
						>
							{getFollowButtonText(result.followStatus || 'none')}
						</button>
					</div>
				{/each}
			{/if}
		</div>
	{/if}
</div>
