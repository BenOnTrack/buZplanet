# Firebase Emulator Development Guide

## Overview

This guide explains how to use Firebase emulators for local development. The emulators allow you to develop and test your Firebase features without affecting production data.

## Quick Start

### 1. Add to your .env.local file

```bash
# Add this line to your .env.local file
VITE_USE_FIREBASE_EMULATOR=false
```

### 2. Install Firebase CLI (if not already installed)

```bash
npm install -g firebase-tools
```

### 3. Login to Firebase

```bash
firebase login
```

### 4. Start development with emulators

#### Option A: Start emulators only

```bash
npm run emulator
```

This starts Firebase emulators without the dev server.

#### Option B: Start dev server with emulators

```bash
npm run dev:emulator
```

This starts both the Vite dev server and Firebase emulators.

## Available Commands

| Command                   | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| `npm run emulator`        | Start Firebase emulators only                          |
| `npm run dev:emulator`    | Start dev server with emulators enabled                |
| `npm run emulator:export` | Export current emulator data to `./emulator-data`      |
| `npm run emulator:import` | Import data from `./emulator-data` and start emulators |

## Emulator URLs

When running emulators, these services will be available:

- **Emulator UI**: http://localhost:4000
- **Firestore Emulator**: http://localhost:8080
- **Auth Emulator**: http://localhost:9099

## Development Workflow

### 1. Toggle Between Production and Emulators

Update your `.env.local` file:

```bash
# Use emulators
VITE_USE_FIREBASE_EMULATOR=true

# Use production Firebase
VITE_USE_FIREBASE_EMULATOR=false
```

### 2. Create Test Data

Use the Firebase Emulator Utils for testing:

```javascript
import { FirebaseEmulatorUtils } from '$lib/firebase-emulator-utils';

// Setup complete test environment
const { user, userId } = await FirebaseEmulatorUtils.setupTestEnvironment();

// Create individual test user
const testUser = await FirebaseEmulatorUtils.createTestUser('dev@example.com', 'password123', {
	displayName: 'Dev User',
	bio: 'Development test user'
});

// Create test data for a user
await FirebaseEmulatorUtils.createTestData(userId);
```

### 3. Export/Import Test Data

Export your current emulator data:

```bash
npm run emulator:export
```

This saves data to `./emulator-data/` which you can:

- Backup for later use
- Share with team members
- Use for consistent testing scenarios

Import previously exported data:

```bash
npm run emulator:import
```

## Configuration

### Firebase Emulator Ports

- Auth: 9099
- Firestore: 8080
- Emulator UI: 4000

These are configured in `firebase.json`.

### Environment Variables

- `VITE_USE_FIREBASE_EMULATOR=true`: Use emulators
- `VITE_USE_FIREBASE_EMULATOR=false`: Use production Firebase

## Best Practices

### 1. Always Use Emulators for Development

- Protects production data
- Faster development cycle
- No API costs during development

### 2. Create Consistent Test Data

- Use the emulator utils to create reproducible test scenarios
- Export/import data for team consistency

### 3. Test Both Environments

- Develop with emulators
- Test with production before deployment

### 4. Security Rules Testing

- Emulators respect Firestore security rules
- Test your rules thoroughly in emulated environment

## Troubleshooting

### Emulators Won't Start

1. Check if ports are available (4000, 8080, 9099)
2. Ensure Firebase CLI is logged in: `firebase login`
3. Verify project configuration: `firebase projects:list`

### App Not Connecting to Emulators

1. Check `VITE_USE_FIREBASE_EMULATOR=true` in `.env.local`
2. Verify emulator URLs in browser console
3. Check for CORS issues in browser dev tools

### Data Not Persisting

- Emulator data is ephemeral by default
- Use `npm run emulator:export` to save data
- Use `npm run emulator:import` to restore data

## Security Notes

- Emulator data is stored locally
- Don't commit sensitive test data to version control
- Use `.gitignore` to exclude `emulator-data/` if containing sensitive info
- Emulators bypass authentication in some cases - be aware when testing

## Team Development

1. Export a base dataset: `npm run emulator:export`
2. Commit the exported data (if non-sensitive)
3. Team members can import: `npm run emulator:import`
4. Consistent development environment across team

## Production Deployment

Before deploying:

1. Test with production Firebase: `VITE_USE_FIREBASE_EMULATOR=false`
2. Verify security rules in Firebase console
3. Check that all features work without emulators
