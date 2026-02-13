/**
 * App initialization utility to ensure proper setup order
 * Uses dynamic imports to avoid preventing worker module code splitting
 */

// Static imports for non-worker modules
import { createProtocolHandler } from '$lib/utils/map/protocol-handler';
import { appState } from '$lib/stores/AppState.svelte';
import maplibregl from 'maplibre-gl';

class AppInitializer {
	private initializationPromise: Promise<InitializationResult> | null = null;
	private state: InitializationState = {
		status: 'pending',
		logs: []
	};

	private listeners: Array<(state: InitializationState) => void> = [];

	/**
	 * Subscribe to initialization state changes
	 */
	subscribe(callback: (state: InitializationState) => void): () => void {
		this.listeners.push(callback);
		// Immediately call with current state
		callback(this.state);

		return () => {
			const index = this.listeners.indexOf(callback);
			if (index > -1) {
				this.listeners.splice(index, 1);
			}
		};
	}

	/**
	 * Update state and notify listeners
	 */
	private updateState(updates: Partial<InitializationState>) {
		this.state = { ...this.state, ...updates };
		this.listeners.forEach((callback) => callback(this.state));
	}

	/**
	 * Add log entry
	 */
	private addLog(message: string) {
		const timestamp = new Date().toLocaleTimeString();
		const logEntry = `[${timestamp}] ${message}`;

		this.updateState({
			logs: [...this.state.logs, logEntry]
		});

		// Log to state only
	}

	/**
	 * Initialize the app with fast startup (defer heavy operations)
	 * Returns a promise that resolves when basic functionality is ready
	 */
	async initialize(fastMode: boolean = false): Promise<InitializationResult> {
		// Return existing promise if already initializing
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		this.initializationPromise = this.performInitialization(fastMode);
		return this.initializationPromise;
	}

	private async performInitialization(fastMode: boolean = false): Promise<InitializationResult> {
		try {
			this.updateState({ status: 'initializing' });
			this.addLog('🚀 Starting app initialization...');

			// Step 1: Initialize Worker (timeout after 3 seconds)
			this.addLog('🔄 Initializing worker...');

			// Dynamic import to avoid code splitting issues
			const { getWorker } = await import('$lib/utils/worker');
			const worker = getWorker();
			this.addLog('✅ Worker instance created');

			// Add timeout for worker ready
			const workerReadyPromise = Promise.race([
				worker.waitForReady(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error('Worker initialization timeout')), 3000)
				)
			]);

			await workerReadyPromise;
			this.addLog('✅ Worker is ready!');
			this.updateState({ status: 'worker-ready' });

			// Step 2: Initialize AppState (IndexedDB storage) - timeout after 2 seconds
			this.addLog('🔄 Initializing AppState storage...');

			try {
				const appStatePromise = Promise.race([
					appState.ensureInitialized(),
					new Promise((_, reject) =>
						setTimeout(() => reject(new Error('AppState initialization timeout')), 2000)
					)
				]);

				await appStatePromise;
				this.addLog(
					`✅ AppState initialized! Map view: [${appState.mapView.center.join(', ')}] @ z${appState.mapView.zoom}`
				);
			} catch (error) {
				this.addLog(`⚠️ AppState initialization timeout - using defaults`);
				// Continue with defaults - this is not a critical failure
			}

			this.updateState({ status: 'appstate-ready' });

			// Step 3: Basic worker initialization (fast)
			const initResponse = await worker.initializeWorker({
				appVersion: '1.0.0',
				timestamp: Date.now()
			});

			let workerInfo;
			if (typeof initResponse === 'string') {
				this.addLog(`✅ Init response: ${initResponse}`);
				workerInfo = { message: initResponse };
			} else {
				this.addLog(`✅ Init response: ${initResponse.message}`);
				this.addLog(`📂 OPFS .mbtiles files found: ${initResponse.opfsFiles.length}`);
				workerInfo = initResponse;

				if (initResponse.opfsFiles.length > 0) {
					initResponse.opfsFiles.forEach((file: string) => {
						this.addLog(`  📄 ${file}`);
					});
				} else {
					this.addLog('  📄 No .mbtiles files found in OPFS');
				}
			}

			// Step 4: Ensure default files are loaded into OPFS
			await this.ensureDefaultFilesInOPFS(worker);

			// Step 5: Register Protocol Handlers (essential for map functionality)
			this.addLog('🔄 Registering MBTiles protocol handler...');
			const protocolHandler = createProtocolHandler(worker);
			maplibregl.addProtocol('mbtiles', protocolHandler);
			this.addLog('✅ MBTiles protocol handler registered!');
			this.updateState({ status: 'protocol-ready' });

			if (!fastMode) {
				// Step 6: Scan and index databases (heavy operation - skip in fast mode)
				this.addLog('🔄 Scanning and indexing databases...');
				this.updateState({ status: 'database-scanning' });

				try {
					const scanResult = await worker.sendMessage('scan-databases', undefined, 10000); // 10s timeout
					this.addLog(
						`✅ Database scan complete: ${scanResult.successfulDbs}/${scanResult.totalFiles} databases loaded`
					);
					if (scanResult.corruptedFiles.length > 0) {
						this.addLog(`⚠️ Corrupted files removed: ${scanResult.corruptedFiles.join(', ')}`);
					}
				} catch (scanError) {
					this.addLog(
						`⚠️ Database scan failed: ${scanError instanceof Error ? scanError.message : 'Unknown error'}`
					);
					// Don't fail initialization for database scan issues
				}
			} else {
				this.addLog('⚡ Fast mode: Skipping database scan (will run in background)');
				// Start database scan in background
				worker.sendMessage('scan-databases').catch((error) => {
					console.warn('Background database scan failed:', error);
				});
			}

			// Step 7: Final verification (quick)
			const pingResponse = await worker.ping();
			this.addLog(`✅ Ping response: ${pingResponse}`);

			// Step 8: Complete
			this.updateState({ status: 'complete' });
			this.addLog('🎉 App initialization complete!');
			this.addLog(
				`🗺️ Map will start at: [${appState.mapView.center.join(', ')}] @ z${appState.mapView.zoom}`
			);

			return {
				success: true,
				workerInfo
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : 'Unknown error';
			this.addLog(`❌ Initialization failed: ${errorMsg}`);

			this.updateState({
				status: 'error',
				error: errorMsg
			});

			console.error('App initialization failed:', error);

			return {
				success: false,
				error: errorMsg
			};
		}
	}

	/**
	 * Ensure default mbtiles files are loaded into OPFS
	 */
	private async ensureDefaultFilesInOPFS(worker: any): Promise<void> {
		const defaultFiles = [
			{
				filename: 'coastline.mbtiles',
				staticPath: '/coastline.mbtiles',
				description: 'Coastline data'
			}
			// Add more default files here if needed
			// {
			// 	filename: 'basemap.mbtiles',
			// 	staticPath: '/basemap.mbtiles',
			// 	description: 'Base map data'
			// }
		];

		for (const fileInfo of defaultFiles) {
			try {
				// Check if file already exists in OPFS
				const opfsFiles = await worker.listOPFSFiles();
				const fileExists = opfsFiles.includes(fileInfo.filename);

				if (!fileExists) {
					this.addLog(`🔄 Loading ${fileInfo.description} from static files...`);

					// Fetch the file from static directory
					const response = await fetch(fileInfo.staticPath);

					if (!response.ok) {
						if (response.status === 404) {
							this.addLog(`⚠️ ${fileInfo.filename} not found in static files - skipping`);
							continue;
						} else {
							throw new Error(
								`Failed to fetch ${fileInfo.filename}: ${response.status} ${response.statusText}`
							);
						}
					}

					// Convert to ArrayBuffer
					const arrayBuffer = await response.arrayBuffer();

					// Validate file size
					if (arrayBuffer.byteLength === 0) {
						this.addLog(`⚠️ ${fileInfo.filename} is empty - skipping`);
						continue;
					}

					this.addLog(
						`📥 Downloading ${fileInfo.filename} (${this.formatFileSize(arrayBuffer.byteLength)})...`
					);

					// Save to OPFS via worker
					const savedPath = await worker.saveFileToOPFS(fileInfo.filename, arrayBuffer);
					this.addLog(`✅ ${fileInfo.description} saved to OPFS as ${savedPath}`);
				} else {
					this.addLog(`✅ ${fileInfo.description} already exists in OPFS`);
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : 'Unknown error';
				this.addLog(`❌ Failed to load ${fileInfo.description}: ${errorMsg}`);
				// Continue with other files - don't fail initialization
			}
		}
	}

	/**
	 * Format file size for display
	 */
	private formatFileSize(bytes: number): string {
		if (bytes === 0) return '0 Bytes';
		const k = 1024;
		const sizes = ['Bytes', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	/**
	 * Get current initialization status
	 */
	getStatus(): InitializationStatus {
		return this.state.status;
	}

	/**
	 * Check if app is ready for map initialization
	 */
	isReady(): boolean {
		return this.state.status === 'complete';
	}

	/**
	 * Reset initialization state (useful for testing)
	 */
	reset() {
		this.initializationPromise = null;
		this.state = {
			status: 'pending',
			logs: []
		};
	}
}

// Export singleton instance
export const appInitializer = new AppInitializer();
