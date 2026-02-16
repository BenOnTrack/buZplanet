<script lang="ts">
	import { userStore } from '$lib/stores/UserStore.svelte';

	async function handleAcceptRequest(followerId: string) {
		try {
			await userStore.acceptFollowRequest(followerId);
		} catch (error) {
			console.error('Failed to accept follow request:', error);
			// Show error message to user
		}
	}

	async function handleRejectRequest(followerId: string) {
		try {
			await userStore.rejectFollowRequest(followerId);
		} catch (error) {
			console.error('Failed to reject follow request:', error);
			// Show error message to user
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString();
	}
</script>

<div class="rounded-lg border bg-white shadow-sm">
	<div class="border-b border-gray-200 px-6 py-4">
		<h2 class="text-lg font-semibold text-gray-900">
			Follow Requests
			{#if userStore.pendingFollowRequests.length > 0}
				<span
					class="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800"
				>
					{userStore.pendingFollowRequests.length}
				</span>
			{/if}
		</h2>
	</div>

	<div class="divide-y divide-gray-100">
		{#if userStore.pendingFollowRequests.length === 0}
			<div class="py-8 text-center">
				<div class="mb-4 text-4xl text-gray-400">👤</div>
				<div class="text-lg text-gray-500">No pending requests</div>
				<div class="mt-2 text-sm text-gray-400">
					When someone requests to follow you, you'll see them here
				</div>
			</div>
		{:else}
			{#each userStore.pendingFollowRequests as { follow, followerProfile } (follow.id)}
				<div class="flex items-center space-x-4 p-4">
					<!-- Avatar -->
					{#if followerProfile.avatarUrl}
						<img
							src={followerProfile.avatarUrl}
							alt="{followerProfile.displayName}'s avatar"
							class="h-12 w-12 rounded-full object-cover"
						/>
					{:else}
						<div
							class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-300 font-semibold text-gray-600"
						>
							{followerProfile.displayName.charAt(0).toUpperCase()}
						</div>
					{/if}

					<!-- User info -->
					<div class="min-w-0 flex-1">
						<div class="font-medium text-gray-900">
							{followerProfile.displayName}
						</div>
						<div class="text-sm text-gray-500">
							@{followerProfile.username}
						</div>
						{#if followerProfile.bio}
							<div class="mt-1 line-clamp-2 text-xs text-gray-400">
								{followerProfile.bio}
							</div>
						{/if}
						<div class="mt-1 text-xs text-gray-400">
							Requested {formatDate(follow.dateCreated)}
						</div>
					</div>

					<!-- Action buttons -->
					<div class="flex space-x-2">
						<button
							onclick={() => handleRejectRequest(follow.followerId)}
							onkeydown={(e) => e.key === 'Enter' && handleRejectRequest(follow.followerId)}
							class="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-700 transition-colors hover:bg-gray-50"
							tabindex="0"
							aria-label="Reject follow request from {followerProfile.displayName}"
						>
							Decline
						</button>
						<button
							onclick={() => handleAcceptRequest(follow.followerId)}
							onkeydown={(e) => e.key === 'Enter' && handleAcceptRequest(follow.followerId)}
							class="rounded-md bg-blue-600 px-3 py-1 text-sm text-white transition-colors hover:bg-blue-700"
							tabindex="0"
							aria-label="Accept follow request from {followerProfile.displayName}"
						>
							Accept
						</button>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>
