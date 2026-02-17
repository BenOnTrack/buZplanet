import { userService } from '$lib/services/userService';
import { authState } from '$lib/stores/auth.svelte';
import type { Unsubscribe } from 'firebase/firestore';

class UserStore {
	// Current user's profile
	currentProfile = $state<UserProfile | null>(null);

	// Loading states
	profileLoading = $state(false);
	followersLoading = $state(false);
	followingLoading = $state(false);
	notificationsLoading = $state(false);

	// Social data
	followers = $state<UserProfile[]>([]);
	following = $state<UserProfile[]>([]);
	notifications = $state<UserNotification[]>([]);

	// Activity feed
	activityFeed = $state<ActivityFeedItem[]>([]);
	activityLoading = $state(false);

	// Search results
	userSearchResults = $state<UserSearchResult[]>([]);
	userSearchLoading = $state(false);

	// Real-time listeners
	private profileListener: Unsubscribe | null = null;
	private notificationsListener: Unsubscribe | null = null;

	// ==================== PROFILE MANAGEMENT ====================

	/**
	 * Initialize user data when user logs in
	 */
	async initializeUserData() {
		const currentUser = authState.user;
		if (!currentUser) return;

		try {
			this.profileLoading = true;

			// Load or create user profile
			let profile = await userService.getProfile(currentUser.uid);

			if (!profile) {
				// Create profile if it doesn't exist
				profile = await userService.createOrUpdateProfile({
					displayName: currentUser.displayName || 'Anonymous',
					avatarUrl: currentUser.photoURL || undefined
				});
			}

			this.currentProfile = profile;

			// Set up real-time listeners
			this.setupProfileListener(currentUser.uid);
			this.setupNotificationsListener();

			// Load social data
			await this.loadSocialData();
		} catch (error) {
			console.error('Error initializing user data:', error);
		} finally {
			this.profileLoading = false;
		}
	}

	/**
	 * Clear user data when user logs out
	 */
	clearUserData() {
		// Clear state
		this.currentProfile = null;
		this.followers = [];
		this.following = [];
		this.notifications = [];
		this.activityFeed = [];
		this.userSearchResults = [];

		// Clear listeners
		if (this.profileListener) {
			this.profileListener();
			this.profileListener = null;
		}
		if (this.notificationsListener) {
			this.notificationsListener();
			this.notificationsListener = null;
		}
	}

	/**
	 * Set up real-time listener for user profile
	 */
	private setupProfileListener(userId: string) {
		if (this.profileListener) {
			this.profileListener();
		}

		this.profileListener = userService.listenToProfile(userId, (profile) => {
			this.currentProfile = profile;
		});
	}

	/**
	 * Set up real-time listener for notifications
	 */
	private setupNotificationsListener() {
		if (this.notificationsListener) {
			this.notificationsListener();
		}

		this.notificationsListener = userService.listenToNotifications((notifications) => {
			this.notifications = notifications;
		});
	}

	/**
	 * Update user profile
	 */
	async updateProfile(updates: Partial<UserProfile>): Promise<void> {
		try {
			this.profileLoading = true;
			const updatedProfile = await userService.createOrUpdateProfile(updates);
			this.currentProfile = updatedProfile;
		} catch (error) {
			console.error('Error updating profile:', error);
			throw error;
		} finally {
			this.profileLoading = false;
		}
	}

	/**
	 * Fix profile with correct display name (helper method)
	 */
	async fixDisplayName(correctName: string): Promise<void> {
		await this.updateProfile({ displayName: correctName });
	}

	/**
	 * Check if username is available
	 */
	async checkUsernameAvailability(username: string): Promise<boolean> {
		return await userService.isUsernameAvailable(username);
	}

	// ==================== SOCIAL DATA LOADING ====================

	/**
	 * Load all social data for current user
	 */
	private async loadSocialData() {
		await Promise.all([this.loadFollowers(), this.loadFollowing(), this.loadActivityFeed()]);
	}

	/**
	 * Load followers list
	 */
	async loadFollowers() {
		try {
			this.followersLoading = true;
			this.followers = await userService.getFollowers();
		} catch (error) {
			console.error('Error loading followers:', error);
		} finally {
			this.followersLoading = false;
		}
	}

	/**
	 * Load following list
	 */
	async loadFollowing() {
		try {
			this.followingLoading = true;
			this.following = await userService.getFollowing();
		} catch (error) {
			console.error('Error loading following:', error);
		} finally {
			this.followingLoading = false;
		}
	}

	/**
	 * Load activity feed
	 */
	async loadActivityFeed() {
		try {
			this.activityLoading = true;
			this.activityFeed = await userService.getActivityFeed();
		} catch (error) {
			console.error('Error loading activity feed:', error);
		} finally {
			this.activityLoading = false;
		}
	}

	// ==================== USER SEARCH ====================

	/**
	 * Search for users
	 */
	async searchUsers(searchTerm: string): Promise<void> {
		if (!searchTerm.trim()) {
			this.userSearchResults = [];
			return;
		}

		try {
			this.userSearchLoading = true;
			this.userSearchResults = await userService.searchUsers(searchTerm);
		} catch (error) {
			console.error('Error searching users:', error);
			this.userSearchResults = [];
		} finally {
			this.userSearchLoading = false;
		}
	}

	/**
	 * Clear user search results
	 */
	clearUserSearch() {
		this.userSearchResults = [];
	}

	// ==================== FOLLOW ACTIONS ====================

	/**
	 * Follow a user
	 */
	async followUser(userId: string): Promise<void> {
		try {
			const followData = await userService.followUser(userId);

			// Update local state if present
			this.updateUserSearchFollowStatus(userId, 'following');
		} catch (error) {
			console.error('Error following user:', error);
			throw error;
		}
	}

	/**
	 * Unfollow a user
	 */
	async unfollowUser(userId: string): Promise<void> {
		try {
			await userService.unfollowUser(userId);

			// Update local state if present
			this.updateUserSearchFollowStatus(userId, 'none');
		} catch (error) {
			console.error('Error unfollowing user:', error);
			throw error;
		}
	}

	/**
	 * Get follow status for a specific user
	 */
	async getFollowStatus(userId: string): Promise<'none' | 'following' | 'follower' | 'mutual'> {
		return await userService.getFollowStatus(userId);
	}

	// ==================== NOTIFICATIONS ====================

	/**
	 * Mark notification as read
	 */
	async markNotificationAsRead(notificationId: string): Promise<void> {
		try {
			await userService.markNotificationAsRead(notificationId);

			// Update local state
			this.notifications = this.notifications.map((notification) =>
				notification.id === notificationId ? { ...notification, read: true } : notification
			);
		} catch (error) {
			console.error('Error marking notification as read:', error);
			throw error;
		}
	}

	/**
	 * Mark all notifications as read
	 */
	async markAllNotificationsAsRead(): Promise<void> {
		try {
			await userService.markAllNotificationsAsRead();

			// Update local state
			this.notifications = this.notifications.map((notification) => ({
				...notification,
				read: true
			}));
		} catch (error) {
			console.error('Error marking all notifications as read:', error);
			throw error;
		}
	}

	// ==================== COMPUTED PROPERTIES ====================

	/**
	 * Get unread notification count
	 */
	get unreadNotificationCount(): number {
		return this.notifications.filter((n) => !n.read).length;
	}

	// ==================== HELPER METHODS ====================

	/**
	 * Update follow status in search results
	 */
	private updateUserSearchFollowStatus(
		userId: string,
		status: 'none' | 'following' | 'follower' | 'mutual'
	) {
		this.userSearchResults = this.userSearchResults.map((result) =>
			result.user.id === userId ? { ...result, followStatus: status } : result
		);
	}

	/**
	 * Create activity item (wrapper for service method)
	 */
	async createActivity(
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
		try {
			await userService.createActivityItem(type, data);
			// Optionally refresh activity feed
			await this.loadActivityFeed();
		} catch (error) {
			console.error('Error creating activity:', error);
		}
	}

	/**
	 * Get user profile by ID (for viewing other users)
	 */
	async getUserProfile(userId: string): Promise<UserProfile | null> {
		return await userService.getProfile(userId);
	}

	/**
	 * Get user profile by username (for @mentions and profile URLs)
	 */
	async getUserProfileByUsername(username: string): Promise<UserProfile | null> {
		return await userService.getProfileByUsername(username);
	}
}

// Export singleton instance
export const userStore = new UserStore();
