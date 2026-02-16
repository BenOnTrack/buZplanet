# User Following System

A comprehensive user following system for buZplanet built with Firebase Firestore and Svelte 5.

## Features Implemented

### 1. User Profiles (`UserProfile` interface)

- Unique usernames with availability checking
- Display names, bios, avatars, location, website
- Privacy settings (public/private profiles)
- Follow permissions (allow followers or not)
- Social stats (follower/following counts)

### 2. Following System (`UserFollow` interface)

- Follow/unfollow functionality
- Private account support (follow requests)
- Follow status tracking (none, following, pending, follower, mutual)
- Notification preferences per follow relationship

### 3. Activity Feed (`ActivityFeedItem` interface)

- Real-time activity tracking for followed users
- Support for stories, features, lists, and follow activities
- Denormalized user data for efficient display

### 4. Notifications (`UserNotification` interface)

- Follow requests and acceptances
- Story mentions and activity updates
- Real-time notification updates
- Read/unread status tracking

### 5. Firestore Collections Structure

```
userProfiles/{userId}
- Contains user profile data
- Public information for discovery

userFollows/{followerId}_{followeeId}
- Follow relationships
- Status tracking (pending, accepted, blocked)
- Notification preferences

activityFeed/{userId}_{type}_{timestamp}
- User activities for feed display
- Denormalized for performance

userNotifications/{userId}_{type}_{timestamp}
- User notifications
- Read/unread status
```

## Components Created

### 1. `UserSearch.svelte`

- Search users by username/display name
- Real-time follow status display
- Follow/unfollow actions directly from search

### 2. `UserProfile.svelte`

- Complete user profile display
- Follow button with status-aware text
- Stats display (followers, following, stories, features)
- Privacy indicators

### 3. `NotificationsPanel.svelte`

- Sliding panel for notifications
- Real-time updates
- Mark as read functionality
- Different notification types with icons

### 4. `FollowRequests.svelte`

- Manage pending follow requests
- Accept/decline functionality
- User profile previews

### 5. `ActivityFeed.svelte`

- Display activities from followed users
- Different activity types with icons
- Clickable items for navigation

### 6. Demo Page (`/social`)

- Complete social features showcase
- Integration examples
- Test functionality

## Services

### 1. `UserService` (`src/lib/services/userService.ts`)

- Comprehensive Firestore operations
- User profile management
- Following system logic
- Activity and notification handling
- Real-time listeners

### 2. `UserStore` (`src/lib/stores/UserStoreNew.svelte.ts`)

- Svelte 5 runes-based reactive store
- Centralized social state management
- Real-time data synchronization
- Computed properties for UI

## Key Features

### Privacy & Security

- Public/private profiles
- Follow request system for private accounts
- User-controlled follower permissions
- Activity visibility settings

### Performance Optimizations

- Denormalized data for fast display
- Batch operations for consistency
- Real-time listeners only where needed
- Efficient search with indexing

### User Experience

- Real-time updates
- Optimistic UI updates
- Loading states and error handling
- Keyboard navigation support
- ARIA labels for accessibility

## Usage Example

```typescript
import { userStore } from '$lib/stores/UserStoreNew.svelte';

// Search for users
await userStore.searchUsers('john');

// Follow a user
await userStore.followUser('userId123');

// Accept a follow request
await userStore.acceptFollowRequest('followerId456');

// Create activity (when user does something)
await userStore.createActivity('story_created', {
	storyId: 'story123',
	itemTitle: 'My Trip to Paris',
	itemDescription: 'Amazing adventure!'
});
```

## Firestore Security Rules (Recommended)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User profiles - read public, write own
    match /userProfiles/{userId} {
      allow read: if resource.data.isPublic == true || request.auth.uid == userId;
      allow write: if request.auth.uid == userId;
    }

    // User follows - read/write own relationships
    match /userFollows/{followId} {
      allow read, write: if request.auth.uid == resource.data.followerId
                        || request.auth.uid == resource.data.followeeId;
    }

    // Activity feed - read public activities
    match /activityFeed/{activityId} {
      allow read: if resource.data.isPublic == true;
      allow write: if request.auth.uid == resource.data.userId;
    }

    // Notifications - read/write own
    match /userNotifications/{notificationId} {
      allow read, write: if request.auth.uid == resource.data.userId;
    }
  }
}
```

## Next Steps

1. **Integration**: Connect with existing story and feature systems
2. **Search Enhancement**: Implement full-text search with Algolia or similar
3. **Push Notifications**: Add browser/mobile push notifications
4. **Analytics**: Track social engagement metrics
5. **Content Moderation**: Add reporting and blocking features
6. **Social Feeds**: Create curated feeds based on interests
7. **Mutual Connections**: Add "people you may know" features

## Dependencies

- Firebase Firestore for data storage
- Svelte 5 with runes for reactivity
- TypeScript for type safety
- Tailwind CSS for styling

The system is designed to be scalable, secure, and user-friendly while providing a solid foundation for social features in buZplanet.
