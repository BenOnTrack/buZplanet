import { browser } from '$app/environment';
import { authState } from '$lib/stores/auth.svelte';
import { db } from '$lib/firebase';
import { userStore } from '$lib/stores/UserStore.svelte';
import { userService } from '$lib/services/userService';
import type { User } from 'firebase/auth';
import {
	collection,
	doc,
	getDoc,
	setDoc,
	updateDoc,
	deleteDoc,
	query,
	where,
	onSnapshot,
	serverTimestamp,
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
			window.addEventListener('online', async () => {
				this.isOnline = true;
				console.log('🌐 StoriesDB: Connection restored - starting sync');
				if (this.currentUser) {
					this.startFirestoreSync();
					// IMPORTANT: Force upload of local changes when coming back online
					await this.uploadPendingLocalChanges();
				}
			});

			window.addEventListener('offline', () => {
				this.isOnline = false;
				console.log('📴 StoriesDB: Connection lost - sync paused');
				this.stopFirestoreSync();
			});

			// Initialize with default state
			this.isInitialized = false;
			this.initPromise = null;

			// Add debugging functions to window
			window.debugStoriesSync = async (): Promise<void> => {
				const debugInfo = await this.getDetailedDebugInfo();
				console.log('🔍 Stories Sync Debug Information:', debugInfo);
			};

			window.testFollowedStoriesSync = async () => {
				console.log('🔄 Testing followed stories sync...');
				try {
					await this.refreshFollowedStoriesSync();
					console.log('✅ Followed stories sync test completed');
				} catch (error) {
					console.error('❌ Followed stories sync test failed:', error);
				}
			};

			// NEW: Simple debug method to manually check for story updates
			window.debugStorySync = async (authorUserId: string, storyId: string) => {
				console.log(`🔍 Debugging story sync for ${authorUserId}/${storyId}`);
				try {
					// Check direct Firestore read
					const storyRef = doc(db, 'users', authorUserId, 'stories', storyId);
					const storyDoc = await getDoc(storyRef);

					if (storyDoc.exists()) {
						const storyData = storyDoc.data();
						console.log('📚 Direct Firestore read:', storyData);

						// Check our cached version
						const followedStoryId = `${authorUserId}_${storyId}`;
						const cachedStory = await this.getFollowedStoryById(followedStoryId);
						console.log('📁 Cached version:', cachedStory);

						console.log('🔍 Comparison:');
						console.log('  Firestore dateModified:', new Date(storyData.dateModified));
						console.log(
							'  Cached dateModified:',
							cachedStory ? new Date(cachedStory.dateModified) : 'NO CACHE'
						);
						console.log('  Firestore title:', storyData.title);
						console.log('  Cached title:', cachedStory?.title || 'NO CACHE');
					} else {
						console.log('❌ Story not found in Firestore');
					}
				} catch (error) {
					console.error('❌ Debug story sync failed:', error);
				}
			};
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

			// Firestore handles offline sync automatically

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

			// NEW: Listen to real-time changes in user's followed stories collection
			const followedStoriesQuery = query(
				collection(db, 'users', userId, 'followedStories'),
				orderBy('dateModified', 'desc')
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

			// NEW: Subscribe to followed stories changes
			const followedStoriesUnsubscribe = onSnapshot(
				followedStoriesQuery,
				(snapshot) => this.handleFirestoreSnapshot(snapshot, 'followedStories'),
				(error) => {
					console.error('Firestore followed stories sync error:', error);
				}
			);

			// Store all unsubscribe functions
			this.firestoreUnsubscribe = () => {
				storiesUnsubscribe();
				categoriesUnsubscribe();
				followedStoriesUnsubscribe();
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

			// For each followed user: fetch existing stories then set up real-time listener
			// Use Promise.all to handle async operations properly
			const setupTasks = followingUsers.map(async (followedUser) => {
				if (!followedUser.id || followedUser.id.length < 3) {
					console.warn(`Invalid user ID for ${followedUser.displayName}:`, followedUser.id);
					return;
				}

				try {
					console.log(`🔄 Setting up sync for ${followedUser.displayName} (${followedUser.id})`);

					// Step 1: Fetch ALL existing public stories for this user (only if not already synced)
					const existingCachedStories = await this.getFollowedStoriesForAuthor(followedUser.id);

					// Only fetch if we don't have any cached stories for this author
					if (existingCachedStories.length === 0) {
						console.log(`📚 No cached stories found, fetching all for ${followedUser.displayName}`);
						await this.fetchExistingStoriesForUser(followedUser);
					} else {
						console.log(
							`📚 Found ${existingCachedStories.length} cached stories for ${followedUser.displayName}`
						);
					}

					// Step 2: Set up real-time listener for future changes
					const followedStoriesQuery = query(
						collection(db, 'users', followedUser.id, 'stories'),
						where('isPublic', '==', true), // Only public stories
						orderBy('dateModified', 'desc')
					);

					// Real-time listener for changes only
					const unsubscribe = onSnapshot(
						followedStoriesQuery,
						(snapshot) => {
							const changes = snapshot.docChanges();
							if (changes.length > 0) {
								console.log(
									`🔄 Real-time update for ${followedUser.displayName}: ${changes.length} changes`
								);
								this.handleFollowedStoriesSnapshot(snapshot, followedUser);
							}
						},
						(error) => {
							console.error(`Followed stories sync error for ${followedUser.displayName}:`, error);
							// Don't stop other listeners due to one error
						}
					);

					// Store the unsubscribe function
					this.followedStoriesUnsubscribes.set(followedUser.id, unsubscribe);
					console.log(`✅ Setup complete for ${followedUser.displayName}`);
				} catch (error) {
					console.error(`Failed to setup sync for ${followedUser.displayName}:`, error);
				}
			});

			// Wait for all setup tasks to complete
			Promise.all(setupTasks)
				.then(() => {
					console.log(`🚀 All followed stories sync tasks completed`);
					// Final UI update after all fetches are done
					this.triggerChange();
				})
				.catch((error) => {
					console.error('Error in followed stories setup tasks:', error);
				});

			console.log(`🚀 Started followed stories sync for ${followingUsers.length} users`);
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
	 * Fetch all existing public stories for a specific followed user
	 * This is called once when we start following someone or on initial sync
	 */
	private async fetchExistingStoriesForUser(followedUser: any): Promise<void> {
		if (!this.currentUser) {
			console.error('❌ Cannot fetch stories: no current user');
			return;
		}

		try {
			console.log(
				`📚 Fetching existing stories for ${followedUser.displayName} (${followedUser.id})...`
			);

			// Check if we have database initialized
			if (!this.db) {
				console.error('❌ Cannot fetch stories: IndexedDB not initialized');
				return;
			}

			const existingStoriesQuery = query(
				collection(db, 'users', followedUser.id, 'stories'),
				where('isPublic', '==', true),
				orderBy('dateModified', 'desc')
			);

			console.log(`🔍 Executing query for user ${followedUser.id}...`);

			// Fetch all existing stories (one-time fetch)
			const snapshot = await getDocs(existingStoriesQuery);
			console.log(
				`📖 Found ${snapshot.docs.length} existing public stories from ${followedUser.displayName}`
			);

			// Debug: Log story details
			if (snapshot.docs.length > 0) {
				console.log('📋 Story details:');
				snapshot.docs.forEach((doc, index) => {
					const data = doc.data();
					console.log(`  ${index + 1}. "${data.title}" (${doc.id}) - Public: ${data.isPublic}`);
				});
			}

			// Process each existing story
			let storedCount = 0;
			for (const doc of snapshot.docs) {
				const storyData = doc.data();
				const originalStoryId = doc.id; // This is the original story ID from User B

				try {
					// Create enhanced story with author info
					const enhancedStory = this.createEnhancedFollowedStory(
						storyData,
						followedUser,
						[] // Start with empty categories - user will assign their own
					);

					// IMPORTANT: Set the original story ID properly
					(enhancedStory as any).originalStoryId = originalStoryId;
					// Keep the story ID as original for now - storeFollowedStoryInFirestore will handle prefixing
					enhancedStory.id = originalStoryId;

					// Store in Firestore and IndexedDB
					await this.storeFollowedStoryInFirestore(enhancedStory);
					storedCount++;
					console.log(`✅ Stored story "${enhancedStory.title}" from ${followedUser.displayName}`);
				} catch (error) {
					console.error(`❌ Failed to store story ${originalStoryId}:`, error);
				}
			}

			console.log(
				`✅ Successfully cached ${storedCount}/${snapshot.docs.length} stories from ${followedUser.displayName}`
			);
		} catch (error) {
			console.error(`❌ Failed to fetch existing stories for ${followedUser.displayName}:`, error);
			throw error; // Re-throw to be caught by caller
		}
	}

	/**
	 * Handle followed stories snapshot changes (real-time updates)
	 * IMPROVED VERSION: Handle both docChanges and full snapshot processing
	 */
	private async handleFollowedStoriesSnapshot(
		snapshot: QuerySnapshot<DocumentData>,
		authorProfile: any
	): Promise<void> {
		try {
			const changes = snapshot.docChanges();
			console.log(
				`📚 Processing ${changes.length} story changes from ${authorProfile.displayName}`
			);

			// If this is the initial listener setup with no changes, process all docs
			if (changes.length === 0 && snapshot.docs.length > 0) {
				console.log(
					`🔄 Initial snapshot - processing ${snapshot.docs.length} existing stories from ${authorProfile.displayName}`
				);

				// Process all existing stories as potential updates
				for (const doc of snapshot.docs) {
					const storyData = doc.data();
					const storyId = doc.id;

					if (storyData.isPublic) {
						// Check if we already have this story cached
						const followedStoryId = `${authorProfile.id}_${storyId}`;
						const existingStory = await this.getFollowedStoryById(followedStoryId);

						if (existingStory) {
							// Update existing story
							await this.updateExistingFollowedStory(storyData, authorProfile, storyId);
							console.log(
								`🔄 Updated existing story "${storyData.title}" from ${authorProfile.displayName}`
							);
						} else {
							// Add new story
							const enhancedStory = this.createEnhancedFollowedStory(storyData, authorProfile, []);
							enhancedStory.id = followedStoryId;
							(enhancedStory as any).originalStoryId = storyId;
							await this.storeFollowedStoryInFirestore(enhancedStory);
							console.log(
								`✅ Added new story "${storyData.title}" from ${authorProfile.displayName}`
							);
						}
					}
				}

				this.triggerChange();
				return;
			}

			// Process document changes (additions, modifications, deletions)
			for (const change of changes) {
				const storyData = change.doc.data();
				const storyId = change.doc.id;

				console.log(`🔄 Processing ${change.type} for story: ${storyData.title} (${storyId})`);

				switch (change.type) {
					case 'added':
						// For new stories, start with empty categories
						if (storyData.isPublic) {
							const followedStoryId = `${authorProfile.id}_${storyId}`;

							// Check if story already exists (prevent duplicates)
							const existingStory = await this.getFollowedStoryById(followedStoryId);
							if (!existingStory) {
								const enhancedStory = this.createEnhancedFollowedStory(
									storyData,
									authorProfile,
									[] // Empty categories for new stories
								);
								enhancedStory.id = followedStoryId;
								(enhancedStory as any).originalStoryId = storyId;
								await this.storeFollowedStoryInFirestore(enhancedStory);
								console.log(
									`✅ Added new story "${storyData.title}" from ${authorProfile.displayName}`
								);
							} else {
								console.log(`⚠️ Story "${storyData.title}" already exists, updating instead`);
								await this.updateExistingFollowedStory(storyData, authorProfile, storyId);
							}
						} else {
							console.log(
								`🔒 Skipped private story "${storyData.title}" from ${authorProfile.displayName}`
							);
						}
						break;

					case 'modified':
						// For modified stories, preserve user's assigned categories
						console.log(
							`🔄 MODIFIED story detected: "${storyData.title}" (public: ${storyData.isPublic})`
						);

						if (storyData.isPublic) {
							await this.updateExistingFollowedStory(storyData, authorProfile, storyId);
							console.log(
								`✅ Updated story "${storyData.title}" from ${authorProfile.displayName}`
							);
						} else {
							// Story became private, remove from our cache
							await this.removeFollowedStoryFromFirestore(authorProfile.id, storyId);
							console.log(
								`🔒 Removed private story "${storyData.title}" from ${authorProfile.displayName}`
							);
						}
						break;

					case 'removed':
						await this.removeFollowedStoryFromFirestore(authorProfile.id, storyId);
						console.log(`🗑️ Removed deleted story from ${authorProfile.displayName}`);
						break;
				}
			}

			// Trigger UI update after processing all changes
			if (changes.length > 0) {
				this.triggerChange();
				console.log(
					`✅ Processed ${changes.length} story changes from ${authorProfile.displayName}`
				);
			}
		} catch (error) {
			console.error('Error handling followed stories snapshot:', error);
		}
	}

	/**
	 * Sync story to Firestore with enhanced error handling
	 */
	private async syncStoryToFirestore(story: Story, retryCount = 0): Promise<void> {
		if (!this.currentUser || !this.isOnline) {
			console.warn(`Cannot sync story ${story.title}: user not authenticated or offline`);
			// Mark story for upload when back online
			(story as any).pendingUpload = true;
			return;
		}

		const MAX_RETRIES = 3;
		const RETRY_DELAY = 1000; // 1 second

		try {
			const userId = this.currentUser.uid;
			console.log(`📤 Syncing story "${story.title}" to Firestore (attempt ${retryCount + 1})`);

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

			console.log(`✅ Successfully synced story "${story.title}" to Firestore`);
			// Clear pending upload flag on success
			delete (story as any).pendingUpload;
		} catch (error: any) {
			console.error(
				`❌ Failed to sync story "${story.title}" to Firestore (attempt ${retryCount + 1}):`,
				error
			);

			// Mark for retry even on error
			(story as any).pendingUpload = true;

			// Retry logic for transient errors
			if (retryCount < MAX_RETRIES && this.shouldRetry(error)) {
				console.log(`⏳ Retrying sync in ${RETRY_DELAY}ms...`);
				setTimeout(() => {
					this.syncStoryToFirestore(story, retryCount + 1);
				}, RETRY_DELAY);
			} else {
				// Log final failure but keep pendingUpload flag for later retry
				console.error(
					`💥 Failed to sync story "${story.title}" after ${MAX_RETRIES} attempts:`,
					error.message
				);
				console.warn('Story will be retried when connection is restored.');
			}
		}
	}

	/**
	 * Delete category from Firestore
	 */
	private async deleteCategoryFromFirestore(categoryId: string): Promise<void> {
		if (!this.currentUser) return;

		try {
			const userId = this.currentUser.uid;
			const docRef = doc(db, 'users', userId, 'storyCategories', categoryId);
			await deleteDoc(docRef);
			console.log(`Successfully deleted category ${categoryId} from Firestore`);
		} catch (error) {
			console.error('Failed to delete category from Firestore:', error);
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

		// Mark for upload if offline
		if (!this.isOnline || !this.currentUser) {
			(story as any).pendingUpload = true;
			console.log(`⚠️ Story "${story.title}" created offline - marked for upload`);
		}

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

		// Firestore handles sync automatically
		if (this.currentUser) {
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

		// Mark for upload if offline
		if (!this.isOnline || !this.currentUser) {
			(category as any).pendingUpload = true;
			console.log(`⚠️ Category "${category.name}" created offline - marked for upload`);
		}

		await new Promise<void>((resolve, reject) => {
			const request = store.put(category);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerChange();

		// Firestore handles sync automatically
		if (this.currentUser) {
			this.syncCategoryToFirestore(category);
		}

		return category;
	}

	/**
	 * Check if a category is used by any stories (both user stories and followed stories)
	 */
	async isCategoryInUse(
		categoryId: string
	): Promise<{ inUse: boolean; storyCount: number; storyTitles: string[] }> {
		await this.ensureInitialized();
		if (!this.db) return { inUse: false, storyCount: 0, storyTitles: [] };

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction(
			[this.STORIES_STORE_NAME, this.FOLLOWED_STORIES_STORE_NAME],
			'readonly'
		);
		const storiesStore = transaction.objectStore(this.STORIES_STORE_NAME);
		const followedStoriesStore = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);

		// Check user stories
		const userStoriesCheck = await new Promise<{ count: number; titles: string[] }>(
			(resolve, reject) => {
				const storiesUsingCategory: { count: number; titles: string[] } = { count: 0, titles: [] };
				const index = storiesStore.index(this.INDEX_USER_ID);
				const request = index.openCursor(IDBKeyRange.only(userId));

				request.onsuccess = (event) => {
					const cursor = (event.target as IDBRequest).result;
					if (cursor) {
						const story = cursor.value as Story;
						if (story.categories && story.categories.includes(categoryId)) {
							storiesUsingCategory.count++;
							storiesUsingCategory.titles.push(`"${story.title}" (your story)`);
						}
						cursor.continue();
					} else {
						resolve(storiesUsingCategory);
					}
				};

				request.onerror = () => reject(request.error);
			}
		);

		// Check followed stories
		const followedStoriesCheck = await new Promise<{ count: number; titles: string[] }>(
			(resolve, reject) => {
				const storiesUsingCategory: { count: number; titles: string[] } = { count: 0, titles: [] };
				const index = followedStoriesStore.index('viewerUserId');
				const request = index.openCursor(IDBKeyRange.only(userId));

				request.onsuccess = (event) => {
					const cursor = (event.target as IDBRequest).result;
					if (cursor) {
						const story = cursor.value as Story & { authorName: string };
						if (story.categories && story.categories.includes(categoryId)) {
							storiesUsingCategory.count++;
							storiesUsingCategory.titles.push(`"${story.title}" by ${story.authorName}`);
						}
						cursor.continue();
					} else {
						resolve(storiesUsingCategory);
					}
				};

				request.onerror = () => reject(request.error);
			}
		);

		// Combine results
		const totalCount = userStoriesCheck.count + followedStoriesCheck.count;
		const allTitles = [...userStoriesCheck.titles, ...followedStoriesCheck.titles];

		return {
			inUse: totalCount > 0,
			storyCount: totalCount,
			storyTitles: allTitles
		};
	}

	/**
	 * Delete a story category
	 */
	async deleteCategory(categoryId: string): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const userId = this.getCurrentUserId();

		// Check if category is in use by any stories
		const usageCheck = await this.isCategoryInUse(categoryId);
		if (usageCheck.inUse) {
			const storyList =
				usageCheck.storyTitles.length <= 5
					? usageCheck.storyTitles.join(', ')
					: `${usageCheck.storyTitles.slice(0, 5).join(', ')} and ${usageCheck.storyCount - 5} more`;

			throw new Error(
				`Cannot delete category "${categoryId}" because it is used by ${usageCheck.storyCount} ${usageCheck.storyCount === 1 ? 'story' : 'stories'}: ${storyList}. Please remove this category from all stories before deleting it.`
			);
		}

		const transaction = this.db.transaction([this.CATEGORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.CATEGORIES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.delete([userId, categoryId]); // Use compound key
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerChange();

		// Firestore handles sync automatically
		if (this.currentUser) {
			this.deleteCategoryFromFirestore(categoryId);
		}
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
		followedStoriesListeners: number;
		followedUsers: string[];
		cachedFollowedStories: number;
	} {
		return {
			userId: this.getCurrentUserId(),
			initialized: this.isInitialized,
			stats: this._stats,
			hasDatabase: !!this.db,
			followedStoriesListeners: this.followedStoriesUnsubscribes.size,
			followedUsers: Array.from(this.followedStoriesUnsubscribes.keys()),
			cachedFollowedStories: 0 // Will be updated by async call if needed
		};
	}

	/**
	 * Get detailed debug information (async version)
	 */
	async getDetailedDebugInfo(): Promise<{
		userId: string;
		initialized: boolean;
		stats: any;
		hasDatabase: boolean;
		followedStoriesListeners: number;
		followedUsers: string[];
		cachedFollowedStories: number;
		followedStoriesByAuthor: Record<string, number>;
		userStoreFollowing: number;
	}> {
		const basicInfo = this.getDebugInfo();

		// Get cached followed stories count
		let cachedFollowedStories = 0;
		const followedStoriesByAuthor: Record<string, number> = {};

		try {
			if (this.db && this.currentUser) {
				const allFollowedStories = await this.getAllFollowedStoriesFromIndexedDB();
				cachedFollowedStories = allFollowedStories.length;

				// Count by author
				allFollowedStories.forEach((story) => {
					const authorId = (story as any).authorUserId;
					if (authorId) {
						followedStoriesByAuthor[authorId] = (followedStoriesByAuthor[authorId] || 0) + 1;
					}
				});
			}
		} catch (error) {
			console.error('Error getting cached followed stories count:', error);
		}

		return {
			...basicInfo,
			cachedFollowedStories,
			followedStoriesByAuthor,
			userStoreFollowing: userStore.following.length
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
	 * Force upload of all pending local changes (called when coming back online)
	 */
	async uploadPendingLocalChanges(): Promise<void> {
		if (!this.currentUser || !this.isOnline) {
			console.warn('Cannot upload pending changes: user not authenticated or offline');
			return;
		}

		console.log('🔄 Force uploading all pending local changes...');
		this.isSyncing = true;

		try {
			// Get all local stories and force upload any that have been modified
			const localStories = await this.exportStories();
			let uploadedCount = 0;

			for (const story of localStories) {
				// Check if story needs to be uploaded
				// Upload if: never synced, or modified after last sync, or explicitly marked for upload
				const lastSyncTimestamp = story.lastSyncTimestamp || 0;
				const needsUpload =
					lastSyncTimestamp === 0 ||
					story.dateModified > lastSyncTimestamp ||
					(story as any).pendingUpload;

				if (needsUpload) {
					console.log(`📤 Force uploading story: ${story.title}`);
					try {
						await this.syncStoryToFirestore(story);
						uploadedCount++;
						// Clear pending upload flag
						delete (story as any).pendingUpload;
					} catch (error) {
						console.error(`Failed to upload story ${story.title}:`, error);
						// Mark for retry
						(story as any).pendingUpload = true;
					}
				}
			}

			console.log(`✅ Force uploaded ${uploadedCount}/${localStories.length} stories`);

			// Upload local categories
			const localCategories = await this.getAllCategories();
			for (const category of localCategories) {
				const lastSyncTimestamp = (category as any).lastSyncTimestamp || 0;
				if (lastSyncTimestamp === 0 && !isDefaultCategory(category.id)) {
					try {
						await this.syncCategoryToFirestore(category);
					} catch (error) {
						console.error(`Failed to upload category ${category.name}:`, error);
					}
				}
			}

			this.lastSyncTimestamp = Date.now();
			await this.updateSyncMetadata();
			console.log('✅ Completed force upload of pending local changes');
		} catch (error) {
			console.error('❌ Failed to upload pending local changes:', error);
		} finally {
			this.isSyncing = false;
		}
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

		// Mark for upload if offline
		if (!this.isOnline || !this.currentUser) {
			(updatedStory as any).pendingUpload = true;
			console.log(`⚠️ Story "${updatedStory.title}" updated offline - marked for upload`);
		}

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

		// Firestore handles sync automatically
		if (this.currentUser) {
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

		// Firestore handles sync automatically
		if (this.currentUser) {
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

		// Firestore handles sync automatically
		if (this.currentUser) {
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
		type: 'stories' | 'categories' | 'followedStories' = 'stories'
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
						} else if (type === 'categories') {
							await this.handleRemoteCategoryChange(firestoreData, docId);
						} else if (type === 'followedStories') {
							await this.handleRemoteFollowedStoryChange(firestoreData, docId);
						}
						break;
					case 'removed':
						if (type === 'stories') {
							await this.handleRemoteStoryDeletion(docId);
						} else if (type === 'categories') {
							await this.handleRemoteCategoryDeletion(docId);
						} else if (type === 'followedStories') {
							await this.handleRemoteFollowedStoryDeletion(docId);
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
	 * Handle remote followed story changes from Firestore
	 * Store them in the separate followedStories IndexedDB store (not mixed with user stories)
	 */
	private async handleRemoteFollowedStoryChange(
		remoteData: any,
		firestoreId: string
	): Promise<void> {
		if (!remoteData.id) return;

		// Store followed story in the separate followedStories IndexedDB store
		const followedStory: Story = {
			...remoteData,
			firestoreId,
			lastSyncTimestamp: Date.now()
		};

		// Store in the separate FOLLOWED_STORIES IndexedDB store
		await this.storeFollowedStoryInIndexedDB(followedStory);
		console.log(
			`✅ Synced followed story from Firestore to followedStories IndexedDB: ${followedStory.title}`
		);
	}

	/**
	 * Handle remote followed story deletion
	 */
	private async handleRemoteFollowedStoryDeletion(firestoreId: string): Promise<void> {
		// Find and delete the followed story from the separate followedStories IndexedDB store
		if (!this.db || !this.currentUser) return;

		try {
			// Get all followed stories and find the one with matching firestoreId
			const allFollowedStories = await this.getAllFollowedStoriesFromIndexedDB();
			const storyToDelete = allFollowedStories.find((s) => (s as any).firestoreId === firestoreId);

			if (storyToDelete) {
				// Extract authorUserId from the story ID
				const parts = storyToDelete.id.split('_');
				if (parts.length >= 2) {
					const authorUserId = parts[0];

					// Delete from followedStories IndexedDB store
					const transaction = this.db.transaction([this.FOLLOWED_STORIES_STORE_NAME], 'readwrite');
					const store = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);

					await new Promise<void>((resolve, reject) => {
						const request = store.delete([this.currentUser!.uid, authorUserId, storyToDelete.id]);
						request.onsuccess = () => resolve();
						request.onerror = () => reject(request.error);
					});

					this.triggerChange();
					console.log(
						`✅ Deleted followed story from followedStories IndexedDB: ${storyToDelete.title}`
					);
				}
			}
		} catch (error) {
			console.error('Error deleting followed story from IndexedDB:', error);
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
	 * Create enhanced followed story with author metadata
	 */
	private createEnhancedFollowedStory(
		storyData: any,
		authorProfile: any,
		categories: string[] = []
	): Story & {
		authorName: string;
		authorUsername: string;
		authorAvatarUrl?: string;
		readOnly: boolean;
		authorUserId: string;
		viewerUserId: string;
	} {
		return {
			...storyData,
			categories: [...categories],
			authorName: authorProfile.displayName,
			authorUsername: authorProfile.username,
			authorAvatarUrl: authorProfile.avatarUrl,
			readOnly: true,
			authorUserId: authorProfile.id,
			viewerUserId: this.currentUser!.uid
		} as any;
	}

	/**
	 * Store followed story in separate followedStories IndexedDB store (not mixed with user stories)
	 * Also store in Firestore for cross-device sync
	 * FIXED: Proper ID handling to avoid confusion
	 */
	private async storeFollowedStoryInFirestore(story: any): Promise<void> {
		if (!this.currentUser) return;

		try {
			const userId = this.currentUser.uid;

			// IMPORTANT: Use originalStoryId or the story's original ID
			const originalStoryId = story.originalStoryId || story.id;
			const authorUserId = story.authorUserId;
			const followedStoryId = `${authorUserId}_${originalStoryId}`;

			console.log(`💾 Storing followed story with IDs:`, {
				authorUserId,
				originalStoryId,
				followedStoryId,
				storyTitle: story.title
			});

			// DUPLICATE PREVENTION: Check if this followed story already exists in the FOLLOWED store
			const existingStory = await this.getFollowedStoryById(followedStoryId);
			if (existingStory) {
				console.log(`⚠️ Followed story already exists, skipping duplicate: ${followedStoryId}`);
				return; // Don't store duplicates
			}

			// Create followed story document with correct IDs
			const followedStoryData = {
				...story,
				id: followedStoryId, // New prefixed ID for followed story
				originalStoryId: originalStoryId, // Keep reference to original
				userId: userId, // This story now "belongs" to current user for Firestore queries
				isFollowedStory: true, // Flag to distinguish from own stories
				lastSyncTimestamp: Date.now()
			};

			// Step 1: Store in FOLLOWED_STORIES IndexedDB store (separate from user stories)
			await this.storeFollowedStoryInIndexedDB(followedStoryData);
			console.log(`✅ Stored followed story in followedStories IndexedDB: ${followedStoryId}`);

			// Step 2: Store in Firestore (for cross-device sync)
			if (this.isOnline) {
				const docRef = doc(db, 'users', userId, 'followedStories', followedStoryId);
				await setDoc(docRef, this.cleanForFirestore(followedStoryData), { merge: true });
				console.log(`📤 Stored followed story in Firestore: ${followedStoryId}`);
			}
		} catch (error) {
			console.error('Failed to store followed story:', error);
		}
	}

	/**
	 * Store followed story in the separate followedStories IndexedDB store
	 * Debug version with better logging
	 */
	private async storeFollowedStoryInIndexedDB(story: any): Promise<void> {
		if (!this.db || !this.currentUser) {
			console.error('Cannot store followed story: no db or current user');
			return;
		}

		// Parse the story ID to get authorUserId (e.g., "userB_story123" -> "userB")
		const parts = story.id.split('_');
		if (parts.length < 2) {
			console.error('Invalid followed story ID format for storage:', story.id);
			return;
		}
		const authorUserId = parts[0];

		const transaction = this.db.transaction([this.FOLLOWED_STORIES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);

		// Use compound key structure that matches the store definition
		const storyWithCompoundKey = {
			...story,
			viewerUserId: this.currentUser.uid, // First part of compound key
			authorUserId: authorUserId, // Second part of compound key
			id: story.id // Third part of compound key (the full prefixed ID)
		};

		console.log('💾 Storing followed story with compound key:', {
			viewerUserId: storyWithCompoundKey.viewerUserId,
			authorUserId: storyWithCompoundKey.authorUserId,
			id: storyWithCompoundKey.id,
			title: storyWithCompoundKey.title
		});

		await new Promise<void>((resolve, reject) => {
			const cleanStory = JSON.parse(JSON.stringify(storyWithCompoundKey));
			const request = store.put(cleanStory);
			request.onsuccess = () => {
				console.log('✅ Successfully stored followed story in IndexedDB');
				resolve();
			};
			request.onerror = () => {
				console.error('Failed to store followed story in IndexedDB:', request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * Get followed story by ID from the separate followedStories IndexedDB store
	 * Debug version with better logging
	 */
	private async getFollowedStoryById(followedStoryId: string): Promise<Story | null> {
		if (!this.db || !this.currentUser) {
			console.error('Cannot get followed story: no db or current user');
			return null;
		}

		// Parse the followedStoryId to get authorUserId (e.g., "userB_story123" -> "userB")
		const parts = followedStoryId.split('_');
		if (parts.length < 2) {
			console.error('Invalid followed story ID format:', followedStoryId);
			return null;
		}
		const authorUserId = parts[0];
		console.log(
			`🔍 Looking for followed story: viewerId=${this.currentUser.uid}, authorId=${authorUserId}, storyId=${followedStoryId}`
		);

		const transaction = this.db.transaction([this.FOLLOWED_STORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);

		return new Promise((resolve, reject) => {
			// Use compound key: viewerUserId + authorUserId + followedStoryId
			const compoundKey = [this.currentUser!.uid, authorUserId, followedStoryId];
			console.log('🔑 Using compound key:', compoundKey);

			const request = store.get(compoundKey);
			request.onsuccess = () => {
				const result = request.result;
				console.log('🔍 Get result:', result ? 'FOUND' : 'NOT FOUND');
				resolve(result || null);
			};
			request.onerror = () => {
				console.error('Error getting followed story:', request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * Get followed stories from the separate followedStories IndexedDB store
	 * Debug version with better logging
	 */
	private async getAllFollowedStoriesFromIndexedDB(): Promise<Story[]> {
		if (!this.db || !this.currentUser) {
			console.error('Cannot get followed stories: no db or current user');
			return [];
		}

		const currentUserId = this.currentUser.uid;
		console.log(`📁 Getting all followed stories for viewerId: ${currentUserId}`);

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
					const story = cursor.value;
					console.log(
						`📚 Found followed story: ${story.id} (${story.title}) by ${story.authorName}`
					);
					stories.push(story);
					cursor.continue();
				} else {
					console.log(`📁 Total followed stories found: ${stories.length}`);
					// Sort by date modified (newest first)
					resolve(stories.sort((a, b) => b.dateModified - a.dateModified));
				}
			};

			request.onerror = () => {
				console.error('Error getting followed stories:', request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * Get followed stories for a specific author from the followedStories IndexedDB store
	 */
	private async getFollowedStoriesForAuthor(authorUserId: string): Promise<Story[]> {
		if (!this.db || !this.currentUser) {
			console.error('Cannot get followed stories for author: no db or current user');
			return [];
		}

		const currentUserId = this.currentUser.uid;
		console.log(`🔍 Getting followed stories for author: ${authorUserId}`);

		const transaction = this.db.transaction([this.FOLLOWED_STORIES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);
		const index = store.index('authorUserId');

		return new Promise((resolve, reject) => {
			const stories: Story[] = [];
			// Get stories by this author that the current user follows
			const request = index.openCursor(IDBKeyRange.only(authorUserId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const story = cursor.value;
					// Only include stories for the current viewer
					if (story.viewerUserId === currentUserId) {
						console.log(`📚 Found cached story by ${authorUserId}: ${story.title}`);
						stories.push(story);
					}
					cursor.continue();
				} else {
					console.log(`🔍 Found ${stories.length} cached stories for author: ${authorUserId}`);
					// Sort by date modified (newest first)
					resolve(stories.sort((a, b) => b.dateModified - a.dateModified));
				}
			};

			request.onerror = () => {
				console.error('Error getting followed stories for author:', request.error);
				reject(request.error);
			};
		});
	}
	/**
	 * Update existing followed story while preserving user's assigned categories
	 */
	private async updateExistingFollowedStory(
		storyData: any,
		authorProfile: any,
		originalStoryId: string
	): Promise<void> {
		if (!this.currentUser) return;

		try {
			const userId = this.currentUser.uid;
			const followedStoryId = `${authorProfile.id}_${originalStoryId}`;

			console.log(`🔄 Updating followed story: ${followedStoryId} (original: ${originalStoryId})`);

			// Get existing story to preserve user's categories
			const existingStory = await this.getFollowedStoryById(followedStoryId);
			if (!existingStory) {
				console.log(`⚠️ Followed story not found for update, creating new: ${followedStoryId}`);
				// If it doesn't exist, create it with empty categories
				const enhancedStory = this.createEnhancedFollowedStory(storyData, authorProfile, []);
				enhancedStory.id = followedStoryId;
				enhancedStory.originalStoryId = originalStoryId;
				await this.storeFollowedStoryInFirestore(enhancedStory);
				return;
			}

			console.log(
				`📚 Preserving user categories for "${storyData.title}":`,
				existingStory.categories
			);

			// Create updated story with preserved categories and all current content
			const updatedStory = {
				...storyData, // Start with all new story data
				// Override with preserved user settings
				id: followedStoryId,
				originalStoryId: originalStoryId,
				userId: userId,
				categories: existingStory.categories || [], // PRESERVE user's categories
				isFollowedStory: true,
				readOnly: true,
				// Author metadata
				authorName: authorProfile.displayName,
				authorUsername: authorProfile.username,
				authorAvatarUrl: authorProfile.avatarUrl,
				authorUserId: authorProfile.id,
				viewerUserId: userId,
				lastSyncTimestamp: Date.now()
			};

			// Update in IndexedDB first
			await this.storeFollowedStoryInIndexedDB(updatedStory);
			console.log(`✅ Updated followed story in IndexedDB: ${storyData.title}`);

			// Update in Firestore (full story sync but with preserved categories)
			if (this.isOnline) {
				try {
					const docRef = doc(db, 'users', userId, 'followedStories', followedStoryId);
					// Use setDoc with merge to ensure all fields are updated properly
					await setDoc(docRef, this.cleanForFirestore(updatedStory), { merge: true });
					console.log(
						`📤 Updated followed story in Firestore with preserved categories: ${storyData.title}`
					);
				} catch (firestoreError) {
					console.warn(
						'Failed to update in Firestore but IndexedDB update succeeded:',
						firestoreError
					);
				}
			}

			// Trigger UI update
			this.triggerChange();
		} catch (error) {
			console.error('Failed to update existing followed story:', error);
		}
	}
	private async removeFollowedStoryFromFirestore(
		authorUserId: string,
		storyId: string
	): Promise<void> {
		if (!this.currentUser) return;

		try {
			const userId = this.currentUser.uid;
			const followedStoryId = `${authorUserId}_${storyId}`;

			// Step 1: Remove from followedStories IndexedDB store (separate from user stories)
			if (this.db) {
				const transaction = this.db.transaction([this.FOLLOWED_STORIES_STORE_NAME], 'readwrite');
				const store = transaction.objectStore(this.FOLLOWED_STORIES_STORE_NAME);

				await new Promise<void>((resolve, reject) => {
					// Use compound key: viewerUserId + authorUserId + followedStoryId
					const request = store.delete([userId, authorUserId, followedStoryId]);
					request.onsuccess = () => resolve();
					request.onerror = () => reject(request.error);
				});

				this.triggerChange();
				console.log(`✅ Removed followed story from followedStories IndexedDB: ${followedStoryId}`);
			}

			// Step 2: Remove from Firestore
			if (this.isOnline) {
				const docRef = doc(db, 'users', userId, 'followedStories', followedStoryId);
				await deleteDoc(docRef);
				console.log(`🗑️ Removed followed story from Firestore: ${followedStoryId}`);
			}
		} catch (error) {
			console.error('Failed to remove followed story:', error);
		}
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

		console.log('📤 Uploading local stories changes to Firestore...');
		const localStories = await this.exportStories();
		let uploadedCount = 0;

		for (const story of localStories) {
			const lastSyncTimestamp = story.lastSyncTimestamp || 0;

			// Upload if never synced or modified since last sync
			if (lastSyncTimestamp === 0 || story.dateModified > lastSyncTimestamp) {
				console.log(
					`📤 Uploading story: ${story.title} (modified: ${new Date(story.dateModified)}, lastSync: ${new Date(lastSyncTimestamp)})`
				);
				await this.syncStoryToFirestore(story);
				uploadedCount++;
			}
		}

		console.log(`📤 Uploaded ${uploadedCount}/${localStories.length} stories to Firestore`);

		// Upload local categories (if any custom ones)
		const localCategories = await this.getAllCategories();
		let uploadedCategoriesCount = 0;

		for (const category of localCategories) {
			const lastSyncTimestamp = (category as any).lastSyncTimestamp || 0;

			// Upload if never synced or is a custom category
			if (lastSyncTimestamp === 0 && !isDefaultCategory(category.id)) {
				console.log(`📤 Uploading category: ${category.name}`);
				await this.syncCategoryToFirestore(category);
				uploadedCategoriesCount++;
			}
		}

		console.log(`📤 Uploaded ${uploadedCategoriesCount} categories to Firestore`);
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
	 * Get public stories from users that the current user follows
	 * These are now stored in the separate followedStories IndexedDB store
	 */
	async getStoriesFromFollowedUsers(limit = 20): Promise<Story[]> {
		if (!this.currentUser) {
			console.warn('No user logged in, cannot fetch followed stories');
			return [];
		}

		try {
			console.log('📦 Reading followed stories from separate followedStories IndexedDB store...');

			// Get followed stories from the separate IndexedDB store
			const followedStories = await this.getAllFollowedStoriesFromIndexedDB();

			// Apply limit
			const limitedStories = followedStories.slice(0, limit);

			console.log(
				`✅ Returning ${limitedStories.length} followed stories from separate IndexedDB store (from ${followedStories.length} total)`
			);
			return limitedStories;
		} catch (error) {
			console.error('Error reading followed stories from separate IndexedDB store:', error);
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
	 * Sync stories for a specific newly followed user (public method)
	 * Call this immediately when a user is followed
	 */
	async syncNewFollowedUser(followedUserId: string): Promise<void> {
		if (!this.currentUser || !this.isOnline) {
			console.log('Cannot sync new followed user: user not authenticated or offline');
			return;
		}

		try {
			console.log(`🆕 Syncing stories for newly followed user: ${followedUserId}`);

			// Get the user profile from UserStore following list or fetch directly
			let followedUser = userStore.following.find((user) => user.id === followedUserId);

			if (!followedUser) {
				// If not in following list yet, fetch the profile directly
				console.log('🔍 User not in following list yet, fetching profile directly...');
				// Use static import since userService is already imported
				const profile = await userService.getProfile(followedUserId);
				if (!profile) {
					console.error('Failed to get profile for newly followed user');
					return;
				}
				followedUser = profile;
			}

			console.log(`📖 Fetching stories for ${followedUser.displayName}...`);

			// Fetch and store existing stories for this specific user
			await this.fetchExistingStoriesForUser(followedUser);

			// Set up real-time listener for this user
			const followedStoriesQuery = query(
				collection(db, 'users', followedUser.id, 'stories'),
				where('isPublic', '==', true),
				orderBy('dateModified', 'desc')
			);

			const unsubscribe = onSnapshot(
				followedStoriesQuery,
				(snapshot) => {
					console.log(
						`🔄 Real-time update for ${followedUser.displayName}: ${snapshot.docChanges().length} changes`
					);
					this.handleFollowedStoriesSnapshot(snapshot, followedUser);
				},
				(error) => {
					console.error(`Followed stories sync error for ${followedUser.displayName}:`, error);
				}
			);

			// Store the unsubscribe function
			this.followedStoriesUnsubscribes.set(followedUser.id, unsubscribe);
			console.log(`✅ Setup complete for newly followed user: ${followedUser.displayName}`);

			// Trigger final UI update
			this.triggerChange();
		} catch (error) {
			console.error('Error syncing newly followed user:', error);
		}
	}

	/**
	 * Update category for a followed story in the separate followedStories IndexedDB store and Firestore
	 */
	async updateFollowedStoryCategory(
		authorUserId: string,
		storyId: string,
		categories: string[]
	): Promise<Story | null> {
		if (!this.currentUser) {
			console.error('Cannot update followed story category: user not authenticated');
			return null;
		}

		try {
			const userId = this.currentUser.uid;

			// Handle case where storyId might already be the prefixed followed story ID
			let followedStoryId = storyId;
			if (!storyId.startsWith(authorUserId + '_')) {
				// If not already prefixed, create the followed story ID
				followedStoryId = `${authorUserId}_${storyId}`;
			}

			console.log(
				`🔄 Updating followed story category: followedStoryId=${followedStoryId}, categories=${categories.join(', ')}`
			);

			// Step 1: Update in the separate followedStories IndexedDB store
			const existingStory = await this.getFollowedStoryById(followedStoryId);
			if (!existingStory) {
				console.error(
					`❌ Followed story not found in followedStories IndexedDB store: ${followedStoryId}`
				);
				return null;
			}

			// Update the story with new categories
			const updatedStory = {
				...existingStory,
				categories: [...categories],
				dateModified: Date.now(),
				lastSyncTimestamp: Date.now()
			};

			// Store in the separate followedStories IndexedDB store
			await this.storeFollowedStoryInIndexedDB(updatedStory);
			this.triggerChange();
			console.log(
				`✅ Updated followed story categories in followedStories IndexedDB: ${updatedStory.title}`
			);

			// Step 2: Update in Firestore (for cross-device sync)
			if (this.isOnline) {
				try {
					const docRef = doc(db, 'users', userId, 'followedStories', followedStoryId);
					await updateDoc(docRef, {
						categories: categories,
						dateModified: Date.now()
					});
					console.log(`📤 Updated followed story categories in Firestore: ${updatedStory.title}`);
				} catch (firestoreError) {
					console.warn(
						'Failed to update followed story in Firestore, but IndexedDB update succeeded:',
						firestoreError
					);
					// Continue - IndexedDB update succeeded
				}
			}

			return updatedStory;
		} catch (error) {
			console.error('Error updating followed story category:', error);
			throw error;
		}
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

			const story = {
				...storyData,
				id: storyData.id || 'temp-' + Date.now(),
				userId: storyData.userId || 'unknown',
				title: storyData.title || 'Untitled',
				content: storyData.content || [],
				dateCreated: storyData.dateCreated || Date.now(),
				dateModified: storyData.dateModified || Date.now(),
				isPublic: storyData.isPublic || false,
				currentVersion: storyData.currentVersion || 1,
				searchText: storyData.searchText || '',
				categories: [], // Clear categories for followed stories
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
