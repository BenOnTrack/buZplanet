<script lang="ts">
	import { userStore } from '$lib/stores/UserStore.svelte';

	let isEditing = $state(false);
	let editDisplayName = $state('');
	let editBio = $state('');
	let editLocation = $state('');
	let editWebsite = $state('');
	let saving = $state(false);

	function startEditing() {
		if (userStore.currentProfile) {
			editDisplayName = userStore.currentProfile.displayName;
			editBio = userStore.currentProfile.bio || '';
			editLocation = userStore.currentProfile.location || '';
			editWebsite = userStore.currentProfile.website || '';
		}
		isEditing = true;
	}

	function cancelEditing() {
		isEditing = false;
		editDisplayName = '';
		editBio = '';
		editLocation = '';
		editWebsite = '';
	}

	async function saveProfile() {
		try {
			saving = true;
			await userStore.updateProfile({
				displayName: editDisplayName.trim() || 'Anonymous',
				bio: editBio.trim() || undefined,
				location: editLocation.trim() || undefined,
				website: editWebsite.trim() || undefined
			});
			isEditing = false;
		} catch (error) {
			console.error('Failed to save profile:', error);
			alert('Failed to save profile. Please try again.');
		} finally {
			saving = false;
		}
	}
</script>

{#if userStore.currentProfile}
	<div class="rounded-lg bg-gray-50 p-4">
		<div class="mb-3 flex items-center justify-between">
			<h4 class="font-medium text-gray-900">Your Profile</h4>
			{#if !isEditing}
				<button
					onclick={startEditing}
					class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
				>
					Edit
				</button>
			{/if}
		</div>

		{#if isEditing}
			<!-- Edit Mode -->
			<div class="space-y-3">
				<div>
					<label for="edit-display-name" class="mb-1 block text-sm font-medium text-gray-700"
						>Display Name</label
					>
					<input
						id="edit-display-name"
						type="text"
						bind:value={editDisplayName}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
						placeholder="Enter your name"
						disabled={saving}
					/>
				</div>

				<div>
					<label for="edit-bio" class="mb-1 block text-sm font-medium text-gray-700"
						>Bio (optional)</label
					>
					<textarea
						id="edit-bio"
						bind:value={editBio}
						rows="2"
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
						placeholder="Tell others about yourself..."
						disabled={saving}
					></textarea>
				</div>

				<div>
					<label for="edit-location" class="mb-1 block text-sm font-medium text-gray-700"
						>Location (optional)</label
					>
					<input
						id="edit-location"
						type="text"
						bind:value={editLocation}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
						placeholder="Where are you located?"
						disabled={saving}
					/>
				</div>

				<div>
					<label for="edit-website" class="mb-1 block text-sm font-medium text-gray-700"
						>Website (optional)</label
					>
					<input
						id="edit-website"
						type="url"
						bind:value={editWebsite}
						class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
						placeholder="https://your-website.com"
						disabled={saving}
					/>
				</div>

				<div class="flex space-x-2">
					<button
						onclick={saveProfile}
						disabled={saving}
						class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
					>
						{saving ? 'Saving...' : 'Save'}
					</button>
					<button
						onclick={cancelEditing}
						disabled={saving}
						class="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<!-- View Mode -->
			<div class="flex items-center space-x-4">
				{#if userStore.currentProfile.avatarUrl}
					<img
						src={userStore.currentProfile.avatarUrl}
						alt="Your avatar"
						class="h-12 w-12 rounded-full object-cover"
					/>
				{:else}
					<div
						class="flex h-12 w-12 items-center justify-center rounded-full bg-gray-300 font-semibold text-gray-600"
					>
						{userStore.currentProfile.displayName.charAt(0).toUpperCase()}
					</div>
				{/if}

				<div class="flex-1">
					<div class="font-medium text-gray-900">
						{userStore.currentProfile.displayName}
						{#if userStore.currentProfile.displayName === 'Anonymous'}
							<span class="ml-1 text-sm text-red-500">(Click Edit to fix this!)</span>
						{/if}
					</div>
					<div class="text-sm text-gray-500">@{userStore.currentProfile.username}</div>
					{#if userStore.currentProfile.bio}
						<div class="mt-1 text-sm text-gray-600">{userStore.currentProfile.bio}</div>
					{/if}
					{#if userStore.currentProfile.location}
						<div class="mt-1 text-xs text-gray-500">📍 {userStore.currentProfile.location}</div>
					{/if}
				</div>

				<div class="text-center">
					<div class="text-lg font-semibold text-gray-900">
						{userStore.currentProfile.followerCount}
					</div>
					<div class="text-xs text-gray-600">Followers</div>
				</div>
				<div class="text-center">
					<div class="text-lg font-semibold text-gray-900">
						{userStore.currentProfile.followingCount}
					</div>
					<div class="text-xs text-gray-600">Following</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
