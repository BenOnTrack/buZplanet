// Worker client for interacting with the SQLite worker
import type { WorkerMessage, WorkerResponse } from './worker.ts';

export class SqliteWorkerClient {
	private worker: Worker;
	private messageId = 0;
	private pendingMessages = new Map<
		string,
		{
			resolve: (value: any) => void;
			reject: (error: Error) => void;
		}
	>();

	constructor(workerUrl: string) {
		this.worker = new Worker(workerUrl, { type: 'module' });
		this.setupEventListeners();
	}

	private setupEventListeners() {
		this.worker.addEventListener('message', (event: MessageEvent<WorkerResponse>) => {
			const { type, data, id, error } = event.data;

			// Handle messages with IDs (responses to requests)
			if (id) {
				const pending = this.pendingMessages.get(id);
				if (pending) {
					this.pendingMessages.delete(id);
					if (error) {
						pending.reject(new Error(data));
					} else {
						pending.resolve(data);
					}
				}
				return;
			}

			// Handle unsolicited messages (notifications)
			switch (type) {
				case 'ready':
					// SQLite worker is ready
					break;
				case 'corrupted-databases-detected':
					console.warn('⚠️ Corrupted databases detected:', data);
					// You can emit custom events here for your UI to handle
					window.dispatchEvent(new CustomEvent('worker:corrupted-databases', { detail: data }));
					break;
				default:
				// Worker notification
			}
		});

		this.worker.addEventListener('error', (error) => {
			console.error('Worker error:', error);
		});
	}

	private sendMessage<T = any>(type: string, data?: any): Promise<T> {
		return new Promise((resolve, reject) => {
			const id = (++this.messageId).toString();

			this.pendingMessages.set(id, { resolve, reject });

			const message: WorkerMessage = { type, data, id };
			this.worker.postMessage(message);

			// Set timeout for cleanup
			setTimeout(() => {
				if (this.pendingMessages.has(id)) {
					this.pendingMessages.delete(id);
					reject(new Error(`Worker request timeout: ${type}`));
				}
			}, 30000); // 30 second timeout
		});
	}

	// Initialize SQLite and OPFS
	async initialize(): Promise<{ message: string; opfsFiles: string[] }> {
		return this.sendMessage('init');
	}

	// Scan and index all databases
	async scanDatabases(): Promise<{
		totalFiles: number;
		successfulDbs: number;
		corruptedFiles: string[];
		indexKeys: number;
	}> {
		return this.sendMessage('scan-databases');
	}

	// Get list of available databases
	async getDatabases(): Promise<Array<{ filename: string; metadata: any }>> {
		return this.sendMessage('get-databases');
	}

	// Query a specific database
	async queryDatabase(filename: string, query: string, params?: any[]): Promise<any[]> {
		return this.sendMessage('query-database', { filename, query, params });
	}

	// Get tile data from database
	async getTile(filename: string, z: number, x: number, y: number): Promise<ArrayBuffer | null> {
		try {
			const result = await this.queryDatabase(
				filename,
				'SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?',
				[z, x, y]
			);

			return result.length > 0 ? result[0][0] : null;
		} catch (error) {
			console.error(`Failed to get tile ${z}/${x}/${y} from ${filename}:`, error);
			return null;
		}
	}

	// Close specific database
	async closeDatabase(filename: string): Promise<string> {
		return this.sendMessage('close-database', { filename });
	}

	// Ping worker (health check)
	async ping(): Promise<string> {
		return this.sendMessage('ping');
	}

	// Cleanup
	terminate() {
		this.worker.terminate();
		// Reject all pending promises
		for (const [id, { reject }] of this.pendingMessages) {
			reject(new Error('Worker terminated'));
		}
		this.pendingMessages.clear();
	}
}

// Usage example:
/*
const workerClient = new SqliteWorkerClient('/src/lib/utils/worker/worker.ts');

// Initialize
const initResult = await workerClient.initialize();
// Commented out example output logs
// console.log('Initialization result:', initResult.message);
// console.log('OPFS .mbtiles files found:', initResult.opfsFiles);

// Scan databases
const scanResult = await workerClient.scanDatabases();
// console.log('Scan result:', scanResult);

// Get database list
const databases = await workerClient.getDatabases();
// console.log('Available databases:', databases);

// Query a database
const tiles = await workerClient.queryDatabase(
    'example.mbtiles',
    'SELECT * FROM tiles WHERE zoom_level = ? LIMIT 10',
    [10]
);

// Get specific tile
const tileData = await workerClient.getTile('example.mbtiles', 10, 512, 384);
*/
