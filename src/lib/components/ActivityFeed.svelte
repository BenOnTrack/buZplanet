<script lang="ts">
	import { userStore } from '$lib/stores/UserStore.svelte';
	import { onMount } from 'svelte';

	async function refreshFeed() {
		try {
			await userStore.loadActivityFeed();
		} catch (error) {
			console.error('Failed to refresh activity feed:', error);
		}
	}

	function getActivityIcon(type: ActivityType): string {
		switch (type) {
			case 'story_created':
				return '📝';
			case 'story_updated':
				return '✏️';
			case 'feature_bookmarked':
				return '📌';
			case 'list_created':
				return '📋';
			case 'list_updated':
				return '📝';
			case 'user_followed':
				return '👤';
			default:
				return '🔔';
		}
	}

	function getActivityText(activity: ActivityFeedItem): string {
		switch (activity.type) {
			case 'story_created':
				return `created a new story${activity.itemTitle ? `: "${activity.itemTitle}"` : ''}`;
			case 'story_updated':
				return `updated their story${activity.itemTitle ? `: "${activity.itemTitle}"` : ''}`;
			case 'feature_bookmarked':
				return `bookmarked a new place${activity.itemTitle ? `: "${activity.itemTitle}"` : ''}`;
			case 'list_created':
				return `created a new list${activity.itemTitle ? `: "${activity.itemTitle}"` : ''}`;
			case 'list_updated':
				return `updated their list${activity.itemTitle ? `: "${activity.itemTitle}"` : ''}`;
			case 'user_followed':
				return `started following someone new`;
			default:
				return 'had some activity';
		}
	}

	function formatRelativeTime(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;

		const minutes = Math.floor(diff / (1000 * 60));
		const hours = Math.floor(diff / (1000 * 60 * 60));
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days > 0) {
			return `${days} day${days > 1 ? 's' : ''} ago`;
		} else if (hours > 0) {
			return `${hours} hour${hours > 1 ? 's' : ''} ago`;
		} else if (minutes > 0) {
			return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
		} else {
			return 'Just now';
		}
	}

	function handleActivityClick(activity: ActivityFeedItem) {
		// Navigate based on activity type
		switch (activity.type) {
			case 'story_created':
			case 'story_updated':
				if (activity.storyId) {
					console.log('Navigate to story:', activity.storyId);
					// You would navigate to the story page here
				}
				break;
			case 'feature_bookmarked':
				if (activity.featureId) {
					console.log('Navigate to feature:', activity.featureId);
					// You would navigate to the feature or map location here
				}
				break;
			case 'list_created':
			case 'list_updated':
				if (activity.listId) {
					console.log('Navigate to list:', activity.listId);
					// You would navigate to the list page here
				}
				break;
			case 'user_followed':
				console.log('Navigate to user profile:', activity.userId);
				// You would navigate to the user's profile page here
				break;
		}
	}

	onMount(() => {
		// Load activity feed if not already loaded
		if (userStore.activityFeed.length === 0) {
			userStore.loadActivityFeed();
		}
	});
</script>

<div class="rounded-lg border bg-white shadow-sm">
	<div class="border-b border-gray-200 px-6 py-4">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-gray-900">Activity Feed</h2>
			<button
				onclick={refreshFeed}
				onkeydown={(e) => e.key === 'Enter' && refreshFeed()}
				class="text-sm font-medium text-blue-600 hover:text-blue-800"
				tabindex="0"
				aria-label="Refresh activity feed"
			>
				Refresh
			</button>
		</div>
	</div>

	<div class="max-h-96 divide-y divide-gray-100 overflow-y-auto">
		{#if userStore.activityLoading}
			<div class="flex items-center justify-center py-8">
				<div
					class="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
				></div>
				<span class="ml-2 text-gray-600">Loading activity...</span>
			</div>
		{:else if userStore.activityFeed.length === 0}
			<div class="py-8 text-center">
				<div class="mb-4 text-4xl text-gray-400">📬</div>
				<div class="text-lg text-gray-500">No activity yet</div>
				<div class="mt-2 text-sm text-gray-400">
					Follow other users to see their activities here
				</div>
			</div>
		{:else}
			{#each userStore.activityFeed as activity (activity.id)}
				<button
					onclick={() => handleActivityClick(activity)}
					onkeydown={(e) => e.key === 'Enter' && handleActivityClick(activity)}
					class="w-full p-4 text-left transition-colors hover:bg-gray-50"
					tabindex="0"
					aria-label="View activity: {activity.userDisplayName} {getActivityText(activity)}"
				>
					<div class="flex items-start space-x-3">
						<!-- Avatar -->
						{#if activity.userAvatarUrl}
							<img
								src={activity.userAvatarUrl}
								alt="{activity.userDisplayName}'s avatar"
								class="h-10 w-10 flex-shrink-0 rounded-full object-cover"
							/>
						{:else}
							<div
								class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-300 font-semibold text-gray-600"
							>
								{activity.userDisplayName.charAt(0).toUpperCase()}
							</div>
						{/if}

						<!-- Content -->
						<div class="min-w-0 flex-1">
							<div class="flex items-center space-x-2">
								<span class="font-medium text-gray-900">
									{activity.userDisplayName}
								</span>
								<span class="text-sm text-gray-500">
									@{activity.userUsername}
								</span>
								<div class="text-lg">
									{getActivityIcon(activity.type)}
								</div>
							</div>

							<p class="mt-1 text-sm text-gray-700">
								{getActivityText(activity)}
							</p>

							{#if activity.itemDescription}
								<p class="mt-1 line-clamp-2 text-xs text-gray-500">
									{activity.itemDescription}
								</p>
							{/if}

							<div class="mt-2 text-xs text-gray-400">
								{formatRelativeTime(activity.dateCreated)}
							</div>
						</div>
					</div>
				</button>
			{/each}
		{/if}
	</div>
</div>
