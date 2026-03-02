import type { AddProtocolAction } from 'maplibre-gl';
import type { WorkerManager } from '$lib/utils/worker';

// Track viewport updates for tile prefetching
let lastViewportUpdate = 0;
const VIEWPORT_UPDATE_THROTTLE = 100; // ms

// Priority system for tile sources
const SOURCE_PRIORITIES: Record<string, number> = {
	coastline: 1,
	basemap: 2, // Highest priority - base layers
	transportation: 3,
	building: 4,
	poi: 5,
	poiRoute: 6,
	route: 7,
	countries: 8,
	area: 9,
	boundary: 10,
	labels: 11,
	default: 12
};

// Priority queue for tile requests
class TileRequestQueue {
	private queue: Array<{ priority: number; request: () => Promise<ArrayBuffer | null> }> = [];
	private processing = false;

	add(source: string, requestFn: () => Promise<ArrayBuffer | null>): Promise<ArrayBuffer | null> {
		const priority = this.getSourcePriority(source);

		return new Promise((resolve, reject) => {
			const request = async () => {
				try {
					const result = await requestFn();
					resolve(result);
					return result;
				} catch (error) {
					reject(error);
					return null;
				}
			};

			// Insert in priority order (lower number = higher priority)
			const insertIndex = this.queue.findIndex((item) => item.priority > priority);
			if (insertIndex === -1) {
				this.queue.push({ priority, request });
			} else {
				this.queue.splice(insertIndex, 0, { priority, request });
			}

			this.processQueue();
		});
	}

	private async processQueue(): Promise<void> {
		if (this.processing || this.queue.length === 0) {
			return;
		}

		this.processing = true;

		while (this.queue.length > 0) {
			const item = this.queue.shift()!;
			try {
				await item.request();
			} catch (error) {
				console.warn('Tile request failed in queue:', error);
			}
		}

		this.processing = false;
	}

	private getSourcePriority(source: string): number {
		const sourceLower = source.toLowerCase();

		// Check for exact match first
		if (SOURCE_PRIORITIES[sourceLower] !== undefined) {
			return SOURCE_PRIORITIES[sourceLower];
		}

		// Check for partial matches
		for (const [key, priority] of Object.entries(SOURCE_PRIORITIES)) {
			if (key !== 'default' && sourceLower.includes(key)) {
				return priority;
			}
		}

		return SOURCE_PRIORITIES.default;
	}
}

// Global priority queue instance
const tileQueue = new TileRequestQueue();

export function createProtocolHandler(workerManager: WorkerManager): AddProtocolAction {
	return async ({ url, type }) => {
		// Handle non-tile requests
		if (type === 'json') {
			return { data: null };
		} else if (type === 'string') {
			return { data: '' };
		}

		try {
			// Parse the mbtiles:// URL
			const parsedUrl = new URL(url);
			const pathParts = parsedUrl.pathname.split('/').filter((part) => part !== '');

			// Extract path components: mbtiles://./source/z/x/y
			// Remove leading dot if present (mbtiles://./basemap/...)
			const cleanParts = pathParts[0] === '.' ? pathParts.slice(1) : pathParts;
			const [source, zStr, xStr, yStr] = cleanParts;

			if (!source || !zStr || !xStr || !yStr) {
				throw new Error(`Invalid mbtiles URL format: ${url}`);
			}

			const z = Number(zStr);
			const x = Number(xStr);
			const y = Number(yStr);

			// Validate coordinates
			if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y)) {
				throw new Error(`Invalid tile coordinates: z=${zStr} x=${xStr} y=${yStr}`);
			}

			if (z < 0 || z > 22 || x < 0 || y < 0) {
				throw new Error(`Tile coordinates out of range: z=${z} x=${x} y=${y}`);
			}

			// Update viewport information for prefetching (throttled)
			updateViewportForPrefetching(workerManager, z, x, y);

			// Request tile from worker with priority queueing
			const tileData = await tileQueue.add(source, () =>
				requestTileFromWorker(workerManager, {
					source,
					z,
					x,
					y
				})
			);

			// If no tile data found, return empty ArrayBuffer
			if (!tileData) {
				return { data: new ArrayBuffer(0) };
			}

			return {
				data: tileData
				// Optionally add cache control
				// cacheControl: 'max-age=86400',
			};
		} catch (error) {
			// Log warnings for debugging but don't treat missing tiles as errors
			console.warn(`Failed to fetch tile ${url}:`, error);
			// Return empty ArrayBuffer instead of throwing to prevent map errors
			return { data: new ArrayBuffer(0) };
		}
	};
}

async function requestTileFromWorker(
	workerManager: WorkerManager,
	tileRequest: TileRequest
): Promise<ArrayBuffer | null> {
	try {
		// Wait for worker to be ready
		await workerManager.waitForReady();

		// Request tile data from worker using the new method
		const tileData = await workerManager.requestTile(
			tileRequest.source,
			tileRequest.z,
			tileRequest.x,
			tileRequest.y
		);

		return tileData; // Can be null if no tile found
	} catch (error) {
		// Check if it's a "no tile found" error (normal behavior)
		if (error instanceof Error && error.message.includes('No tile found')) {
			// This is expected for missing tiles - don't log as error
			return null; // Return null instead of throwing
		}

		// Log other errors as they might be actual issues
		console.error('Worker tile request failed:', error);
		return null; // Return null instead of throwing
	}
}

/**
 * Update viewport information for intelligent prefetching
 */
function updateViewportForPrefetching(
	workerManager: WorkerManager,
	z: number,
	x: number,
	y: number
): void {
	const now = Date.now();
	if (now - lastViewportUpdate < VIEWPORT_UPDATE_THROTTLE) {
		return; // Throttle updates
	}
	lastViewportUpdate = now;

	// Estimate viewport size (approximate tiles visible)
	const tilesX = 4; // Rough estimate for typical screen
	const tilesY = 3; // Rough estimate for typical screen

	// Update viewport in worker (don't await - run in background)
	workerManager.updateViewport?.(z, x, y, tilesX, tilesY)?.catch((error) => {
		console.debug('Viewport update failed (non-critical):', error);
	});
}
