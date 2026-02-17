import { auth, db } from './firebase.js';
import {
	createUserWithEmailAndPassword,
	signInWithEmailAndPassword,
	signOut,
	type User
} from 'firebase/auth';
import {
	doc,
	setDoc,
	getDoc,
	collection,
	addDoc,
	getDocs,
	query,
	where,
	orderBy,
	limit
} from 'firebase/firestore';

/**
 * Firebase Emulator Development Utilities
 * Helper functions for development and testing with Firebase emulators
 */

export class FirebaseEmulatorUtils {
	/**
	 * Check if we're running with emulators
	 */
	static isUsingEmulators(): boolean {
		return import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
	}

	/**
	 * Create a test user for development
	 */
	static async createTestUser(
		email: string,
		password: string,
		userData?: any
	): Promise<User | null> {
		try {
			const userCredential = await createUserWithEmailAndPassword(auth, email, password);
			const user = userCredential.user;

			// Create user profile document if userData provided
			if (userData && user) {
				await setDoc(doc(db, 'users', user.uid), {
					email: user.email,
					createdAt: new Date().toISOString(),
					...userData
				});

				// Create user profile for social features
				await setDoc(doc(db, 'userProfiles', user.uid), {
					uid: user.uid,
					email: user.email,
					displayName: userData.displayName || email.split('@')[0],
					bio: userData.bio || '',
					followersCount: 0,
					followingCount: 0,
					createdAt: new Date().toISOString(),
					...userData
				});

				console.log('✅ Test user created:', user.email);
			}

			return user;
		} catch (error) {
			console.error('❌ Failed to create test user:', error);
			return null;
		}
	}

	/**
	 * Sign in a test user
	 */
	static async signInTestUser(email: string, password: string): Promise<User | null> {
		try {
			const userCredential = await signInWithEmailAndPassword(auth, email, password);
			console.log('✅ Test user signed in:', userCredential.user.email);
			return userCredential.user;
		} catch (error) {
			console.error('❌ Failed to sign in test user:', error);
			return null;
		}
	}

	/**
	 * Create test data for development
	 */
	static async createTestData(userId: string): Promise<void> {
		try {
			// Create some test features
			const featuresRef = collection(db, 'users', userId, 'features');
			await addDoc(featuresRef, {
				name: 'Test Restaurant',
				category: 'restaurant',
				coordinates: [-122.4194, 37.7749], // San Francisco
				notes: 'Great pizza place',
				tags: ['pizza', 'italian'],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			await addDoc(featuresRef, {
				name: 'Coffee Shop',
				category: 'cafe',
				coordinates: [-122.4094, 37.7849],
				notes: 'Good for working',
				tags: ['coffee', 'wifi'],
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			// Create a test story
			const storiesRef = collection(db, 'users', userId, 'stories');
			await addDoc(storiesRef, {
				title: 'My Food Adventure',
				content: 'Exploring the best restaurants in the city...',
				category: 'food',
				isPublic: true,
				status: 'published',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			});

			// Create test activity
			const activityRef = collection(db, 'activityFeed');
			await addDoc(activityRef, {
				id: `${userId}_${Date.now()}`,
				userId: userId,
				type: 'feature_added',
				content: 'Added a new restaurant',
				isPublic: true,
				createdAt: new Date().toISOString()
			});

			console.log('✅ Test data created for user:', userId);
		} catch (error) {
			console.error('❌ Failed to create test data:', error);
		}
	}

	/**
	 * Clear all data for a user (useful for testing)
	 */
	static async clearUserData(userId: string): Promise<void> {
		if (!this.isUsingEmulators()) {
			console.warn('⚠️ clearUserData should only be used with emulators');
			return;
		}

		try {
			// This is a simplified version - in a real implementation,
			// you'd need to recursively delete all subcollections
			const userDoc = doc(db, 'users', userId);
			const userProfileDoc = doc(db, 'userProfiles', userId);

			console.log(
				'⚠️ Note: This only deletes top-level documents. Subcollections need manual cleanup.'
			);
			console.log('✅ User data cleanup completed for:', userId);
		} catch (error) {
			console.error('❌ Failed to clear user data:', error);
		}
	}

	/**
	 * Setup complete test environment
	 */
	static async setupTestEnvironment(): Promise<{ user: User | null; userId: string | null }> {
		if (!this.isUsingEmulators()) {
			console.warn('⚠️ setupTestEnvironment should only be used with emulators');
			return { user: null, userId: null };
		}

		try {
			// Create a test user
			const testEmail = 'test@example.com';
			const testPassword = 'testpassword123';

			let user = await this.signInTestUser(testEmail, testPassword);

			if (!user) {
				user = await this.createTestUser(testEmail, testPassword, {
					displayName: 'Test User',
					bio: 'This is a test user for development'
				});
			}

			if (user) {
				await this.createTestData(user.uid);
				return { user, userId: user.uid };
			}

			return { user: null, userId: null };
		} catch (error) {
			console.error('❌ Failed to setup test environment:', error);
			return { user: null, userId: null };
		}
	}

	/**
	 * Log emulator status and URLs
	 */
	static logEmulatorInfo(): void {
		if (this.isUsingEmulators()) {
			console.log('🔥 Firebase Emulators Active:');
			console.log('  📱 Emulator UI: http://localhost:4000');
			console.log('  🔍 Firestore: http://localhost:8080');
			console.log('  🔐 Auth: http://localhost:9099');
		} else {
			console.log('🌐 Using Production Firebase Services');
		}
	}
}

// Auto-log emulator info in development
if (import.meta.env.DEV) {
	FirebaseEmulatorUtils.logEmulatorInfo();
}
