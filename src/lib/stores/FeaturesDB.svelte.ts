import { browser } from '$app/environment';

export interface FeatureNames {
	[key: string]: string; // name, name:en, name:fr, name:de, etc.
}

export interface BookmarkList {
	id: string; // Unique identifier for the list
	name: string; // Display name for the list
	description?: string; // Optional description
	category?: string; // Optional category/tag
	color?: string; // Optional color for UI display
	featureIds: string[]; // Array of feature IDs in this list
	dateCreated: number;
	dateModified: number;
}

export interface StoredFeature {
	id: string; // Unique identifier for the feature
	class?: string;
	subclass?: string;
	category?: string;
	names: FeatureNames; // All name properties (name, name:en, name:fr, etc.)
	geometry: any; // GeoJSON geometry
	source: string; // Map source
	sourceLayer?: string; // Source layer if applicable
	layer?: { id: string }; // Map layer info

	// User action flags
	bookmarked: boolean;
	listIds: string[]; // Array of bookmark list IDs this feature belongs to
	visitedDates: number[]; // Array of timestamps when visited
	todo: boolean;

	// Metadata
	dateCreated: number;
	dateModified: number;

	// Search optimization - denormalized searchable text
	searchText: string; // Concatenated text for full-text search
}

export interface FeatureSearchResult {
	feature: StoredFeature;
	score: number; // Relevance score for ranking
	matchedFields: string[]; // Which fields matched the search
}

/**
 * Features Database management class using Svelte 5 runes
 * Handles persistent storage of map features with efficient search capabilities
 * Optimized for quick querying across all searchable fields
 */
class FeaturesDB {
	// Storage configuration
	private readonly DB_NAME = 'FeaturesDB';
	private readonly DB_VERSION = 2; // Incremented for bookmark lists
	private readonly STORE_NAME = 'features';
	private readonly LISTS_STORE_NAME = 'bookmarkLists';
	private readonly INDEX_SEARCH = 'searchText';
	private readonly INDEX_BOOKMARKED = 'bookmarked';
	private readonly INDEX_VISITED = 'visitedDates';
	private readonly INDEX_TODO = 'todo';
	private readonly INDEX_CLASS = 'class';
	private readonly INDEX_CATEGORY = 'category';
	private readonly INDEX_SOURCE = 'source';
	private readonly INDEX_LIST_IDS = 'listIds';

	private db: IDBDatabase | null = null;
	private isInitialized = $state(false);
	private initPromise: Promise<void> | null = null;

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
			this.initializeDatabase();
		} else {
			this.isInitialized = true;
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
	 * Open IndexedDB with proper indexes for efficient querying
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

				// Create features object store
				let featuresStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.STORE_NAME)) {
					featuresStore = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
				} else {
					featuresStore = request.transaction!.objectStore(this.STORE_NAME);
				}

				// Create bookmark lists object store
				let listsStore: IDBObjectStore;
				if (!db.objectStoreNames.contains(this.LISTS_STORE_NAME)) {
					listsStore = db.createObjectStore(this.LISTS_STORE_NAME, { keyPath: 'id' });
				} else {
					listsStore = request.transaction!.objectStore(this.LISTS_STORE_NAME);
				}

				// Create indexes for features store
				const featureIndexesToCreate = [
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
					}
				];

				featureIndexesToCreate.forEach(({ name, keyPath, options }) => {
					if (!featuresStore.indexNames.contains(name)) {
						featuresStore.createIndex(name, keyPath, options);
					}
				});

				// Migrate existing features to include listIds if upgrading from version 1
				if (oldVersion < 2) {
					// Add listIds array to existing features
					const cursor = featuresStore.openCursor();
					cursor.onsuccess = (event) => {
						const cursor = (event.target as IDBRequest).result;
						if (cursor) {
							const feature = cursor.value;
							if (!feature.listIds) {
								feature.listIds = [];
								cursor.update(feature);
							}
							cursor.continue();
						}
					};
				}
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
	 * Store or update a feature
	 */
	async storeFeature(
		mapFeature: any,
		action: 'bookmark' | 'visited' | 'todo' = 'bookmark'
	): Promise<StoredFeature> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const featureId = this.getFeatureId(mapFeature);
		const names = this.extractNames(mapFeature.properties);

		// Check if feature already exists
		const existingFeature = await this.getFeatureById(featureId);
		const now = Date.now();

		// Calculate if feature will be bookmarked after this action
		const willBeBookmarked =
			existingFeature?.bookmarked || action === 'bookmark' || action === 'visited';

		const storedFeature: StoredFeature = {
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
			todo: existingFeature?.todo || (action === 'todo' && willBeBookmarked), // todo requires bookmarking

			dateCreated: existingFeature?.dateCreated || now,
			dateModified: now,

			searchText: '' // Will be set below
		};

		// Generate searchable text
		storedFeature.searchText = this.generateSearchText(storedFeature);

		// Store in database
		const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(storedFeature);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerBookmarkChange(); // Trigger reactivity
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
	 * Update an existing feature
	 */
	async updateFeature(feature: StoredFeature): Promise<StoredFeature> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		feature.searchText = this.generateSearchText(feature);
		feature.dateModified = Date.now();

		const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(feature);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerBookmarkChange(); // Trigger reactivity
		return feature;
	}

	/**
	 * Get feature by ID
	 */
	async getFeatureById(id: string): Promise<StoredFeature | null> {
		await this.ensureInitialized();
		if (!this.db) return null;

		const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.get(id);
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Search features with text query
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

		const {
			limit = 50,
			bookmarkedOnly = false,
			visitedOnly = false,
			todoOnly = false,
			categoryFilter,
			classFilter
		} = options;

		const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORE_NAME);

		let features: StoredFeature[] = [];

		// Get features using appropriate index
		if (bookmarkedOnly) {
			// Get all features and filter for bookmarked ones
			const allFeatures = await this.getAllFeatures(store);
			features = allFeatures.filter((f) => f.bookmarked === true);
		} else if (visitedOnly) {
			// Get features that have at least one visit
			const allFeatures = await this.getAllFeatures(store);
			features = allFeatures.filter((f) => f.visitedDates && f.visitedDates.length > 0);
		} else if (todoOnly) {
			// Get all features and filter for todo ones
			const allFeatures = await this.getAllFeatures(store);
			features = allFeatures.filter((f) => f.todo === true);
		} else if (categoryFilter) {
			features = await this.getFeaturesByIndex(store, this.INDEX_CATEGORY, categoryFilter);
		} else if (classFilter) {
			features = await this.getFeaturesByIndex(store, this.INDEX_CLASS, classFilter);
		} else {
			features = await this.getAllFeatures(store);
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
	 * Get all features
	 */
	private async getAllFeatures(store: IDBObjectStore): Promise<StoredFeature[]> {
		return new Promise((resolve, reject) => {
			const features: StoredFeature[] = [];
			const request = store.openCursor();

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

		const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORE_NAME);
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
	 * Update statistics
	 */
	private async updateStats(): Promise<void> {
		if (!this.db) return;

		try {
			const transaction = this.db.transaction([this.STORE_NAME, this.LISTS_STORE_NAME], 'readonly');
			const featuresStore = transaction.objectStore(this.STORE_NAME);
			const listsStore = transaction.objectStore(this.LISTS_STORE_NAME);

			const [total, bookmarked, visited, todo, lists] = await Promise.all([
				this.countFeatures(featuresStore),
				this.countBookmarkedFeatures(featuresStore), // Use custom method instead of index
				this.countVisitedFeatures(featuresStore),
				this.countTodoFeatures(featuresStore), // Use custom method instead of index
				this.countBookmarkLists(listsStore)
			]);

			this._stats = { total, bookmarked, visited, todo, lists };
		} catch (error) {
			console.error('Failed to update stats:', error);
		}
	}

	/**
	 * Count all features
	 */
	private async countFeatures(store: IDBObjectStore): Promise<number> {
		return new Promise((resolve, reject) => {
			const request = store.count();
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
	 * Count visited features (features with at least one visit)
	 */
	private async countVisitedFeatures(store: IDBObjectStore): Promise<number> {
		return new Promise((resolve, reject) => {
			let count = 0;
			const request = store.openCursor();

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
	 * Count bookmark lists
	 */
	private async countBookmarkLists(store: IDBObjectStore): Promise<number> {
		return new Promise((resolve, reject) => {
			const request = store.count();
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Count bookmarked features (features with bookmarked = true)
	 */
	private async countBookmarkedFeatures(store: IDBObjectStore): Promise<number> {
		return new Promise((resolve, reject) => {
			let count = 0;
			const request = store.openCursor();

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
	 * Count todo features (features with todo = true)
	 */
	private async countTodoFeatures(store: IDBObjectStore): Promise<number> {
		return new Promise((resolve, reject) => {
			let count = 0;
			const request = store.openCursor();

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
	 * Delete a feature
	 */
	async deleteFeature(id: string): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.delete(id);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		this.triggerBookmarkChange(); // Trigger reactivity
	}

	/**
	 * Clear all features
	 */
	async clearAllFeatures(): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.clear();
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		this._stats.total = 0;
		this._stats.bookmarked = 0;
		this._stats.visited = 0;
		this._stats.todo = 0;
		this.triggerBookmarkChange(); // Trigger reactivity
	}

	/**
	 * Clear all bookmark lists
	 */
	async clearAllBookmarkLists(): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

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

		// Then clear all lists
		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.clear();
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

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
	 * Export all features for backup
	 */
	async exportFeatures(): Promise<StoredFeature[]> {
		const results = await this.searchFeatures('');
		return results.map((r) => r.feature);
	}

	/**
	 * Import features from backup
	 */
	async importFeatures(features: StoredFeature[]): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

		const transaction = this.db.transaction([this.STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORE_NAME);

		for (const feature of features) {
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
	 * Create a new bookmark list
	 */
	async createBookmarkList(listData: {
		name: string;
		description?: string;
		category?: string;
		color?: string;
	}): Promise<BookmarkList> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const now = Date.now();
		const listId = `list-${now}-${Math.random().toString(36).substr(2, 9)}`;

		const bookmarkList: BookmarkList = {
			id: listId,
			name: listData.name,
			description: listData.description,
			category: listData.category,
			color: listData.color,
			featureIds: [],
			dateCreated: now,
			dateModified: now
		};

		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(bookmarkList);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		return bookmarkList;
	}

	/**
	 * Get all bookmark lists
	 */
	async getAllBookmarkLists(): Promise<BookmarkList[]> {
		await this.ensureInitialized();
		if (!this.db) return [];

		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		return new Promise((resolve, reject) => {
			const lists: BookmarkList[] = [];
			const request = store.openCursor();

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
	 * Get bookmark list by ID
	 */
	async getBookmarkListById(listId: string): Promise<BookmarkList | null> {
		await this.ensureInitialized();
		if (!this.db) return null;

		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.get(listId);
			request.onsuccess = () => resolve(request.result || null);
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Update bookmark list
	 */
	async updateBookmarkList(list: BookmarkList): Promise<BookmarkList> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		list.dateModified = Date.now();

		const transaction = this.db.transaction([this.LISTS_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.LISTS_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(list);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		await this.updateStats();
		return list;
	}

	/**
	 * Delete bookmark list
	 */
	async deleteBookmarkList(listId: string): Promise<void> {
		await this.ensureInitialized();
		if (!this.db) return;

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
			const request = store.delete(listId);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

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

		const transaction = this.db.transaction([this.STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORE_NAME);
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
	 * Get lists that contain a specific feature
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
}

// Create singleton instance
export const featuresDB = new FeaturesDB();
