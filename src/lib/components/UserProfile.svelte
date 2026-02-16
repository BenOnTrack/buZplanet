<script lang="ts">
	import { userStore } from '$lib/stores/UserStore.svelte';
	import { onMount } from 'svelte';

	interface Props {
		userId: string;
		username?: string; // Optional - can load by username instead of ID
	}

	let { userId, username }: Props = $props();

	// Component state
	let profile = $state<UserProfile | null>(null);
	let loading = $state(true);
	let followStatus = $state<'none' | 'following' | 'pending' | 'follower' | 'mutual'>('none');
	let isCurrentUser = $state(false);

	// Load profile data
	async function loadProfile() {
		try {
			loading = true;

			if (username && !userId) {
				profile = await userStore.getUserProfileByUsername(username);
			} else if (userId) {
				profile = await userStore.getUserProfile(userId);
			}

			if (profile) {
				// Check if this is the current user
				isCurrentUser = profile.id === userStore.currentProfile?.id;

				// Get follow status if not current user
				if (!isCurrentUser) {
					followStatus = await userStore.getFollowStatus(profile.id);
				}
			}
		} catch (error) {
			console.error('Error loading profile:', error);
		} finally {
			loading = false;
		}
	}

	async function handleFollowToggle() {
		if (!profile || isCurrentUser) return;

		try {
			if (followStatus === 'following' || followStatus === 'mutual') {
				await userStore.unfollowUser(profile.id);
				followStatus = followStatus === 'mutual' ? 'follower' : 'none';
			} else {
				await userStore.followUser(profile.id);
				followStatus = profile.isPublic ? 'following' : 'pending';
			}
		} catch (error) {
			console.error('Follow action failed:', error);
			// You might want to show an error message to the user
		}
	}

	function getFollowButtonText(): string {
		switch (followStatus) {
			case 'following':
				return 'Unfollow';
			case 'pending':
				return 'Request Sent';
			case 'mutual':
				return 'Following';
			case 'follower':
				return 'Follow Back';
			default:
				return 'Follow';
		}
	}

	function getFollowButtonClass(): string {
		switch (followStatus) {
			case 'following':
			case 'mutual':
				return 'bg-gray-200 text-gray-700 hover:bg-gray-300 hover:text-gray-800';
			case 'pending':
				return 'bg-yellow-100 text-yellow-700 cursor-not-allowed';
			case 'follower':
				return 'bg-blue-600 text-white hover:bg-blue-700';
			default:
				return 'bg-blue-600 text-white hover:bg-blue-700';
		}
	}

	function formatDate(timestamp: number): string {
		return new Date(timestamp).toLocaleDateString();
	}

	// Load profile on mount and when props change
	onMount(loadProfile);

	$effect(() => {
		if (userId || username) {
			loadProfile();
		}
	});
</script>

{#if loading}
	<div class="flex items-center justify-center p-8">
		<div
			class="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"
		></div>
	</div>
{:else if !profile}
	<div class="p-8 text-center">
		<div class="text-lg text-gray-500">User not found</div>
	</div>
{:else}
	<div class="rounded-lg border bg-white p-6 shadow-sm">
		<!-- Header with avatar and basic info -->
		<div class="flex items-start space-x-4">
			{#if profile.avatarUrl}
				<img
					src={profile.avatarUrl}
					alt="{profile.displayName}'s avatar"
					class="h-20 w-20 rounded-full object-cover"
				/>
			{:else}
				<div
					class="flex h-20 w-20 items-center justify-center rounded-full bg-gray-300 text-2xl font-semibold text-gray-600"
				>
					{profile.displayName.charAt(0).toUpperCase()}
				</div>
			{/if}

			<div class="min-w-0 flex-1">
				<div class="flex items-center space-x-3">
					<h1 class="truncate text-2xl font-bold text-gray-900">
						{profile.displayName}
					</h1>
					{#if !profile.isPublic}
						<span
							class="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800"
						>
							Private
						</span>
					{/if}
				</div>

				<p class="mt-1 text-gray-600">@{profile.username}</p>

				{#if profile.location}
					<p class="mt-1 text-sm text-gray-500">📍 {profile.location}</p>
				{/if}
			</div>

			{#if !isCurrentUser}
				<button
					onclick={handleFollowToggle}
					onkeydown={(e) => e.key === 'Enter' && handleFollowToggle()}
					disabled={followStatus === 'pending'}
					class="rounded-md px-4 py-2 font-medium transition-colors {getFollowButtonClass()}"
					tabindex="0"
					aria-label="{getFollowButtonText()} {profile.displayName}"
				>
					{getFollowButtonText()}
				</button>
			{/if}
		</div>

		<!-- Bio -->
		{#if profile.bio}
			<div class="mt-4">
				<p class="whitespace-pre-line text-gray-700">{profile.bio}</p>
			</div>
		{/if}

		<!-- Website -->
		{#if profile.website}
			<div class="mt-3">
				<a
					href={profile.website}
					target="_blank"
					rel="noopener noreferrer"
					class="text-blue-600 hover:text-blue-800 hover:underline"
				>
					🔗 {profile.website}
				</a>
			</div>
		{/if}

		<!-- Stats -->
		<div class="mt-4 flex items-center space-x-6 border-t border-gray-200 pt-4">
			<div class="text-center">
				<div class="text-xl font-semibold text-gray-900">{profile.followerCount}</div>
				<div class="text-sm text-gray-600">Followers</div>
			</div>
			<div class="text-center">
				<div class="text-xl font-semibold text-gray-900">{profile.followingCount}</div>
				<div class="text-sm text-gray-600">Following</div>
			</div>
			{#if profile.publicStoryCount > 0}
				<div class="text-center">
					<div class="text-xl font-semibold text-gray-900">{profile.publicStoryCount}</div>
					<div class="text-sm text-gray-600">Stories</div>
				</div>
			{/if}
			{#if profile.publicFeatureCount > 0}
				<div class="text-center">
					<div class="text-xl font-semibold text-gray-900">{profile.publicFeatureCount}</div>
					<div class="text-sm text-gray-600">Features</div>
				</div>
			{/if}
		</div>

		<!-- Join date -->
		<div class="mt-4 border-t border-gray-200 pt-4">
			<p class="text-sm text-gray-500">
				Joined {formatDate(profile.dateCreated)}
			</p>
		</div>

		<!-- Follow status for current user viewing others -->
		{#if !isCurrentUser && followStatus !== 'none'}
			<div class="mt-3">
				{#if followStatus === 'mutual'}
					<p class="text-sm text-gray-600">
						You and {profile.displayName} follow each other
					</p>
				{:else if followStatus === 'following'}
					<p class="text-sm text-gray-600">
						You follow {profile.displayName}
					</p>
				{:else if followStatus === 'follower'}
					<p class="text-sm text-gray-600">
						{profile.displayName} follows you
					</p>
				{:else if followStatus === 'pending'}
					<p class="text-sm text-gray-600">Follow request pending</p>
				{/if}
			</div>
		{/if}
	</div>
{/if}
