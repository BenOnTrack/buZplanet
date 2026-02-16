import {
	doc,
	getDoc,
	setDoc,
	updateDoc,
	deleteDoc,
	collection,
	query,
	where,
	orderBy,
	limit,
	getDocs,
	writeBatch,
	increment,
	serverTimestamp,
	onSnapshot,
	type Unsubscribe
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import { user } from '$lib/stores/auth';
import { get } from 'svelte/store';

/**
 * Service for managing user profiles and social features
 */
export class UserService {
	private static instance: UserService;

	static getInstance(): UserService {
		if (!UserService.instance) {
			UserService.instance = new UserService();
		}
		return UserService.instance;
	}

	// ==================== USER PROFILE MANAGEMENT ====================

	/**
	 * Create or update user profile
	 */
	async createOrUpdateProfile(profileData: Partial<UserProfile>): Promise<UserProfile> {
		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User must be authenticated');
		}

		const profileRef = doc(db, 'userProfiles', currentUser.uid);
		const now = Date.now();

		// Check if profile exists
		const existingProfile = await getDoc(profileRef);

		let profile: UserProfile;

		if (existingProfile.exists()) {
			// Update existing profile - filter out undefined values
			const updateData = this.filterUndefinedValues({
				...profileData,
				dateModified: now,
				lastSyncTimestamp: now
			});

			await updateDoc(profileRef, updateData);

			profile = {
				...(existingProfile.data() as UserProfile),
				...updateData
			};
		} else {
			// Create new profile - only include defined values
			const baseProfile: UserProfile = {
				id: currentUser.uid,
				username: profileData.username || this.generateUsername(currentUser.email) || 'user',
				displayName: profileData.displayName || currentUser.displayName || 'Anonymous',
				isPublic: profileData.isPublic ?? true,
				allowFollowers: profileData.allowFollowers ?? true,
				showActivity: profileData.showActivity ?? true,
				followerCount: 0,
				followingCount: 0,
				publicStoryCount: 0,
				publicFeatureCount: 0,
				dateCreated: now,
				dateModified: now,
				lastActiveDate: now,
				lastSyncTimestamp: now,
				firestoreId: currentUser.uid
			};

			// Add optional fields only if they have values
			if (profileData.bio) baseProfile.bio = profileData.bio;
			if (profileData.avatarUrl || currentUser.photoURL) {
				baseProfile.avatarUrl = profileData.avatarUrl || currentUser.photoURL || undefined;
			}
			if (profileData.location) baseProfile.location = profileData.location;
			if (profileData.website) baseProfile.website = profileData.website;

			profile = baseProfile;
			await setDoc(profileRef, profile);
		}

		return profile;
	}

	/**
	 * Get user profile by ID
	 */
	async getProfile(userId: string): Promise<UserProfile | null> {
		try {
			const profileRef = doc(db, 'userProfiles', userId);
			const profileDoc = await getDoc(profileRef);

			if (profileDoc.exists()) {
				return profileDoc.data() as UserProfile;
			}

			return null;
		} catch (error) {
			console.error('Error fetching user profile:', error);
			throw error;
		}
	}

	/**
	 * Get user profile by username
	 */
	async getProfileByUsername(username: string): Promise<UserProfile | null> {
		try {
			const q = query(collection(db, 'userProfiles'), where('username', '==', username), limit(1));

			const querySnapshot = await getDocs(q);

			if (!querySnapshot.empty) {
				return querySnapshot.docs[0].data() as UserProfile;
			}

			return null;
		} catch (error) {
			console.error('Error fetching user profile by username:', error);
			throw error;
		}
	}

	/**
	 * Search users by username or display name
	 */
	async searchUsers(searchTerm: string, maxResults: number = 20): Promise<UserSearchResult[]> {
		try {
			const currentUser = get(user);
			const searchLower = searchTerm.toLowerCase();

			// Search by username (exact prefix match)
			const usernameQuery = query(
				collection(db, 'userProfiles'),
				where('username', '>=', searchLower),
				where('username', '<=', searchLower + '\uf8ff'),
				where('isPublic', '==', true),
				limit(maxResults)
			);

			// Search by display name (we'll need to implement full-text search later)
			// For now, we'll do a simple prefix search
			const displayNameQuery = query(
				collection(db, 'userProfiles'),
				where('displayName', '>=', searchTerm),
				where('displayName', '<=', searchTerm + '\uf8ff'),
				where('isPublic', '==', true),
				limit(maxResults)
			);

			const [usernameResults, displayNameResults] = await Promise.all([
				getDocs(usernameQuery),
				getDocs(displayNameQuery)
			]);

			const userMap = new Map<string, UserProfile>();

			// Combine results, removing duplicates
			usernameResults.docs.forEach((doc) => {
				userMap.set(doc.id, doc.data() as UserProfile);
			});

			displayNameResults.docs.forEach((doc) => {
				userMap.set(doc.id, doc.data() as UserProfile);
			});

			// Convert to search results with follow status
			const searchResults: UserSearchResult[] = [];

			for (const [userId, profile] of userMap) {
				if (userId === currentUser?.uid) continue; // Don't include current user

				const followStatus = await this.getFollowStatus(userId);

				searchResults.push({
					user: profile,
					score: this.calculateSearchScore(profile, searchTerm),
					matchedFields: this.getMatchedFields(profile, searchTerm),
					followStatus
				});
			}

			// Sort by relevance score
			return searchResults.sort((a, b) => b.score - a.score);
		} catch (error) {
			console.error('Error searching users:', error);
			throw error;
		}
	}

	/**
	 * Check if username is available
	 */
	async isUsernameAvailable(username: string): Promise<boolean> {
		try {
			const profile = await this.getProfileByUsername(username);
			return profile === null;
		} catch (error) {
			console.error('Error checking username availability:', error);
			return false;
		}
	}

	// ==================== FOLLOWING SYSTEM ====================

	/**
	 * Follow a user
	 */
	async followUser(followeeId: string): Promise<UserFollow> {
		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User must be authenticated');
		}

		if (currentUser.uid === followeeId) {
			throw new Error('Cannot follow yourself');
		}

		console.log('Starting follow process for:', followeeId);

		// Check if already following
		try {
			const existingFollow = await this.getFollowRelationship(currentUser.uid, followeeId);
			if (existingFollow) {
				throw new Error('Already following this user');
			}
		} catch (error) {
			console.error('Error checking existing follow:', error);
			// Continue anyway - might be first time
		}

		// Get the followee's profile to check privacy settings
		let followeeProfile: UserProfile;
		try {
			const profile = await this.getProfile(followeeId);
			if (!profile) {
				throw new Error('User not found');
			}
			followeeProfile = profile;
			console.log('Followee profile loaded:', followeeProfile.displayName);
		} catch (error) {
			console.error('Error loading followee profile:', error);
			throw error;
		}

		if (!followeeProfile.allowFollowers) {
			throw new Error('User does not allow followers');
		}

		const now = Date.now();

		// Create follow relationship (simple document creation first)
		const followId = `${currentUser.uid}_${followeeId}`;
		const followData: UserFollow = {
			id: followId,
			followerId: currentUser.uid,
			followeeId: followeeId,
			status: followeeProfile.isPublic ? 'accepted' : 'pending',
			dateCreated: now,
			dateAccepted: followeeProfile.isPublic ? now : undefined,
			notifyOnStories: true,
			notifyOnFeatures: false,
			notifyOnLists: true,
			dateModified: now,
			lastSyncTimestamp: now,
			firestoreId: followId
		};

		console.log('Creating follow document:', followId);

		try {
			// Try simple document creation first
			const followRef = doc(db, 'userFollows', followId);
			await setDoc(followRef, this.filterUndefinedValues(followData));
			console.log('Follow document created successfully');
		} catch (error) {
			console.error('Error creating follow document:', error);
			throw error;
		}

		// Update follower counts if immediately accepted
		if (followeeProfile.isPublic) {
			console.log('Updating follower counts for public profile');
			try {
				// Update followee's follower count
				const followeeRef = doc(db, 'userProfiles', followeeId);
				await updateDoc(followeeRef, {
					followerCount: increment(1),
					dateModified: now
				});
				console.log('Updated followee follower count');

				// Update current user's following count
				const currentUserRef = doc(db, 'userProfiles', currentUser.uid);
				await updateDoc(currentUserRef, {
					followingCount: increment(1),
					dateModified: now
				});
				console.log('Updated current user following count');

				// Create activity feed item
				try {
					await this.createActivityItem('user_followed', {
						targetUserId: followeeId
					});
					console.log('Created activity feed item');
				} catch (error) {
					console.error('Error creating activity:', error);
					// Don't throw - follow was successful
				}
			} catch (error) {
				console.error('Error updating follower counts:', error);
				// Don't throw - the follow was created successfully
			}
		} else {
			console.log('Private profile - follow request is pending');
		}

		// TODO: Add count updates later after basic follow works
		// TODO: Add activity creation later
		// TODO: Add notifications later

		return followData;
	}

	/**
	 * Unfollow a user
	 */
	async unfollowUser(followeeId: string): Promise<void> {
		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User must be authenticated');
		}

		console.log('Starting unfollow process for:', followeeId);

		const followId = `${currentUser.uid}_${followeeId}`;
		const followRef = doc(db, 'userFollows', followId);

		// Check if follow relationship exists
		let followDoc;
		try {
			followDoc = await getDoc(followRef);
			if (!followDoc.exists()) {
				throw new Error('Not following this user');
			}
			console.log('Found follow relationship to delete');
		} catch (error) {
			console.error('Error checking follow relationship:', error);
			throw error;
		}

		const followData = followDoc.data() as UserFollow;
		console.log('Follow status:', followData.status);

		try {
			// Delete follow relationship
			await deleteDoc(followRef);
			console.log('Follow relationship deleted successfully');
		} catch (error) {
			console.error('Error deleting follow document:', error);
			throw error;
		}

		// Update counts if the follow was accepted
		if (followData.status === 'accepted') {
			console.log('Updating follower counts after unfollow');
			try {
				// Decrement followee's follower count
				const followeeRef = doc(db, 'userProfiles', followeeId);
				await updateDoc(followeeRef, {
					followerCount: increment(-1),
					dateModified: Date.now()
				});
				console.log('Updated followee follower count (-1)');

				// Decrement current user's following count
				const currentUserRef = doc(db, 'userProfiles', currentUser.uid);
				await updateDoc(currentUserRef, {
					followingCount: increment(-1),
					dateModified: Date.now()
				});
				console.log('Updated current user following count (-1)');
			} catch (error) {
				console.error('Error updating follower counts:', error);
				// Don't throw - the unfollow was successful
			}
		} else {
			console.log('Follow was pending, no count updates needed');
		}
	}

	/**
	 * Accept a follow request
	 */
	async acceptFollowRequest(followerId: string): Promise<void> {
		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User must be authenticated');
		}

		const followId = `${followerId}_${currentUser.uid}`;
		const followRef = doc(db, 'userFollows', followId);

		// Check if follow request exists
		const followDoc = await getDoc(followRef);
		if (!followDoc.exists()) {
			throw new Error('Follow request not found');
		}

		const followData = followDoc.data() as UserFollow;
		if (followData.status !== 'pending') {
			throw new Error('Follow request is not pending');
		}

		const batch = writeBatch(db);
		const now = Date.now();

		// Update follow status
		batch.update(followRef, {
			status: 'accepted',
			dateAccepted: now,
			dateModified: now
		});

		// Update follower counts
		const followeeRef = doc(db, 'userProfiles', currentUser.uid);
		batch.update(followeeRef, {
			followerCount: increment(1),
			dateModified: now
		});

		const followerRef = doc(db, 'userProfiles', followerId);
		batch.update(followerRef, {
			followingCount: increment(1),
			dateModified: now
		});

		await batch.commit();

		// Create notification for accepted follow
		await this.createNotification(followerId, 'follow_accepted', {
			fromUserId: currentUser.uid,
			message: `${currentUser.displayName || currentUser.email} accepted your follow request`
		});
	}

	/**
	 * Reject a follow request
	 */
	async rejectFollowRequest(followerId: string): Promise<void> {
		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User must be authenticated');
		}

		const followId = `${followerId}_${currentUser.uid}`;
		const followRef = doc(db, 'userFollows', followId);

		// Delete the follow request
		await deleteDoc(followRef);
	}

	/**
	 * Get follow relationship between two users
	 */
	async getFollowRelationship(followerId: string, followeeId: string): Promise<UserFollow | null> {
		try {
			const followId = `${followerId}_${followeeId}`;
			const followRef = doc(db, 'userFollows', followId);
			const followDoc = await getDoc(followRef);

			if (followDoc.exists()) {
				return followDoc.data() as UserFollow;
			}

			return null;
		} catch (error) {
			console.error('Error getting follow relationship:', error);
			return null;
		}
	}

	/**
	 * Get follow status between current user and another user
	 */
	async getFollowStatus(
		userId: string
	): Promise<'none' | 'following' | 'pending' | 'follower' | 'mutual'> {
		const currentUser = get(user);
		if (!currentUser || currentUser.uid === userId) {
			return 'none';
		}

		const [following, follower] = await Promise.all([
			this.getFollowRelationship(currentUser.uid, userId),
			this.getFollowRelationship(userId, currentUser.uid)
		]);

		if (following?.status === 'accepted' && follower?.status === 'accepted') {
			return 'mutual';
		} else if (following?.status === 'accepted') {
			return 'following';
		} else if (following?.status === 'pending') {
			return 'pending';
		} else if (follower?.status === 'accepted') {
			return 'follower';
		}

		return 'none';
	}

	/**
	 * Get users that current user is following
	 */
	async getFollowing(userId?: string, limitCount: number = 50): Promise<UserProfile[]> {
		try {
			const targetUserId = userId || get(user)?.uid;
			if (!targetUserId) return [];

			const q = query(
				collection(db, 'userFollows'),
				where('followerId', '==', targetUserId),
				where('status', '==', 'accepted'),
				orderBy('dateAccepted', 'desc'),
				limit(limitCount)
			);

			const querySnapshot = await getDocs(q);
			const followeeIds = querySnapshot.docs.map((doc) => doc.data().followeeId);

			// Get user profiles for all followees
			const profiles: UserProfile[] = [];
			for (const id of followeeIds) {
				const profile = await this.getProfile(id);
				if (profile) {
					profiles.push(profile);
				}
			}

			return profiles;
		} catch (error) {
			console.error('Error getting following list:', error);
			return [];
		}
	}

	/**
	 * Get users that are following the current user
	 */
	async getFollowers(userId?: string, limitCount: number = 50): Promise<UserProfile[]> {
		try {
			const targetUserId = userId || get(user)?.uid;
			if (!targetUserId) return [];

			const q = query(
				collection(db, 'userFollows'),
				where('followeeId', '==', targetUserId),
				where('status', '==', 'accepted'),
				orderBy('dateAccepted', 'desc'),
				limit(limitCount)
			);

			const querySnapshot = await getDocs(q);
			const followerIds = querySnapshot.docs.map((doc) => doc.data().followerId);

			// Get user profiles for all followers
			const profiles: UserProfile[] = [];
			for (const id of followerIds) {
				const profile = await this.getProfile(id);
				if (profile) {
					profiles.push(profile);
				}
			}

			return profiles;
		} catch (error) {
			console.error('Error getting followers list:', error);
			return [];
		}
	}

	/**
	 * Get pending follow requests for current user
	 */
	async getPendingFollowRequests(): Promise<
		{ follow: UserFollow; followerProfile: UserProfile }[]
	> {
		try {
			const currentUser = get(user);
			if (!currentUser) return [];

			const q = query(
				collection(db, 'userFollows'),
				where('followeeId', '==', currentUser.uid),
				where('status', '==', 'pending'),
				orderBy('dateCreated', 'desc'),
				limit(20)
			);

			const querySnapshot = await getDocs(q);
			const requests: { follow: UserFollow; followerProfile: UserProfile }[] = [];

			for (const doc of querySnapshot.docs) {
				const followData = doc.data() as UserFollow;
				const followerProfile = await this.getProfile(followData.followerId);

				if (followerProfile) {
					requests.push({
						follow: followData,
						followerProfile
					});
				}
			}

			return requests;
		} catch (error) {
			console.error('Error getting pending follow requests:', error);
			return [];
		}
	}

	// ==================== ACTIVITY FEED ====================

	/**
	 * Create an activity feed item
	 */
	async createActivityItem(
		type: ActivityType,
		data: {
			storyId?: string;
			featureId?: string;
			listId?: string;
			targetUserId?: string;
			itemTitle?: string;
			itemDescription?: string;
		}
	): Promise<void> {
		const currentUser = get(user);
		if (!currentUser) return;

		const userProfile = await this.getProfile(currentUser.uid);
		if (!userProfile || !userProfile.showActivity) return;

		const activityId = `${currentUser.uid}_${type}_${Date.now()}`;

		// Base activity data with required fields
		const activityData: any = {
			id: activityId,
			userId: currentUser.uid,
			type,
			dateCreated: Date.now(),
			userDisplayName: userProfile.displayName,
			userUsername: userProfile.username,
			isPublic: userProfile.isPublic,
			lastSyncTimestamp: Date.now(),
			firestoreId: activityId
		};

		// Add optional fields only if they have values
		if (data.storyId) activityData.storyId = data.storyId;
		if (data.featureId) activityData.featureId = data.featureId;
		if (data.listId) activityData.listId = data.listId;
		if (data.targetUserId) activityData.targetUserId = data.targetUserId;
		if (data.itemTitle) activityData.itemTitle = data.itemTitle;
		if (data.itemDescription) activityData.itemDescription = data.itemDescription;
		if (userProfile.avatarUrl) activityData.userAvatarUrl = userProfile.avatarUrl;

		const activityRef = doc(db, 'activityFeed', activityId);
		await setDoc(activityRef, activityData);
	}

	/**
	 * Get activity feed for current user (from people they follow)
	 */
	async getActivityFeed(limitCount: number = 50): Promise<ActivityFeedItem[]> {
		try {
			const currentUser = get(user);
			if (!currentUser) return [];

			// Get list of users current user is following
			const following = await this.getFollowing(currentUser.uid, 100);
			const followingIds = following.map((user) => user.id);

			if (followingIds.length === 0) return [];

			// Get recent activity from followed users
			const q = query(
				collection(db, 'activityFeed'),
				where('userId', 'in', followingIds.slice(0, 10)), // Firestore 'in' limit is 10
				where('isPublic', '==', true),
				orderBy('dateCreated', 'desc'),
				limit(limitCount)
			);

			const querySnapshot = await getDocs(q);
			return querySnapshot.docs.map((doc) => doc.data() as ActivityFeedItem);
		} catch (error) {
			console.error('Error getting activity feed:', error);
			return [];
		}
	}

	// ==================== NOTIFICATIONS ====================

	/**
	 * Create a notification for a user
	 */
	async createNotification(
		userId: string,
		type: NotificationType,
		data: {
			fromUserId?: string;
			itemId?: string;
			message: string;
		}
	): Promise<void> {
		const notificationId = `${userId}_${type}_${Date.now()}`;
		let fromUserData: Partial<UserProfile> = {};

		if (data.fromUserId) {
			const fromUser = await this.getProfile(data.fromUserId);
			if (fromUser) {
				fromUserData = {
					displayName: fromUser.displayName,
					username: fromUser.username,
					avatarUrl: fromUser.avatarUrl
				};
			}
		}

		const notificationData: UserNotification = {
			id: notificationId,
			userId,
			type,
			read: false,
			dateCreated: Date.now(),
			fromUserId: data.fromUserId,
			itemId: data.itemId,
			message: data.message,
			fromUserDisplayName: fromUserData.displayName,
			fromUserUsername: fromUserData.username,
			fromUserAvatarUrl: fromUserData.avatarUrl,
			lastSyncTimestamp: Date.now(),
			firestoreId: notificationId
		};

		const notificationRef = doc(db, 'userNotifications', notificationId);
		await setDoc(notificationRef, notificationData);
	}

	/**
	 * Get notifications for current user
	 */
	async getNotifications(limitCount: number = 50): Promise<UserNotification[]> {
		try {
			const currentUser = get(user);
			if (!currentUser) return [];

			const q = query(
				collection(db, 'userNotifications'),
				where('userId', '==', currentUser.uid),
				where('deleted', '!=', true),
				orderBy('dateCreated', 'desc'),
				limit(limitCount)
			);

			const querySnapshot = await getDocs(q);
			return querySnapshot.docs.map((doc) => doc.data() as UserNotification);
		} catch (error) {
			console.error('Error getting notifications:', error);
			return [];
		}
	}

	/**
	 * Mark notification as read
	 */
	async markNotificationAsRead(notificationId: string): Promise<void> {
		const notificationRef = doc(db, 'userNotifications', notificationId);
		await updateDoc(notificationRef, {
			read: true,
			dateModified: Date.now()
		});
	}

	/**
	 * Mark all notifications as read
	 */
	async markAllNotificationsAsRead(): Promise<void> {
		const currentUser = get(user);
		if (!currentUser) return;

		const q = query(
			collection(db, 'userNotifications'),
			where('userId', '==', currentUser.uid),
			where('read', '==', false)
		);

		const querySnapshot = await getDocs(q);
		const batch = writeBatch(db);

		querySnapshot.docs.forEach((doc) => {
			batch.update(doc.ref, {
				read: true,
				dateModified: Date.now()
			});
		});

		await batch.commit();
	}

	// ==================== HELPER METHODS ====================

	/**
	 * Filter out undefined values from an object
	 */
	private filterUndefinedValues(obj: any): any {
		const filtered: any = {};
		for (const [key, value] of Object.entries(obj)) {
			if (value !== undefined) {
				filtered[key] = value;
			}
		}
		return filtered;
	}

	/**
	 * Generate a username from email address
	 */
	private generateUsername(email?: string | null): string {
		if (!email) return 'user' + Math.random().toString(36).substr(2, 6);

		// Extract username part from email and clean it
		let username = email.split('@')[0];
		// Remove any non-alphanumeric characters except dots and underscores
		username = username.replace(/[^a-zA-Z0-9._]/g, '');
		// Ensure it's not empty
		if (!username) {
			return 'user' + Math.random().toString(36).substr(2, 6);
		}
		return username;
	}

	private calculateSearchScore(profile: UserProfile, searchTerm: string): number {
		const searchLower = searchTerm.toLowerCase();
		let score = 0;

		// Exact username match gets highest score
		if (profile.username.toLowerCase() === searchLower) {
			score += 100;
		} else if (profile.username.toLowerCase().startsWith(searchLower)) {
			score += 80;
		} else if (profile.username.toLowerCase().includes(searchLower)) {
			score += 60;
		}

		// Display name matches
		if (profile.displayName.toLowerCase() === searchLower) {
			score += 90;
		} else if (profile.displayName.toLowerCase().startsWith(searchLower)) {
			score += 70;
		} else if (profile.displayName.toLowerCase().includes(searchLower)) {
			score += 50;
		}

		// Bio matches (if exists)
		if (profile.bio && profile.bio.toLowerCase().includes(searchLower)) {
			score += 20;
		}

		// Boost score based on user activity
		score += Math.min(profile.followerCount / 10, 20);
		score += Math.min(profile.publicStoryCount / 5, 10);

		return score;
	}

	private getMatchedFields(profile: UserProfile, searchTerm: string): string[] {
		const searchLower = searchTerm.toLowerCase();
		const matchedFields: string[] = [];

		if (profile.username.toLowerCase().includes(searchLower)) {
			matchedFields.push('username');
		}

		if (profile.displayName.toLowerCase().includes(searchLower)) {
			matchedFields.push('displayName');
		}

		if (profile.bio && profile.bio.toLowerCase().includes(searchLower)) {
			matchedFields.push('bio');
		}

		return matchedFields;
	}

	/**
	 * Listen to real-time updates for user profile
	 */
	listenToProfile(userId: string, callback: (profile: UserProfile | null) => void): Unsubscribe {
		const profileRef = doc(db, 'userProfiles', userId);

		return onSnapshot(
			profileRef,
			(doc) => {
				if (doc.exists()) {
					callback(doc.data() as UserProfile);
				} else {
					callback(null);
				}
			},
			(error) => {
				console.error('Error listening to profile:', error);
				callback(null);
			}
		);
	}

	/**
	 * Listen to real-time notifications
	 */
	listenToNotifications(callback: (notifications: UserNotification[]) => void): Unsubscribe {
		const currentUser = get(user);
		if (!currentUser) {
			return () => {}; // Return empty unsubscribe function
		}

		const q = query(
			collection(db, 'userNotifications'),
			where('userId', '==', currentUser.uid),
			where('deleted', '!=', true),
			orderBy('dateCreated', 'desc'),
			limit(50)
		);

		return onSnapshot(
			q,
			(querySnapshot) => {
				const notifications = querySnapshot.docs.map((doc) => doc.data() as UserNotification);
				callback(notifications);
			},
			(error) => {
				console.error('Error listening to notifications:', error);
				callback([]);
			}
		);
	}
}

// Export singleton instance
export const userService = UserService.getInstance();
