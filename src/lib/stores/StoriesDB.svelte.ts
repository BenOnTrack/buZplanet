import { appState } from './AppState.svelte';
import { user } from './auth';
import { get } from 'svelte/store';
import { storiesSync } from '$lib/firebase/storiesSync';

/**
 * Stories database store for managing story data with IndexedDB
 * Handles CRUD operations, search, and versioning for stories
 */
class StoriesDB {
	private db = $state<IDBDatabase | null>(null);
	private _initialized = $state(false);
	private initializationPromise: Promise<void> | null = null;

	// Reactive signal for data changes - increment this when stories change
	private _changeSignal = $state(0);

	// Public getter for change signal to trigger reactivity
	get changeSignal(): number {
		return this._changeSignal;
	}

	// Trigger change notification
	private notifyChange(): void {
		this._changeSignal++;
		console.log('📢 Stories data changed, signal:', this._changeSignal);
	}

	// Database configuration
	private readonly DB_NAME = 'BuzplanetStoriesDB';
	private readonly DB_VERSION = 1;
	private readonly STORES = {
		STORIES: 'stories',
		VERSIONS: 'story_versions',
		CATEGORIES: 'story_categories'
	} as const;

	// Getters
	get initialized(): boolean {
		return this._initialized;
	}

	/**
	 * Ensure the database is initialized
	 */
	async ensureInitialized(): Promise<void> {
		if (this._initialized) return;

		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = this.initialize();
		await this.initializationPromise;
	}

	/**
	 * Initialize the IndexedDB database
	 */
	private async initialize(): Promise<void> {
		try {
			console.log('📚 Initializing StoriesDB...');

			// Ensure appState is initialized first
			console.log('🔄 Ensuring appState is initialized...');
			await appState.ensureInitialized();
			console.log('✅ AppState initialized');

			console.log('🗃️ Opening IndexedDB...');
			const db = await new Promise<IDBDatabase>((resolve, reject) => {
				console.log('💾 Opening database:', this.DB_NAME, 'version:', this.DB_VERSION);
				const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

				request.onerror = () => {
					console.error('❌ Failed to open StoriesDB:', request.error);
					reject(request.error);
				};

				request.onsuccess = () => {
					console.log('✅ StoriesDB opened successfully');
					resolve(request.result);
				};

				request.onupgradeneeded = (event) => {
					console.log('🔄 Upgrading StoriesDB schema...');
					const db = (event.target as IDBOpenDBRequest).result;

					// Create stories store
					if (!db.objectStoreNames.contains(this.STORES.STORIES)) {
						const storiesStore = db.createObjectStore(this.STORES.STORIES, { keyPath: 'id' });
						storiesStore.createIndex('userId', 'userId', { unique: false });
						storiesStore.createIndex('dateCreated', 'dateCreated', { unique: false });
						storiesStore.createIndex('dateModified', 'dateModified', { unique: false });
						storiesStore.createIndex('categories', 'categories', {
							unique: false,
							multiEntry: true
						});
						storiesStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
						storiesStore.createIndex('searchText', 'searchText', { unique: false });
						storiesStore.createIndex('isPublic', 'isPublic', { unique: false });
						console.log('✅ Created stories object store with indexes');
					}

					// Create story versions store
					if (!db.objectStoreNames.contains(this.STORES.VERSIONS)) {
						const versionsStore = db.createObjectStore(this.STORES.VERSIONS, { keyPath: 'id' });
						versionsStore.createIndex('storyId', 'storyId', { unique: false });
						versionsStore.createIndex('versionNumber', 'versionNumber', { unique: false });
						versionsStore.createIndex('dateCreated', 'dateCreated', { unique: false });
						console.log('✅ Created story versions object store with indexes');
					}

					// Create story categories store
					if (!db.objectStoreNames.contains(this.STORES.CATEGORIES)) {
						const categoriesStore = db.createObjectStore(this.STORES.CATEGORIES, { keyPath: 'id' });
						categoriesStore.createIndex('name', 'name', { unique: true });
						console.log('✅ Created story categories object store with indexes');
					}
				};
			});

			this.db = db;
			console.log('✅ StoriesDB initialization complete');
			this._initialized = true;
		} catch (error) {
			console.error('❌ Failed to initialize StoriesDB:', error);
			throw error;
		}
	}

	/**
	 * Clean story data for IndexedDB storage (remove non-cloneable objects)
	 */
	private cleanStoryData(story: Story): Story {
		console.log('🧽 Cleaning story data for storage...');

		try {
			// Create a completely clean object by explicitly mapping all fields
			const cleanedStory: Story = {
				id: String(story.id || ''),
				userId: String(story.userId || ''),
				title: String(story.title || ''),
				content: Array.isArray(story.content)
					? story.content.map((node) => {
							if (node && typeof node === 'object' && node.type === 'text') {
								return {
									type: 'text' as const,
									text: String(node.text || '')
								};
							} else if (node && typeof node === 'object' && node.type === 'feature') {
								// Create a clean feature object with only serializable data
								const cleanFeature: any = {
									id: String(node.feature?.id || ''),
									names: {}
								};

								// Safely copy names object
								if (node.feature?.names && typeof node.feature.names === 'object') {
									for (const [key, value] of Object.entries(node.feature.names)) {
										if (typeof value === 'string') {
											cleanFeature.names[key] = value;
										}
									}
								}

								// Add type-specific properties safely
								if (node.feature && 'lng' in node.feature && typeof node.feature.lng === 'number') {
									// SearchResult properties
									cleanFeature.lng = Number(node.feature.lng);
									cleanFeature.lat = Number(node.feature.lat || 0);
									cleanFeature.database = String(node.feature.database || '');
									cleanFeature.layer = String(node.feature.layer || '');
									cleanFeature.zoom = Number(node.feature.zoom || 0);
									cleanFeature.tileX = Number(node.feature.tileX || 0);
									cleanFeature.tileY = Number(node.feature.tileY || 0);
								}

								if (node.feature && 'geometry' in node.feature) {
									// StoredFeature properties - safely serialize geometry
									try {
										cleanFeature.geometry = JSON.parse(JSON.stringify(node.feature.geometry));
									} catch (geometryError) {
										console.warn('⚠️ Failed to serialize geometry, using null:', geometryError);
										cleanFeature.geometry = null;
									}
									cleanFeature.source = String(node.feature.source || '');
									if (node.feature.sourceLayer) {
										cleanFeature.sourceLayer = String(node.feature.sourceLayer);
									}
								}

								// Common properties
								if (node.feature?.class) cleanFeature.class = String(node.feature.class);
								if (node.feature?.subclass) cleanFeature.subclass = String(node.feature.subclass);
								if (node.feature?.category) cleanFeature.category = String(node.feature.category);

								return {
									type: 'feature' as const,
									featureId: String(node.featureId || ''),
									displayText: String(node.displayText || ''),
									feature: cleanFeature,
									customText: node.customText ? String(node.customText) : undefined
								};
							}
							// If node is malformed, create a safe text node
							return {
								type: 'text' as const,
								text: '[Invalid content node]'
							};
						})
					: [],
				tags: Array.isArray(story.tags) ? story.tags.map((tag) => String(tag)).filter(Boolean) : [],
				categories: Array.isArray(story.categories)
					? story.categories.map((cat) => String(cat)).filter(Boolean)
					: [],
				dateCreated: Number(story.dateCreated) || Date.now(),
				dateModified: Number(story.dateModified) || Date.now(),
				viewCount: Number(story.viewCount) || 0,
				isPublic: Boolean(story.isPublic),
				currentVersion: Number(story.currentVersion) || 1,
				searchText: String(story.searchText || '')
			};

			// Only add optional string fields if they have values
			if (story.description && typeof story.description === 'string' && story.description.trim()) {
				cleanedStory.description = story.description.trim();
			}

			// Add sync fields if present
			if (story.deleted !== undefined) {
				cleanedStory.deleted = Boolean(story.deleted);
			}

			if (story.firestoreId && typeof story.firestoreId === 'string') {
				cleanedStory.firestoreId = story.firestoreId;
			}

			if (story.lastSyncTimestamp && typeof story.lastSyncTimestamp === 'number') {
				cleanedStory.lastSyncTimestamp = story.lastSyncTimestamp;
			}

			console.log('✅ Story data cleaned for storage');
			return cleanedStory;
		} catch (error) {
			console.error('❌ Failed to clean story data:', error);
			console.error('Original story object:', story);

			// Fallback: create minimal safe story
			return {
				id: String(story.id || `fallback-${Date.now()}`),
				userId: String(story.userId || 'anonymous'),
				title: String(story.title || 'Untitled Story'),
				content: [],
				tags: [],
				categories: [],
				dateCreated: Date.now(),
				dateModified: Date.now(),
				viewCount: 0,
				isPublic: false,
				currentVersion: 1,
				searchText: String(story.title || 'Untitled Story').toLowerCase()
			};
		}
	}

	/**
	 * Create a new story
	 */
	async createStory(
		title: string,
		content: StoryContentNode[] = [],
		options: {
			description?: string;
			tags?: string[];
			categories?: string[];
			isPublic?: boolean;
		} = {}
	): Promise<Story> {
		console.log('📖 Creating new story...');
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		const now = Date.now();
		const storyId = `story-${now}-${Math.random().toString(36).substr(2, 9)}`;
		const userId = get(user)?.uid || 'anonymous';

		// Create story
		const story: Story = {
			id: storyId,
			userId,
			title,
			description: options.description,
			content: [...content],
			tags: options.tags || [],
			categories: options.categories || [],
			dateCreated: now,
			dateModified: now,
			viewCount: 0,
			isPublic: options.isPublic || false,
			currentVersion: 1,
			searchText: this.generateSearchText(title, content, options.tags, options.description)
		};

		// Clean the story data to ensure it can be stored in IndexedDB
		const cleanedStory = this.cleanStoryData(story);
		console.log('💾 Storing story in database...');

		const transaction = this.db.transaction([this.STORES.STORIES], 'readwrite');

		try {
			await new Promise<void>((resolve, reject) => {
				const request = transaction.objectStore(this.STORES.STORIES).add(cleanedStory);
				request.onsuccess = () => {
					console.log('✅ Story stored successfully');
					resolve();
				};
				request.onerror = () => {
					console.error('❌ Failed to store story:', request.error);
					reject(request.error);
				};
			});

			console.log('✅ Story created successfully:', story.id);
			this.notifyChange();

			// Sync to Firebase if user is authenticated
			const currentUser = get(user);
			if (currentUser && !story.userId.includes('anonymous')) {
				try {
					console.log('🔄 Auto-syncing new story to Firebase...');
					await storiesSync.uploadStory(story);
					console.log('✅ Story auto-synced to Firebase');
				} catch (error) {
					console.error('⚠️ Failed to auto-sync story to Firebase:', error);
					// Don't fail the creation if sync fails
				}
			}

			return story;
		} catch (error) {
			console.error('❌ Failed to create story:', error);
			throw error;
		}
	}

	/**
	 * Update an existing story
	 */
	async updateStory(
		storyId: string,
		updates: {
			title?: string;
			description?: string;
			content?: StoryContentNode[];
			tags?: string[];
			categories?: string[];
			isPublic?: boolean;
		},
		changeDescription?: string
	): Promise<Story> {
		console.log('✏️ Updating story:', storyId);
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		// Get the existing story first
		const existingStory = await this.getStoryById(storyId);
		if (!existingStory) {
			throw new Error(`Story with id ${storyId} not found`);
		}

		console.log('🔄 Found existing story:', existingStory);

		const now = Date.now();

		// Create updated story
		const updatedStory: Story = {
			...existingStory,
			...updates,
			dateModified: now,
			currentVersion: existingStory.currentVersion + 1,
			searchText: this.generateSearchText(
				updates.title || existingStory.title,
				updates.content || existingStory.content,
				updates.tags || existingStory.tags,
				updates.description !== undefined ? updates.description : existingStory.description
			)
		};

		// Clean the story data to ensure it can be stored in IndexedDB
		const cleanedStory = this.cleanStoryData(updatedStory);
		console.log('💾 Updating story in database...');

		const transaction = this.db.transaction([this.STORES.STORIES], 'readwrite');

		try {
			await new Promise<void>((resolve, reject) => {
				const request = transaction.objectStore(this.STORES.STORIES).put(cleanedStory);
				request.onsuccess = () => {
					console.log('✅ Story updated successfully');
					resolve();
				};
				request.onerror = () => {
					console.error('❌ Failed to update story:', request.error);
					reject(request.error);
				};
			});

			console.log('✅ Story updated successfully:', updatedStory.id);
			this.notifyChange();

			// Sync to Firebase if user is authenticated
			const currentUser = get(user);
			if (currentUser && !updatedStory.userId.includes('anonymous')) {
				try {
					console.log('🔄 Auto-syncing updated story to Firebase...');
					await storiesSync.uploadStory(updatedStory);
					console.log('✅ Story auto-synced to Firebase');
				} catch (error) {
					console.error('⚠️ Failed to auto-sync story to Firebase:', error);
					// Don't fail the update if sync fails
				}
			}

			return updatedStory;
		} catch (error) {
			console.error('❌ Failed to update story:', error);
			throw error;
		}
	}

	/**
	 * Get a story by ID
	 */
	async getStoryById(id: string): Promise<Story | null> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([this.STORES.STORIES], 'readonly');
			const request = transaction.objectStore(this.STORES.STORIES).get(id);

			request.onsuccess = () => {
				resolve(request.result || null);
			};

			request.onerror = () => {
				console.error('❌ Failed to get story:', request.error);
				reject(request.error);
			};
		});
	}
	/**
	 * Get all stories for current user
	 */
	async getAllStories(): Promise<Story[]> {
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		return new Promise((resolve, reject) => {
			const transaction = this.db!.transaction([this.STORES.STORIES], 'readonly');
			const index = transaction.objectStore(this.STORES.STORIES).index('userId');
			const request = index.getAll(get(user)?.uid || 'anonymous');

			request.onsuccess = () => {
				const stories = request.result.sort((a, b) => b.dateModified - a.dateModified);
				resolve(stories);
			};

			request.onerror = () => {
				console.error('❌ Failed to get all stories:', request.error);
				reject(request.error);
			};
		});
	}

	/**
	 * Generate searchable text from story content
	 */
	private generateSearchText(
		title: string,
		content: StoryContentNode[],
		tags?: string[],
		description?: string
	): string {
		const textParts = [title];

		if (description) {
			textParts.push(description);
		}

		// Extract text from content nodes
		for (const node of content) {
			if (node.type === 'text') {
				textParts.push(node.text);
			} else if (node.type === 'feature') {
				textParts.push(node.displayText);
				if (node.customText) {
					textParts.push(node.customText);
				}
			}
		}

		if (tags && tags.length > 0) {
			textParts.push(...tags);
		}

		return textParts.join(' ').toLowerCase();
	}

	/**
	 * Increment story view count
	 */
	async incrementViewCount(storyId: string): Promise<void> {
		console.log('👁️ Incrementing view count for story:', storyId);

		try {
			const story = await this.getStoryById(storyId);
			if (!story) {
				console.warn('⚠️ Story not found for view count increment:', storyId);
				return;
			}

			// Update view count
			const updatedStory: Story = {
				...story,
				viewCount: (story.viewCount || 0) + 1
			};

			// Clean and save updated story
			const cleanedStory = this.cleanStoryData(updatedStory);
			const transaction = this.db!.transaction([this.STORES.STORIES], 'readwrite');

			await new Promise<void>((resolve, reject) => {
				const request = transaction.objectStore(this.STORES.STORIES).put(cleanedStory);
				request.onsuccess = () => {
					console.log('✅ View count incremented to:', updatedStory.viewCount);
					resolve();
				};
				request.onerror = () => {
					console.error('❌ Failed to increment view count:', request.error);
					reject(request.error);
				};
			});
		} catch (error) {
			console.error('❌ Failed to increment view count:', error);
			// Don't throw - view count increment should be silent and not break the UI
		}
	}
	/**
	 * Delete a story (soft delete)
	 */
	async deleteStory(storyId: string): Promise<void> {
		console.log('🗑️ Soft deleting story:', storyId);
		await this.ensureInitialized();
		if (!this.db) throw new Error('Database not initialized');

		// Get the existing story first
		const existingStory = await this.getStoryById(storyId);
		if (!existingStory) {
			throw new Error(`Story with id ${storyId} not found`);
		}

		// Mark as deleted
		const deletedStory: Story = {
			...existingStory,
			deleted: true,
			dateModified: Date.now()
		};

		const cleanedStory = this.cleanStoryData(deletedStory);
		const transaction = this.db.transaction([this.STORES.STORIES], 'readwrite');

		try {
			await new Promise<void>((resolve, reject) => {
				const request = transaction.objectStore(this.STORES.STORIES).put(cleanedStory);
				request.onsuccess = () => {
					console.log('✅ Story soft deleted successfully');
					resolve();
				};
				request.onerror = () => {
					console.error('❌ Failed to soft delete story:', request.error);
					reject(request.error);
				};
			});

			console.log('✅ Story soft deleted successfully:', storyId);
			this.notifyChange();

			// Sync deletion to Firebase if user is authenticated
			const currentUser = get(user);
			if (currentUser && !deletedStory.userId.includes('anonymous')) {
				try {
					console.log('🔄 Syncing story deletion to Firebase...');
					await storiesSync.deleteStoryFromFirestore(storyId);
					console.log('✅ Story deletion synced to Firebase');
				} catch (error) {
					console.error('⚠️ Failed to sync story deletion to Firebase:', error);
				}
			}
		} catch (error) {
			console.error('❌ Failed to delete story:', error);
			throw error;
		}
	}

	/**
	 * Perform full sync with Firebase
	 */
	async syncWithFirebase(): Promise<{ success: boolean; message: string }> {
		console.log('🔄 Starting manual Firebase sync...');

		const currentUser = get(user);
		if (!currentUser) {
			return {
				success: false,
				message: 'User not authenticated'
			};
		}

		try {
			const result = await storiesSync.performFullSync();

			if (result.success) {
				// Refresh local data after sync
				this.notifyChange();

				return {
					success: true,
					message: `Sync completed: ${result.uploadedStories} uploaded, ${result.downloadedStories} downloaded`
				};
			} else {
				return {
					success: false,
					message: `Sync failed: ${result.errors.join(', ')}`
				};
			}
		} catch (error) {
			console.error('❌ Manual sync failed:', error);
			return {
				success: false,
				message: error instanceof Error ? error.message : 'Unknown sync error'
			};
		}
	}

	/**
	 * Start real-time sync with Firebase
	 */
	startRealtimeSync(): void {
		const currentUser = get(user);
		if (currentUser) {
			console.log('🔄 Starting real-time sync with Firebase...');
			storiesSync.startRealtimeSync();
		}
	}

	/**
	 * Stop real-time sync with Firebase
	 */
	stopRealtimeSync(): void {
		console.log('⏹️ Stopping real-time sync with Firebase...');
		storiesSync.stopRealtimeSync();
	}

	/**
	 * Get sync status
	 */
	async getSyncStatus(): Promise<{ lastSync: Date | null; syncInProgress: boolean }> {
		const currentUser = get(user);
		if (!currentUser) {
			return {
				lastSync: null,
				syncInProgress: false
			};
		}

		return await storiesSync.getSyncStatus(currentUser.uid);
	}

	/**
	 * Get all story categories (return empty array for now)
	 */
	async getAllCategories(): Promise<StoryCategory[]> {
		return [];
	}
}

// Create singleton instance
export const storiesDB = new StoriesDB();
