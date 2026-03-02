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
	private _successMessage = $state<string | null>(null);

	constructor() {
		// Initialize auth state listener (only in browser)
		if (browser) {
			try {
				// Set a timeout for initial auth determination
				const authTimeout = setTimeout(() => {
					if (this._loading) {
						console.warn('⚠️ Auth state determination timeout - assuming anonymous');
						this._user = null;
						this._loading = false;
					}
				}, 5000); // 5 second timeout

				onAuthStateChanged(auth, async (firebaseUser) => {
					clearTimeout(authTimeout);

					// Only set user if they exist and are email verified
					if (firebaseUser && !firebaseUser.emailVerified) {
						// Sign out unverified users
						try {
							await firebaseSignOut(auth);
							this._authError =
								'Account not verified. Please contact administrator to verify your account.';
						} catch (error) {
							console.error('Error signing out unverified user:', error);
						}
						this._user = null;
					} else {
						this._user = firebaseUser;
					}
					this._loading = false;
				});
			} catch (error) {
				console.error('Failed to initialize auth listener:', error);
				// Fallback to anonymous state
				this._user = null;
				this._loading = false;
			}
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

	get successMessage(): string | null {
		return this._successMessage;
	}

	// Clear auth error and success message
	clearAuthError(): void {
		this._authError = null;
	}

	clearSuccessMessage(): void {
		this._successMessage = null;
	}

	clearMessages(): void {
		this._authError = null;
		this._successMessage = null;
	}

	// Sign up with email and password
	async signUp(email: string, password: string, displayName?: string): Promise<User> {
		try {
			this._authError = null;
			this._successMessage = null;
			this._loading = true;

			const userCredential = await createUserWithEmailAndPassword(auth, email, password);

			// Update profile with display name if provided
			if (displayName && userCredential.user) {
				await updateProfile(userCredential.user, { displayName });
			}

			// Sign out immediately since email needs verification
			await firebaseSignOut(auth);

			// Set success message
			this._successMessage =
				'Account created successfully! Please contact an administrator to verify your account before signing in.';

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
			this._successMessage = null;
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
			this._successMessage = null;
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
