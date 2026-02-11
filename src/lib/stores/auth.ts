import { writable } from 'svelte/store';
import {
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signOut as firebaseSignOut,
	onAuthStateChanged,
	type User,
	GoogleAuthProvider,
	signInWithPopup,
	sendPasswordResetEmail,
	updateProfile
} from 'firebase/auth';
import { auth } from '$lib/firebase';

// Auth store to track the current user
export const user = writable<User | null>(null);
export const loading = writable<boolean>(true);
export const authError = writable<string | null>(null);

// Initialize auth state listener
onAuthStateChanged(auth, (firebaseUser) => {
	user.set(firebaseUser);
	loading.set(false);
});

// Clear auth error
export function clearAuthError() {
	authError.set(null);
}

// Sign up with email and password
export async function signUp(email: string, password: string, displayName?: string) {
	try {
		authError.set(null);
		loading.set(true);

		const userCredential = await createUserWithEmailAndPassword(auth, email, password);

		// Update profile with display name if provided
		if (displayName && userCredential.user) {
			await updateProfile(userCredential.user, { displayName });
		}

		return userCredential.user;
	} catch (error: any) {
		console.error('Sign up error:', error);
		authError.set(error.message);
		throw error;
	} finally {
		loading.set(false);
	}
}

// Sign in with email and password
export async function signIn(email: string, password: string) {
	try {
		authError.set(null);
		loading.set(true);

		const userCredential = await signInWithEmailAndPassword(auth, email, password);
		return userCredential.user;
	} catch (error: any) {
		console.error('Sign in error:', error);
		authError.set(error.message);
		throw error;
	} finally {
		loading.set(false);
	}
}

// Sign in with Google
export async function signInWithGoogle() {
	try {
		authError.set(null);
		loading.set(true);

		const provider = new GoogleAuthProvider();
		const userCredential = await signInWithPopup(auth, provider);
		return userCredential.user;
	} catch (error: any) {
		console.error('Google sign in error:', error);
		authError.set(error.message);
		throw error;
	} finally {
		loading.set(false);
	}
}

// Sign out
export async function signOut() {
	try {
		loading.set(true);
		await firebaseSignOut(auth);
	} catch (error: any) {
		console.error('Sign out error:', error);
		authError.set(error.message);
		throw error;
	} finally {
		loading.set(false);
	}
}

// Reset password
export async function resetPassword(email: string) {
	try {
		authError.set(null);
		await sendPasswordResetEmail(auth, email);
		return true;
	} catch (error: any) {
		console.error('Password reset error:', error);
		authError.set(error.message);
		throw error;
	}
}
