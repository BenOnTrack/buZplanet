# Data Architecture Overview

This document outlines the consistent data architecture used across all core objects in the application.

## Core Objects

The application manages 5 primary data objects, all following the same architectural patterns:

1. **Features** - Map features with user interactions (bookmarks, visits, todo)
2. **Stories** - User-created story content with rich media
3. **Bookmark Lists** - Organized collections of bookmarked features
4. **Followed Stories** - Cached public stories from followed users
5. **Story Categories** - User-defined categories for organizing stories

## Unified Architecture Pattern

### 🔄 Offline-First Design

All objects are designed to work completely offline:

- **Primary Storage**: IndexedDB serves as the main data store
- **User Isolation**: Compound keys `[userId, itemId]` ensure complete data separation
- **Immediate Response**: All operations update local storage first, UI updates immediately
- **Background Sync**: Cloud synchronization happens asynchronously without blocking UI

### 📡 Real-time Firestore Sync (Push-based)

Every object implements the same push-based synchronization:

```typescript
// Real-time listeners for push updates
onSnapshot(collection(db, 'users', userId, 'stories'), (snapshot) => {
	// Handle real-time changes from other devices
	this.handleFirestoreSnapshot(snapshot);
});
```

**Key Features:**

- **Push Updates**: Uses Firestore `onSnapshot()` for real-time changes
- **Conflict Resolution**: Timestamp-based conflict resolution between local and remote changes
- **Retry Logic**: Automatic retry with exponential backoff for failed operations
- **Network Awareness**: Respects online/offline state

### 🔄 Cross-device Synchronization

Data automatically syncs across all user devices via Firestore:

| Object           | Firestore Collection            |
| ---------------- | ------------------------------- |
| Features         | `/users/{uid}/features/`        |
| Stories          | `/users/{uid}/stories/`         |
| Bookmark Lists   | `/users/{uid}/lists/`           |
| Followed Stories | `/users/{uid}/followedStories/` |
| Story Categories | `/users/{uid}/storyCategories/` |

## Implementation Details

### Storage Layer

Each object uses a dedicated IndexedDB store with optimized indexes:

```typescript
// Example: Features storage structure
private readonly FEATURES_STORE_NAME = 'userFeatures';
keyPath: ['userId', 'id'] // Compound key for user isolation

// Indexes for efficient querying
createIndex('userId', 'userId', { unique: false });
createIndex('searchText', 'searchText', { unique: false });
createIndex('bookmarked', 'bookmarked', { unique: false });
```

### State Management (Svelte 5)

Consistent reactive state patterns across all objects:

```typescript
class DataStore {
  private _stats = $state({ total: 0, ... });
  private _changeSignal = $state(0);

  get stats() { return this._stats; }
  get changeSignal() { return this._changeSignal; }

  private triggerChange(): void {
    this._changeSignal++;
  }
}
```

### User Context Handling

All objects handle user authentication changes consistently:

```typescript
async handleUserChange(newUser: User | null): Promise<void> {
  if (previousUser?.uid !== newUser?.uid) {
    this.stopFirestoreSync();
    this.isInitialized = false;
    this.initPromise = null;

    // Reset user-specific state
    this._stats = { total: 0, ... };
    this._changeSignal++;

    await this.initializeDatabase();

    if (newUser && this.isOnline) {
      this.startFirestoreSync();
    }
  }
}
```

## Special Features

### Followed Stories Caching

The Followed Stories object implements sophisticated caching:

- **Separate Storage**: Uses dedicated `followedStories` IndexedDB store
- **Compound Keys**: `[viewerUserId, authorUserId, storyId]` prevents cross-user access
- **Content Preservation**: User's category assignments preserved when authors update content
- **Real-time Updates**: Immediate sync when followed users publish new content

### Search Capabilities

All objects provide full-text search with relevance scoring:

```typescript
// Generated searchable text for each object
searchText: string = generateSearchText({
	title,
	description,
	categories,
	names,
	content
});

// Scored search results
interface SearchResult {
	item: DataObject;
	score: number;
	matchedFields: string[];
}
```

### Data Export/Import

Every object supports backup and restore:

```typescript
async exportData(): Promise<DataObject[]>
async importData(data: DataObject[]): Promise<void>
async clearAllData(): Promise<void>
```

## Security & Privacy

### Data Isolation

- **User-based Keys**: All data uses compound keys starting with `userId`
- **Query Isolation**: All database queries automatically filter by current user
- **No Cross-user Access**: Architecture prevents accessing other users' private data

### Followed Content Security

- **Public Only**: Only public content from followed users is cached
- **Real-time Privacy**: Content immediately removed if author makes it private
- **Read-only Access**: Followed content cannot be modified, only categorized locally

## Performance Optimizations

### Efficient Indexing

Each object store includes indexes optimized for common queries:

- **User ID**: Fast user-specific data retrieval
- **Search Text**: Full-text search capabilities
- **Categories**: Category-based filtering
- **Dates**: Chronological sorting and filtering
- **Status Flags**: Boolean filters (public, bookmarked, etc.)

### Reactive Updates

- **Minimal Re-renders**: Change signals only update when necessary
- **Selective Updates**: Only affected UI components re-render
- **Batch Operations**: Multiple changes batched into single updates

## Error Handling

### Robust Sync Error Handling

```typescript
private shouldRetry(error: any): boolean {
  // Don't retry auth/permission errors
  if (error.code === 'permission-denied') return false;

  // Retry network-related errors
  if (error.code === 'unavailable') return true;

  return false;
}
```

### Graceful Degradation

- **Offline Mode**: Full functionality without internet connection
- **Sync Conflicts**: Automatic resolution with user override options
- **Storage Failures**: Fallback to in-memory storage if IndexedDB unavailable

## Development Benefits

### Consistent API

All data stores provide the same interface patterns:

```typescript
// Common methods across all stores
await store.ensureInitialized();
const items = await store.getAll();
const item = await store.getById(id);
await store.create(data);
await store.update(id, changes);
await store.delete(id);
const results = await store.search(query, options);
```

### Debugging Support

Built-in debugging capabilities:

```typescript
// Debug information available in browser console
window.debugStoriesSync();
window.debugFeaturesSync();
store.getDebugInfo();
store.getSyncStatus();
```

This unified architecture ensures consistent behavior, optimal performance, and reliable data synchronization across all application features while maintaining complete offline functionality.
