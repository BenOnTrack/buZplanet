import Worker from './worker.ts?worker';
import type { WorkerMessage, WorkerResponse } from './worker';

export class WorkerManager {
	private worker: Worker | null = null;
	private messageId = 0;
	private pendingMessages = new Map<
		string,
		{
			resolve: (value: any) => void;
			reject: (reason?: any) => void;
			timeout?: NodeJS.Timeout;
		}
	>();
	private isReady = false;
	private readyPromise: Promise<void> | null = null;

	constructor() {
		this.initialize();
	}

	private initialize(): void {
		try {
			this.worker = new Worker();

			// Set up message listener
			this.worker.addEventListener('message', this.handleMessage.bind(this));

			// Set up error listener
			this.worker.addEventListener('error', (error) => {
				console.error('Worker error:', error);
				this.handleError(error);
			});

			// Wait for worker to be ready
			this.readyPromise = new Promise((resolve) => {
				const checkReady = (event: MessageEvent<WorkerResponse>) => {
					if (event.data.type === 'ready') {
						this.isReady = true;
						this.worker?.removeEventListener('message', checkReady);
						resolve();
					}
				};
				this.worker?.addEventListener('message', checkReady);
			});
		} catch (error) {
			console.error('Failed to initialize worker:', error);
			throw error;
		}
	}

	private handleMessage(event: MessageEvent<WorkerResponse>): void {
		const { type, data, id, error } = event.data;

		// Handle messages with IDs (responses to requests)
		if (id && this.pendingMessages.has(id)) {
			const pending = this.pendingMessages.get(id)!;
			this.pendingMessages.delete(id);

			// Clear timeout if it exists
			if (pending.timeout) {
				clearTimeout(pending.timeout);
			}

			if (error) {
				// Don't log "No tile found" errors as they are expected
				const errorMsg = typeof data === 'string' ? data : 'Unknown error';
				if (!errorMsg.includes('No tile found')) {
					console.error(`Worker error for ${type}:`, errorMsg);
				}
				pending.reject(new Error(errorMsg));
			} else {
				pending.resolve(data);
			}
		}

		// Handle broadcast messages (no ID)
		switch (type) {
			case 'ready':
				// Worker is ready
				break;
			case 'worker-error':
				console.error('Worker reported error:', data);
				break;
			default:
			// Broadcast messages (no ID)
		}
	}

	private handleError(error: ErrorEvent): void {
		console.error('Worker error:', error.message);

		// Reject all pending messages
		this.pendingMessages.forEach(({ reject, timeout }) => {
			if (timeout) clearTimeout(timeout);
			reject(new Error(`Worker error: ${error.message}`));
		});
		this.pendingMessages.clear();
	}

	private generateMessageId(): string {
		return `msg_${++this.messageId}_${Date.now()}`;
	}

	async waitForReady(): Promise<void> {
		if (this.isReady) return;
		if (this.readyPromise) {
			await this.readyPromise;
		}
	}

	async sendMessage(type: string, data?: any, timeoutMs: number = 5000): Promise<any> {
		if (!this.worker) {
			throw new Error('Worker not initialized');
		}

		await this.waitForReady();

		const id = this.generateMessageId();
		const message: WorkerMessage = { type, data, id };

		// Handle binary data transfer
		const transferList: Transferable[] = [];
		if (data && data.fileData instanceof ArrayBuffer) {
			transferList.push(data.fileData);
		}

		return new Promise((resolve, reject) => {
			// Set up timeout
			const timeout = setTimeout(() => {
				this.pendingMessages.delete(id);
				reject(new Error(`Worker message timeout: ${type}`));
			}, timeoutMs);

			// Store pending message
			this.pendingMessages.set(id, { resolve, reject, timeout });

			// Send message with transfers if needed
			if (transferList.length > 0) {
				this.worker!.postMessage(message, transferList);
			} else {
				this.worker!.postMessage(message);
			}
		});
	}

	async ping(): Promise<string> {
		return this.sendMessage('ping');
	}

	async initializeWorker(initData?: any): Promise<{ message: string; opfsFiles: string[] }> {
		return this.sendMessage('init', initData);
	}

	async processTask(taskData: any): Promise<string> {
		return this.sendMessage('task', taskData);
	}

	async requestTile(source: string, z: number, x: number, y: number): Promise<ArrayBuffer | null> {
		const result = await this.sendMessage('tile-request', { source, z, x, y });
		// Result can be null if no tile is found, which is normal
		return result;
	}

	async scanDatabases(): Promise<{
		totalFiles: number;
		successfulDbs: number;
		corruptedFiles: string[];
		indexKeys: number;
	}> {
		return this.sendMessage('scan-databases');
	}

	async listDatabases(): Promise<{ databases: any[]; totalCount: number; filenames: string[] }> {
		return this.sendMessage('list-databases');
	}

	// OPFS operations through worker
	async saveFileToOPFS(
		filename: string,
		fileData: ArrayBuffer,
		directory?: string
	): Promise<string> {
		return this.sendMessage('opfs-save-file', { filename, fileData, directory }, 30000); // 30s timeout for large files
	}

	async listOPFSFiles(directory?: string): Promise<string[]> {
		const result = await this.sendMessage('opfs-list-files', { directory });
		return result.files;
	}

	async searchFeatures(query: string, limit?: number): Promise<any[]> {
		return this.sendMessage('search-features', { query, limit }, 60000); // 60 second timeout for comprehensive search
	}

	postMessage(type: string, data?: any): void {
		if (!this.worker) {
			throw new Error('Worker not initialized');
		}

		const message: WorkerMessage = { type, data };
		this.worker.postMessage(message);
	}

	terminate(): void {
		if (this.worker) {
			// Clear all pending messages
			this.pendingMessages.forEach(({ reject, timeout }) => {
				if (timeout) clearTimeout(timeout);
				reject(new Error('Worker terminated'));
			});
			this.pendingMessages.clear();

			this.worker.terminate();
			this.worker = null;
			this.isReady = false;
			this.readyPromise = null;
		}
	}

	get ready(): boolean {
		return this.isReady;
	}
}

// Singleton instance
let workerInstance: WorkerManager | null = null;

export function getWorker(): WorkerManager {
	if (!workerInstance) {
		workerInstance = new WorkerManager();
	}
	return workerInstance;
}

export function terminateWorker(): void {
	if (workerInstance) {
		workerInstance.terminate();
		workerInstance = null;
	}
}
