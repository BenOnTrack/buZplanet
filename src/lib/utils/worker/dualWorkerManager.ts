import TileWorker from './tileWorker.ts?worker';
import SearchWorker from './searchWorker.ts?worker';

export class DualWorkerManager {
	private tileWorker: Worker | null = null;
	private searchWorker: Worker | null = null;
	private messageId = 0;
	private pendingTileMessages = new Map<
		string,
		{
			resolve: (value: any) => void;
			reject: (reason?: any) => void;
		}
	>();
	private pendingSearchMessages = new Map<
		string,
		{
			resolve: (value: any) => void;
			reject: (reason?: any) => void;
			onProgress?: (data: any) => void;
		}
	>();
	private tileWorkerReady = false;
	private searchWorkerReady = false;
	private tileWorkerReadyPromise: Promise<void> | null = null;
	private searchWorkerReadyPromise: Promise<void> | null = null;

	constructor() {
		this.initialize();
	}

	private initialize(): void {
		try {
			// Initialize tile worker
			this.tileWorker = new TileWorker();
			this.tileWorker.addEventListener('message', this.handleTileMessage.bind(this));
			this.tileWorker.addEventListener('error', (error) => {
				console.error('Tile worker error:', error);
			});

			// Initialize search worker
			this.searchWorker = new SearchWorker();
			this.searchWorker.addEventListener('message', this.handleSearchMessage.bind(this));
			this.searchWorker.addEventListener('error', (error) => {
				console.error('Search worker error:', error);
			});

			// Wait for workers to be ready
			this.tileWorkerReadyPromise = new Promise((resolve) => {
				const checkReady = (event: MessageEvent) => {
					if (event.data.type === 'ready') {
						this.tileWorkerReady = true;
						this.tileWorker?.removeEventListener('message', checkReady);
						resolve();
					}
				};
				this.tileWorker?.addEventListener('message', checkReady);
			});

			this.searchWorkerReadyPromise = new Promise((resolve) => {
				const checkReady = (event: MessageEvent) => {
					if (event.data.type === 'ready') {
						this.searchWorkerReady = true;
						this.searchWorker?.removeEventListener('message', checkReady);
						resolve();
					}
				};
				this.searchWorker?.addEventListener('message', checkReady);
			});
		} catch (error) {
			console.error('Failed to initialize workers:', error);
			throw error;
		}
	}

	private handleTileMessage(event: MessageEvent): void {
		const { type, data, id, error } = event.data;

		if (id && this.pendingTileMessages.has(id)) {
			const pending = this.pendingTileMessages.get(id)!;
			this.pendingTileMessages.delete(id);

			if (error) {
				const errorMsg = typeof data === 'string' ? data : 'Unknown error';
				if (!errorMsg.includes('No tile found')) {
					console.error(`Tile worker error for ${type}:`, errorMsg);
				}
				pending.reject(new Error(errorMsg));
			} else {
				pending.resolve(data);
			}
		}
	}

	private handleSearchMessage(event: MessageEvent): void {
		const { type, data, id, error } = event.data;

		if (id && this.pendingSearchMessages.has(id)) {
			const pending = this.pendingSearchMessages.get(id)!;

			// Handle progress messages
			if (type === 'search-progress' && pending.onProgress) {
				try {
					pending.onProgress(data);
				} catch (progressError) {
					console.error('Search progress callback error:', progressError);
				}
				return; // Don't resolve yet
			}

			// Handle final response
			this.pendingSearchMessages.delete(id);

			if (error) {
				console.error(`Search worker error for ${type}:`, data);
				pending.reject(new Error(typeof data === 'string' ? data : 'Unknown error'));
			} else {
				pending.resolve(data);
			}
		}
	}

	private generateMessageId(): string {
		return `msg_${++this.messageId}_${Date.now()}`;
	}

	async waitForReady(): Promise<void> {
		await Promise.all([
			this.tileWorkerReady ? Promise.resolve() : this.tileWorkerReadyPromise,
			this.searchWorkerReady ? Promise.resolve() : this.searchWorkerReadyPromise
		]);
	}

	private async sendTileMessage(type: string, data?: any): Promise<any> {
		if (!this.tileWorker) {
			throw new Error('Tile worker not initialized');
		}

		if (!this.tileWorkerReady) {
			await this.tileWorkerReadyPromise;
		}

		const id = this.generateMessageId();
		const message = { type, data, id };

		return new Promise((resolve, reject) => {
			this.pendingTileMessages.set(id, { resolve, reject });
			this.tileWorker!.postMessage(message);
		});
	}

	private async sendSearchMessage(
		type: string,
		data?: any,
		onProgress?: (data: any) => void
	): Promise<any> {
		if (!this.searchWorker) {
			throw new Error('Search worker not initialized');
		}

		if (!this.searchWorkerReady) {
			await this.searchWorkerReadyPromise;
		}

		const id = this.generateMessageId();
		const message = { type, data, id };

		return new Promise((resolve, reject) => {
			this.pendingSearchMessages.set(id, { resolve, reject, onProgress });
			this.searchWorker!.postMessage(message);
		});
	}

	// Initialize both workers
	async initializeWorkers(): Promise<{ tileWorker: string; searchWorker: string }> {
		const [tileResult, searchResult] = await Promise.all([
			this.sendTileMessage('init'),
			this.sendSearchMessage('init')
		]);

		return {
			tileWorker: tileResult,
			searchWorker: searchResult
		};
	}

	// Tile operations (fast, dedicated worker)
	async requestTile(source: string, z: number, x: number, y: number): Promise<ArrayBuffer | null> {
		return this.sendTileMessage('tile-request', { source, z, x, y });
	}

	// Update viewport for intelligent prefetching
	async updateViewport(
		z: number,
		centerX: number,
		centerY: number,
		tilesX: number,
		tilesY: number
	): Promise<string> {
		return this.sendTileMessage('viewport-update', { z, centerX, centerY, tilesX, tilesY });
	}

	// Get tile cache statistics
	async getTileCacheStats(): Promise<any> {
		return this.sendTileMessage('cache-stats');
	}

	// Clear tile cache
	async clearTileCache(): Promise<string> {
		return this.sendTileMessage('clear-cache');
	}

	// Advanced cache inspection methods
	async getCacheContents(): Promise<any[]> {
		return this.sendTileMessage('cache-contents');
	}

	async getTilesByZoom(zoom: number): Promise<any[]> {
		return this.sendTileMessage('cache-zoom-tiles', { zoom });
	}

	async getRecentTiles(limit: number = 10): Promise<any[]> {
		return this.sendTileMessage('cache-recent-tiles', { limit });
	}

	async getPopularTiles(limit: number = 10): Promise<any[]> {
		return this.sendTileMessage('cache-popular-tiles', { limit });
	}

	// Search operations (separate worker, no interference)
	async searchFeatures(
		query: string,
		limit?: number,
		language?: string,
		userLocation?: { lng: number; lat: number },
		onProgress?: (data: {
			results: any[];
			isComplete: boolean;
			currentDatabase?: string;
			total: number;
		}) => void
	): Promise<any[]> {
		return this.sendSearchMessage(
			'search-features',
			{ query, limit, language, userLocation },
			onProgress
		);
	}

	async cancelSearch(): Promise<string> {
		return this.sendSearchMessage('cancel-search');
	}

	async scanDatabases(): Promise<{
		totalFiles: number;
		successfulDbs: number;
		corruptedFiles: string[];
		indexKeys: number;
	}> {
		// Use search worker for database scanning since it has the full implementation
		return this.sendSearchMessage('scan-databases');
	}

	// Additional legacy methods for full compatibility
	async queryDatabase(filename: string, query: string, params?: any[]): Promise<any[]> {
		return this.sendSearchMessage('query-database', { filename, query, params });
	}

	async getDatabases(): Promise<Array<{ filename: string; metadata: any }>> {
		return this.sendSearchMessage('get-databases');
	}

	async closeDatabase(filename: string): Promise<string> {
		return this.sendSearchMessage('close-database', { filename });
	}

	// Legacy compatibility methods
	async ping(): Promise<string> {
		// Ping both workers
		try {
			await Promise.all([
				this.sendTileMessage('ping').catch(() => 'Tile worker ping failed'),
				this.sendSearchMessage('ping').catch(() => 'Search worker ping failed')
			]);
			return 'Both workers are responsive';
		} catch (error) {
			return 'Worker ping failed';
		}
	}

	async initializeWorker(initData?: any): Promise<{ message: string; opfsFiles: string[] }> {
		// Initialize both workers
		const results = await this.initializeWorkers();
		return {
			message: `${results.tileWorker} | ${results.searchWorker}`,
			opfsFiles: [] // Will be populated by scan
		};
	}

	async processTask(taskData: any): Promise<string> {
		// Route to search worker for task processing
		return this.sendSearchMessage('task', taskData);
	}

	async listDatabases(): Promise<{ databases: any[]; totalCount: number; filenames: string[] }> {
		// Use search worker for database listing
		return this.sendSearchMessage('list-databases');
	}

	// OPFS operations through search worker
	async saveFileToOPFS(
		filename: string,
		fileData: ArrayBuffer,
		directory?: string
	): Promise<string> {
		return this.sendSearchMessage('opfs-save-file', { filename, fileData, directory });
	}

	async listOPFSFiles(directory?: string): Promise<string[]> {
		const result = await this.sendSearchMessage('opfs-list-files', { directory });
		return result.files;
	}

	postMessage(type: string, data?: any): void {
		// Route to search worker for general messages
		if (!this.searchWorker) {
			throw new Error('Search worker not initialized');
		}

		const message = { type, data };
		this.searchWorker.postMessage(message);
	}

	terminate(): void {
		// Clear pending messages
		this.pendingTileMessages.forEach(({ reject }) => {
			reject(new Error('Worker terminated'));
		});
		this.pendingSearchMessages.forEach(({ reject }) => {
			reject(new Error('Worker terminated'));
		});
		this.pendingTileMessages.clear();
		this.pendingSearchMessages.clear();

		// Terminate workers
		if (this.tileWorker) {
			this.tileWorker.terminate();
			this.tileWorker = null;
			this.tileWorkerReady = false;
			this.tileWorkerReadyPromise = null;
		}

		if (this.searchWorker) {
			this.searchWorker.terminate();
			this.searchWorker = null;
			this.searchWorkerReady = false;
			this.searchWorkerReadyPromise = null;
		}
	}

	get ready(): boolean {
		return this.tileWorkerReady && this.searchWorkerReady;
	}
}

// Singleton instance
let dualWorkerInstance: DualWorkerManager | null = null;

export function getWorker(): DualWorkerManager {
	if (!dualWorkerInstance) {
		dualWorkerInstance = new DualWorkerManager();
	}
	return dualWorkerInstance;
}

export function terminateWorker(): void {
	if (dualWorkerInstance) {
		dualWorkerInstance.terminate();
		dualWorkerInstance = null;
	}
}
