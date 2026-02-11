import { user, loading } from '$lib/stores/auth';
import { get } from 'svelte/store';

/**
 * Simple authentication guard
 * Returns the current authentication state
 */
export function useAuth() {
	return {
		user: get(user),
		isLoading: get(loading),
		isAuthenticated: !!get(user)
	};
}

/**
 * Reactive authentication state
 * Use this in components with $derived()
 */
export function getAuthState() {
	return {
		user,
		loading,
		isAuthenticated: $derived(!!user)
	};
}
