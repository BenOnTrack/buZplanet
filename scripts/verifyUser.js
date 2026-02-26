// Example using Node.js Admin SDK
import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin (you'll need to set up service account)
if (!admin.apps.length) {
	const serviceAccount = JSON.parse(
		readFileSync(
			'/home/bmodave/coding/firebase/buzplanet-firebase-adminsdk-fbsvc-0f06b24858.json',
			'utf8'
		)
	);
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount)
	});
}

const uid = process.argv[2] || 'USER_UID_FROM_CONSOLE';
admin
	.auth()
	.updateUser(uid, {
		emailVerified: true
	})
	.then(() => {
		console.log('Successfully updated user');
	})
	.catch((error) => {
		console.log('Error updating user:', error);
	});
