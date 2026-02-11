# Firebase Authentication Setup Guide

This guide will walk you through setting up Firebase Authentication for your SvelteKit application.

## Prerequisites

- A Google/Gmail account
- Node.js and npm installed
- This SvelteKit project

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" or "Add project"
3. Enter your project name (e.g., "buzplanet-auth")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project console, click "Authentication" in the left sidebar
2. Click "Get started" if it's your first time
3. Go to the "Sign-in method" tab
4. Enable the sign-in providers you want to use:

### Email/Password Authentication

1. Click on "Email/Password"
2. Toggle "Enable" to ON
3. Click "Save"

### Google Authentication

1. Click on "Google"
2. Toggle "Enable" to ON
3. Select your support email
4. Click "Save"

## Step 3: Register Your Web App

1. In the Firebase project overview, click the web icon (`</>`) to add a web app
2. Enter an app nickname (e.g., "buzplanet-web")
3. Optionally set up Firebase Hosting (not required)
4. Click "Register app"
5. **Copy the Firebase configuration object** - you'll need this in the next step

The configuration will look like this:

```javascript
const firebaseConfig = {
	apiKey: 'AIzaSy...',
	authDomain: 'your-project.firebaseapp.com',
	projectId: 'your-project-id',
	storageBucket: 'your-project.firebasestorage.app',
	messagingSenderId: '123456789',
	appId: '1:123456789:web:abc123...'
};
```

## Step 4: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in your Firebase configuration values in `.env.local`:
   ```env
   VITE_FIREBASE_API_KEY=your_api_key_from_config
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   ```

## Step 5: Set Up Firebase Security Rules (Optional)

If you plan to use Firestore or other Firebase services, you should configure security rules:

1. Go to "Firestore Database" or "Realtime Database" in your Firebase console
2. Click on "Rules" tab
3. Set up authentication-based rules, for example:
   ```javascript
   // Firestore rules
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

## Step 6: Test Your Setup

1. Start your development server:

   ```bash
   npm run dev
   ```

2. Open your application and click on the authentication button (lock icon in top-left)
3. Try signing up with email/password or Google authentication
4. Check the Firebase console under "Authentication" > "Users" to see registered users

## Available Authentication Methods

The implemented authentication supports:

- ✅ Email/Password registration and login
- ✅ Google OAuth sign-in
- ✅ Password reset via email
- ✅ User profile management
- ✅ Automatic authentication state persistence

## Using Authentication in Your Components

### Basic usage:

```svelte
<script>
	import { user, loading, signOut } from '$lib/stores/auth';

	const currentUser = $derived($user);
	const isLoading = $derived($loading);
</script>

{#if isLoading}
	<p>Loading...</p>
{:else if currentUser}
	<p>Hello, {currentUser.displayName || currentUser.email}!</p>
	<button onclick={signOut}>Sign Out</button>
{:else}
	<p>Please sign in</p>
{/if}
```

### Authentication guard:

```svelte
<script>
	import { useAuth } from '$lib/stores/authGuard';

	const { user, isAuthenticated, isLoading } = useAuth();
</script>
```

## Troubleshooting

### Common Issues:

1. **"Firebase: Error (auth/configuration-not-found)"**
   - Check that all environment variables are set correctly
   - Make sure `.env.local` is in your project root
   - Restart your dev server after adding environment variables

2. **"Firebase: Error (auth/unauthorized-domain)"**
   - Go to Firebase Console > Authentication > Settings
   - Add your domain (e.g., `localhost:5173`, `your-domain.com`) to "Authorized domains"

3. **Google Sign-in not working**
   - Make sure Google is enabled in Firebase Console > Authentication > Sign-in method
   - Check that your domain is in the authorized domains list

4. **Environment variables not loading**
   - Make sure the file is named `.env.local` (not `.env.local.txt`)
   - Restart your development server
   - Check that variables start with `VITE_`

### Getting Help

- [Firebase Auth Documentation](https://firebase.google.com/docs/auth/web/start)
- [SvelteKit Environment Variables](https://kit.svelte.dev/docs/modules#$env-dynamic-private)

## Security Considerations

1. Never commit your `.env.local` file to version control
2. Use different Firebase projects for development and production
3. Set up proper Firestore/Database security rules
4. Consider implementing additional security features like email verification
5. Monitor authentication usage in Firebase Console

## Next Steps

- Set up Firestore for user data storage
- Implement user profile pages
- Add email verification
- Set up role-based access control
- Configure production environment variables
