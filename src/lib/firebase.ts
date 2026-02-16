import { initializeApp } from 'firebase/app';
import { getAuth, type Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, type Firestore, connectFirestoreEmulator } from 'firebase/firestore';
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

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth: Auth = getAuth(app);

// Initialize Firestore and get a reference to the service
export const db: Firestore = getFirestore(app);

// Track emulator connection state to prevent multiple connections
let emulatorsConnected = false;

// Connect to Firebase emulators in development (only in browser)
if (
	browser &&
	import.meta.env.DEV &&
	import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true' &&
	!emulatorsConnected
) {
	console.log('🔥 Connecting to Firebase emulators');

	try {
		// Connect to Firestore emulator
		connectFirestoreEmulator(db, 'localhost', 8080);
		console.log('📄 Connected to Firestore emulator on localhost:8080');

		// Connect to Auth emulator
		connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
		console.log('🔐 Connected to Auth emulator on localhost:9099');

		emulatorsConnected = true;
	} catch (error: any) {
		// Emulators might already be connected, which is fine
		console.log('Emulators connection status:', error.message);
		emulatorsConnected = true;
	}
} else if (browser && import.meta.env.DEV) {
	console.log('🌐 Using production Firebase services');
}

export default app;
