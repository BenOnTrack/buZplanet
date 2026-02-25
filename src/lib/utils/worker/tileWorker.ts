// Enhanced Tile Worker - handles tile requests with intelligent caching and prefetching
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { OpfsDatabase, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { mergeTiles } from '$lib/utils/map/mergeTiles.js';
import { TileCache } from './tileCache.js';

// Global state for tile worker
let sqlite3: Sqlite3Static | null = null;
let opfsRoot: FileSystemDirectoryHandle | null = null;
const openDatabases = new Map<string, OpfsDatabase>();

// Initialize tile cache with 256MB memory limit
const tileCache = new TileCache({
	maxMemorySize: 256 * 1024 * 1024, // 256MB
	prefetchRadius: 1,
	prefetchZoomLevels: [-1, 1],
	prefetchDirection: true,
	maxPrefetchQueue: 50
});

// Connect the cache to the OPFS loader once databases are initialized
let cacheInitialized = false;
function initializeTileCache() {
	if (cacheInitialized) return;
	cacheInitialized = true;

	// Set the OPFS loader function for the cache
	tileCache.setOPFSLoader(loadTileFromOPFS);
	console.log('✅ Tile cache initialized with OPFS loader');
}

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent) => {
	const { type, data, id } = event.data;

	try {
		switch (type) {
			case 'init':
				await initializeSqlite();
				await initializeOPFS();
				await scanDatabases();
				postMessage({
					type: 'initialized',
					data: 'Tile worker initialized',
					id
				});
				break;

			case 'tile-request':
				const tileData = await handleTileRequest(data.source, data.z, data.x, data.y);
				if (tileData) {
					postMessage(
						{
							type: 'tile-response',
							data: tileData,
							id
						},
						{
							transfer: [tileData]
						}
					);
				} else {
					postMessage({
						type: 'tile-response',
						data: null,
						id
					});
				}
				break;

			case 'viewport-update':
				tileCache.updateViewport(data.z, data.centerX, data.centerY, data.tilesX, data.tilesY);
				postMessage({
					type: 'viewport-updated',
					data: 'Viewport updated and prefetching scheduled',
					id
				});
				break;

			case 'cache-stats':
				postMessage({
					type: 'cache-stats-response',
					data: tileCache.getStats(),
					id
				});
				break;

			case 'cache-contents':
				postMessage({
					type: 'cache-contents-response',
					data: tileCache.getCacheContents(),
					id
				});
				break;

			case 'cache-zoom-tiles':
				postMessage({
					type: 'cache-zoom-tiles-response',
					data: tileCache.getTilesByZoom(data.zoom),
					id
				});
				break;

			case 'cache-recent-tiles':
				postMessage({
					type: 'cache-recent-tiles-response',
					data: tileCache.getRecentTiles(data.limit || 10),
					id
				});
				break;

			case 'clear-cache':
				tileCache.clear();
				postMessage({
					type: 'cache-cleared',
					data: 'All caches cleared',
					id
				});
				break;

			case 'ping':
				postMessage({
					type: 'pong',
					data: 'Tile worker is alive!',
					id
				});
				break;

			default:
				postMessage({
					type: 'error',
					data: `Unknown message type: ${type}`,
					id,
					error: true
				});
		}
	} catch (error) {
		postMessage({
			type: 'error',
			data: error instanceof Error ? error.message : 'Unknown error',
			id,
			error: true
		});
	}
});

// Initialize SQLite
async function initializeSqlite(): Promise<void> {
	if (sqlite3) return;
	sqlite3 = await sqlite3InitModule();
}

// Initialize OPFS
async function initializeOPFS(): Promise<void> {
	if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
		throw new Error('OPFS is not supported in this browser');
	}
	opfsRoot = await navigator.storage.getDirectory();
}

// Scan and open databases
async function scanDatabases(): Promise<void> {
	if (!sqlite3 || !opfsRoot) return;

	for await (const [name, handle] of (opfsRoot as any).entries()) {
		if (name.endsWith('.mbtiles') && handle.kind === 'file') {
			try {
				const db: OpfsDatabase = new sqlite3.oo1.OpfsDb(name, 'r');
				openDatabases.set(name, db);
			} catch (error) {
				console.warn(`Failed to open ${name} in tile worker:`, error);
			}
		}
	}

	// Initialize tile cache after databases are loaded
	initializeTileCache();
}

// Handle tile requests with intelligent caching (Organic Maps style)
async function handleTileRequest(
	source: string,
	z: number,
	x: number,
	y: number
): Promise<ArrayBuffer | null> {
	try {
		// Validate coordinates
		if (z < 0 || z > 22 || x < 0 || y < 0) {
			throw new Error(`Invalid tile coordinates: z=${z} x=${x} y=${y}`);
		}

		// 1. FASTEST: Check memory cache first (microseconds)
		const cached = tileCache.getFromMemory(source, z, x, y);
		if (cached) {
			// Return a copy to avoid transfer ownership issues
			return cached.data.slice();
		}

		// 2. FAST: Load from OPFS MBTiles (milliseconds)
		const tileData = await loadTileFromOPFS(source, z, x, y);
		if (tileData) {
			// Increment OPFS fetch counter
			tileCache.incrementOPFSFetch();

			// Store in memory cache for future requests (async, don't wait)
			tileCache.storeInMemory(source, z, x, y, tileData, false).catch((error) => {
				console.warn('Failed to cache tile:', error);
			});

			// Return a copy
			return tileData.slice();
		}

		return null;
	} catch (error) {
		// Log actual errors (not missing tiles/databases)
		if (
			error instanceof Error &&
			!error.message.includes('No tile found') &&
			!error.message.includes('No database found')
		) {
			console.error(`Tile request failed: ${source} ${z}/${x}/${y}:`, error);
		}
		return null;
	}
}

// Load tile from OPFS MBTiles (original logic)
async function loadTileFromOPFS(
	source: string,
	z: number,
	x: number,
	y: number
): Promise<ArrayBuffer | null> {
	const startTime = performance.now();

	// Find databases for the source
	const sourceDbs = getDatabasesBySource(source);
	if (sourceDbs.length === 0) {
		return null;
	}

	// Convert XYZ to TMS Y coordinate (MBTiles use TMS scheme)
	const tmsY = (1 << z) - 1 - y;

	let result: ArrayBuffer | null = null;

	// Special handling for basemap - merge multiple tiles
	if (source.toLowerCase() === 'basemap' && sourceDbs.length > 1) {
		result = await mergeVectorTiles(sourceDbs, z, x, tmsY);
	} else {
		// For non-basemap or single database, use existing logic
		result = await getSingleTile(sourceDbs, z, x, tmsY);
	}

	if (result) {
		const endTime = performance.now();
		const duration = endTime - startTime;
		// console.log(`💾 OPFS FETCH: ${source}-${z}-${x}-${y} (${duration.toFixed(3)}ms - OPFS disk)`);
	}

	return result;
}

function getDatabasesBySource(source: string): OpfsDatabase[] {
	const matchingDbs: OpfsDatabase[] = [];
	const sourceLower = source.toLowerCase();

	// Special handling for basemap - merge multiple basemap databases
	if (sourceLower === 'basemap') {
		const basemapPatterns = [
			'basemap',
			'base-map',
			'base_map',
			'osm',
			'planet',
			'world',
			'background'
		];

		for (const [filename, db] of openDatabases) {
			const filenameLower = filename.toLowerCase();
			const isBasemap = basemapPatterns.some(
				(pattern) =>
					filenameLower.includes(pattern) ||
					(!filenameLower.includes('poi') &&
						!filenameLower.includes('building') &&
						!filenameLower.includes('place') &&
						!filenameLower.includes('transport') &&
						!filenameLower.includes('amenity'))
			);

			if (isBasemap) {
				matchingDbs.push(db);
			}
		}
		return matchingDbs;
	}

	// For non-basemap sources, use exact/simple matching
	for (const [filename, db] of openDatabases) {
		const filenameLower = filename.toLowerCase();
		if (filenameLower.includes(sourceLower)) {
			matchingDbs.push(db);
		}
	}

	return matchingDbs;
}

// Get single tile (existing logic)
async function getSingleTile(
	sourceDbs: OpfsDatabase[],
	z: number,
	x: number,
	tmsY: number
): Promise<ArrayBuffer | null> {
	for (const db of sourceDbs) {
		try {
			const stmt = db.prepare(
				'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?'
			);

			stmt.bind([z, x, tmsY]);

			if (stmt.step()) {
				const tileData = stmt.get(0) as Uint8Array;
				stmt.finalize();

				if (tileData && tileData.length > 0) {
					return await processRawTileData(tileData);
				}
			} else {
				stmt.finalize();
			}
		} catch (dbError) {
			console.warn(`Error querying database for tile z=${z} x=${x} y=${tmsY}:`, dbError);
			continue;
		}
	}

	return null;
}

// Process raw tile data (decompress if needed)
async function processRawTileData(tileData: Uint8Array): Promise<ArrayBuffer> {
	// Check if tile is gzipped (common in MBTiles)
	if (isGzipped(tileData)) {
		return await gunzip(tileData);
	} else {
		const typedArray = tileData as Uint8Array;
		const buffer =
			typedArray.buffer instanceof ArrayBuffer
				? typedArray.buffer
				: new ArrayBuffer(typedArray.byteLength);
		if (!(typedArray.buffer instanceof ArrayBuffer)) {
			new Uint8Array(buffer).set(typedArray);
			return buffer;
		}
		return buffer.slice(typedArray.byteOffset, typedArray.byteOffset + typedArray.byteLength);
	}
}

// Merge multiple vector tiles into a single tile
async function mergeVectorTiles(
	sourceDbs: OpfsDatabase[],
	z: number,
	x: number,
	tmsY: number
): Promise<ArrayBuffer | null> {
	const tilesToMerge: { filename: string; data: ArrayBuffer }[] = [];

	for (const db of sourceDbs) {
		try {
			const stmt = db.prepare(
				'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?'
			);
			stmt.bind([z, x, tmsY]);

			if (stmt.step()) {
				const rawTileData = stmt.get(0) as Uint8Array;
				stmt.finalize();

				if (rawTileData && rawTileData.length > 0) {
					const processedData = await processRawTileData(rawTileData);
					tilesToMerge.push({
						filename: 'unknown',
						data: processedData
					});
				}
			} else {
				stmt.finalize();
			}
		} catch (dbError) {
			console.warn(`Error getting tile for merge:`, dbError);
			continue;
		}
	}

	if (tilesToMerge.length === 0) {
		return null;
	}

	if (tilesToMerge.length === 1) {
		return tilesToMerge[0].data;
	}

	try {
		const tileArrays: Uint8Array[] = tilesToMerge.map(({ data }) => new Uint8Array(data));
		const mergedTile = await mergeTiles(tileArrays);

		const resultBuffer =
			mergedTile.buffer instanceof ArrayBuffer
				? mergedTile.buffer
				: new ArrayBuffer(mergedTile.byteLength);

		if (!(mergedTile.buffer instanceof ArrayBuffer)) {
			new Uint8Array(resultBuffer).set(mergedTile);
			return resultBuffer;
		}

		return resultBuffer.slice(mergedTile.byteOffset, mergedTile.byteOffset + mergedTile.byteLength);
	} catch (error) {
		console.error(`Vector tile merge failed:`, error);
		return tilesToMerge[0].data;
	}
}

// Check if data is gzipped
function isGzipped(data: Uint8Array): boolean {
	return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

// Gunzip decompression
async function gunzip(data: Uint8Array): Promise<ArrayBuffer> {
	try {
		const buffer =
			data.buffer instanceof ArrayBuffer ? data.buffer : new ArrayBuffer(data.byteLength);
		if (!(data.buffer instanceof ArrayBuffer)) {
			new Uint8Array(buffer).set(data);
		}

		const decompressionStream = new DecompressionStream('gzip');
		const response = new Response(buffer);
		const inputStream = response.body!;
		const decompressedStream = inputStream.pipeThrough(decompressionStream);
		const decompressedArrayBuffer = await new Response(decompressedStream).arrayBuffer();
		return decompressedArrayBuffer;
	} catch (error) {
		console.error('Gunzip decompression failed:', error);
		throw error;
	}
}

// Send ready message
postMessage({
	type: 'ready',
	data: 'Tile worker is ready'
});
