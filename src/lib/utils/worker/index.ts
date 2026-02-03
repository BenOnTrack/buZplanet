import Worker from './worker.ts?worker';
import type { WorkerMessage, WorkerResponse } from './worker';

export class WorkerManager {
	private worker: Worker | null = null;
	private messageId = 0;
	private pendingMessages = new Map<string, {
		resolve: (value: any) => void;
		reject: (reason?: any) => void;
		timeout?: NodeJS.Timeout;
	}>();
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
				pending.reject(new Error(data));
			} else {
				pending.resolve(data);
			}
		}

		// Handle broadcast messages (no ID)
		switch (type) {
			case 'ready':
				console.log('Worker is ready');
				break;
			case 'worker-error':
				console.error('Worker reported error:', data);
				break;
			default:
				console.log('Worker message:', type, data);
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

		return new Promise((resolve, reject) => {
			// Set up timeout
			const timeout = setTimeout(() => {
				this.pendingMessages.delete(id);
				reject(new Error(`Worker message timeout: ${type}`));
			}, timeoutMs);

			// Store pending message
			this.pendingMessages.set(id, { resolve, reject, timeout });

			// Send message
			this.worker!.postMessage(message);
		});
	}

	async ping(): Promise<string> {
		return this.sendMessage('ping');
	}

	async initializeWorker(initData?: any): Promise<{message: string; opfsFiles: string[]}> {
		return this.sendMessage('init', initData);
	}

	async processTask(taskData: any): Promise<string> {
		return this.sendMessage('task', taskData);
	}

	async requestTile(source: string, z: number, x: number, y: number): Promise<ArrayBuffer> {
		return this.sendMessage('tile-request', { source, z, x, y });
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