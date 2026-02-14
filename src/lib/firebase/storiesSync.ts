import {
	collection,
	doc,
	getDoc,
	setDoc,
	updateDoc,
	deleteDoc,
	getDocs,
	query,
	where,
	orderBy,
	limit,
	writeBatch,
	serverTimestamp,
	Timestamp,
	type DocumentData,
	type QueryDocumentSnapshot,
	onSnapshot,
	type Unsubscribe
} from 'firebase/firestore';
import { db } from '$lib/firebase';
import { user } from '$lib/stores/auth';
import { storiesDB } from '$lib/stores/StoriesDB.svelte';
import { get } from 'svelte/store';

/**
 * Firebase sync utilities for stories
 * Handles syncing stories between local IndexedDB and Firestore
 */

// Use user-scoped subcollections like features and bookmark lists
// Structure: users/{userId}/stories/{storyId}
// Structure: users/{userId}/story_versions/{versionId}
// Structure: users/{userId}/sync_metadata/stories

export interface FirestoreStory {
	id: string;
	userId: string;
	title: string;
	description?: string;
	content: StoryContentNode[];
	tags: string[];
	categories: string[];
	dateCreated: Timestamp;
	dateModified: Timestamp;
	viewCount?: number;
	isPublic: boolean;
	currentVersion: number;
	searchText: string;
	deleted?: boolean;

	// Firestore metadata
	firestoreCreated?: Timestamp;
	firestoreModified?: Timestamp;
}

export interface SyncResult {
	success: boolean;
	uploadedStories: number;
	downloadedStories: number;
	conflicts: SyncConflict[];
	errors: string[];
}

export class StoriesSync {
	private static instance: StoriesSync;
	private syncInProgress = false;
	private realtimeUnsubscribe: Unsubscribe | null = null;

	static getInstance(): StoriesSync {
		if (!StoriesSync.instance) {
			StoriesSync.instance = new StoriesSync();
		}
		return StoriesSync.instance;
	}

	/**
	 * Convert Story to Firestore format
	 */
	private toFirestoreStory(story: Story): FirestoreStory {
		// Create base object with required fields
		const firestoreStory: FirestoreStory = {
			id: story.id,
			userId: story.userId,
			title: story.title,
			content: story.content,
			tags: story.tags || [],
			categories: story.categories || [],
			dateCreated: Timestamp.fromMillis(story.dateCreated),
			dateModified: Timestamp.fromMillis(story.dateModified),
			isPublic: story.isPublic || false,
			currentVersion: story.currentVersion || 1,
			searchText: story.searchText || '',
			firestoreModified: serverTimestamp() as Timestamp
		};

		// Only add optional fields if they have values
		if (story.description !== undefined && story.description !== null && story.description !== '') {
			firestoreStory.description = story.description;
		}

		if (story.viewCount !== undefined && story.viewCount !== null) {
			firestoreStory.viewCount = story.viewCount;
		}

		if (story.deleted !== undefined && story.deleted !== null) {
			firestoreStory.deleted = story.deleted;
		}

		return firestoreStory;
	}

	/**
	 * Convert Firestore document to Story
	 */
	private fromFirestoreStory(doc: QueryDocumentSnapshot<DocumentData>): Story {
		const data = doc.data() as FirestoreStory;

		return {
			id: data.id,
			userId: data.userId,
			title: data.title,
			description: data.description || undefined, // Convert empty string or null to undefined
			content: data.content || [],
			tags: data.tags || [],
			categories: data.categories || [],
			dateCreated: data.dateCreated.toMillis(),
			dateModified: data.dateModified.toMillis(),
			viewCount: data.viewCount || 0,
			isPublic: data.isPublic || false,
			currentVersion: data.currentVersion || 1,
			searchText: data.searchText || '',
			deleted: data.deleted || false,
			firestoreId: doc.id,
			lastSyncTimestamp: Date.now()
		};
	}

	/**
	 * Upload a single story to Firestore (user-scoped)
	 */
	async uploadStory(story: Story): Promise<void> {
		console.log('⬆️ Uploading story to Firestore:', story.id);

		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User not authenticated');
		}

		try {
			const firestoreStory = this.toFirestoreStory(story);
			// Use user-scoped subcollection like features
			const storyRef = doc(db, 'users', currentUser.uid, 'stories', story.id);

			await setDoc(storyRef, firestoreStory, { merge: true });

			console.log('✅ Story uploaded successfully:', story.id);
		} catch (error) {
			console.error('❌ Failed to upload story:', error);
			throw error;
		}
	}

	/**
	 * Download a single story from Firestore (user-scoped)
	 */
	async downloadStory(storyId: string): Promise<Story | null> {
		console.log('⬇️ Downloading story from Firestore:', storyId);

		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User not authenticated');
		}

		try {
			// Use user-scoped subcollection like features
			const storyRef = doc(db, 'users', currentUser.uid, 'stories', storyId);
			const storySnap = await getDoc(storyRef);

			if (!storySnap.exists()) {
				console.log('📭 Story not found in Firestore:', storyId);
				return null;
			}

			const story = this.fromFirestoreStory(storySnap as QueryDocumentSnapshot<DocumentData>);
			console.log('✅ Story downloaded successfully:', story.id);
			return story;
		} catch (error) {
			console.error('❌ Failed to download story:', error);
			throw error;
		}
	}

	/**
	 * Full sync: upload local changes and download remote changes
	 */
	async performFullSync(): Promise<SyncResult> {
		console.log('🔄 Starting full stories sync...');

		if (this.syncInProgress) {
			console.log('⚠️ Sync already in progress, skipping');
			return {
				success: false,
				uploadedStories: 0,
				downloadedStories: 0,
				conflicts: [],
				errors: ['Sync already in progress']
			};
		}

		const currentUser = get(user);
		if (!currentUser) {
			return {
				success: false,
				uploadedStories: 0,
				downloadedStories: 0,
				conflicts: [],
				errors: ['User not authenticated']
			};
		}

		this.syncInProgress = true;
		const result: SyncResult = {
			success: true,
			uploadedStories: 0,
			downloadedStories: 0,
			conflicts: [],
			errors: []
		};

		try {
			// Ensure local database is initialized
			await storiesDB.ensureInitialized();

			// Get local stories
			const localStories = await storiesDB.getAllStories();
			console.log(`📱 Found ${localStories.length} local stories`);

			// Get remote stories
			const remoteStories = await this.getAllRemoteStories(currentUser.uid);
			console.log(`☁️ Found ${remoteStories.length} remote stories`);

			// Create maps for efficient lookup
			const localStoriesMap = new Map(localStories.map((s) => [s.id, s]));
			const remoteStoriesMap = new Map(remoteStories.map((s) => [s.id, s]));

			// Upload new/modified local stories
			for (const localStory of localStories) {
				const remoteStory = remoteStoriesMap.get(localStory.id);

				if (!remoteStory) {
					// New story - upload it
					try {
						await this.uploadStory(localStory);
						result.uploadedStories++;
					} catch (error) {
						result.errors.push(`Failed to upload story ${localStory.id}: ${error}`);
					}
				} else {
					// Story exists remotely - check if local is newer
					if (localStory.dateModified > remoteStory.dateModified) {
						// Local is newer - upload it
						try {
							await this.uploadStory(localStory);
							result.uploadedStories++;
						} catch (error) {
							result.errors.push(`Failed to upload story ${localStory.id}: ${error}`);
						}
					} else if (remoteStory.dateModified > localStory.dateModified) {
						// Remote is newer - download it
						try {
							await this.syncRemoteStoryToLocal(remoteStory);
							result.downloadedStories++;
						} catch (error) {
							result.errors.push(`Failed to download story ${remoteStory.id}: ${error}`);
						}
					}
					// If dates are equal, no sync needed
				}
			}

			// Download new remote stories (not in local)
			for (const remoteStory of remoteStories) {
				if (!localStoriesMap.has(remoteStory.id)) {
					try {
						await this.syncRemoteStoryToLocal(remoteStory);
						result.downloadedStories++;
					} catch (error) {
						result.errors.push(`Failed to download new story ${remoteStory.id}: ${error}`);
					}
				}
			}

			// Update sync metadata
			await this.updateSyncMetadata(currentUser.uid);

			console.log('✅ Full sync completed:', result);
			return result;
		} catch (error) {
			console.error('❌ Sync failed:', error);
			result.success = false;
			result.errors.push(error instanceof Error ? error.message : 'Unknown sync error');
			return result;
		} finally {
			this.syncInProgress = false;
		}
	}

	/**
	 * Get all remote stories for a user (user-scoped subcollection)
	 */
	private async getAllRemoteStories(userId: string): Promise<Story[]> {
		console.log('☁️ Fetching all remote stories for user:', userId);

		try {
			// Use user-scoped subcollection like features
			const storiesQuery = query(
				collection(db, 'users', userId, 'stories'),
				where('deleted', '!=', true),
				orderBy('dateModified', 'desc')
			);

			const querySnapshot = await getDocs(storiesQuery);
			const stories = querySnapshot.docs.map((doc) => this.fromFirestoreStory(doc));

			console.log(`✅ Fetched ${stories.length} remote stories`);
			return stories;
		} catch (error) {
			console.error('❌ Failed to fetch remote stories:', error);
			throw error;
		}
	}

	/**
	 * Sync a remote story to local database
	 */
	private async syncRemoteStoryToLocal(remoteStory: Story): Promise<void> {
		console.log('📥 Syncing remote story to local:', remoteStory.id);

		try {
			// Check if story exists locally
			const existingStory = await storiesDB.getStoryById(remoteStory.id);

			if (existingStory) {
				// Update existing story
				await storiesDB.updateStory(
					remoteStory.id,
					{
						title: remoteStory.title,
						description: remoteStory.description,
						content: remoteStory.content,
						tags: remoteStory.tags,
						categories: remoteStory.categories,
						isPublic: remoteStory.isPublic
					},
					'Synced from Firestore'
				);
			} else {
				// Create new story locally (need to call createStory through the local API)
				await storiesDB.createStory(remoteStory.title, remoteStory.content, {
					description: remoteStory.description,
					tags: remoteStory.tags,
					categories: remoteStory.categories,
					isPublic: remoteStory.isPublic
				});
			}

			console.log('✅ Remote story synced to local:', remoteStory.id);
		} catch (error) {
			console.error('❌ Failed to sync remote story to local:', error);
			throw error;
		}
	}

	/**
	 * Delete a story from Firestore (user-scoped)
	 */
	async deleteStoryFromFirestore(storyId: string): Promise<void> {
		console.log('🗑️ Deleting story from Firestore:', storyId);

		const currentUser = get(user);
		if (!currentUser) {
			throw new Error('User not authenticated');
		}

		try {
			// Use user-scoped subcollection like features
			const storyRef = doc(db, 'users', currentUser.uid, 'stories', storyId);

			// Soft delete by updating the deleted flag
			await updateDoc(storyRef, {
				deleted: true,
				firestoreModified: serverTimestamp()
			});

			console.log('✅ Story soft-deleted in Firestore:', storyId);
		} catch (error) {
			console.error('❌ Failed to delete story from Firestore:', error);
			throw error;
		}
	}

	/**
	 * Start real-time sync listening (user-scoped subcollection)
	 */
	startRealtimeSync(): void {
		const currentUser = get(user);
		if (!currentUser || this.realtimeUnsubscribe) {
			return;
		}

		console.log('🔄 Starting real-time sync for stories...');

		// Use user-scoped subcollection like features
		const storiesQuery = query(
			collection(db, 'users', currentUser.uid, 'stories'),
			where('deleted', '!=', true),
			orderBy('dateModified', 'desc')
		);

		this.realtimeUnsubscribe = onSnapshot(
			storiesQuery,
			async (snapshot) => {
				console.log('🔄 Firestore stories changed, processing updates...');

				for (const docChange of snapshot.docChanges()) {
					try {
						if (docChange.type === 'added' || docChange.type === 'modified') {
							const remoteStory = this.fromFirestoreStory(docChange.doc);
							await this.syncRemoteStoryToLocal(remoteStory);
						}
						// Handle deletion if needed
					} catch (error) {
						console.error('❌ Failed to sync real-time story change:', error);
					}
				}
			},
			(error) => {
				console.error('❌ Real-time sync error:', error);
			}
		);

		console.log('✅ Real-time sync started');
	}

	/**
	 * Stop real-time sync listening
	 */
	stopRealtimeSync(): void {
		if (this.realtimeUnsubscribe) {
			console.log('⏹️ Stopping real-time sync...');
			this.realtimeUnsubscribe();
			this.realtimeUnsubscribe = null;
		}
	}

	/**
	 * Update sync metadata (user-scoped)
	 */
	private async updateSyncMetadata(userId: string): Promise<void> {
		try {
			// Store sync metadata in user's subcollection like features
			// Use 'sync_metadata' to match the security rules pattern
			const metadataRef = doc(db, 'users', userId, 'sync_metadata', 'stories');
			await setDoc(
				metadataRef,
				{
					userId,
					lastSyncTimestamp: serverTimestamp(),
					dataType: 'stories',
					syncVersion: 1
				},
				{ merge: true }
			);
		} catch (error) {
			console.error('❌ Failed to update sync metadata:', error);
		}
	}

	/**
	 * Get sync status (user-scoped)
	 */
	async getSyncStatus(userId: string): Promise<{ lastSync: Date | null; syncInProgress: boolean }> {
		try {
			// Get sync metadata from user's subcollection like features
			// Use 'sync_metadata' to match the security rules pattern
			const metadataRef = doc(db, 'users', userId, 'sync_metadata', 'stories');
			const metadataSnap = await getDoc(metadataRef);

			let lastSync: Date | null = null;
			if (metadataSnap.exists()) {
				const data = metadataSnap.data();
				if (data.lastSyncTimestamp) {
					lastSync = (data.lastSyncTimestamp as Timestamp).toDate();
				}
			}

			return {
				lastSync,
				syncInProgress: this.syncInProgress
			};
		} catch (error) {
			console.error('❌ Failed to get sync status:', error);
			return {
				lastSync: null,
				syncInProgress: this.syncInProgress
			};
		}
	}
}

// Export singleton instance
export const storiesSync = StoriesSync.getInstance();
