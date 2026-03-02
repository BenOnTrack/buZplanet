import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, type Auth, connectAuthEmulator } from 'firebase/auth';
import {
	initializeFirestore,
	getFirestore,
	type Firestore,
	connectFirestoreEmulator,
	persistentLocalCache,
	persistentMultipleTabManager
} from 'firebase/firestore';
import { browser } from '$app/environment';

// Firebase configuration
// These values should come from your Firebase project settings
const firebaseConfig = {
	apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
	authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
	projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase with proper singleton pattern to prevent multiple initialization
let app: any;
let auth: Auth;
let db: Firestore;

try {
	// Check if Firebase app is already initialized
	if (getApps().length === 0) {
		// Initialize Firebase for the first time
		app = initializeApp(firebaseConfig);
		console.log('🔥 Firebase app initialized');
	} else {
		// Use existing Firebase app
		app = getApp();
		console.log('🔥 Using existing Firebase app');
	}

	// Initialize Firebase Authentication
	auth = getAuth(app);

	// Log configuration for debugging
	if (browser) {
		console.log('Firebase auth configured for browser environment');
	}

	// Initialize Firestore with persistent cache
	// Try to get existing instance first, then initialize if needed
	try {
		db = getFirestore(app);
		console.log('🔥 Using existing Firestore instance');
	} catch (firestoreError) {
		// If no instance exists, initialize with cache
		try {
			db = initializeFirestore(app, {
				// Enable persistent cache for offline support
				localCache: persistentLocalCache({
					// Enable multi-tab support
					tabManager: persistentMultipleTabManager()
				})
			});
			console.log('🔥 Firestore initialized with persistent cache');
		} catch (initError: any) {
			// If initialization fails, fall back to default Firestore
			console.warn('Failed to initialize Firestore with cache, using default:', initError);
			db = getFirestore(app);
		}
	}

	console.log('✅ Firebase services ready');
} catch (error) {
	console.error('❌ Failed to initialize Firebase:', error);
	// Re-throw to prevent app from starting with broken Firebase
	throw error;
}

// Track emulator connection state to prevent multiple connections
let emulatorsConnected = false;

// Connect to Firebase emulators in development (only in browser)
if (
	browser &&
	import.meta.env.DEV &&
	import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' &&
	!emulatorsConnected &&
	auth &&
	db
) {
	console.log('🔥 Connecting to Firebase emulators');

	try {
		// Connect to Firestore emulator
		connectFirestoreEmulator(db, 'localhost', 8080);
		console.log('🔥 Connected to Firestore emulator on localhost:8080 with persistent cache');

		// Connect to Auth emulator
		connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
		console.log('🔐 Connected to Auth emulator on localhost:9099');

		emulatorsConnected = true;
	} catch (error: any) {
		// Emulators might already be connected, which is fine
		console.log('Emulators connection status:', error.message);
		emulatorsConnected = true;
	}
} else if (browser && import.meta.env.DEV && auth && db) {
	console.log('🌐 Using production Firebase services with persistent cache');
}

// Export the instances
export { auth, db };
export default app;
