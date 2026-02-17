<script lang="ts">
	import { userStore } from '$lib/stores/UserStore.svelte';
	import { authState } from '$lib/stores/auth.svelte';
	import { onMount, onDestroy } from 'svelte';

	// This component manages the UserStore lifecycle and effects
	let lastUser: any = null;

	// Watch for auth changes using $effect
	$effect(() => {
		const currentUser = authState.user;

		// Only react to actual changes
		if (currentUser !== lastUser) {
			lastUser = currentUser;

			if (currentUser) {
				userStore.initializeUserData();
			} else {
				userStore.clearUserData();
			}
		}
	});

	onDestroy(() => {
		// Clean up when component is destroyed
		userStore.clearUserData();
	});
</script>

<!-- This component doesn't render anything, it just manages the store -->
