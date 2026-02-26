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
import { browser } from '$app/environment';

/**
 * Auth State management class using Svelte 5 runes
 * Handles Firebase authentication state
 */
class AuthState {
	// Reactive states
	private _user = $state<User | null>(null);
	private _loading = $state<boolean>(true);
	private _authError = $state<string | null>(null);

	constructor() {
		// Initialize auth state listener (only in browser)
		if (browser) {
			onAuthStateChanged(auth, (firebaseUser) => {
				this._user = firebaseUser;
				this._loading = false;
			});
		} else {
			// On server, just set loading to false
			this._loading = false;
		}
	}

	// Getters for reactive state
	get user(): User | null {
		return this._user;
	}

	get loading(): boolean {
		return this._loading;
	}

	get authError(): string | null {
		return this._authError;
	}

	// Clear auth error
	clearAuthError(): void {
		this._authError = null;
	}

	// Sign up with email and password
	async signUp(email: string, password: string, displayName?: string): Promise<User> {
		try {
			this._authError = null;
			this._loading = true;

			const userCredential = await createUserWithEmailAndPassword(auth, email, password);

			// Update profile with display name if provided
			if (displayName && userCredential.user) {
				await updateProfile(userCredential.user, { displayName });
			}

			return userCredential.user;
		} catch (error: any) {
			console.error('Sign up error:', error);
			this._authError = error.message;
			throw error;
		} finally {
			this._loading = false;
		}
	}

	// Sign in with email and password
	async signIn(email: string, password: string): Promise<User> {
		try {
			this._authError = null;
			this._loading = true;

			const userCredential = await signInWithEmailAndPassword(auth, email, password);

			// Check if email is verified
			if (!userCredential.user.emailVerified) {
				// Sign out the user immediately
				await firebaseSignOut(auth);
				this._authError =
					'Account not verified. Please contact administrator to verify your account.';
				throw new Error('Email not verified');
			}

			return userCredential.user;
		} catch (error: any) {
			console.error('Sign in error:', error);
			if (error.message !== 'Email not verified') {
				this._authError = error.message;
			}
			throw error;
		} finally {
			this._loading = false;
		}
	}

	// Sign in with Google
	async signInWithGoogle(): Promise<User> {
		try {
			this._authError = null;
			this._loading = true;

			const provider = new GoogleAuthProvider();
			const userCredential = await signInWithPopup(auth, provider);

			// Check if email is verified
			if (!userCredential.user.emailVerified) {
				// Sign out the user immediately
				await firebaseSignOut(auth);
				this._authError =
					'Account not verified. Please contact administrator to verify your account.';
				throw new Error('Email not verified');
			}

			return userCredential.user;
		} catch (error: any) {
			console.error('Google sign in error:', error);
			if (error.message !== 'Email not verified') {
				this._authError = error.message;
			}
			throw error;
		} finally {
			this._loading = false;
		}
	}

	// Sign out
	async signOut(): Promise<void> {
		try {
			this._loading = true;
			await firebaseSignOut(auth);
		} catch (error: any) {
			console.error('Sign out error:', error);
			this._authError = error.message;
			throw error;
		} finally {
			this._loading = false;
		}
	}

	// Reset password
	async resetPassword(email: string): Promise<boolean> {
		try {
			this._authError = null;
			await sendPasswordResetEmail(auth, email);
			return true;
		} catch (error: any) {
			console.error('Password reset error:', error);
			this._authError = error.message;
			throw error;
		}
	}
}

// Create singleton instance
export const authState = new AuthState();
