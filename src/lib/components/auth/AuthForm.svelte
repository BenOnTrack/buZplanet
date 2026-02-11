<script lang="ts">
	import {
		signIn,
		signUp,
		signInWithGoogle,
		authError,
		loading,
		clearAuthError
	} from '$lib/stores/auth';
	import PropertyIcon from '$lib/components/ui/PropertyIcon.svelte';

	let isSignUp = $state(false);
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let displayName = $state('');
	let formError = $state('');

	const errorMessage = $derived($authError || formError);
	const isLoading = $derived($loading);

	// Clear errors when switching between forms
	function toggleForm() {
		isSignUp = !isSignUp;
		clearAuthError();
		formError = '';
		email = '';
		password = '';
		confirmPassword = '';
		displayName = '';
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		formError = '';

		// Basic validation
		if (!email || !password) {
			formError = 'Email and password are required';
			return;
		}

		if (password.length < 6) {
			formError = 'Password must be at least 6 characters';
			return;
		}

		if (isSignUp) {
			if (password !== confirmPassword) {
				formError = 'Passwords do not match';
				return;
			}

			try {
				await signUp(email, password, displayName || undefined);
			} catch (error) {
				// Error is handled by the auth store
			}
		} else {
			try {
				await signIn(email, password);
			} catch (error) {
				// Error is handled by the auth store
			}
		}
	}

	async function handleGoogleSignIn() {
		try {
			await signInWithGoogle();
		} catch (error) {
			// Error is handled by the auth store
		}
	}
</script>

<form onsubmit={handleSubmit} class="space-y-4">
	<div class="space-y-4">
		{#if isSignUp}
			<div class="space-y-2">
				<label for="displayName" class="text-sm font-medium"> Display Name (optional) </label>
				<input
					id="displayName"
					type="text"
					bind:value={displayName}
					class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					placeholder="Enter your name"
					disabled={isLoading}
				/>
			</div>
		{/if}

		<div class="space-y-2">
			<label for="email" class="text-sm font-medium"> Email * </label>
			<input
				id="email"
				type="email"
				bind:value={email}
				required
				class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				placeholder="Enter your email"
				disabled={isLoading}
			/>
		</div>

		<div class="space-y-2">
			<label for="password" class="text-sm font-medium"> Password * </label>
			<input
				id="password"
				type="password"
				bind:value={password}
				required
				class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				placeholder="Enter your password"
				disabled={isLoading}
			/>
		</div>

		{#if isSignUp}
			<div class="space-y-2">
				<label for="confirmPassword" class="text-sm font-medium"> Confirm Password * </label>
				<input
					id="confirmPassword"
					type="password"
					bind:value={confirmPassword}
					required
					class="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					placeholder="Confirm your password"
					disabled={isLoading}
				/>
			</div>
		{/if}
	</div>

	{#if errorMessage}
		<div class="bg-destructive/15 text-destructive rounded-md p-3 text-sm">
			{errorMessage}
		</div>
	{/if}

	<div class="space-y-3">
		<button
			type="submit"
			disabled={isLoading}
			class="bg-primary text-primary-foreground ring-offset-background hover:bg-primary/90 focus-visible:ring-ring inline-flex h-10 w-full items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
		>
			{#if isLoading}
				<PropertyIcon key={'description'} value={'loading'} size={16} class="mr-2 animate-spin" />
			{/if}
			{isSignUp ? 'Create Account' : 'Sign In'}
		</button>

		<div class="relative">
			<div class="absolute inset-0 flex items-center">
				<span class="border-border w-full border-t"></span>
			</div>
			<div class="relative flex justify-center text-xs uppercase">
				<span class="bg-background text-muted-foreground px-2">Or continue with</span>
			</div>
		</div>

		<button
			type="button"
			onclick={handleGoogleSignIn}
			disabled={isLoading}
			class="border-input bg-background ring-offset-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-10 w-full items-center justify-center rounded-md border px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
		>
			<PropertyIcon key={'description'} value={'google'} size={16} class="mr-2" />
			Continue with Google
		</button>
	</div>

	<div class="text-center text-sm">
		{isSignUp ? 'Already have an account?' : "Don't have an account?"}
		<button
			type="button"
			onclick={toggleForm}
			class="text-primary font-medium underline-offset-4 hover:underline"
			disabled={isLoading}
		>
			{isSignUp ? 'Sign in' : 'Sign up'}
		</button>
	</div>
</form>
