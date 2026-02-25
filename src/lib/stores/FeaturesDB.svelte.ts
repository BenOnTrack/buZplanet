import { browser } from '$app/environment';
import { authState } from '$lib/stores/auth.svelte';
import { db } from '$lib/firebase';
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
	orderBy,
	limit as firestoreLimit,
	type DocumentData,
	type QuerySnapshot,
	type Unsubscribe
} from 'firebase/firestore';

/**
 * Features Database management class using Svelte 5 runes
 * Handles persistent storage of map features with efficient search capabilities
 * Optimized for quick querying across all searchable fields
 */
class FeaturesDB {
	// Storage configuration - now with Firestore sync
	private readonly DB_NAME = 'FeaturesDB';
	private readonly DB_VERSION = 4; // Incremented for sync capabilities
	private readonly FEATURES_STORE_NAME = 'userFeatures';
	private readonly LISTS_STORE_NAME = 'userBookmarkLists';
	private readonly SYNC_STORE_NAME = 'syncMetadata';
	private readonly STORE_NAME = 'userFeatures'; // Alias for backward compatibility
	private readonly INDEX_USER_ID = 'userId';
	private readonly INDEX_SEARCH = 'searchText';
	private readonly INDEX_BOOKMARKED = 'bookmarked';
	private readonly INDEX_VISITED = 'visitedDates';
	private readonly INDEX_TODO = 'todo';
	private readonly INDEX_CLASS = 'class';
	private readonly INDEX_CATEGORY = 'category';
	private readonly INDEX_SOURCE = 'source';
	private readonly INDEX_LIST_IDS = 'listIds';
	private readonly INDEX_LAST_SYNC = 'lastSync';

	private db: IDBDatabase | null = null;
	private isInitialized = $state(false);
	private initPromise: Promise<void> | null = null;
	private currentUser: User | null = null;

	// Firestore sync state
	private firestoreUnsubscribe: Unsubscribe | null = null;
	private isSyncing = $state(false);
	private isOnline = $state(navigator?.onLine ?? true);
	private syncConflicts = $state<SyncConflict[]>([]);
	private lastSyncTimestamp = $state<number>(0);

	// Reactive state for features count and stats
	private _stats = $state({
		total: 0,
		bookmarked: 0,
		visited: 0, // Features that have at least one visit
		todo: 0,
		lists: 0 // Total number of bookmark lists
	});

	// Reactive trigger for bookmark changes - increment when bookmarks change
	private _bookmarksVersion = $state(0);

	constructor() {
		if (browser) {
			// Listen to online/offline events
			window.addEventListener('online', async () => {
				this.isOnline = true;
				console.log('🌐 FeaturesDB: Connection restored - starting sync');
				if (this.currentUser) {
					this.startFirestoreSync();
					// IMPORTANT: Force upload of local changes when coming back online
					await this.uploadPendingLocalChanges();
				}
			});

			window.addEventListener('offline', () => {
				this.isOnline = false;
				console.log('📴 FeaturesDB: Connection lost - sync paused');
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
			this.isInitialized = false;
			this.initPromise = null;

			// Reset stats when user changes
			this._stats = { total: 0, bookmarked: 0, visited: 0, todo: 0, lists: 0 };
			this._bookmarksVersion++;
			this.syncConflicts = [];
			this.lastSyncTimestamp = 0;

			await this.initializeDatabase();

			// Firestore handles offline sync automatically

			// Start sync for new authenticated user
			if (newUser && this.isOnline) {
				this.startFirestoreSync();
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

	// Reactive trigger for bookmark changes
	get bookmarksVersion(): number {
		return this._bookmarksVersion;
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
	 * Trigger bookmark reactivity - call whenever bookmarks change
	 */
	private triggerBookmarkChange(): void {
		this._bookmarksVersion++;
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
			console.warn('IndexedDB not available for FeaturesDB');
			this.isInitialized = true;
			return;
		}

		try {
			this.db = await this.openDatabase();
			await this.updateStats();
			this.isInitialized = true;
		} catch (error) {
			console.error('Failed to initialize FeaturesDB:', error);
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

				// Clean slate for sync-enabled storage - remove old stores
				if (oldVersion < 4) {
					if (db.objectStoreNames.contains('features')) {
						db.deleteObjectStore('features');
					}
					if (db.objectStoreNames.contains('bookmarkLists')) {
						db.deleteObjectStore('bookmarkLists');
					}
					if (db.objectStoreNames.contains('userFeatures')) {
						db.deleteObjectStore('userFeatures');
					}
					if (db.objectStoreNames.contains('userBookmarkLists')) {
						db.deleteObjectStore('userBookmarkLists');
					}
				}

				// Create user features object store
				let featuresStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.FEATURES_STORE_NAME)) {
					featuresStore = db.createObjectStore(this.FEATURES_STORE_NAME, {
						keyPath: ['userId', 'id'] // Compound key: userId + featureId
					});
				} else {
					featuresStore = request.transaction!.objectStore(this.FEATURES_STORE_NAME);
				}

				// Create user bookmark lists object store
				let listsStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.LISTS_STORE_NAME)) {
					listsStore = db.createObjectStore(this.LISTS_STORE_NAME, {
						keyPath: ['userId', 'id'] // Compound key: userId + listId
					});
				} else {
					listsStore = request.transaction!.objectStore(this.LISTS_STORE_NAME);
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

				// Create indexes for features store
				const featureIndexesToCreate = [
					{ name: this.INDEX_USER_ID, keyPath: 'userId', options: { unique: false } },
					{ name: this.INDEX_SEARCH, keyPath: 'searchText', options: { unique: false } },
					{ name: this.INDEX_BOOKMARKED, keyPath: 'bookmarked', options: { unique: false } },
					{
						name: this.INDEX_VISITED,
						keyPath: 'visitedDates',
						options: { unique: false, multiEntry: true }
					},
					{ name: this.INDEX_TODO, keyPath: 'todo', options: { unique: false } },
					{ name: this.INDEX_CLASS, keyPath: 'class', options: { unique: false } },
					{ name: this.INDEX_CATEGORY, keyPath: 'category', options: { unique: false } },
					{ name: this.INDEX_SOURCE, keyPath: 'source', options: { unique: false } },
					{
						name: this.INDEX_LIST_IDS,
						keyPath: 'listIds',
						options: { unique: false, multiEntry: true }
					},
					{ name: this.INDEX_LAST_SYNC, keyPath: 'lastSyncTimestamp', options: { unique: false } }
				];

				featureIndexesToCreate.forEach(({ name, keyPath, options }) => {
					if (!featuresStore.indexNames.contains(name)) {
						featuresStore.createIndex(name, keyPath, options);
					}
				});

				// Create indexes for lists store
				const listsIndexesToCreate = [
					{ name: this.INDEX_USER_ID, keyPath: 'userId', options: { unique: false } },
					{ name: this.INDEX_LAST_SYNC, keyPath: 'lastSyncTimestamp', options: { unique: false } }
				];

				listsIndexesToCreate.forEach(({ name, keyPath, options }) => {
					if (!listsStore.indexNames.contains(name)) {
						listsStore.createIndex(name, keyPath, options);
					}
				});
			};
		});
	}

	/**
	 * Generate searchable text from feature properties
	 */
	private generateSearchText(feature: {
		class?: string;
		subclass?: string;
		category?: string;
		names: FeatureNames;
		source: string;
		sourceLayer?: string;
	}): string {
		const searchParts: string[] = [];

		// Add classification data
		if (feature.class) searchParts.push(feature.class.toLowerCase());
		if (feature.subclass) searchParts.push(feature.subclass.toLowerCase());
		if (feature.category) searchParts.push(feature.category.toLowerCase());

		// Add all names
		Object.values(feature.names).forEach((name) => {
			if (name && name.trim()) {
				searchParts.push(name.toLowerCase());
			}
		});

		// Add source information
		searchParts.push(feature.source.toLowerCase());
		if (feature.sourceLayer) {
			searchParts.push(feature.sourceLayer.toLowerCase());
		}

		return searchParts.join(' ');
	}

	/**
	 * Get feature ID (features always have unique IDs)
	 */
	private getFeatureId(feature: any): string {
		if (feature.id !== undefined && feature.id !== null) {
			return String(feature.id);
		}

		// This should not happen according to your note, but keeping as fallback
		console.warn('Feature missing ID, generating fallback ID:', feature);
		return `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
	}

	/**
	 * Extract all name properties from feature
	 */
	private extractNames(properties: any): FeatureNames {
		const names: FeatureNames = {};

		if (!properties) return names;

		// Extract all properties that start with 'name'
		Object.keys(properties).forEach((key) => {
			if (key === 'name' || key.startsWith('name:')) {
				const value = properties[key];
				if (value && typeof value === 'string' && value.trim()) {
					names[key] = value.trim();
				}
			}
		});

		return names;
	}

	/**
	 * Store or update a feature for current user with Firestore sync
	 */
	async storeFeature(
		mapFeature: any,
		action: 'bookmark' | 'visited' | 'todo' = 'bookmark'
	): Promise<StoredFeature> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const userId = this.getCurrentUserId();
		const featureId = this.getFeatureId(mapFeature);
		const names = this.extractNames(mapFeature.properties);

		// Check if feature already exists for this user
		const existingFeature = await this.getFeatureById(featureId);
		const now = Date.now();

		// Calculate if feature will be bookmarked after this action
		const willBeBookmarked =
			existingFeature?.bookmarked || action === 'bookmark' || action === 'visited';

		// When marking as visited, set todo to false; otherwise preserve existing todo status
		let todoStatus: boolean;
		if (action === 'visited') {
			todoStatus = false; // Automatically set todo to false when visited
		} else if (action === 'todo' && willBeBookmarked) {
			todoStatus = true; // Set todo when explicitly requested and bookmarked
		} else {
			todoStatus = existingFeature?.todo || false; // Preserve existing todo status
		}

		const storedFeature: StoredFeature = {
			userId, // Add userId to stored feature
			id: featureId,
			class: mapFeature.properties?.class,
			subclass: mapFeature.properties?.subclass,
			category: mapFeature.properties?.category,
			names,
			geometry: mapFeature.geometry,
			source: mapFeature.source || 'unknown',
			sourceLayer: mapFeature.sourceLayer,
			layer: mapFeature.layer ? { id: mapFeature.layer.id } : undefined,

			// Update user actions based on existing state
			bookmarked: willBeBookmarked,
			listIds: existingFeature?.listIds || [],
			visitedDates:
				action === 'visited'
					? [...(existingFeature?.visitedDates || []), now]
					: existingFeature?.visitedDates || [],
			todo: todoStatus,

			dateCreated: existingFeature?.dateCreated || now,
			dateModified: now,
			lastSyncTimestamp: now, // Track for sync

			searchText: '' // Will be set below
		};

		// Generate searchable text
		storedFeature.searchText = this.generateSearchText(storedFeature);

		// Store in database with better error handling
		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);

		// Mark for upload if offline
		if (!this.isOnline || !this.currentUser) {
			(storedFeature as any).pendingUpload = true;
			console.log(`⚠️ Feature "${storedFeature.id}" stored offline - marked for upload`);
		}

		await new Promise<void>((resolve, reject) => {
			try {
				// Create a clean copy to ensure it can be cloned
				const cleanStoredFeature = JSON.parse(JSON.stringify(storedFeature));
				const request = store.put(cleanStoredFeature);
				request.onsuccess = () => resolve();
				request.onerror = () => {
					console.error('IndexedDB store.put failed:', request.error);
					console.error('Attempted to store feature:', cleanStoredFeature);
					reject(request.error);
				};
			} catch (jsonError) {
				console.error('Failed to serialize feature for storage:', jsonError);
				console.error('Original feature object:', storedFeature);
				console.error('Map feature input:', mapFeature);
				reject(new Error(`Feature serialization failed: ${jsonError}`));
			}
		});

		await this.updateStats();
		this.triggerBookmarkChange(); // Trigger reactivity

		// Firestore handles sync automatically
		if (this.currentUser) {
			this.syncFeatureToFirestore(storedFeature);
		}

		return storedFeature;
	}

	/**
	 * Toggle bookmark status of a feature
	 */
	async toggleBookmark(mapFeature: any): Promise<StoredFeature> {
		const featureId = this.getFeatureId(mapFeature);
		const existingFeature = await this.getFeatureById(featureId);

		if (existingFeature) {
			// Toggle bookmark status
			existingFeature.bookmarked = !existingFeature.bookmarked;
			existingFeature.dateModified = Date.now();
			return await this.updateFeature(existingFeature);
		} else {
			// Create new bookmarked feature
			return await this.storeFeature(mapFeature, 'bookmark');
		}
	}

	/**
	 * Add a visit date to a feature
	 */
	async addVisit(mapFeature: any, visitDate?: number): Promise<StoredFeature> {
		const featureId = this.getFeatureId(mapFeature);
		const existingFeature = await this.getFeatureById(featureId);
		const visitTimestamp = visitDate || Date.now();

		if (existingFeature) {
			// Only allow adding visits to bookmarked features
			if (!existingFeature.bookmarked) {
				throw new Error('Cannot add visit to unbookmarked feature');
			}

			// Always add new visit timestamp (allow duplicates)
			existingFeature.visitedDates.push(visitTimestamp);
			// Sort visits chronologically
			existingFeature.visitedDates.sort((a, b) => a - b);

			// When marking as visited, automatically set todo to false
			existingFeature.todo = false;

			return await this.updateFeature(existingFeature);
		} else {
			// Create new bookmarked feature with visit (must be bookmarked to have visits)
			return await this.storeFeature(mapFeature, 'visited');
		}
	}

	/**
	 * Remove a specific visit date from a feature
	 */
	async removeVisit(mapFeature: any, visitDate: number): Promise<StoredFeature | null> {
		const featureId = this.getFeatureId(mapFeature);
		const existingFeature = await this.getFeatureById(featureId);

		if (existingFeature) {
			existingFeature.visitedDates = existingFeature.visitedDates.filter(
				(date) => date !== visitDate
			);
			return await this.updateFeature(existingFeature);
		}
		return null;
	}

	/**
	 * Toggle the most recent visit (remove if exists, add if doesn't)
	 */
	async toggleVisit(mapFeature: any): Promise<StoredFeature> {
		const featureId = this.getFeatureId(mapFeature);
		const existingFeature = await this.getFeatureById(featureId);
		const today = new Date();
		today.setHours(0, 0, 0, 0); // Start of day
		const todayTimestamp = today.getTime();

		if (existingFeature && existingFeature.visitedDates.includes(todayTimestamp)) {
			// Remove today's visit
			existingFeature.visitedDates = existingFeature.visitedDates.filter(
				(date) => date !== todayTimestamp
			);
			return await this.updateFeature(existingFeature);
		} else {
			// Add today's visit
			return await this.addVisit(mapFeature, todayTimestamp);
		}
	}

	/**
	 * Toggle todo status of a bookmarked feature
	 */
	async toggleTodo(mapFeature: any): Promise<StoredFeature> {
		const featureId = this.getFeatureId(mapFeature);
		let existingFeature = await this.getFeatureById(featureId);

		if (existingFeature) {
			// Only allow toggle todo on bookmarked features
			if (!existingFeature.bookmarked) {
				throw new Error('Cannot toggle todo status on unbookmarked feature');
			}

			// Toggle todo status
			existingFeature.todo = !existingFeature.todo;
			existingFeature.dateModified = Date.now();
			return await this.updateFeature(existingFeature);
		} else {
			// Create new bookmarked feature with todo status
			return await this.storeFeature(mapFeature, 'todo');
		}
	}

	/**
	 * Update an existing feature for current user with Firestore sync
	 */
	async updateFeature(feature: StoredFeature): Promise<StoredFeature> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		// Ensure userId is set for current user
		feature.userId = this.getCurrentUserId();
		feature.searchText = this.generateSearchText(feature);
		feature.dateModified = Date.now();
		feature.lastSyncTimestamp = Date.now(); // Track for sync

		// Mark for upload if offline
		if (!this.isOnline || !this.currentUser) {
			(feature as any).pendingUpload = true;
			console.log(`⚠️ Feature "${feature.id}" updated offline - marked for upload`);
		}

		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			try {
				// Create a clean copy to ensure it can be cloned
				const cleanFeature = JSON.parse(JSON.stringify(feature));
				const request = store.put(cleanFeature);
				request.onsuccess = () => resolve();
				request.onerror = () => {
					console.error('IndexedDB store.put failed in updateFeature:', request.error);
					console.error('Attempted to update feature:', cleanFeature);
					reject(request.error);
				};
			} catch (jsonError) {
				console.error('Failed to serialize feature for update:', jsonError);
				console.error('Feature object:', feature);
				reject(new Error(`Feature serialization failed in update: ${jsonError}`));
			}
		});

		await this.updateStats();
		this.triggerBookmarkChange(); // Trigger reactivity

		// Firestore handles sync automatically
		if (this.currentUser) {
			this.syncFeatureToFirestore(feature);
		}

		return feature;
	}

	/**
	 * Get feature by ID for current user
	 */
	async getFeatureById(id: string): Promise<StoredFeature | null> {
		await this.ensureInitialized();
		if (!this.db) return null;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.get([userId, id]); // Use compound key
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Search features for current user with text query
	 */
	async searchFeatures(
		query: string,
		options: {
			limit?: number;
			bookmarkedOnly?: boolean;
			visitedOnly?: boolean;
			todoOnly?: boolean;
			categoryFilter?: string;
			classFilter?: string;
		} = {}
	): Promise<FeatureSearchResult[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		const userId = this.getCurrentUserId();
		const {
			limit = 50,
			bookmarkedOnly = false,
			visitedOnly = false,
			todoOnly = false,
			categoryFilter,
			classFilter
		} = options;

		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);

		let features: StoredFeature[] = [];

		// Get features for current user only
		features = await this.getAllFeaturesForUser(store, userId);

		// Apply filters
		if (bookmarkedOnly) {
			features = features.filter((f) => f.bookmarked === true);
		}
		if (visitedOnly) {
			features = features.filter((f) => f.visitedDates && f.visitedDates.length > 0);
		}
		if (todoOnly) {
			features = features.filter((f) => f.todo === true);
		}
		if (categoryFilter) {
			features = features.filter((f) => f.category === categoryFilter);
		}
		if (classFilter) {
			features = features.filter((f) => f.class === classFilter);
		}

		// Apply text search and scoring
		const queryLower = query.toLowerCase().trim();
		const results: FeatureSearchResult[] = [];

		if (!queryLower) {
			// No query, return all features with default score
			return features.slice(0, limit).map((feature) => ({
				feature,
				score: 1,
				matchedFields: []
			}));
		}

		features.forEach((feature) => {
			const matches: string[] = [];
			let score = 0;

			// Search in searchText (full-text search)
			if (feature.searchText.includes(queryLower)) {
				matches.push('searchText');
				score += 1;
			}

			// Bonus points for exact matches in specific fields
			Object.entries(feature.names).forEach(([key, name]) => {
				if (name.toLowerCase().includes(queryLower)) {
					matches.push(key);
					score += key === 'name' ? 5 : 3; // Primary name gets higher score
				}
			});

			if (feature.class?.toLowerCase().includes(queryLower)) {
				matches.push('class');
				score += 2;
			}

			if (feature.category?.toLowerCase().includes(queryLower)) {
				matches.push('category');
				score += 2;
			}

			if (score > 0) {
				results.push({
					feature,
					score,
					matchedFields: matches
				});
			}
		});

		// Sort by relevance score and limit results
		return results.sort((a, b) => b.score - a.score).slice(0, limit);
	}

	/**
	 * Get features by index
	 */
	private async getFeaturesByIndex(
		store: IDBObjectStore,
		indexName: string,
		value: any
	): Promise<StoredFeature[]> {
		return new Promise((resolve, reject) => {
			// Check if value is valid for IDBKeyRange
			if (value === null || value === undefined) {
				resolve([]);
				return;
			}

			try {
				const features: StoredFeature[] = [];
				const index = store.index(indexName);
				const request = index.openCursor(IDBKeyRange.only(value));

				request.onsuccess = (event) => {
					const cursor = (event.target as IDBRequest).result;
					if (cursor) {
						features.push(cursor.value);
						cursor.continue();
					} else {
						resolve(features);
					}
				};

				request.onerror = () => reject(request.error);
			} catch (error) {
				// If IDBKeyRange.only fails, the value is not a valid key
				console.warn(`Invalid key for index ${indexName}:`, value, error);
				resolve([]);
			}
		});
	}

	/**
	 * Get all features for a specific user
	 */
	private async getAllFeaturesForUser(
		store: IDBObjectStore,
		userId: string
	): Promise<StoredFeature[]> {
		return new Promise((resolve, reject) => {
			const features: StoredFeature[] = [];
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					features.push(cursor.value);
					cursor.continue();
				} else {
					resolve(features);
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get bookmarked features
	 */
	async getBookmarkedFeatures(): Promise<StoredFeature[]> {
		const results = await this.searchFeatures('', { bookmarkedOnly: true });
		return results.map((r) => r.feature);
	}

	/**
	 * Get visited features (features with at least one visit)
	 */
	async getVisitedFeatures(): Promise<StoredFeature[]> {
		const results = await this.searchFeatures('', { visitedOnly: true });
		return results.map((r) => r.feature);
	}

	/**
	 * Get features visited on a specific date
	 */
	async getFeaturesVisitedOnDate(date: Date): Promise<StoredFeature[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		const targetDate = new Date(date);
		targetDate.setHours(0, 0, 0, 0);
		const timestamp = targetDate.getTime();

		// Validate timestamp
		if (!timestamp || isNaN(timestamp)) return [];

		// Use the correct store name
		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);
		const index = store.index(this.INDEX_VISITED);

		return new Promise((resolve, reject) => {
			try {
				const features: StoredFeature[] = [];
				const request = index.openCursor(IDBKeyRange.only(timestamp));

				request.onsuccess = (event) => {
					const cursor = (event.target as IDBRequest).result;
					if (cursor) {
						features.push(cursor.value);
						cursor.continue();
					} else {
						resolve(features);
					}
				};

				request.onerror = () => reject(request.error);
			} catch (error) {
				console.warn(`Invalid timestamp for querying visited features:`, timestamp, error);
				resolve([]);
			}
		});
	}

	/**
	 * Get visit timeline for a specific feature
	 */
	async getFeatureVisitTimeline(featureId: string): Promise<number[]> {
		const feature = await this.getFeatureById(featureId);
		return feature?.visitedDates || [];
	}

	/**
	 * Get overall visit timeline (all features)
	 */
	async getOverallVisitTimeline(): Promise<{ date: number; features: StoredFeature[] }[]> {
		const allFeatures = await this.exportFeatures();
		const timeline = new Map<number, StoredFeature[]>();

		allFeatures.forEach((feature) => {
			feature.visitedDates.forEach((date) => {
				if (!timeline.has(date)) {
					timeline.set(date, []);
				}
				timeline.get(date)!.push(feature);
			});
		});

		// Convert to array and sort by date
		return Array.from(timeline.entries())
			.map(([date, features]) => ({ date, features }))
			.sort((a, b) => a.date - b.date);
	}

	/**
	 * Get todo features
	 */
	async getTodoFeatures(): Promise<StoredFeature[]> {
		const results = await this.searchFeatures('', { todoOnly: true });
		return results.map((r) => r.feature);
	}

	/**
	 * Update statistics for current user
	 */
	private async updateStats(): Promise<void> {
		if (!this.db) return;

		try {
			const userId = this.getCurrentUserId();
			const transaction = this.db.transaction(
				[this.FEATURES_STORE_NAME, this.LISTS_STORE_NAME],
				'readonly'
			);
			const featuresStore = transaction.objectStore(this.FEATURES_STORE_NAME);
			const listsStore = transaction.objectStore(this.LISTS_STORE_NAME);

			const [total, bookmarked, visited, todo, lists] = await Promise.all([
				this.countFeaturesForUser(featuresStore, userId),
				this.countBookmarkedFeaturesForUser(featuresStore, userId),
				this.countVisitedFeaturesForUser(featuresStore, userId),
				this.countTodoFeaturesForUser(featuresStore, userId),
				this.countBookmarkListsForUser(listsStore, userId)
			]);

			this._stats = { total, bookmarked, visited, todo, lists };
		} catch (error) {
			console.error('Failed to update stats:', error);
		}
	}

	/**
	 * Count features for a specific user
	 */
	private async countFeaturesForUser(store: IDBObjectStore, userId: string): Promise<number> {
		return new Promise((resolve, reject) => {
			const index = store.index(this.INDEX_USER_ID);
			const request = index.count(IDBKeyRange.only(userId));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Count features by index
	 */
	private async countFeaturesByIndex(
		store: IDBObjectStore,
		indexName: string,
		value: any
	): Promise<number> {
		return new Promise((resolve, reject) => {
			// Check if value is valid for IDBKeyRange
			if (value === null || value === undefined) {
				resolve(0);
				return;
			}

			try {
				const index = store.index(indexName);
				const request = index.count(IDBKeyRange.only(value));
				request.onsuccess = () => resolve(request.result);
				request.onerror = () => reject(request.error);
			} catch (error) {
				// If IDBKeyRange.only fails, the value is not a valid key
				console.warn(`Invalid key for index ${indexName}:`, value, error);
				resolve(0);
			}
		});
	}

	/**
	 * Count visited features for a specific user (features with at least one visit)
	 */
	private async countVisitedFeaturesForUser(
		store: IDBObjectStore,
		userId: string
	): Promise<number> {
		return new Promise((resolve, reject) => {
			let count = 0;
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const feature = cursor.value as StoredFeature;
					if (feature.visitedDates && feature.visitedDates.length > 0) {
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
	 * Count bookmark lists for a specific user
	 */
	private async countBookmarkListsForUser(store: IDBObjectStore, userId: string): Promise<number> {
		return new Promise((resolve, reject) => {
			const index = store.index(this.INDEX_USER_ID);
			const request = index.count(IDBKeyRange.only(userId));
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Count bookmarked features for a specific user (features with bookmarked = true)
	 */
	private async countBookmarkedFeaturesForUser(
		store: IDBObjectStore,
		userId: string
	): Promise<number> {
		return new Promise((resolve, reject) => {
			let count = 0;
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const feature = cursor.value as StoredFeature;
					if (feature.bookmarked === true) {
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
	 * Count todo features for a specific user (features with todo = true)
	 */
	private async countTodoFeaturesForUser(store: IDBObjectStore, userId: string): Promise<number> {
		return new Promise((resolve, reject) => {
			let count = 0;
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					const feature = cursor.value as StoredFeature;
					if (feature.todo === true) {
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
	 * Delete a feature for current user
	 */
	async deleteFeature(id: string): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.delete([userId, id]); // Use compound key
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerBookmarkChange(); // Trigger reactivity

		// Firestore handles sync automatically
		if (this.currentUser) {
			this.deleteFeatureFromFirestore(id);
		}
	}

	/**
	 * Clear all features for current user
	 */
	async clearAllFeatures(): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);

		// Get all features for current user and delete them
		const features = await this.getAllFeaturesForUser(store, userId);
		for (const feature of features) {
			await new Promise<void>((resolve, reject) => {
				const request = store.delete([userId, feature.id]);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		}

		this._stats.total = 0;
		this._stats.bookmarked = 0;
		this._stats.visited = 0;
		this._stats.todo = 0;
		this.triggerBookmarkChange(); // Trigger reactivity
	}

	/**
	 * Clear all bookmark lists for current user
	 */
	async clearAllBookmarkLists(): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const userId = this.getCurrentUserId();

		// First remove list IDs from all features and update their bookmark/todo status
		const allFeatures = await this.exportFeatures();
		for (const feature of allFeatures) {
			if (feature.listIds.length > 0) {
				feature.listIds = [];
				feature.bookmarked = false;

				// If feature is no longer bookmarked, clear todo status but keep visits
				feature.todo = false;

				await this.updateFeature(feature);
			}
		}

		// Then clear all lists for current user
		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);
		const index = store.index(this.INDEX_USER_ID);

		const lists = await new Promise<BookmarkList[]>((resolve, reject) => {
			const lists: BookmarkList[] = [];
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					lists.push(cursor.value);
					cursor.continue();
				} else {
					resolve(lists);
				}
			};

			request.onerror = () => reject(request.error);
		});

		for (const list of lists) {
			await new Promise<void>((resolve, reject) => {
				const request = store.delete([userId, list.id]);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		}

		this._stats.lists = 0;
		this.triggerBookmarkChange(); // Trigger reactivity
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
	 * Export all features for current user for backup
	 */
	async exportFeatures(): Promise<StoredFeature[]> {
		const results = await this.searchFeatures('');
		return results.map((r) => r.feature);
	}

	/**
	 * Import features from backup for current user
	 */
	async importFeatures(features: StoredFeature[]): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);

		for (const feature of features) {
			// Ensure feature belongs to current user
			feature.userId = userId;

			await new Promise<void>((resolve, reject) => {
				const request = store.put(feature);
				request.onsuccess = () => resolve();
				request.onerror = () => reject(request.error);
			});
		}

		await this.updateStats();
		this.triggerBookmarkChange(); // Trigger reactivity
	}

	// ==================== BOOKMARK LISTS METHODS ====================

	/**
	 * Create a new bookmark list for current user
	 */
	async createBookmarkList(listData: {
		name: string;
		description?: string;
		category?: string;
		color?: string;
	}): Promise<BookmarkList> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const userId = this.getCurrentUserId();
		const now = Date.now();
		const listId = `list-${now}-${Math.random().toString(36).substr(2, 9)}`;

		console.log(`Creating bookmark list for user ${userId}:`, listData);

		const bookmarkList: BookmarkList = {
			userId, // Add userId to bookmark list
			id: listId,
			name: listData.name,
			description: listData.description,
			category: listData.category,
			color: listData.color,
			featureIds: [],
			dateCreated: now,
			dateModified: now,
			lastSyncTimestamp: now // Track for sync
		};

		console.log('Created bookmark list object:', bookmarkList);

		// Mark for upload if offline
		if (!this.isOnline || !this.currentUser) {
			(bookmarkList as any).pendingUpload = true;
			console.log(`⚠️ Bookmark list "${bookmarkList.name}" created offline - marked for upload`);
		}

		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(bookmarkList);
			request.onsuccess = () => {
				console.log('Successfully stored bookmark list in IndexedDB');
				resolve();
			};
			request.onerror = () => {
				console.error('Failed to store bookmark list in IndexedDB:', request.error);
				reject(request.error);
			};
		});

		await this.updateStats();
		console.log('Updated stats after creating list');

		// Firestore handles sync automatically
		if (this.currentUser) {
			this.syncBookmarkListToFirestore(bookmarkList);
		}

		return bookmarkList;
	}

	/**
	 * Get all bookmark lists for current user
	 */
	async getAllBookmarkLists(): Promise<BookmarkList[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		return new Promise((resolve, reject) => {
			const lists: BookmarkList[] = [];
			const index = store.index(this.INDEX_USER_ID);
			const request = index.openCursor(IDBKeyRange.only(userId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					lists.push(cursor.value);
					cursor.continue();
				} else {
					// Sort by name for consistent display
					resolve(lists.sort((a, b) => a.name.localeCompare(b.name)));
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get bookmark list by ID for current user
	 */
	async getBookmarkListById(listId: string): Promise<BookmarkList | null> {
		await this.ensureInitialized();
		if (!this.db) return null;

		const userId = this.getCurrentUserId();
		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.get([userId, listId]); // Use compound key
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Update bookmark list for current user
	 */
	async updateBookmarkList(list: BookmarkList): Promise<BookmarkList> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		// Ensure list belongs to current user
		list.userId = this.getCurrentUserId();
		list.dateModified = Date.now();
		list.lastSyncTimestamp = Date.now(); // Track for sync

		// Mark for upload if offline
		if (!this.isOnline || !this.currentUser) {
			(list as any).pendingUpload = true;
			console.log(`⚠️ Bookmark list "${list.name}" updated offline - marked for upload`);
		}

		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(list);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();

		// Firestore handles sync automatically
		if (this.currentUser) {
			this.syncBookmarkListToFirestore(list);
		}

		return list;
	}

	/**
	 * Delete bookmark list for current user
	 */
	async deleteBookmarkList(listId: string): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const userId = this.getCurrentUserId();

		// First, remove this list from all features and update their bookmark/todo status
		const features = await this.getFeaturesByListId(listId);
		for (const feature of features) {
			feature.listIds = feature.listIds.filter((id) => id !== listId);
			feature.bookmarked = feature.listIds.length > 0;

			// If feature is no longer bookmarked, clear todo status but keep visits
			if (!feature.bookmarked) {
				feature.todo = false;
			}

			await this.updateFeature(feature);
		}

		// Then delete the list itself
		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.delete([userId, listId]); // Use compound key
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		// Firestore handles sync automatically
		if (this.currentUser) {
			this.deleteBookmarkListFromFirestore(listId);
		}

		await this.updateStats();
	}

	/**
	 * Add feature to bookmark lists
	 */
	async addFeatureToLists(mapFeature: any, listIds: string[]): Promise<StoredFeature> {
		const featureId = this.getFeatureId(mapFeature);
		let storedFeature = await this.getFeatureById(featureId);

		if (storedFeature) {
			// Add new list IDs to existing feature
			const currentListIds = new Set(storedFeature.listIds);
			listIds.forEach((listId) => currentListIds.add(listId));
			storedFeature.listIds = Array.from(currentListIds);
			storedFeature.bookmarked = storedFeature.listIds.length > 0;
			storedFeature = await this.updateFeature(storedFeature);
		} else {
			// Create new feature with list IDs
			storedFeature = await this.storeFeature(mapFeature, 'bookmark');
			storedFeature.listIds = listIds;
			storedFeature = await this.updateFeature(storedFeature);
		}

		// Update bookmark lists to include this feature
		for (const listId of listIds) {
			const list = await this.getBookmarkListById(listId);
			if (list) {
				if (!list.featureIds.includes(featureId)) {
					list.featureIds.push(featureId);
					await this.updateBookmarkList(list);
				}
			}
		}

		return storedFeature;
	}

	/**
	 * Remove feature from bookmark lists
	 */
	async removeFeatureFromLists(mapFeature: any, listIds: string[]): Promise<StoredFeature | null> {
		const featureId = this.getFeatureId(mapFeature);
		let storedFeature = await this.getFeatureById(featureId);

		if (!storedFeature) return null;

		// Remove list IDs from feature
		storedFeature.listIds = storedFeature.listIds.filter((id) => !listIds.includes(id));
		storedFeature.bookmarked = storedFeature.listIds.length > 0;

		// If feature is no longer bookmarked, clear todo status but keep visits
		if (!storedFeature.bookmarked) {
			storedFeature.todo = false;
		}

		storedFeature = await this.updateFeature(storedFeature);

		// Update bookmark lists to remove this feature
		for (const listId of listIds) {
			const list = await this.getBookmarkListById(listId);
			if (list) {
				list.featureIds = list.featureIds.filter((id) => id !== featureId);
				await this.updateBookmarkList(list);
			}
		}

		this.triggerBookmarkChange(); // Trigger reactivity
		return storedFeature;
	}

	/**
	 * Get features by list ID
	 */
	async getFeaturesByListId(listId: string): Promise<StoredFeature[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		// Validate listId
		if (!listId) return [];

		// Use the correct store name (FEATURES_STORE_NAME not STORE_NAME)
		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);
		const index = store.index(this.INDEX_LIST_IDS);

		return new Promise((resolve, reject) => {
			try {
				const features: StoredFeature[] = [];
				const request = index.openCursor(IDBKeyRange.only(listId));

				request.onsuccess = (event) => {
					const cursor = (event.target as IDBRequest).result;
					if (cursor) {
						features.push(cursor.value);
						cursor.continue();
					} else {
						resolve(features);
					}
				};

				request.onerror = () => reject(request.error);
			} catch (error) {
				console.warn(`Invalid listId for querying features:`, listId, error);
				resolve([]);
			}
		});
	}

	/**
	 * Get lists that contain a specific feature for current user
	 */
	async getListsForFeature(featureId: string): Promise<BookmarkList[]> {
		const feature = await this.getFeatureById(featureId);
		if (!feature || feature.listIds.length === 0) return [];

		const lists: BookmarkList[] = [];
		for (const listId of feature.listIds) {
			const list = await this.getBookmarkListById(listId);
			if (list) {
				lists.push(list);
			}
		}

		return lists;
	}

	/**
	 * Clean up resources when component is destroyed
	 */
	destroy(): void {
		this.stopFirestoreSync();
	}

	// ==================== FIRESTORE SYNC METHODS ====================

	/**
	 * Start Firestore real-time sync for current user
	 */
	private startFirestoreSync(): void {
		if (!this.currentUser || !this.isOnline) return;

		this.stopFirestoreSync(); // Clean up any existing subscription

		try {
			const userId = this.currentUser.uid;

			// Listen to real-time changes in user's features collection
			const featuresQuery = query(
				collection(db, 'users', userId, 'features'),
				orderBy('dateModified', 'desc')
			);

			// Listen to real-time changes in user's lists collection
			const listsQuery = query(
				collection(db, 'users', userId, 'lists'),
				orderBy('dateModified', 'desc')
			);

			// Subscribe to features changes
			const featuresUnsubscribe = onSnapshot(
				featuresQuery,
				(snapshot) => this.handleFirestoreSnapshot(snapshot, 'features'),
				(error) => {
					console.error('Firestore features sync error:', error);
					this.isSyncing = false;
				}
			);

			// Subscribe to lists changes
			const listsUnsubscribe = onSnapshot(
				listsQuery,
				(snapshot) => this.handleFirestoreSnapshot(snapshot, 'lists'),
				(error) => {
					console.error('Firestore lists sync error:', error);
					this.isSyncing = false;
				}
			);

			// Store both unsubscribe functions
			this.firestoreUnsubscribe = () => {
				featuresUnsubscribe();
				listsUnsubscribe();
			};

			console.log('Started Firestore sync for both features and lists');

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

	/**
	 * Handle Firestore snapshot changes
	 */
	private async handleFirestoreSnapshot(
		snapshot: QuerySnapshot<DocumentData>,
		type: 'features' | 'lists' = 'features'
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
						if (type === 'features') {
							await this.handleRemoteFeatureChange(firestoreData, docId);
						} else {
							await this.handleRemoteListChange(firestoreData, docId);
						}
						break;
					case 'removed':
						if (type === 'features') {
							await this.handleRemoteFeatureDeletion(docId);
						} else {
							await this.handleRemoteListDeletion(docId);
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
	 * Handle remote feature changes from Firestore
	 */
	private async handleRemoteFeatureChange(remoteData: any, firestoreId: string): Promise<void> {
		if (!remoteData.id) return;

		const localFeature = await this.getFeatureById(remoteData.id);

		if (!localFeature) {
			// No local version, safe to add from remote
			const feature: StoredFeature = {
				...remoteData,
				firestoreId,
				lastSyncTimestamp: Date.now()
			};

			await this.storeFeatureLocally(feature);
		} else {
			// Check for conflicts
			const localTimestamp = localFeature.lastSyncTimestamp || 0;
			const remoteTimestamp = remoteData.lastSyncTimestamp || 0;

			if (localTimestamp > remoteTimestamp && localFeature.dateModified > remoteData.dateModified) {
				// Local is newer, upload to Firestore
				this.syncFeatureToFirestore(localFeature);
			} else if (remoteTimestamp > localTimestamp) {
				// Remote is newer, update local
				const updatedFeature: StoredFeature = {
					...remoteData,
					firestoreId,
					lastSyncTimestamp: Date.now()
				};

				await this.storeFeatureLocally(updatedFeature);
			} else {
				// Conflict detected
				this.addSyncConflict({
					id: remoteData.id,
					type: 'feature',
					localData: localFeature,
					remoteData,
					conflictType: 'both_modified',
					timestamp: Date.now()
				});
			}
		}
	}

	/**
	 * Handle remote feature deletion
	 */
	private async handleRemoteFeatureDeletion(firestoreId: string): Promise<void> {
		// Find local feature by Firestore ID and delete it
		const allFeatures = await this.exportFeatures();
		const featureToDelete = allFeatures.find((f) => (f as any).firestoreId === firestoreId);

		if (featureToDelete) {
			await this.deleteFeature(featureToDelete.id);
		}
	}

	/**
	 * Handle remote list changes from Firestore
	 */
	private async handleRemoteListChange(remoteData: any, firestoreId: string): Promise<void> {
		if (!remoteData.id) return;

		const localList = await this.getBookmarkListById(remoteData.id);

		if (!localList) {
			// No local version, safe to add from remote
			const list: BookmarkList = {
				...remoteData,
				firestoreId,
				lastSyncTimestamp: Date.now()
			};

			await this.storeBookmarkListLocally(list);
		} else {
			// Check for conflicts
			const localTimestamp = localList.lastSyncTimestamp || 0;
			const remoteTimestamp = remoteData.lastSyncTimestamp || 0;

			if (localTimestamp > remoteTimestamp && localList.dateModified > remoteData.dateModified) {
				// Local is newer, upload to Firestore
				this.syncBookmarkListToFirestore(localList);
			} else if (remoteTimestamp > localTimestamp) {
				// Remote is newer, update local
				const updatedList: BookmarkList = {
					...remoteData,
					firestoreId,
					lastSyncTimestamp: Date.now()
				};

				await this.storeBookmarkListLocally(updatedList);
			} else {
				// Conflict detected
				this.addSyncConflict({
					id: remoteData.id,
					type: 'list',
					localData: localList,
					remoteData,
					conflictType: 'both_modified',
					timestamp: Date.now()
				});
			}
		}
	}

	/**
	 * Handle remote list deletion
	 */
	private async handleRemoteListDeletion(firestoreId: string): Promise<void> {
		// Find local list by Firestore ID and delete it
		const allLists = await this.getAllBookmarkLists();
		const listToDelete = allLists.find((l) => (l as any).firestoreId === firestoreId);

		if (listToDelete) {
			await this.deleteBookmarkList(listToDelete.id);
		}
	}

	/**
	 * Store feature locally without triggering sync
	 */
	private async storeFeatureLocally(feature: StoredFeature): Promise<void> {
		if (!this.db) return;

		const transaction = this.db.transaction([this.FEATURES_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.FEATURES_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const cleanFeature = JSON.parse(JSON.stringify(feature));
			const request = store.put(cleanFeature);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerBookmarkChange();
	}

	/**
	 * Store bookmark list locally without triggering sync
	 */
	private async storeBookmarkListLocally(list: BookmarkList): Promise<void> {
		if (!this.db) return;

		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const cleanList = JSON.parse(JSON.stringify(list));
			const request = store.put(cleanList);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerBookmarkChange();
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
	 * Sync feature to Firestore with enhanced error handling
	 */
	private async syncFeatureToFirestore(feature: StoredFeature, retryCount = 0): Promise<void> {
		if (!this.currentUser || !this.isOnline) {
			console.warn(`Cannot sync feature ${feature.id}: user not authenticated or offline`);
			// Mark feature for upload when back online
			(feature as any).pendingUpload = true;
			return;
		}

		const MAX_RETRIES = 3;
		const RETRY_DELAY = 1000; // 1 second

		try {
			const userId = this.currentUser.uid;
			console.log(`📤 Syncing feature "${feature.id}" to Firestore (attempt ${retryCount + 1})`);

			// Clean feature data for Firestore (remove undefined values)
			const cleanFeature = this.cleanForFirestore({
				...feature,
				serverTimestamp: serverTimestamp(),
				lastSyncTimestamp: Date.now()
			});

			// Use feature ID as Firestore document ID
			const docRef = doc(db, 'users', userId, 'features', feature.id);
			await setDoc(docRef, cleanFeature, { merge: true });

			// Update local feature with sync timestamp
			feature.lastSyncTimestamp = Date.now();
			await this.storeFeatureLocally(feature);

			console.log(`✅ Successfully synced feature "${feature.id}" to Firestore`);
			// Clear pending upload flag on success
			delete (feature as any).pendingUpload;
		} catch (error: any) {
			console.error(
				`❌ Failed to sync feature "${feature.id}" to Firestore (attempt ${retryCount + 1}):`,
				error
			);

			// Mark for retry even on error
			(feature as any).pendingUpload = true;

			// Retry logic for transient errors
			if (retryCount < MAX_RETRIES && this.shouldRetry(error)) {
				console.log(`⏳ Retrying sync in ${RETRY_DELAY}ms...`);
				setTimeout(() => {
					this.syncFeatureToFirestore(feature, retryCount + 1);
				}, RETRY_DELAY);
			} else {
				// Log final failure but keep pendingUpload flag for later retry
				console.error(
					`💥 Failed to sync feature "${feature.id}" after ${MAX_RETRIES} attempts:`,
					error.message
				);
				console.warn('Feature will be retried when connection is restored.');
			}
		}
	}

	/**
	 * Sync bookmark list to Firestore with enhanced error handling
	 */
	private async syncBookmarkListToFirestore(list: BookmarkList, retryCount = 0): Promise<void> {
		if (!this.currentUser || !this.isOnline) {
			console.warn(`Cannot sync bookmark list ${list.name}: user not authenticated or offline`);
			// Mark list for upload when back online
			(list as any).pendingUpload = true;
			return;
		}

		const MAX_RETRIES = 3;
		const RETRY_DELAY = 1000; // 1 second

		try {
			const userId = this.currentUser.uid;
			console.log(
				`📤 Syncing bookmark list "${list.name}" to Firestore (attempt ${retryCount + 1})`
			);

			// Clean list data for Firestore (remove undefined values)
			const cleanList = this.cleanForFirestore({
				...list,
				serverTimestamp: serverTimestamp(),
				lastSyncTimestamp: Date.now()
			});

			console.log('Clean list data for Firestore:', cleanList);

			// Use list ID as Firestore document ID
			const docRef = doc(db, 'users', userId, 'lists', list.id);
			await setDoc(docRef, cleanList, { merge: true });

			// Update local list with sync timestamp
			list.lastSyncTimestamp = Date.now();
			await this.storeBookmarkListLocally(list);

			console.log(`✅ Successfully synced bookmark list "${list.name}" to Firestore`);
			// Clear pending upload flag on success
			delete (list as any).pendingUpload;
		} catch (error: any) {
			console.error(
				`❌ Failed to sync bookmark list "${list.name}" to Firestore (attempt ${retryCount + 1}):`,
				error
			);

			// Mark for retry even on error
			(list as any).pendingUpload = true;

			// Retry logic for transient errors
			if (retryCount < MAX_RETRIES && this.shouldRetry(error)) {
				console.log(`⏳ Retrying sync in ${RETRY_DELAY}ms...`);
				setTimeout(() => {
					this.syncBookmarkListToFirestore(list, retryCount + 1);
				}, RETRY_DELAY);
			} else {
				// Log final failure but keep pendingUpload flag for later retry
				console.error(
					`💥 Failed to sync bookmark list "${list.name}" after ${MAX_RETRIES} attempts:`,
					error.message
				);
				console.warn('Bookmark list will be retried when connection is restored.');
			}
		}
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

		console.log('📤 Uploading local features changes to Firestore...');
		const localFeatures = await this.exportFeatures();
		const userId = this.currentUser.uid;
		let uploadedCount = 0;

		for (const feature of localFeatures) {
			const lastSyncTimestamp = feature.lastSyncTimestamp || 0;

			// Upload if never synced or modified since last sync
			if (lastSyncTimestamp === 0 || feature.dateModified > lastSyncTimestamp) {
				console.log(
					`📤 Uploading feature: ${feature.id} (modified: ${new Date(feature.dateModified)}, lastSync: ${new Date(lastSyncTimestamp)})`
				);
				await this.syncFeatureToFirestore(feature);
				uploadedCount++;
			}
		}

		console.log(`📤 Uploaded ${uploadedCount}/${localFeatures.length} features to Firestore`);

		// Upload local bookmark lists
		const localLists = await this.getAllBookmarkLists();
		let uploadedListsCount = 0;

		for (const list of localLists) {
			const lastSyncTimestamp = list.lastSyncTimestamp || 0;

			// Upload if never synced or modified since last sync
			if (lastSyncTimestamp === 0 || list.dateModified > lastSyncTimestamp) {
				console.log(`📤 Uploading bookmark list: ${list.name}`);
				await this.syncBookmarkListToFirestore(list);
				uploadedListsCount++;
			}
		}

		console.log(`📤 Uploaded ${uploadedListsCount} bookmark lists to Firestore`);
	}

	/**
	 * Download remote changes from Firestore
	 */
	private async downloadRemoteChanges(): Promise<void> {
		if (!this.currentUser) return;

		const userId = this.currentUser.uid;
		const lastSync = await this.getLastSyncTimestamp();

		try {
			// Query for features modified since last sync
			const featuresQuery = query(
				collection(db, 'users', userId, 'features'),
				where('dateModified', '>', lastSync),
				orderBy('dateModified', 'asc')
			);

			// Query for lists modified since last sync
			const listsQuery = query(
				collection(db, 'users', userId, 'lists'),
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
	 * Add sync conflict to queue
	 */
	private addSyncConflict(conflict: SyncConflict): void {
		this.syncConflicts = [...this.syncConflicts, conflict];
	}

	/**
	 * Resolve sync conflict
	 */
	async resolveSyncConflict(
		conflictId: string,
		resolution: 'local' | 'remote' | 'merge'
	): Promise<void> {
		const conflict = this.syncConflicts.find((c) => c.id === conflictId);
		if (!conflict) return;

		try {
			switch (resolution) {
				case 'local':
					// Keep local version, upload to Firestore
					if (conflict.type === 'feature') {
						await this.syncFeatureToFirestore(conflict.localData);
					} else if (conflict.type === 'list') {
						await this.syncBookmarkListToFirestore(conflict.localData);
					}
					break;
				case 'remote':
					// Accept remote version, update local
					if (conflict.type === 'feature') {
						await this.storeFeatureLocally(conflict.remoteData);
					} else if (conflict.type === 'list') {
						await this.storeBookmarkListLocally(conflict.remoteData);
					}
					break;
				case 'merge':
					// Intelligent merge
					if (conflict.type === 'feature') {
						const merged = this.mergeFeatures(conflict.localData, conflict.remoteData);
						await this.storeFeatureLocally(merged);
						await this.syncFeatureToFirestore(merged);
					} else if (conflict.type === 'list') {
						const merged = this.mergeBookmarkLists(conflict.localData, conflict.remoteData);
						await this.storeBookmarkListLocally(merged);
						await this.syncBookmarkListToFirestore(merged);
					}
					break;
			}

			// Remove resolved conflict
			this.syncConflicts = this.syncConflicts.filter((c) => c.id !== conflictId);
		} catch (error) {
			console.error('Failed to resolve sync conflict:', error);
		}
	}

	/**
	 * Intelligent merge of two feature versions
	 */
	private mergeFeatures(local: StoredFeature, remote: StoredFeature): StoredFeature {
		return {
			...local,
			// Use most recent modification time
			dateModified: Math.max(local.dateModified, remote.dateModified),
			// Merge visit dates (combine and deduplicate)
			visitedDates: Array.from(new Set([...local.visitedDates, ...remote.visitedDates])).sort(),
			// Keep bookmark status if either is bookmarked
			bookmarked: local.bookmarked || remote.bookmarked,
			// Keep todo status if either is todo
			todo: local.todo || remote.todo,
			// Merge list IDs
			listIds: Array.from(new Set([...local.listIds, ...remote.listIds])),
			// Update sync timestamp
			lastSyncTimestamp: Date.now()
		};
	}

	/**
	 * Intelligent merge of two bookmark list versions
	 */
	private mergeBookmarkLists(local: BookmarkList, remote: BookmarkList): BookmarkList {
		return {
			...local,
			// Use most recent modification time
			dateModified: Math.max(local.dateModified, remote.dateModified),
			// Merge feature IDs (combine and deduplicate)
			featureIds: Array.from(new Set([...local.featureIds, ...remote.featureIds])),
			// Keep most recent metadata (name, description, etc.)
			name: local.dateModified > remote.dateModified ? local.name : remote.name,
			description:
				local.dateModified > remote.dateModified ? local.description : remote.description,
			color: local.dateModified > remote.dateModified ? local.color : remote.color,
			category: local.dateModified > remote.dateModified ? local.category : remote.category,
			// Update sync timestamp
			lastSyncTimestamp: Date.now()
		};
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

	/**
	 * Delete feature from Firestore
	 */
	private async deleteFeatureFromFirestore(featureId: string): Promise<void> {
		if (!this.currentUser) return;

		try {
			const userId = this.currentUser.uid;
			const docRef = doc(db, 'users', userId, 'features', featureId);
			await deleteDoc(docRef);
		} catch (error) {
			console.error('Failed to delete feature from Firestore:', error);
		}
	}

	/**
	 * Delete bookmark list from Firestore
	 */
	private async deleteBookmarkListFromFirestore(listId: string): Promise<void> {
		if (!this.currentUser) return;

		try {
			const userId = this.currentUser.uid;
			const docRef = doc(db, 'users', userId, 'lists', listId);
			await deleteDoc(docRef);
		} catch (error) {
			console.error('Failed to delete bookmark list from Firestore:', error);
		}
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
			// Get all local features and force upload any that have been modified
			const localFeatures = await this.exportFeatures();
			let uploadedCount = 0;

			for (const feature of localFeatures) {
				// Check if feature needs to be uploaded
				const lastSyncTimestamp = feature.lastSyncTimestamp || 0;
				const needsUpload =
					lastSyncTimestamp === 0 ||
					feature.dateModified > lastSyncTimestamp ||
					(feature as any).pendingUpload;

				if (needsUpload) {
					console.log(`📤 Force uploading feature: ${feature.id}`);
					try {
						await this.syncFeatureToFirestore(feature);
						uploadedCount++;
						// Clear pending upload flag
						delete (feature as any).pendingUpload;
					} catch (error) {
						console.error(`Failed to upload feature ${feature.id}:`, error);
						// Mark for retry
						(feature as any).pendingUpload = true;
					}
				}
			}

			console.log(`✅ Force uploaded ${uploadedCount}/${localFeatures.length} features`);

			// Upload local bookmark lists
			const localLists = await this.getAllBookmarkLists();
			let uploadedListsCount = 0;

			for (const list of localLists) {
				const lastSyncTimestamp = list.lastSyncTimestamp || 0;
				const needsUpload =
					lastSyncTimestamp === 0 ||
					list.dateModified > lastSyncTimestamp ||
					(list as any).pendingUpload;

				if (needsUpload) {
					console.log(`📤 Force uploading bookmark list: ${list.name}`);
					try {
						await this.syncBookmarkListToFirestore(list);
						uploadedListsCount++;
						// Clear pending upload flag
						delete (list as any).pendingUpload;
					} catch (error) {
						console.error(`Failed to upload bookmark list ${list.name}:`, error);
						// Mark for retry
						(list as any).pendingUpload = true;
					}
				}
			}

			console.log(`✅ Force uploaded ${uploadedListsCount} bookmark lists`);

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
}

// Create singleton instance
export const featuresDB = new FeaturesDB();
