// Export the new dual worker system instead of the old single worker
export {
	DualWorkerManager as WorkerManager,
	getWorker,
	terminateWorker
} from './dualWorkerManager.ts';

// Legacy exports for backward compatibility
export type { DualWorkerManager as LegacyWorkerManager } from './dualWorkerManager.ts';

// Enhanced Worker Manager interface for tile caching
export interface EnhancedWorkerManager {
	// Standard methods
	requestTile(source: string, z: number, x: number, y: number): Promise<ArrayBuffer | null>;
	waitForReady(): Promise<void>;
	ping(): Promise<string>;
	terminate(): void;

	// Enhanced caching methods
	updateViewport?(
		z: number,
		centerX: number,
		centerY: number,
		tilesX: number,
		tilesY: number
	): Promise<string>;
	getTileCacheStats?(): Promise<any>;
	clearTileCache?(): Promise<string>;
	getCacheContents?(): Promise<any[]>;
	getTilesByZoom?(zoom: number): Promise<any[]>;
	getRecentTiles?(limit: number): Promise<any[]>;
	getPopularTiles?(limit: number): Promise<any[]>;

	// Search methods
	searchFeatures?(
		query: string,
		limit?: number,
		language?: string,
		userLocation?: { lng: number; lat: number },
		onProgress?: (data: any) => void
	): Promise<any[]>;
	cancelSearch?(): Promise<string>;
	scanDatabases?(): Promise<any>;
}
