<script lang="ts">
	import { authState } from '$lib/stores/auth.svelte';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	async function handleSignOut() {
		try {
			await authState.signOut();
		} catch (error) {
			console.error('Error signing out:', error);
		}
	}
</script>

<div class="space-y-4">
	<div class="text-center">
		<div class="mb-2 flex justify-center">
			<div class="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
				<PropertyIcon key={'description'} value={'user'} size={32} class="text-primary" />
			</div>
		</div>
		<h3 class="text-lg font-semibold">Welcome back!</h3>
		<p class="text-muted-foreground text-sm">
			{authState.user?.displayName || authState.user?.email || 'User'}
		</p>
		{#if authState.user?.email && authState.user?.displayName}
			<p class="text-muted-foreground text-xs">{authState.user.email}</p>
		{/if}
	</div>

	<div class="bg-muted/50 space-y-2 rounded-lg p-3 text-sm">
		<div class="flex items-center justify-between">
			<span class="font-medium">Email:</span>
			<span class="text-muted-foreground">{authState.user?.email}</span>
		</div>

		<div class="flex items-center justify-between">
			<span class="font-medium">Verified:</span>
			<span class="text-muted-foreground">
				{authState.user?.emailVerified ? 'Yes' : 'No'}
			</span>
		</div>

		<div class="flex items-center justify-between">
			<span class="font-medium">Account created:</span>
			<span class="text-muted-foreground">
				{authState.user?.metadata.creationTime
					? new Date(authState.user.metadata.creationTime).toLocaleDateString()
					: 'Unknown'}
			</span>
		</div>
	</div>

	<button
		onclick={handleSignOut}
		disabled={authState.loading}
		class="border-input bg-background ring-offset-background hover:bg-destructive hover:text-destructive-foreground focus-visible:ring-ring inline-flex h-10 w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
	>
		{#if authState.loading}
			<PropertyIcon key={'description'} value={'loading'} size={16} class="mr-2 animate-spin" />
		{/if}
		<PropertyIcon key={'description'} value={'sign-out'} size={16} class="mr-2" />
		Sign Out
	</button>
</div>
