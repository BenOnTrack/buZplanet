import { browser } from '$app/environment';
import { authState } from '$lib/stores/auth.svelte';
import { db } from '$lib/firebase';
import { userStore } from '$lib/stores/UserStore.svelte';
import type { User } from 'firebase/auth';
import {
	collection,
	doc,
	getDoc,
	setDoc,
	deleteDoc,
	query,
	where,
	onSnapshot,
	serverTimestamp,
	Timestamp,
	orderBy,
	limit as firestoreLimit,
	getDocs,
	type DocumentData,
	type QuerySnapshot,
	type Unsubscribe
} from 'firebase/firestore';
import {
	DEFAULT_STORY_CATEGORIES,
	generateSearchText,
	isDefaultCategory
} from '$lib/utils/stories';

/**
 * Stories Database management class using Svelte 5 runes
 * Handles persistent storage of user stories with Firestore sync
 * Similar to FeaturesDB but optimized for story content management
 */
class StoriesDB {
	// Storage configuration - with Firestore sync
	private readonly DB_NAME = 'StoriesDB';
	private readonly DB_VERSION = 3; // UPDATED: New version for user-isolated followed stories cache
	private readonly STORIES_STORE_NAME = 'userStories';
	private readonly FOLLOWED_STORIES_STORE_NAME = 'followedStories'; // NEW: Cache for followed users' stories
	private readonly STORY_VERSIONS_STORE_NAME = 'userStoryVersions';
	private readonly CATEGORIES_STORE_NAME = 'storyCategories';
	private readonly SYNC_STORE_NAME = 'syncMetadata';

	// Index names
	private readonly INDEX_USER_ID = 'userId';
	private readonly INDEX_SEARCH = 'searchText';
	private readonly INDEX_CATEGORIES = 'categories';
	private readonly INDEX_PUBLIC = 'isPublic';
	private readonly INDEX_LAST_SYNC = 'lastSync';
	private readonly INDEX_DATE_MODIFIED = 'dateModified';

	private db: IDBDatabase | null = null;
	private isInitialized = $state(false);
	private initPromise: Promise<void> | null = null;
	private currentUser: User | null = null;
	private firestoreUnsubscribe: Unsubscribe | null = null;
	private followedStoriesUnsubscribes: Map<string, Unsubscribe> = new Map(); // NEW: Track followed users' listeners
	private isSyncing = $state(false);
	private isOnline = $state(navigator?.onLine ?? true);
	private syncConflicts = $state<SyncConflict[]>([]);
	private lastSyncTimestamp = $state<number>(0);

	// Reactive state for stories count and stats
	private _stats = $state({
		total: 0,
		public: 0,
		categories: 0,
		totalViews: 0
	});

	// Reactive trigger for changes - increment when stories change
	private _changeSignal = $state(0);

	constructor() {
		if (browser) {
			// Listen to online/offline events
			window.addEventListener('online', () => {
				this.isOnline = true;
				if (this.currentUser) {
					this.startFirestoreSync();
				}
			});

			window.addEventListener('offline', () => {
				this.isOnline = false;
				this.stopFirestoreSync();
			});

			// Initialize with default state
			this.isInitialized = false;
			this.initPromise = null;
		} else {
			this.isInitialized = true;
		}
	}

	/**
	 * Handle user change - called from components when auth state changes
	 */
	async handleUserChange(newUser: User | null): Promise<void> {
		if (!browser) return;

		const previousUser = this.currentUser;
		this.currentUser = newUser;

		// If user changed, reinitialize storage for new user
		if (previousUser?.uid !== newUser?.uid) {
			this.stopFirestoreSync(); // Stop previous user's sync
			this.stopFollowedStoriesSync(); // Stop followed stories sync
			this.isInitialized = false;
			this.initPromise = null;

			// Reset stats when user changes
			this._stats = { total: 0, public: 0, categories: 0, totalViews: 0 };
			this._changeSignal++;
			this.syncConflicts = [];
			this.lastSyncTimestamp = 0;

			await this.initializeDatabase();

			// Note: No need to clear followed stories cache - it's now user-isolated by compound key
			// Each user can only access their own followed stories cache

			// Start sync for new authenticated user
			if (newUser && this.isOnline) {
				this.startFirestoreSync();
				// Start followed stories sync after a brief delay to let user data load
				setTimeout(() => this.startFollowedStoriesSync(), 2000);
			}
		}
	}

	// Getters
	get initialized(): boolean {
		return this.isInitialized;
	}

	get stats() {
		return this._stats;
	}

	// Reactive trigger for changes
	get changeSignal(): number {
		return this._changeSignal;
	}

	// Sync status getters
	get syncing(): boolean {
		return this.isSyncing;
	}

	get online(): boolean {
		return this.isOnline;
	}

	get conflicts(): SyncConflict[] {
		return this.syncConflicts;
	}

	get lastSync(): number {
		return this.lastSyncTimestamp;
	}

	/**
	 * Get current user ID or 'anonymous' if not logged in
	 */
	private getCurrentUserId(): string {
		return this.currentUser?.uid || 'anonymous';
	}

	/**
	 * Trigger reactivity - call whenever stories change
	 */
	private triggerChange(): void {
		this._changeSignal++;
	}

	/**
	 * Initialize IndexedDB database with proper indexes for efficient searching
	 */
	private async initializeDatabase(): Promise<void> {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = this._initializeDatabase();
		return this.initPromise;
	}

	private async _initializeDatabase(): Promise<void> {
		if (!browser || typeof indexedDB === 'undefined') {
			console.warn('IndexedDB not available for StoriesDB');
			this.isInitialized = true;
			return;
		}

		try {
			this.db = await this.openDatabase();
			await this.initializeDefaultCategories();
			await this.updateStats();
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to initialize StoriesDB:', error);
			this.isInitialized = true;
		}
	}

	/**
	 * Open IndexedDB with proper indexes for efficient querying - user-based
	 */
	private openDatabase(): Promise<IDBDatabase> {
		if (!browser || typeof indexedDB === 'undefined') {
			throw new Error('IndexedDB not available');
		}

		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;
				const oldVersion = event.oldVersion;

				// Handle migration from version 2 to 3 (user-isolated followed stories)
				if (oldVersion <= 2 && db.objectStoreNames.contains(this.FOLLOWED_STORIES_STORE_NAME)) {
					console.log('🔄 Migrating followed stories cache to user-isolated structure');
					// Delete old followed stories store to recreate with new key structure
					db.deleteObjectStore(this.FOLLOWED_STORIES_STORE_NAME);
				}

				// Create user stories object store
				let storiesStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.STORIES_STORE_NAME)) {
					storiesStore = db.createObjectStore(this.STORIES_STORE_NAME, {
						keyPath: ['userId', 'id'] // Compound key: userId + storyId
					});
				} else {
					storiesStore = request.transaction!.objectStore(this.STORIES_STORE_NAME);
				}

				// NEW: Create followed stories object store
				let followedStoriesStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.FOLLOWED_STORIES_STORE_NAME)) {
					followedStoriesStore = db.createObjectStore(this.FOLLOWED_STORIES_STORE_NAME, {
						keyPath: ['viewerUserId', 'authorUserId', 'id'] // Compound key: viewerUserId + authorUserId + storyId
					});
				} else {
					followedStoriesStore = request.transaction!.objectStore(this.FOLLOWED_STORIES_STORE_NAME);
				}

				// Create story versions object store
				let versionsStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.STORY_VERSIONS_STORE_NAME)) {
					versionsStore = db.createObjectStore(this.STORY_VERSIONS_STORE_NAME, {
						keyPath: ['userId', 'id'] // Compound key: userId + versionId
					});
				} else {
					versionsStore = request.transaction!.objectStore(this.STORY_VERSIONS_STORE_NAME);
				}

				// Create story categories object store
				let categoriesStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.CATEGORIES_STORE_NAME)) {
					categoriesStore = db.createObjectStore(this.CATEGORIES_STORE_NAME, {
						keyPath: ['userId', 'id'] // Compound key: userId + categoryId
					});
				} else {
					categoriesStore = request.transaction!.objectStore(this.CATEGORIES_STORE_NAME);
				}

				// Create sync metadata store
				let syncStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.SYNC_STORE_NAME)) {
					syncStore = db.createObjectStore(this.SYNC_STORE_NAME, {
						keyPath: 'userId'
					});
				} else {
					syncStore = request.transaction!.objectStore(this.SYNC_STORE_NAME);
				}

				// Create indexes for stories store
				const storyIndexesToCreate = [
					{ name: this.INDEX_USER_ID, keyPath: 'userId', options: { unique: false } },
					{ name: this.INDEX_SEARCH, keyPath: 'searchText', options: { unique: false } },
					{
						name: this.INDEX_CATEGORIES,
						keyPath: 'categories',
						options: { unique: false, multiEntry: true }
					},
					{ name: this.INDEX_PUBLIC, keyPath: 'isPublic', options: { unique: false } },
					{ name: this.INDEX_DATE_MODIFIED, keyPath: 'dateModified', options: { unique: false } },
					{ name: this.INDEX_LAST_SYNC, keyPath: 'lastSyncTimestamp', options: { unique: false } }
				];

				storyIndexesToCreate.forEach(({ name, keyPath, options }) => {
					if (!storiesStore.indexNames.contains(name)) {
						storiesStore.createIndex(name, keyPath, options);
					}
				});

				// NEW: Create indexes for followed stories store
				const followedStoryIndexesToCreate = [
					{ name: 'viewerUserId', keyPath: 'viewerUserId', options: { unique: false } },
					{ name: 'authorUserId', keyPath: 'authorUserId', options: { unique: false } },
					{ name: this.INDEX_PUBLIC, keyPath: 'isPublic', options: { unique: false } },
					{ name: this.INDEX_DATE_MODIFIED, keyPath: 'dateModified', options: { unique: false } },
					{ name: 'authorName', keyPath: 'authorName', options: { unique: false } }
				];

				followedStoryIndexesToCreate.forEach(({ name, keyPath, options }) => {
					if (!followedStoriesStore.indexNames.contains(name)) {
						followedStoriesStore.createIndex(name, keyPath, options);
					}
				});

				// Create indexes for versions store
				const versionIndexesToCreate = [
					{ name: this.INDEX_USER_ID, keyPath: 'userId', options: { unique: false } },
					{ name: 'storyId', keyPath: 'storyId', options: { unique: false } },
					{ name: this.INDEX_LAST_SYNC, keyPath: 'lastSyncTimestamp', options: { unique: false } }
				];

				versionIndexesToCreate.forEach(({ name, keyPath, options }) => {
					if (!versionsStore.indexNames.contains(name)) {
						versionsStore.createIndex(name, keyPath, options);
					}
				});

				// Create indexes for categories store
				const categoryIndexesToCreate = [
					{ name: this.INDEX_USER_ID, keyPath: 'userId', options: { unique: false } },
					{ name: this.INDEX_LAST_SYNC, keyPath: 'lastSyncTimestamp', options: { unique: false } }
				];

				categoryIndexesToCreate.forEach(({ name, keyPath, options }) => {
					if (!categoriesStore.indexNames.contains(name)) {
						categoriesStore.createIndex(name, keyPath, options);
					}
				});
			};
		});
	}

	/**
	 * Ensure database is initialized
	 */
	async ensureInitialized(): Promise<void> {
		if (!browser) return;
		if (this.isInitialized) return;
		if (this.initPromise) {
			await this.initPromise;
		}
	}

	/**
	 * Clean up resources when component is destroyed
	 */
	destroy(): void {
		this.stopFirestoreSync();
		this.stopFollowedStoriesSync(); // NEW: Clean up followed stories listeners
	}

	// ==================== PLACEHOLDER METHODS ====================
	// These will be implemented in subsequent steps

	/**
	 * Initialize default story categories
	 */
	private async initializeDefaultCategories(): Promise<void> {
		if (!this.db) return;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.CATEGORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.CATEGORIES_STORE_NAME);

		// Check if categories already exist
		const existingCategories = await this.getAllCategoriesFromStore(store, userId);
		if (existingCategories.length > 0) {
			return; // Already initialized
		}

		// Store each default category
		for (const categoryData of DEFAULT_STORY_CATEGORIES) {
			const userCategory: StoryCategory = {
				...categoryData,
				userId,
				lastSyncTimestamp: Date.now()
			};

			await new Promise<void>((resolve, reject) => {
				const request = store.put(userCategory);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		}
	}

	/**
	 * Update statistics for current user
	 */
	private async updateStats(): Promise<void> {
		if (!this.db) return;

		try {
			const userId = this.getCurrentUserId();
			const transaction = this.db.transaction(
				[this.STORIES_STORE_NAME, this.CATEGORIES_STORE_NAME],
				'readonly'
			);
			const storiesStore = transaction.objectStore(this.STORIES_STORE_NAME);
			const categoriesStore = transaction.objectStore(this.CATEGORIES_STORE_NAME);

			const [total, publicStories, categories, totalViews] = await Promise.all([
				this.countStoriesForUser(storiesStore, userId),
				this.countPublicStoriesForUser(storiesStore, userId),
				this.countCategoriesForUser(categoriesStore, userId),
				this.getTotalViewsForUser(storiesStore, userId)
			]);

			this._stats = { total, public: publicStories, categories, totalViews };
		} catch (error) {
			console.error('Failed to update stats:', error);
		}
	}

	// ==================== FIRESTORE SYNC PLACEHOLDER METHODS ====================

	/**
	 * Start Firestore real-time sync for current user
	 */
	private startFirestoreSync(): void {
		if (!this.currentUser || !this.isOnline) return;

		this.stopFirestoreSync(); // Clean up any existing subscription

		try {
			const userId = this.currentUser.uid;

			// Listen to real-time changes in user's stories collection
			const storiesQuery = query(
				collection(db, 'users', userId, 'stories'),
				orderBy('dateModified', 'desc')
			);

			// Listen to real-time changes in user's story categories collection
			const categoriesQuery = query(
				collection(db, 'users', userId, 'storyCategories'),
				orderBy('name', 'asc')
			);

			// Subscribe to stories changes
			const storiesUnsubscribe = onSnapshot(
				storiesQuery,
				(snapshot) => this.handleFirestoreSnapshot(snapshot, 'stories'),
				(error) => {
					console.error('Firestore stories sync error:', error);
					this.isSyncing = false;
				}
			);

			// Subscribe to categories changes
			const categoriesUnsubscribe = onSnapshot(
				categoriesQuery,
				(snapshot) => this.handleFirestoreSnapshot(snapshot, 'categories'),
				(error) => {
					console.error('Firestore categories sync error:', error);
					this.isSyncing = false;
				}
			);

			// Store both unsubscribe functions
			this.firestoreUnsubscribe = () => {
				storiesUnsubscribe();
				categoriesUnsubscribe();
			};

			console.log('Started Firestore sync for stories and categories');

			// Initial sync
			this.performInitialSync();
		} catch (error) {
			console.error('Failed to start Firestore sync:', error);
		}
	}

	/**
	 * Stop Firestore sync
	 */
	private stopFirestoreSync(): void {
		if (this.firestoreUnsubscribe) {
			this.firestoreUnsubscribe();
			this.firestoreUnsubscribe = null;
		}
		this.isSyncing = false;
	}

	// ==================== FOLLOWED STORIES SYNC (NEW) ====================

	/**
	 * Start real-time sync for followed users' public stories
	 */
	private startFollowedStoriesSync(): void {
		if (!this.currentUser || !this.isOnline) {
			console.log('Cannot start followed stories sync: user not authenticated or offline');
			return;
		}

		try {
			// Get current following list
			const followingUsers = userStore.following;
			console.log(`🔄 Starting followed stories sync for ${followingUsers.length} users`);

			// Stop any existing listeners first
			this.stopFollowedStoriesSync();

			// Set up real-time listener for each followed user's public stories
			followingUsers.forEach((followedUser) => {
				if (!followedUser.id || followedUser.id.length < 3) {
					console.warn(`Invalid user ID for ${followedUser.displayName}:`, followedUser.id);
					return;
				}

				try {
					const followedStoriesQuery = query(
						collection(db, 'users', followedUser.id, 'stories'),
						where('isPublic', '==', true), // Only public stories
						orderBy('dateModified', 'desc')
					);

					// Set up real-time listener
					const unsubscribe = onSnapshot(
						followedStoriesQuery,
						(snapshot) => this.handleFollowedStoriesSnapshot(snapshot, followedUser),
						(error) => {
							console.warn(`Followed stories sync error for ${followedUser.displayName}:`, error);
						}
					);

					// Store the unsubscribe function
					this.followedStoriesUnsubscribes.set(followedUser.id, unsubscribe);
					console.log(`✅ Started listening to stories from ${followedUser.displayName}`);
				} catch (error) {
					console.error(`Failed to set up listener for ${followedUser.displayName}:`, error);
				}
			});

			console.log(
				`🚀 Followed stories sync started for ${this.followedStoriesUnsubscribes.size} users`
			);
		} catch (error) {
			console.error('Failed to start followed stories sync:', error);
		}
	}

	/**
	 * Stop all followed stories sync listeners
	 */
	private stopFollowedStoriesSync(): void {
		console.log(`🛑 Stopping ${this.followedStoriesUnsubscribes.size} followed stories listeners`);

		// Unsubscribe from all followed stories listeners
		this.followedStoriesUnsubscribes.forEach((unsubscribe, userId) => {
			try {
				unsubscribe();
			} catch (error) {
				console.error(`Error unsubscribing from stories for user ${userId}:`, error);
			}
		});

		this.followedStoriesUnsubscribes.clear();
	}

	/**
	 * Handle followed stories snapshot changes (real-time updates)
	 */
	private async handleFollowedStoriesSnapshot(
		snapshot: QuerySnapshot<DocumentData>,
		authorProfile: any
	): Promise<void> {
		try {
			console.log(`📚 Received ${snapshot.docs.length} stories from ${authorProfile.displayName}`);

			// Process each story change
			for (const change of snapshot.docChanges()) {
				const storyData = change.doc.data();
				const storyId = change.doc.id;

				// Create enhanced story with author info and viewer ID for security
				const enhancedStory: Story & {
					authorName: string;
					authorUsername: string;
					authorAvatarUrl?: string;
					readOnly: boolean;
					authorUserId: string;
					viewerUserId: string; // Add current user ID for cache isolation
				} = {
					...storyData,
					authorName: authorProfile.displayName,
					authorUsername: authorProfile.username,
					authorAvatarUrl: authorProfile.avatarUrl,
					readOnly: true,
					authorUserId: authorProfile.id,
					viewerUserId: this.currentUser!.uid // Current user who is viewing/following
				} as any;

				switch (change.type) {
					case 'added':
					case 'modified':
						// Only store if still public
						if (enhancedStory.isPublic) {
							await this.storeFollowedStoryLocally(enhancedStory);
							console.log(
								`✅ ${change.type} story "${enhancedStory.title}" from ${authorProfile.displayName}`
							);
						} else {
							// Story became private, remove it
							await this.removeFollowedStoryLocally(authorProfile.id, storyId);
							console.log(
								`🔒 Removed private story "${enhancedStory.title}" from ${authorProfile.displayName}`
							);
						}
						break;
					case 'removed':
						await this.removeFollowedStoryLocally(authorProfile.id, storyId);
						console.log(`🗑️ Removed deleted story from ${authorProfile.displayName}`);
						break;
				}
			}

			// Trigger UI update
			this.triggerChange();
		} catch (error) {
			console.error('Error handling followed stories snapshot:', error);
		}
	}

	/**
	 * Sync story to Firestore (placeholder)
	 */
	private async syncStoryToFirestore(story: Story, retryCount = 0): Promise<void> {
		if (!this.currentUser || !this.isOnline) return;

		const MAX_RETRIES = 3;
		const RETRY_DELAY = 1000; // 1 second

		try {
			const userId = this.currentUser.uid;

			// Clean story data for Firestore (remove undefined values)
			const cleanStory = this.cleanForFirestore({
				...story,
				serverTimestamp: serverTimestamp(),
				lastSyncTimestamp: Date.now()
			});

			// Use story ID as Firestore document ID
			const docRef = doc(db, 'users', userId, 'stories', story.id);
			await setDoc(docRef, cleanStory, { merge: true });

			// Update local story with sync timestamp
			story.lastSyncTimestamp = Date.now();
			await this.storeStoryLocally(story);

			console.log(`Successfully synced story ${story.id} to Firestore`);
		} catch (error: any) {
			console.error(`Failed to sync story to Firestore (attempt ${retryCount + 1}):`, error);

			// Retry logic for transient errors
			if (retryCount < MAX_RETRIES && this.shouldRetry(error)) {
				console.log(`Retrying sync in ${RETRY_DELAY}ms...`);
				setTimeout(() => {
					this.syncStoryToFirestore(story, retryCount + 1);
				}, RETRY_DELAY);
			} else {
				// Log final failure
				console.error(
					`Failed to sync story ${story.id} after ${MAX_RETRIES} attempts:`,
					error.message
				);
			}
		}
	}

	/**
	 * Delete story from Firestore (placeholder)
	 */
	private async deleteStoryFromFirestore(storyId: string): Promise<void> {
		if (!this.currentUser) return;

		try {
			const userId = this.currentUser.uid;
			const docRef = doc(db, 'users', userId, 'stories', storyId);
			await deleteDoc(docRef);
			console.log(`Successfully deleted story ${storyId} from Firestore`);
		} catch (error) {
			console.error('Failed to delete story from Firestore:', error);
		}
	}

	// ==================== HELPER METHODS ====================

	/**
	 * Get all stories for a specific user
	 */
	private async getAllStoriesForUser(store: IDBObjectStore, userId: string): Promise<Story[]> {
		return new Promise((resolve, reject) => {
			const stories: Story[] = [];
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					stories.push(cursor.value);
					cursor.continue();
				} else {
					// Sort by date modified (newest first)
					resolve(stories.sort((a, b) => b.dateModified - a.dateModified));
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get all categories for a specific user
	 */
	private async getAllCategoriesFromStore(
		store: IDBObjectStore,
		userId: string
	): Promise<StoryCategory[]> {
		return new Promise((resolve, reject) => {
			const categories: StoryCategory[] = [];
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					categories.push(cursor.value);
					cursor.continue();
				} else {
					// Sort by name
					resolve(categories.sort((a, b) => a.name.localeCompare(b.name)));
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Count stories for a specific user
	 */
	private async countStoriesForUser(store: IDBObjectStore, userId: string): Promise<number> {
		return new Promise((resolve, reject) => {
			const index = store.index(this.INDEX_USER_ID);
			const request = index.count(IDBKeyRange.only(userId));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Count public stories for a specific user
	 */
	private async countPublicStoriesForUser(store: IDBObjectStore, userId: string): Promise<number> {
		return new Promise((resolve, reject) => {
			let count = 0;
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const story = cursor.value as Story;
					if (story.isPublic === true) {
						count++;
					}
					cursor.continue();
				} else {
					resolve(count);
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Count categories for a specific user
	 */
	private async countCategoriesForUser(store: IDBObjectStore, userId: string): Promise<number> {
		return new Promise((resolve, reject) => {
			const index = store.index(this.INDEX_USER_ID);
			const request = index.count(IDBKeyRange.only(userId));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get total view count for all stories for a specific user
	 */
	private async getTotalViewsForUser(store: IDBObjectStore, userId: string): Promise<number> {
		return new Promise((resolve, reject) => {
			let totalViews = 0;
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const story = cursor.value as Story;
					totalViews += story.viewCount || 0;
					cursor.continue();
				} else {
					resolve(totalViews);
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	// ==================== PUBLIC API PLACEHOLDER METHODS ====================
	// These will be the main methods that components use

	async createStory(
		title: string,
		content: StoryContentNode[],
		options?: {
			description?: string;
			categories?: string[];
			isPublic?: boolean;
		}
	): Promise<Story> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const userId = this.getCurrentUserId();
		const now = Date.now();
		const storyId = `story-${now}-${Math.random().toString(36).substr(2, 9)}`;

		const story: Story = {
			id: storyId,
			userId,
			title: title.trim(),
			description: options?.description?.trim() || undefined,
			content: [...content],
			categories: [...(options?.categories || [])],
			dateCreated: now,
			dateModified: now,
			viewCount: 0,
			isPublic: options?.isPublic || false,
			currentVersion: 1,
			lastSyncTimestamp: now,
			searchText: '' // Will be set below
		};

		// Generate searchable text
		story.searchText = generateSearchText(story);

		// Store in database
		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			try {
				const cleanStory = JSON.parse(JSON.stringify(story));
				const request = store.put(cleanStory);
				request.onsuccess = () => resolve();
				request.onerror = () => {
					console.error('IndexedDB store.put failed:', request.error);
					reject(request.error);
				};
			} catch (jsonError) {
				console.error('Failed to serialize story for storage:', jsonError);
				reject(new Error(`Story serialization failed: ${jsonError}`));
			}
		});

		await this.updateStats();
		this.triggerChange();

		// Sync to Firestore if online
		if (this.isOnline && this.currentUser) {
			this.syncStoryToFirestore(story);
		}

		return story;
	}

	/**
	 * Create a new story category
	 */
	async createCategory(categoryData: {
		id: string;
		name: string;
		color: string;
		icon?: string;
		description?: string;
	}): Promise<StoryCategory> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const userId = this.getCurrentUserId();
		const category: StoryCategory = {
			...categoryData,
			userId,
			lastSyncTimestamp: Date.now()
		};

		const transaction = this.db.transaction([this.CATEGORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.CATEGORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(category);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerChange();

		// Sync to Firestore if online and authenticated
		if (this.isOnline && this.currentUser) {
			this.syncCategoryToFirestore(category);
		}

		return category;
	}

	/**
	 * Get stories by category
	 */
	async getStoriesByCategory(categoryId: string): Promise<Story[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);
		const index = store.index(this.INDEX_CATEGORIES);

		return new Promise((resolve, reject) => {
			const stories: Story[] = [];
			const request = index.openCursor(IDBKeyRange.only(categoryId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					// Only include stories for current user
					const story = cursor.value as Story;
					if (story.userId === this.getCurrentUserId()) {
						stories.push(story);
					}
					cursor.continue();
				} else {
					resolve(stories.sort((a, b) => b.dateModified - a.dateModified));
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Export all stories for backup
	 */
	async exportStories(): Promise<Story[]> {
		return this.getAllStories();
	}

	/**
	 * Import stories from backup
	 */
	async importStories(stories: Story[]): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		for (const story of stories) {
			// Ensure story belongs to current user
			story.userId = userId;
			story.lastSyncTimestamp = Date.now();

			await new Promise<void>((resolve, reject) => {
				const request = store.put(story);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		}

		await this.updateStats();
		this.triggerChange();
	}

	/**
	 * Clear all stories for current user
	 */
	async clearAllStories(): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		// Get all stories for current user and delete them
		const stories = await this.getAllStoriesForUser(store, userId);
		for (const story of stories) {
			await new Promise<void>((resolve, reject) => {
				const request = store.delete([userId, story.id]);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		}

		this._stats.total = 0;
		this._stats.public = 0;
		this._stats.totalViews = 0;
		this.triggerChange();
	}

	/**
	 * Debug method to check current user and database state
	 */
	getDebugInfo(): {
		userId: string;
		initialized: boolean;
		stats: any;
		hasDatabase: boolean;
	} {
		return {
			userId: this.getCurrentUserId(),
			initialized: this.isInitialized,
			stats: this._stats,
			hasDatabase: !!this.db
		};
	}

	/**
	 * Force full sync
	 */
	async forceSyncNow(): Promise<void> {
		if (!this.currentUser || !this.isOnline) {
			throw new Error('Cannot sync: user not authenticated or offline');
		}

		await this.performInitialSync();
	}

	/**
	 * Get sync status
	 */
	getSyncStatus(): {
		online: boolean;
		syncing: boolean;
		lastSync: number;
		conflicts: number;
		authenticated: boolean;
	} {
		return {
			online: this.isOnline,
			syncing: this.isSyncing,
			lastSync: this.lastSyncTimestamp,
			conflicts: this.syncConflicts.length,
			authenticated: !!this.currentUser
		};
	}

	async getAllStories(): Promise<Story[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		return this.getAllStoriesForUser(store, userId);
	}

	async getStoryById(id: string): Promise<Story | null> {
		await this.ensureInitialized();
		if (!this.db) return null;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.get([userId, id]); // Use compound key
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	}

	async updateStory(
		id: string,
		updates: Partial<Pick<Story, 'title' | 'description' | 'content' | 'categories' | 'isPublic'>>,
		changeDescription?: string
	): Promise<Story> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const existingStory = await this.getStoryById(id);
		if (!existingStory) {
			throw new Error(`Story with ID ${id} not found`);
		}

		// Create updated story
		const updatedStory: Story = {
			...existingStory,
			...updates,
			dateModified: Date.now(),
			currentVersion: existingStory.currentVersion + 1,
			lastSyncTimestamp: Date.now()
		};

		// Regenerate searchable text
		updatedStory.searchText = generateSearchText(updatedStory);

		// Store updated story
		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			try {
				const cleanStory = JSON.parse(JSON.stringify(updatedStory));
				const request = store.put(cleanStory);
				request.onsuccess = () => resolve();
				request.onerror = () => {
					console.error('IndexedDB store.put failed in updateStory:', request.error);
					reject(request.error);
				};
			} catch (jsonError) {
				console.error('Failed to serialize story for update:', jsonError);
				reject(new Error(`Story serialization failed in update: ${jsonError}`));
			}
		});

		// TODO: Store version history in next step

		await this.updateStats();
		this.triggerChange();

		// Sync to Firestore if online
		if (this.isOnline && this.currentUser) {
			this.syncStoryToFirestore(updatedStory);
		}

		return updatedStory;
	}

	async deleteStory(id: string): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.delete([userId, id]); // Use compound key
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		// TODO: Delete version history in next step

		await this.updateStats();
		this.triggerChange();

		// Sync deletion to Firestore if online
		if (this.isOnline && this.currentUser) {
			this.deleteStoryFromFirestore(id);
		}
	}

	async searchStories(
		query: string,
		options?: {
			limit?: number;
			categories?: string[];
			publicOnly?: boolean;
		}
	): Promise<StorySearchResult[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		const userId = this.getCurrentUserId();
		const { limit = 50, categories, publicOnly = false } = options || {};

		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		// Get all stories for current user
		let stories = await this.getAllStoriesForUser(store, userId);

		// Apply filters
		if (publicOnly) {
			stories = stories.filter((story) => story.isPublic === true);
		}
		if (categories && categories.length > 0) {
			stories = stories.filter((story) => story.categories.some((cat) => categories.includes(cat)));
		}

		// Apply text search and scoring
		const queryLower = query.toLowerCase().trim();
		const results: StorySearchResult[] = [];

		if (!queryLower) {
			// No query, return all stories with default score
			return stories.slice(0, limit).map((story) => ({
				story,
				score: 1,
				matchedFields: [],
				matchedContent: []
			}));
		}

		stories.forEach((story) => {
			const matches: string[] = [];
			const matchedContent: StoryContentNode[] = [];
			let score = 0;

			// Search in searchText (full-text search)
			if (story.searchText.includes(queryLower)) {
				matches.push('searchText');
				score += 1;
			}

			// Bonus points for exact matches in specific fields
			if (story.title.toLowerCase().includes(queryLower)) {
				matches.push('title');
				score += 5; // Title matches get highest score
			}

			if (story.description?.toLowerCase().includes(queryLower)) {
				matches.push('description');
				score += 3;
			}

			// Check content nodes
			story.content.forEach((node) => {
				if (node.type === 'text' && node.text.toLowerCase().includes(queryLower)) {
					matchedContent.push(node);
					matches.push('content');
					score += 1;
				} else if (
					node.type === 'feature' &&
					(node.displayText.toLowerCase().includes(queryLower) ||
						node.customText?.toLowerCase().includes(queryLower))
				) {
					matchedContent.push(node);
					matches.push('feature');
					score += 2; // Feature matches are more specific
				}
			});

			if (score > 0) {
				results.push({
					story,
					score,
					matchedFields: Array.from(new Set(matches)), // Remove duplicates
					matchedContent
				});
			}
		});

		// Sort by relevance score and limit results
		return results.sort((a, b) => b.score - a.score).slice(0, limit);
	}

	async getAllCategories(): Promise<StoryCategory[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.CATEGORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.CATEGORIES_STORE_NAME);

		return this.getAllCategoriesFromStore(store, userId);
	}

	async incrementViewCount(storyId: string): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const story = await this.getStoryById(storyId);
		if (!story) return;

		story.viewCount = (story.viewCount || 0) + 1;
		story.lastSyncTimestamp = Date.now();

		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			try {
				const cleanStory = JSON.parse(JSON.stringify(story));
				const request = store.put(cleanStory);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			} catch (jsonError) {
				console.error('Failed to serialize story for view count update:', jsonError);
				reject(new Error(`Story serialization failed: ${jsonError}`));
			}
		});

		await this.updateStats();

		// Sync to Firestore if online (view count updates)
		if (this.isOnline && this.currentUser) {
			this.syncStoryToFirestore(story);
		}
	}

	// ==================== MISSING SYNC HELPER METHODS ====================

	/**
	 * Get category by ID for current user
	 */
	async getCategoryById(categoryId: string): Promise<StoryCategory | null> {
		await this.ensureInitialized();
		if (!this.db) return null;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.CATEGORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.CATEGORIES_STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.get([userId, categoryId]); // Use compound key
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Handle Firestore snapshot changes
	 */
	private async handleFirestoreSnapshot(
		snapshot: QuerySnapshot<DocumentData>,
		type: 'stories' | 'categories' = 'stories'
	): Promise<void> {
		if (!this.currentUser) return;

		this.isSyncing = true;

		try {
			for (const change of snapshot.docChanges()) {
				const firestoreData = change.doc.data();
				const docId = change.doc.id;

				switch (change.type) {
					case 'added':
					case 'modified':
						if (type === 'stories') {
							await this.handleRemoteStoryChange(firestoreData, docId);
						} else {
							await this.handleRemoteCategoryChange(firestoreData, docId);
						}
						break;
					case 'removed':
						if (type === 'stories') {
							await this.handleRemoteStoryDeletion(docId);
						} else {
							await this.handleRemoteCategoryDeletion(docId);
						}
						break;
				}
			}

			this.lastSyncTimestamp = Date.now();
			await this.updateSyncMetadata();
		} catch (error) {
			console.error('Error handling Firestore snapshot:', error);
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Handle remote story changes from Firestore
	 */
	private async handleRemoteStoryChange(remoteData: any, firestoreId: string): Promise<void> {
		if (!remoteData.id) return;

		const localStory = await this.getStoryById(remoteData.id);

		if (!localStory) {
			// No local version, safe to add from remote
			const story: Story = {
				...remoteData,
				firestoreId,
				lastSyncTimestamp: Date.now()
			};

			await this.storeStoryLocally(story);
		} else {
			// Check for conflicts
			const localTimestamp = localStory.lastSyncTimestamp || 0;
			const remoteTimestamp = remoteData.lastSyncTimestamp || 0;

			if (localTimestamp > remoteTimestamp && localStory.dateModified > remoteData.dateModified) {
				// Local is newer, upload to Firestore
				this.syncStoryToFirestore(localStory);
			} else if (remoteTimestamp > localTimestamp) {
				// Remote is newer, update local
				const updatedStory: Story = {
					...remoteData,
					firestoreId,
					lastSyncTimestamp: Date.now()
				};

				await this.storeStoryLocally(updatedStory);
			} else {
				// Conflict detected
				this.addSyncConflict({
					id: remoteData.id,
					type: 'story',
					localData: localStory,
					remoteData,
					conflictType: 'both_modified',
					timestamp: Date.now()
				});
			}
		}
	}

	/**
	 * Handle remote story deletion
	 */
	private async handleRemoteStoryDeletion(firestoreId: string): Promise<void> {
		// Find local story by Firestore ID and delete it
		const allStories = await this.exportStories();
		const storyToDelete = allStories.find((s) => (s as any).firestoreId === firestoreId);

		if (storyToDelete) {
			await this.deleteStory(storyToDelete.id);
		}
	}

	/**
	 * Handle remote category changes from Firestore
	 */
	private async handleRemoteCategoryChange(remoteData: any, firestoreId: string): Promise<void> {
		if (!remoteData.id) return;

		const localCategory = await this.getCategoryById(remoteData.id);

		if (!localCategory) {
			// No local version, safe to add from remote
			const category: StoryCategory = {
				...remoteData,
				firestoreId,
				lastSyncTimestamp: Date.now()
			};

			await this.storeCategoryLocally(category);
		} else {
			// Update local category
			const updatedCategory: StoryCategory = {
				...remoteData,
				firestoreId,
				lastSyncTimestamp: Date.now()
			};

			await this.storeCategoryLocally(updatedCategory);
		}
	}

	/**
	 * Handle remote category deletion
	 */
	private async handleRemoteCategoryDeletion(firestoreId: string): Promise<void> {
		// Categories are rarely deleted, but we should handle it
		console.log('Remote category deletion not fully implemented:', firestoreId);
	}

	/**
	 * Store story locally without triggering sync
	 */
	private async storeStoryLocally(story: Story): Promise<void> {
		if (!this.db) return;

		const transaction = this.db.transaction([this.STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const cleanStory = JSON.parse(JSON.stringify(story));
			const request = store.put(cleanStory);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerChange();
	}

	/**
	 * Store category locally without triggering sync
	 */
	private async storeCategoryLocally(category: StoryCategory): Promise<void> {
		if (!this.db) return;

		const transaction = this.db.transaction([this.CATEGORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.CATEGORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const cleanCategory = JSON.parse(JSON.stringify(category));
			const request = store.put(cleanCategory);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerChange();
	}

	/**
	 * Store followed story locally without triggering sync
	 */
	private async storeFollowedStoryLocally(story: any): Promise<void> {
		if (!this.db || !this.currentUser) return;

		const transaction = this.db.transaction([this.FOLLOWED_STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);

		// Ensure story has viewerUserId for proper cache isolation
		const storyWithViewer = {
			...story,
			viewerUserId: this.currentUser.uid
		};

		await new Promise<void>((resolve, reject) => {
			const cleanStory = JSON.parse(JSON.stringify(storyWithViewer));
			const request = store.put(cleanStory);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Remove followed story locally
	 */
	private async removeFollowedStoryLocally(authorUserId: string, storyId: string): Promise<void> {
		if (!this.db || !this.currentUser) return;

		const transaction = this.db.transaction([this.FOLLOWED_STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			// Use the full compound key: viewerUserId + authorUserId + storyId
			const request = store.delete([this.currentUser!.uid, authorUserId, storyId]);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get all followed stories from local cache (for current user only)
	 */
	private async getAllFollowedStoriesFromCache(): Promise<Story[]> {
		if (!this.db || !this.currentUser) return [];

		const currentUserId = this.currentUser.uid;
		const transaction = this.db.transaction([this.FOLLOWED_STORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);
		const index = store.index('viewerUserId');

		return new Promise((resolve, reject) => {
			const stories: Story[] = [];
			// Only get stories for the current user
			const request = index.openCursor(IDBKeyRange.only(currentUserId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					stories.push(cursor.value);
					cursor.continue();
				} else {
					// Sort by date modified (newest first)
					resolve(stories.sort((a, b) => b.dateModified - a.dateModified));
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Add sync conflict to queue
	 */
	private addSyncConflict(conflict: SyncConflict): void {
		this.syncConflicts = [...this.syncConflicts, conflict];
	}

	/**
	 * Clean object by removing undefined values (Firestore doesn't allow undefined)
	 */
	private cleanForFirestore(obj: any): any {
		if (obj === null || obj === undefined) {
			return null;
		}

		if (Array.isArray(obj)) {
			return obj.map((item) => this.cleanForFirestore(item));
		}

		if (typeof obj === 'object') {
			const cleaned: any = {};
			for (const [key, value] of Object.entries(obj)) {
				if (value !== undefined) {
					cleaned[key] = this.cleanForFirestore(value);
				}
			}
			return cleaned;
		}

		return obj;
	}

	/**
	 * Determine if error should trigger a retry
	 */
	private shouldRetry(error: any): boolean {
		// Don't retry authentication/permission errors
		if (error.code === 'permission-denied' || error.code === 'unauthenticated') {
			return false;
		}

		// Don't retry invalid data errors
		if (error.code === 'invalid-argument') {
			return false;
		}

		// Retry network-related errors
		if (
			error.code === 'unavailable' ||
			error.code === 'deadline-exceeded' ||
			error.code === 'internal'
		) {
			return true;
		}

		// Default to not retrying unknown errors
		return false;
	}

	/**
	 * Perform initial sync when user connects
	 */
	private async performInitialSync(): Promise<void> {
		if (!this.currentUser || !this.isOnline) return;

		this.isSyncing = true;

		try {
			// Upload local changes to Firestore
			await this.uploadLocalChanges();

			// Download and apply remote changes
			await this.downloadRemoteChanges();

			this.lastSyncTimestamp = Date.now();
			await this.updateSyncMetadata();
		} catch (error) {
			console.error('Initial sync failed:', error);
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Upload local changes to Firestore
	 */
	private async uploadLocalChanges(): Promise<void> {
		if (!this.currentUser) return;

		const localStories = await this.exportStories();

		for (const story of localStories) {
			const lastSyncTimestamp = story.lastSyncTimestamp || 0;

			// Upload if never synced or modified since last sync
			if (lastSyncTimestamp === 0 || story.dateModified > lastSyncTimestamp) {
				await this.syncStoryToFirestore(story);
			}
		}

		// Upload local categories (if any custom ones)
		const localCategories = await this.getAllCategories();
		for (const category of localCategories) {
			const lastSyncTimestamp = (category as any).lastSyncTimestamp || 0;

			// Upload if never synced or is a custom category
			if (lastSyncTimestamp === 0 && !isDefaultCategory(category.id)) {
				await this.syncCategoryToFirestore(category);
			}
		}
	}

	/**
	 * Download remote changes from Firestore
	 */
	private async downloadRemoteChanges(): Promise<void> {
		if (!this.currentUser) return;

		const userId = this.currentUser.uid;
		const lastSync = await this.getLastSyncTimestamp();

		try {
			// Query for stories modified since last sync
			const storiesQuery = query(
				collection(db, 'users', userId, 'stories'),
				where('dateModified', '>', lastSync),
				orderBy('dateModified', 'asc')
			);

			console.log('Downloading remote changes since:', new Date(lastSync));

			// The snapshot listeners will handle the actual downloads
			// This method just sets up the queries for initial sync
		} catch (error) {
			console.error('Failed to set up download queries:', error);
		}
	}

	/**
	 * Sync category to Firestore
	 */
	private async syncCategoryToFirestore(category: StoryCategory): Promise<void> {
		if (!this.currentUser || !this.isOnline) return;

		try {
			const userId = this.currentUser.uid;
			const cleanCategory = this.cleanForFirestore({
				...category,
				serverTimestamp: serverTimestamp(),
				lastSyncTimestamp: Date.now()
			});

			const docRef = doc(db, 'users', userId, 'storyCategories', category.id);
			await setDoc(docRef, cleanCategory, { merge: true });
			console.log(`Successfully synced category ${category.id} to Firestore`);
		} catch (error) {
			console.error('Failed to sync category to Firestore:', error);
		}
	}

	/**
	 * Update sync metadata
	 */
	private async updateSyncMetadata(): Promise<void> {
		if (!this.db || !this.currentUser) return;

		const userId = this.currentUser.uid;
		const metadata: SyncMetadata = {
			userId,
			lastSyncTimestamp: this.lastSyncTimestamp,
			deviceId: this.getDeviceId(),
			syncVersion: 1
		};

		const transaction = this.db.transaction([this.SYNC_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.SYNC_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(metadata);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get last sync timestamp
	 */
	private async getLastSyncTimestamp(): Promise<number> {
		if (!this.db || !this.currentUser) return 0;

		const userId = this.currentUser.uid;
		const transaction = this.db.transaction([this.SYNC_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.SYNC_STORE_NAME);

		return new Promise((resolve) => {
			const request = store.get(userId);
			request.onsuccess = () => {
				const metadata = request.result as SyncMetadata;
				resolve(metadata?.lastSyncTimestamp || 0);
			};
			request.onerror = () => resolve(0);
		});
	}

	/**
	 * Get unique device ID
	 */
	private getDeviceId(): string {
		let deviceId = localStorage.getItem('deviceId');
		if (!deviceId) {
			deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
			localStorage.setItem('deviceId', deviceId);
		}
		return deviceId;
	}

	// ==================== SOCIAL FEATURES ====================

	/**
	 * Get public stories from users that the current user follows (FROM USER-ISOLATED CACHE)
	 * Security: Each user can only access their own followed stories cache via compound key isolation
	 */
	async getStoriesFromFollowedUsers(limit = 20): Promise<Story[]> {
		if (!this.currentUser) {
			console.warn('No user logged in, cannot fetch followed stories');
			return [];
		}

		try {
			// Read from user-isolated cache - only current user's followed stories
			console.log('💾 Reading followed stories from user-isolated cache...');
			const cachedStories = await this.getAllFollowedStoriesFromCache();

			// Apply limit and return
			const limitedStories = cachedStories.slice(0, limit);
			console.log(
				`✅ Returning ${limitedStories.length} cached followed stories for user ${this.currentUser.uid} (from ${cachedStories.length} total)`
			);
			return limitedStories;
		} catch (error) {
			console.error('Error reading followed stories from cache:', error);
			return [];
		}
	}

	/**
	 * Force sync restart for followed stories (public method)
	 * Call this when following list changes
	 */
	async refreshFollowedStoriesSync(): Promise<void> {
		if (!this.currentUser || !this.isOnline) {
			console.log('Cannot refresh followed stories sync: user not authenticated or offline');
			return;
		}

		console.log('🔄 Refreshing followed stories sync (public method)');
		// Small delay to let UserStore update
		setTimeout(() => this.startFollowedStoriesSync(), 500);
	}

	/**
	 * Get a specific story by ID and user ID (for reading followed user stories)
	 */
	async getStoryFromUser(userId: string, storyId: string): Promise<Story | null> {
		if (!this.currentUser) {
			return null;
		}

		try {
			// Check if we're following this user (for permission)
			const isFollowing = userStore.following.some((user) => user.id === userId);
			if (!isFollowing && userId !== this.currentUser.uid) {
				console.warn('Cannot access story from user we are not following');
				return null;
			}

			const storyRef = doc(db, 'users', userId, 'stories', storyId);
			const storyDoc = await getDoc(storyRef);

			if (!storyDoc.exists()) {
				return null;
			}

			const storyData = storyDoc.data();

			// Only return if story is public (unless it's our own story)
			if (!storyData.isPublic && userId !== this.currentUser.uid) {
				console.warn('Story is not public');
				return null;
			}

			// Get author information
			const authorProfile = userStore.following.find((user) => user.id === userId);

			const story: Story = {
				...storyData,
				// Add author metadata
				authorName: authorProfile?.displayName || 'Unknown',
				authorUsername: authorProfile?.username || 'unknown',
				authorAvatarUrl: authorProfile?.avatarUrl,
				readOnly: userId !== this.currentUser.uid // Read-only if not our story
			} as Story & {
				authorName: string;
				authorUsername: string;
				authorAvatarUrl?: string;
				readOnly: boolean;
			};

			return story;
		} catch (error) {
			console.error('Error fetching story from user:', error);
			return null;
		}
	}
}

// Create singleton instance
export const storiesDB = new StoriesDB();
