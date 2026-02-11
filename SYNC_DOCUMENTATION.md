## Setup Instructions

### 1. Firebase Configuration

Ensure your `.env` file has the correct Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123:web:abc123
```

### 2. Firestore Security Rules

Copy the rules from `firestore.rules` to your Firebase Console:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to "Firestore Database" → "Rules"
4. Replace the default rules with the content from `firestore.rules`
5. Click "Publish"

### 3. Enable Firestore

If you haven't already:

1. In Firebase Console, go to "Firestore Database"
2. Click "Create database"
3. Choose "Start in production mode" (we have custom rules)
4. Select a location close to your users

# FeaturesDB Sync System Documentation

## Overview

The FeaturesDB now includes automatic synchronization with Firebase Firestore, allowing users to seamlessly access their bookmarks, visited places, and todo lists across multiple devices. The system handles:

- **Real-time sync**: Changes are automatically synced when online
- **Offline support**: Works offline with automatic sync when connection is restored
- **Conflict resolution**: Intelligent handling of conflicting changes from different devices
- **User isolation**: Each user's data is completely separate and secure

## Architecture

### Local Storage (IndexedDB)

- **AppStateDB**: Device-local configuration (map view, color settings, etc.)
- **FeaturesDB**: User data with sync capabilities (features, bookmark lists, sync metadata)

### Cloud Storage (Firestore)

```
/users/{userId}/
  ├── features/{featureId}     - User's bookmarked/visited features
  ├── lists/{listId}          - User's bookmark lists
  └── syncMetadata            - Sync state and device info
```

## Key Features

### 1. Automatic Sync

- **Real-time**: Uses Firestore listeners for instant updates
- **Bidirectional**: Local changes upload to cloud, remote changes download to device
- **Efficient**: Only syncs modified data since last sync

### 2. Offline Support

- **Full functionality**: All features work offline
- **Queue changes**: Local changes are queued for sync when online
- **Connection detection**: Automatically detects online/offline state

### 3. Conflict Resolution

When the same item is modified on multiple devices, the system offers three resolution strategies:

- **Keep Local**: Use the local version, overwrite remote
- **Use Remote**: Accept the remote version, overwrite local
- **Smart Merge**: Intelligently combine both versions

#### Smart Merge Logic

**For Features:**

- Combines visit dates from both versions
- Preserves bookmark status if either version is bookmarked
- Merges bookmark list memberships
- Uses most recent modification timestamp

**For Bookmark Lists:**

- Combines feature IDs from both versions
- Uses metadata from most recently modified version
- Preserves all features from both versions

### 4. Security & Privacy

- **User isolation**: Each user can only access their own data
- **Firebase Auth**: Secure authentication required for sync
- **Local-first**: Data works locally even without account

## Usage Examples

### Basic Feature Operations

```typescript
import { featuresDB } from '$lib/stores/FeaturesDB.svelte.ts';

// Bookmark a feature (automatically syncs)
await featuresDB.storeFeature(mapFeature, 'bookmark');

// Add a visit (automatically syncs)
await featuresDB.addVisit(mapFeature);

// Create bookmark list (automatically syncs)
await featuresDB.createBookmarkList({
	name: 'Paris Restaurants',
	description: 'Great places to eat in Paris',
	color: 'blue'
});
```

### Sync Status Monitoring

```typescript
// Get current sync status
const status = featuresDB.getSyncStatus();
console.log('Online:', status.online);
console.log('Syncing:', status.syncing);
console.log('Conflicts:', status.conflicts);

// Force immediate sync
if (status.authenticated && status.online) {
	await featuresDB.forceSyncNow();
}
```

### Conflict Resolution

```typescript
// Get current conflicts
const conflicts = featuresDB.conflicts;

// Resolve a conflict
await featuresDB.resolveSyncConflict(conflictId, 'merge');
```

## Component Integration

Use the provided `SyncStatusPanel.svelte` component to show sync status and handle conflicts:

```svelte
<script>
	import SyncStatusPanel from '$lib/components/SyncStatusPanel.svelte';
</script>

<SyncStatusPanel />
```

## Data Flow

### When User Makes Local Change

1. Update local IndexedDB immediately
2. If online and authenticated:
   - Upload change to Firestore
   - Update local sync timestamp
3. If offline:
   - Mark for sync when connection restored

### When Remote Change Detected

1. Firestore listener receives change
2. Compare with local version:
   - No local version → Apply remote change
   - Local newer → Upload local version
   - Remote newer → Apply remote change
   - Both modified → Create conflict
3. Update local data and UI

### Conflict Resolution Flow

1. User selects resolution strategy
2. Apply chosen resolution:
   - **Local**: Upload local version to Firestore
   - **Remote**: Apply remote version locally
   - **Merge**: Combine versions intelligently
3. Remove conflict from queue
4. Sync resolved version

## Migration Notes

### Upgrading from Non-Sync Version

The database automatically upgrades existing local data:

1. **Version 3 → 4**: Adds sync fields and metadata store
2. **Data preservation**: Existing features and lists are preserved
3. **Sync initialization**: On first login, local data is uploaded to Firestore

### AppState Changes

AppState is now **user-specific but device-local**:

- Multiple users can use the same device with separate settings
- Map view settings are preserved per user on each device
- Color preferences are preserved per user on each device
- **No cross-device sync** - each device maintains its own user preferences

This allows:

- User A and User B to have different settings on the same phone
- User A to have different settings on desktop vs mobile
- Fast access without network dependency

## Firestore Security Rules

Ensure your Firestore has these security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only access their own data
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Performance Considerations

### Efficient Querying

- Uses compound indexes for fast user-specific queries
- Pagination support for large datasets
- Optimized full-text search with denormalized search fields

### Bandwidth Optimization

- Only syncs changes since last sync timestamp
- Compresses data before network transfer
- Uses Firestore's built-in delta sync

### Battery/Resource Management

- Pauses sync listeners when app is backgrounded
- Batches multiple changes for efficient uploads
- Minimal background activity

## Troubleshooting

### Common Issues

**Sync not working:**

- Check internet connection
- Verify user is authenticated (`featuresDB.getSyncStatus().authenticated`)
- Check browser console for Firestore errors

**Conflicts appearing frequently:**

- Usually indicates rapid changes across devices
- Use "Smart Merge" resolution for best results
- Consider implementing UI to prevent simultaneous editing

**Performance issues:**

- Large datasets may take longer to sync initially
- Subsequent syncs are faster (only changed data)
- Consider pagination for very large collections

### Debug Tools

```typescript
// Enable verbose logging
localStorage.setItem('debug', 'featuresdb:*');

// Check sync metadata
await featuresDB.getSyncStatus();

// Force full resync (use cautiously)
await featuresDB.clearAllFeatures();
await featuresDB.forceSyncNow();
```

## Future Enhancements

### Planned Features

- **Batch operations**: Sync multiple changes in single request
- **Compression**: Gzip large payloads for faster sync
- **Selective sync**: Choose which data types to sync
- **Backup/Export**: Full data export for backup purposes
- **Team features**: Shared lists between users

### API Stability

- Core sync APIs are stable
- Minor additions may be made for new features
- Breaking changes will be versioned and documented
