import type { AddProtocolAction } from 'maplibre-gl';
import type { WorkerManager } from '$lib/utils/worker';

interface TileRequest {
	source: string;
	z: number;
	x: number;
	y: number;
}

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

			// Request tile from worker
			const tileData = await requestTileFromWorker(workerManager, {
				source,
				z,
				x,
				y
			});

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
