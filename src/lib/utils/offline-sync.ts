import { browser } from '$app/environment';
import { db } from '$lib/firebase';
import {
	collection,
	doc,
	setDoc,
	deleteDoc,
	serverTimestamp,
	writeBatch,
	getDoc
} from 'firebase/firestore';

export interface SyncQueueItem {
	id: string;
	type: 'feature' | 'story' | 'category' | 'list' | 'followed-story';
	action: 'create' | 'update' | 'delete';
	userId: string;
	data?: any; // The data to sync (null for deletes)
	timestamp: number; // When the change was made
	retryCount: number;
	lastAttempt?: number;
}

export interface SyncResult {
	success: boolean;
	processedCount: number;
	failedCount: number;
	errors: Array<{ item: SyncQueueItem; error: string }>;
}

/**
 * Offline-first sync manager
 * Handles queuing changes made while offline and syncing them when connection is restored
 */
export class OfflineSyncManager {
	private readonly DB_NAME = 'SyncQueueDB';
	private readonly DB_VERSION = 1;
	private readonly QUEUE_STORE_NAME = 'syncQueue';

	private db: IDBDatabase | null = null;
	private isInitialized = false;
	private currentUserId: string | null = null;
	private isSyncing = false;
	private isOnline = true;

	// Retry configuration
	private readonly MAX_RETRIES = 5;
	private readonly BASE_RETRY_DELAY = 1000; // 1 second
	private readonly MAX_RETRY_DELAY = 30000; // 30 seconds

	constructor() {
		if (browser) {
			// Listen to online/offline events
			this.isOnline = navigator.onLine;

			window.addEventListener('online', () => {
				console.log('🌐 Connection restored - starting sync');
				this.isOnline = true;
				this.processSyncQueue();
			});

			window.addEventListener('offline', () => {
				console.log('📴 Connection lost - sync paused');
				this.isOnline = false;
			});
		}
	}

	/**
	 * Initialize the sync manager for a specific user
	 */
	async initialize(userId: string | null): Promise<void> {
		if (this.currentUserId === userId && this.isInitialized) {
			return; // Already initialized for this user
		}

		this.currentUserId = userId;

		if (!browser || typeof indexedDB === 'undefined') {
			console.warn('IndexedDB not available for sync queue');
			this.isInitialized = true;
			return;
		}

		try {
			this.db = await this.openDatabase();
			this.isInitialized = true;

			console.log(`🔄 Sync manager initialized for user: ${userId || 'anonymous'}`);

			// Process any existing queue items when initializing
			if (this.isOnline) {
				setTimeout(() => this.processSyncQueue(), 1000);
			}
		} catch (error) {
			console.error('Failed to initialize sync manager:', error);
			this.isInitialized = true; // Continue without sync queue
		}
	}

	/**
	 * Open IndexedDB for sync queue
	 */
	private openDatabase(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				// Create sync queue store
				const store = db.createObjectStore(this.QUEUE_STORE_NAME, { keyPath: 'id' });

				// Create indexes for efficient querying
				store.createIndex('userId', 'userId', { unique: false });
				store.createIndex('timestamp', 'timestamp', { unique: false });
				store.createIndex('retryCount', 'retryCount', { unique: false });
			};
		});
	}

	/**
	 * Queue a change for sync
	 */
	async queueChange(
		type: SyncQueueItem['type'],
		action: SyncQueueItem['action'],
		itemId: string,
		data?: any
	): Promise<void> {
		if (!this.isInitialized || !this.currentUserId) {
			console.warn('Sync manager not initialized, cannot queue change');
			return;
		}

		const queueItem: SyncQueueItem = {
			id: `${this.currentUserId}-${type}-${itemId}-${Date.now()}`,
			type,
			action,
			userId: this.currentUserId,
			data: data ? this.cleanForFirestore(data) : null,
			timestamp: Date.now(),
			retryCount: 0
		};

		try {
			await this.addToQueue(queueItem);
			console.log(`📝 Queued ${action} for ${type} ${itemId}`);

			// If online, try to sync immediately
			if (this.isOnline) {
				setTimeout(() => this.processSyncQueue(), 100);
			}
		} catch (error) {
			console.error('Failed to queue change:', error);
		}
	}

	/**
	 * Add item to sync queue
	 */
	private async addToQueue(item: SyncQueueItem): Promise<void> {
		if (!this.db) return;

		const transaction = this.db.transaction([this.QUEUE_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.QUEUE_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.put(item);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Get all queued items for current user
	 */
	private async getQueuedItems(): Promise<SyncQueueItem[]> {
		if (!this.db || !this.currentUserId) return [];

		const transaction = this.db.transaction([this.QUEUE_STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.QUEUE_STORE_NAME);
		const index = store.index('userId');

		return new Promise((resolve, reject) => {
			const items: SyncQueueItem[] = [];
			const request = index.openCursor(IDBKeyRange.only(this.currentUserId));

			request.onsuccess = (event) => {
				const cursor = (event.target as IDBRequest).result;
				if (cursor) {
					items.push(cursor.value);
					cursor.continue();
				} else {
					// Sort by timestamp (oldest first)
					resolve(items.sort((a, b) => a.timestamp - b.timestamp));
				}
			};

			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Remove item from sync queue
	 */
	private async removeFromQueue(itemId: string): Promise<void> {
		if (!this.db) return;

		const transaction = this.db.transaction([this.QUEUE_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.QUEUE_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.delete(itemId);
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});
	}

	/**
	 * Update retry count for a queue item
	 */
	private async updateRetryCount(item: SyncQueueItem): Promise<void> {
		item.retryCount++;
		item.lastAttempt = Date.now();
		await this.addToQueue(item);
	}

	/**
	 * Process the sync queue
	 */
	async processSyncQueue(): Promise<SyncResult> {
		if (!this.isOnline || this.isSyncing || !this.currentUserId) {
			return { success: false, processedCount: 0, failedCount: 0, errors: [] };
		}

		this.isSyncing = true;
		console.log('🔄 Processing sync queue...');

		try {
			const queuedItems = await this.getQueuedItems();
			console.log(`📋 Found ${queuedItems.length} items in sync queue`);

			if (queuedItems.length === 0) {
				return { success: true, processedCount: 0, failedCount: 0, errors: [] };
			}

			const results: SyncResult = {
				success: true,
				processedCount: 0,
				failedCount: 0,
				errors: []
			};

			// Process items in batches to avoid overwhelming Firestore
			const batchSize = 10;
			for (let i = 0; i < queuedItems.length; i += batchSize) {
				const batch = queuedItems.slice(i, i + batchSize);
				await this.processBatch(batch, results);

				// Small delay between batches
				if (i + batchSize < queuedItems.length) {
					await new Promise((resolve) => setTimeout(resolve, 100));
				}
			}

			console.log(
				`✅ Sync complete: ${results.processedCount} processed, ${results.failedCount} failed`
			);

			if (results.errors.length > 0) {
				console.log('❌ Sync errors:', results.errors);
				results.success = false;
			}

			return results;
		} catch (error) {
			console.error('Sync queue processing failed:', error);
			return {
				success: false,
				processedCount: 0,
				failedCount: 0,
				errors: [{ item: {} as SyncQueueItem, error: String(error) }]
			};
		} finally {
			this.isSyncing = false;
		}
	}

	/**
	 * Process a batch of sync items
	 */
	private async processBatch(items: SyncQueueItem[], results: SyncResult): Promise<void> {
		for (const item of items) {
			try {
				// Skip items that have exceeded max retries
				if (item.retryCount >= this.MAX_RETRIES) {
					console.warn(`⚠️ Skipping item ${item.id} - exceeded max retries`);
					await this.removeFromQueue(item.id);
					results.failedCount++;
					continue;
				}

				// Calculate delay for exponential backoff
				if (item.retryCount > 0) {
					const delay = Math.min(
						this.BASE_RETRY_DELAY * Math.pow(2, item.retryCount - 1),
						this.MAX_RETRY_DELAY
					);

					// Skip if not enough time has passed since last attempt
					if (item.lastAttempt && Date.now() - item.lastAttempt < delay) {
						console.log(`⏳ Skipping item ${item.id} - retry delay not reached`);
						continue;
					}
				}

				const success = await this.syncItem(item);

				if (success) {
					await this.removeFromQueue(item.id);
					results.processedCount++;
					console.log(`✅ Synced ${item.type} ${item.action}`);
				} else {
					await this.updateRetryCount(item);
					results.failedCount++;
					console.log(
						`❌ Failed to sync ${item.type} ${item.action} (retry ${item.retryCount + 1}/${this.MAX_RETRIES})`
					);
				}
			} catch (error) {
				console.error(`Error processing queue item ${item.id}:`, error);
				await this.updateRetryCount(item);
				results.failedCount++;
				results.errors.push({
					item,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}
	}

	/**
	 * Sync a single item to Firestore
	 */
	private async syncItem(item: SyncQueueItem): Promise<boolean> {
		try {
			const collectionPath = this.getCollectionPath(item.type);
			if (!collectionPath) {
				console.error(`Unknown item type: ${item.type}`);
				return false;
			}

			const docRef = doc(db, 'users', item.userId, collectionPath, this.getDocumentId(item));

			switch (item.action) {
				case 'create':
				case 'update':
					if (!item.data) {
						console.error('No data provided for create/update action');
						return false;
					}

					// Add server timestamp and last sync timestamp
					const dataToSync = {
						...item.data,
						serverTimestamp: serverTimestamp(),
						lastSyncTimestamp: Date.now()
					};

					await setDoc(docRef, dataToSync, { merge: true });
					return true;

				case 'delete':
					await deleteDoc(docRef);
					return true;

				default:
					console.error(`Unknown action: ${item.action}`);
					return false;
			}
		} catch (error) {
			console.error(`Failed to sync item ${item.id}:`, error);

			// Don't retry certain errors
			if (this.isPermanentError(error)) {
				console.log(`Permanent error for item ${item.id}, removing from queue`);
				await this.removeFromQueue(item.id);
			}

			return false;
		}
	}

	/**
	 * Get Firestore collection path for item type
	 */
	private getCollectionPath(type: SyncQueueItem['type']): string | null {
		switch (type) {
			case 'feature':
				return 'features';
			case 'story':
				return 'stories';
			case 'category':
				return 'storyCategories';
			case 'list':
				return 'lists';
			case 'followed-story':
				return 'followedStories';
			default:
				return null;
		}
	}

	/**
	 * Get document ID from sync item
	 */
	private getDocumentId(item: SyncQueueItem): string {
		// Extract the actual document ID from the data or use a fallback
		if (item.data?.id) {
			return item.data.id;
		}

		// Fallback: extract from queue item ID
		const parts = item.id.split('-');
		if (parts.length >= 4) {
			return parts.slice(2, -1).join('-'); // Remove userId, type, and timestamp
		}

		console.error(`Could not determine document ID for item ${item.id}`);
		return 'unknown';
	}

	/**
	 * Check if error is permanent (shouldn't retry)
	 */
	private isPermanentError(error: any): boolean {
		const errorCode = error?.code || '';

		return (
			errorCode === 'permission-denied' ||
			errorCode === 'unauthenticated' ||
			errorCode === 'invalid-argument' ||
			errorCode === 'not-found'
		);
	}

	/**
	 * Clean object for Firestore (remove undefined values)
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
	 * Get sync queue status
	 */
	async getQueueStatus(): Promise<{
		totalItems: number;
		itemsByType: Record<string, number>;
		oldestItem: number | null;
		isProcessing: boolean;
	}> {
		const items = await this.getQueuedItems();
		const itemsByType: Record<string, number> = {};
		let oldestTimestamp: number | null = null;

		items.forEach((item) => {
			itemsByType[item.type] = (itemsByType[item.type] || 0) + 1;
			if (!oldestTimestamp || item.timestamp < oldestTimestamp) {
				oldestTimestamp = item.timestamp;
			}
		});

		return {
			totalItems: items.length,
			itemsByType,
			oldestItem: oldestTimestamp,
			isProcessing: this.isSyncing
		};
	}

	/**
	 * Clear sync queue (for testing/debugging)
	 */
	async clearQueue(): Promise<void> {
		if (!this.db) return;

		const transaction = this.db.transaction([this.QUEUE_STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.QUEUE_STORE_NAME);

		await new Promise<void>((resolve, reject) => {
			const request = store.clear();
			request.onsuccess = () => resolve();
			request.onerror = () => reject(request.error);
		});

		console.log('🗑️ Sync queue cleared');
	}
}

// Export singleton instance
export const offlineSyncManager = new OfflineSyncManager();
