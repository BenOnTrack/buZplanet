// Web Worker TypeScript implementation
// This worker runs in a separate thread and can communicate with the main thread
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { OpfsDatabase, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { VectorTile, type VectorTileFeature } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import { mergeTiles } from '$lib/utils/map/mergeTiles.js';

export interface WorkerMessage {
	type: string;
	data?: any;
	id?: string;
	fileData?: ArrayBuffer;
}

export interface WorkerResponse extends WorkerMessage {
	error?: boolean;
}

export interface DatabaseEntry {
	db: OpfsDatabase;
	bounds?: [number, number, number, number];
	minzoom?: number;
	maxzoom?: number;
	filename: string;
	metadata?: any;
}

export interface DatabaseMetadata {
	bounds?: [number, number, number, number];
	minzoom?: number;
	maxzoom?: number;
	format?: string;
	name?: string;
	description?: string;
}

// Global state
let sqlite3: Sqlite3Static | null = null;
let opfsRoot: FileSystemDirectoryHandle | null = null;
const dbIndex = new Map<string, DatabaseEntry[]>();
const openDatabases = new Map<string, OpfsDatabase>();

// OPFS file operations
class WorkerOPFSManager {
	private static instance: WorkerOPFSManager;
	private root: FileSystemDirectoryHandle | null = null;

	public static getInstance(): WorkerOPFSManager {
		if (!WorkerOPFSManager.instance) {
			WorkerOPFSManager.instance = new WorkerOPFSManager();
		}
		return WorkerOPFSManager.instance;
	}

	public async initialize(): Promise<void> {
		if (!('storage' in navigator && 'getDirectory' in navigator.storage)) {
			throw new Error('OPFS is not supported in this browser');
		}

		try {
			this.root = await navigator.storage.getDirectory();
			opfsRoot = this.root; // Set global reference
		} catch (error) {
			throw new Error(`Failed to initialize OPFS: ${error}`);
		}
	}

	public async saveFile(
		filename: string,
		data: ArrayBuffer,
		directory: string = ''
	): Promise<string> {
		if (!this.root) {
			await this.initialize();
		}

		try {
			// Use root directory or create/get subdirectory
			const dirHandle = directory
				? await this.root!.getDirectoryHandle(directory, { create: true })
				: this.root!;

			// Generate unique filename if file already exists
			let finalFilename = filename;
			let counter = 1;

			while (await this.fileExists(dirHandle, finalFilename)) {
				const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
				const ext = filename.match(/\.[^/.]+$/)?.[0] || '';
				finalFilename = `${nameWithoutExt}_${counter}${ext}`;
				counter++;
			}

			// Create file handle
			const fileHandle = await dirHandle.getFileHandle(finalFilename, { create: true });

			// Safari iOS compatibility: check if createWritable is available
			if ('createWritable' in fileHandle) {
				// Modern browsers (Chrome, Firefox, desktop Safari)
				const writable = await (fileHandle as any).createWritable();
				await writable.write(data);
				await writable.close();
			} else {
				// Safari iOS fallback: use createSyncAccessHandle if available
				if ('createSyncAccessHandle' in fileHandle) {
					const accessHandle = await (fileHandle as any).createSyncAccessHandle();
					try {
						accessHandle.truncate(0);
						accessHandle.write(new Uint8Array(data), { at: 0 });
						accessHandle.flush();
					} finally {
						accessHandle.close();
					}
				} else {
					// Ultimate fallback: throw descriptive error
					throw new Error('OPFS write operations not supported in this browser version');
				}
			}

			return directory ? `${directory}/${finalFilename}` : finalFilename;
		} catch (error) {
			throw new Error(`Failed to save file: ${error}`);
		}
	}

	public async listFiles(directory: string = ''): Promise<string[]> {
		if (!this.root) {
			await this.initialize();
		}

		try {
			// Use root directory or get subdirectory
			const dirHandle = directory ? await this.root!.getDirectoryHandle(directory) : this.root!;
			const files: string[] = [];

			// TypeScript doesn't recognize entries() method but it exists in modern browsers
			for await (const [name, handle] of (dirHandle as any).entries()) {
				if (handle.kind === 'file') {
					files.push(name);
				}
			}

			return files;
		} catch (error) {
			// Directory doesn't exist or other error
			return [];
		}
	}

	private async fileExists(
		dirHandle: FileSystemDirectoryHandle,
		filename: string
	): Promise<boolean> {
		try {
			await dirHandle.getFileHandle(filename);
			return true;
		} catch {
			return false;
		}
	}
}

const workerOPFS = WorkerOPFSManager.getInstance();

// Listen for messages from the main thread
self.addEventListener('message', async (event: MessageEvent<WorkerMessage>) => {
	const { type, data, id } = event.data;

	try {
		switch (type) {
			case 'ping':
				// Respond to ping with pong
				postMessage({
					type: 'pong',
					data: 'Worker is alive!',
					id
				} satisfies WorkerResponse);
				break;

			case 'init':
				// Initialize SQLite and OPFS
				await initializeSqlite();
				await workerOPFS.initialize();
				// Check and log all OPFS .mbtiles files
				const opfsFiles = await listOpfsMbtilesFiles();
				postMessage({
					type: 'initialized',
					data: {
						message: 'SQLite and OPFS initialized',
						opfsFiles: opfsFiles
					},
					id
				} satisfies WorkerResponse);
				break;

			case 'scan-databases':
				// Scan and index all .mbtiles files
				const scanResult = await scanAndIndexDatabases();
				postMessage({
					type: 'databases-scanned',
					data: scanResult,
					id
				} satisfies WorkerResponse);
				break;

			case 'query-database':
				// Execute query on specific database
				const queryResult = await queryDatabase(data.filename, data.query, data.params);
				postMessage({
					type: 'query-result',
					data: queryResult,
					id
				} satisfies WorkerResponse);
				break;

			case 'get-databases':
				// Get list of available databases
				const databases = getDatabaseList();
				postMessage({
					type: 'database-list',
					data: databases,
					id
				} satisfies WorkerResponse);
				break;

			case 'close-database':
				// Close specific database
				closeDatabase(data.filename);
				postMessage({
					type: 'database-closed',
					data: `Database ${data.filename} closed`,
					id
				} satisfies WorkerResponse);
				break;

			case 'tile-request':
				// Handle tile request from protocol handler
				const tileData = await handleTileRequest(data.source, data.z, data.x, data.y);
				if (tileData) {
					postMessage(
						{
							type: 'tile-response',
							data: tileData,
							id
						} satisfies WorkerResponse,
						{
							transfer: [tileData]
						}
					); // Transfer ArrayBuffer
				} else {
					// No tile data available - send response with null data
					postMessage({
						type: 'tile-response',
						data: null,
						id
					} satisfies WorkerResponse);
				}
				break;

			case 'list-databases':
				// List all available databases with their metadata
				const availableDbs = getDatabaseList();
				postMessage({
					type: 'database-list-response',
					data: {
						databases: availableDbs,
						totalCount: availableDbs.length,
						filenames: availableDbs.map((db) => db.filename)
					},
					id
				} satisfies WorkerResponse);
				break;

			case 'opfs-save-file':
				// Save file to OPFS
				const savedPath = await workerOPFS.saveFile(
					data.filename,
					data.fileData,
					data.directory || ''
				);
				postMessage({
					type: 'opfs-file-saved',
					data: { savedPath },
					id
				} satisfies WorkerResponse);
				break;

			case 'opfs-list-files':
				// List files in OPFS
				const fileList = await workerOPFS.listFiles(data.directory || '');
				postMessage({
					type: 'opfs-files-listed',
					data: { files: fileList },
					id
				} satisfies WorkerResponse);
				break;

			case 'search-features':
				// Search for features across all mbtiles databases with progressive results
				const searchResults = await searchFeatures(data.query, data.limit || 10000, {
					onProgress: (results: SearchResult[], isComplete: boolean, currentDatabase?: string) => {
						// Send progressive results to main thread
						postMessage({
							type: 'search-progress',
							data: {
								results,
								isComplete,
								currentDatabase,
								total: results.length
							},
							id
						} satisfies WorkerResponse);
					}
				});
				// Final complete message
				postMessage({
					type: 'search-results',
					data: searchResults,
					id
				} satisfies WorkerResponse);
				break;

			case 'task':
				// Example task processing
				// Simulate some work
				const taskResult = `Task completed: ${data}`;
				postMessage({
					type: 'task-completed',
					data: taskResult,
					id
				} satisfies WorkerResponse);
				break;

			default:
				// Unknown message type
				postMessage({
					type: 'error',
					data: `Unknown message type: ${type}`,
					id,
					error: true
				} satisfies WorkerResponse);
		}
	} catch (error) {
		// Send error back to main thread
		postMessage({
			type: 'error',
			data: error instanceof Error ? error.message : 'Unknown error',
			id,
			error: true
		} satisfies WorkerResponse);
	}
});

// Handle worker errors
self.addEventListener('error', (error) => {
	console.error('Worker error:', error);
	postMessage({
		type: 'worker-error',
		data: error.message,
		error: true
	} satisfies WorkerResponse);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', (event) => {
	console.error('Worker unhandled rejection:', event.reason);
	postMessage({
		type: 'worker-error',
		data: `Unhandled rejection: ${event.reason}`,
		error: true
	} satisfies WorkerResponse);
});

// SQLite initialization
async function initializeSqlite(): Promise<void> {
	if (sqlite3) return; // Already initialized

	try {
		// Initialize SQLite
		sqlite3 = await sqlite3InitModule();

		// Get OPFS root directory
		opfsRoot = await navigator.storage.getDirectory();

		// SQLite and OPFS initialized successfully
	} catch (error) {
		console.error('❌ Failed to initialize SQLite:', error);
		throw error;
	}
}

// List all .mbtiles files in OPFS root directory
async function listOpfsMbtilesFiles(): Promise<string[]> {
	if (!opfsRoot) {
		throw new Error('OPFS not initialized');
	}

	const mbtilesFiles: string[] = [];

	try {
		// Iterate through all entries in OPFS root
		for await (const [name, handle] of (opfsRoot as any).entries()) {
			if (name.endsWith('.mbtiles') && handle.kind === 'file') {
				mbtilesFiles.push(name);
			}
		}

		// Found .mbtiles files in OPFS root
		return mbtilesFiles;
	} catch (error) {
		console.error('❌ Error listing OPFS .mbtiles files:', error);
		throw error;
	}
}

// Scan and index all .mbtiles files in OPFS
async function scanAndIndexDatabases(): Promise<{
	totalFiles: number;
	successfulDbs: number;
	corruptedFiles: string[];
	indexKeys: number;
}> {
	if (!sqlite3 || !opfsRoot) {
		throw new Error('SQLite not initialized');
	}

	// Clear existing index
	dbIndex.clear();
	closeAllDatabases();

	const mbtilesList: string[] = [];
	const corruptedFiles: string[] = [];

	// Find all .mbtiles files
	for await (const [name, handle] of (opfsRoot as any).entries()) {
		if (name.endsWith('.mbtiles') && handle.kind === 'file') {
			mbtilesList.push(name);
		}
	}

	// console.log(`Found ${mbtilesList.length} .mbtiles files in OPFS:`, mbtilesList);

	// Process each database
	for (const filename of mbtilesList) {
		try {
			await processDatabaseFile(filename);
			// Successfully loaded database
		} catch (error) {
			console.error(`❌ Failed to load ${filename}:`, error);
			corruptedFiles.push(filename);

			// Remove corrupted file
			await removeCorruptedFile(filename);
		}
	}

	const result = {
		totalFiles: mbtilesList.length,
		successfulDbs: mbtilesList.length - corruptedFiles.length,
		corruptedFiles,
		indexKeys: dbIndex.size
	};

	// console.log('Database scan complete:', result);

	// Notify about corrupted files if any
	if (corruptedFiles.length > 0) {
		postMessage({
			type: 'corrupted-databases-detected',
			data: {
				corruptedFiles,
				message: 'Some database files were corrupted and removed. Please re-download these files.'
			}
		} satisfies WorkerResponse);
	}

	return result;
}

// Process individual database file
async function processDatabaseFile(filename: string): Promise<void> {
	if (!sqlite3 || !opfsRoot) {
		throw new Error('SQLite not initialized');
	}

	// Validate file exists and has content
	const fileHandle = await opfsRoot.getFileHandle(filename, { create: false });
	const file = await fileHandle.getFile();

	if (file.size === 0) {
		throw new Error(`File ${filename} is empty`);
	}

	// console.log(`Processing ${filename}: ${file.size} bytes`);

	// Open database in read-only mode
	const db: OpfsDatabase = new sqlite3.oo1.OpfsDb(filename, 'r');

	try {
		// Validate database and get metadata
		const metadata = await validateAndGetMetadata(db);

		// Create database entry
		const dbEntry: DatabaseEntry = {
			db,
			bounds: metadata.bounds,
			minzoom: metadata.minzoom,
			maxzoom: metadata.maxzoom,
			filename
		};

		// Add to index with multiple keys for easy lookup
		const indexKeys = generateIndexKeys(dbEntry);
		for (const key of indexKeys) {
			if (!dbIndex.has(key)) {
				dbIndex.set(key, []);
			}
			dbIndex.get(key)!.push(dbEntry);
		}

		// Keep reference to open database
		openDatabases.set(filename, db);
	} catch (error) {
		db.close();
		throw error;
	}
}

// Validate database and extract metadata
async function validateAndGetMetadata(db: OpfsDatabase): Promise<DatabaseMetadata> {
	try {
		// Check if it's a valid MBTiles database
		const tables = db.selectArrays("SELECT name FROM sqlite_master WHERE type='table'");
		const tableNames = tables.map((row) => row[0]);

		if (!tableNames.includes('tiles') || !tableNames.includes('metadata')) {
			throw new Error('Invalid MBTiles database: missing required tables');
		}

		// Get metadata
		const metadata: DatabaseMetadata = {};
		const metadataRows = db.selectArrays('SELECT name, value FROM metadata');

		for (const [name, value] of metadataRows) {
			if (value === null || value === undefined) continue;

			switch (name) {
				case 'bounds':
					if (typeof value === 'string') {
						metadata.bounds = value.split(',').map(Number) as [number, number, number, number];
					}
					break;
				case 'minzoom':
					metadata.minzoom = parseInt(String(value));
					break;
				case 'maxzoom':
					metadata.maxzoom = parseInt(String(value));
					break;
				case 'format':
					metadata.format = String(value);
					break;
				case 'name':
					metadata.name = String(value);
					break;
				case 'description':
					metadata.description = String(value);
					break;
			}
		}

		// Verify we can read tiles
		const tileCount = db.selectValue('SELECT COUNT(*) FROM tiles');
		if (!tileCount || tileCount === 0) {
			throw new Error('Database contains no tiles');
		}

		return metadata;
	} catch (error) {
		throw new Error(
			`Database validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
		);
	}
}

// Generate index keys for database lookup
function generateIndexKeys(dbEntry: DatabaseEntry): string[] {
	const keys = [dbEntry.filename];

	// Add bounds-based keys if available
	if (dbEntry.bounds) {
		const [west, south, east, north] = dbEntry.bounds;
		keys.push(`bounds_${west}_${south}_${east}_${north}`);
	}

	// Add zoom-based keys
	if (dbEntry.minzoom !== undefined && dbEntry.maxzoom !== undefined) {
		keys.push(`zoom_${dbEntry.minzoom}_${dbEntry.maxzoom}`);
	}

	return keys;
}

// Query specific database
async function queryDatabase(filename: string, query: string, params?: any[]): Promise<any> {
	const db = openDatabases.get(filename);
	if (!db) {
		throw new Error(`Database ${filename} not found or not open`);
	}

	try {
		if (params) {
			return db.selectArrays(query, params);
		} else {
			return db.selectArrays(query);
		}
	} catch (error) {
		throw new Error(`Query failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

// Get list of available databases
function getDatabaseList(): Array<{ filename: string; metadata: DatabaseMetadata }> {
	const databases: Array<{ filename: string; metadata: DatabaseMetadata }> = [];

	for (const [filename, db] of openDatabases) {
		try {
			const metadataRows = db.selectArrays('SELECT name, value FROM metadata');
			const metadata: DatabaseMetadata = {};

			for (const [name, value] of metadataRows) {
				if (value === null || value === undefined) continue;

				switch (name) {
					case 'bounds':
						if (typeof value === 'string') {
							metadata.bounds = value.split(',').map(Number) as [number, number, number, number];
						}
						break;
					case 'minzoom':
						metadata.minzoom = parseInt(String(value));
						break;
					case 'maxzoom':
						metadata.maxzoom = parseInt(String(value));
						break;
					case 'format':
						metadata.format = String(value);
						break;
					case 'name':
						metadata.name = String(value);
						break;
					case 'description':
						metadata.description = String(value);
						break;
				}
			}

			databases.push({ filename, metadata });
		} catch (error) {
			console.warn(`Failed to get metadata for ${filename}:`, error);
		}
	}

	return databases;
}

// Close specific database
function closeDatabase(filename: string): void {
	const db = openDatabases.get(filename);
	if (db) {
		try {
			db.close();
			openDatabases.delete(filename);

			// Remove from index
			for (const [key, entries] of dbIndex.entries()) {
				const filtered = entries.filter((entry) => entry.filename !== filename);
				if (filtered.length === 0) {
					dbIndex.delete(key);
				} else {
					dbIndex.set(key, filtered);
				}
			}

			// Database closed
		} catch (error) {
			console.error(`Error closing database ${filename}:`, error);
		}
	}
}

// Close all databases
function closeAllDatabases(): void {
	for (const filename of openDatabases.keys()) {
		closeDatabase(filename);
	}
}

// Remove corrupted file from OPFS
async function removeCorruptedFile(filename: string): Promise<void> {
	if (!opfsRoot) return;

	try {
		await opfsRoot.removeEntry(filename);
		// Removed corrupted file
	} catch (error) {
		console.error(`Failed to remove corrupted file ${filename}:`, error);
	}
}

// Cleanup on worker termination
self.addEventListener('beforeunload', () => {
	closeAllDatabases();
});

// Handle tile requests with vector tile merging
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

		// Find databases for the source
		const sourceDbs = getDatabasesBySource(source);
		if (sourceDbs.length === 0) {
			return null;
		}

		// Convert XYZ to TMS Y coordinate (MBTiles use TMS scheme)
		const tmsY = (1 << z) - 1 - y;

		// Special handling for basemap - merge multiple tiles
		if (source.toLowerCase() === 'basemap' && sourceDbs.length > 1) {
			return await mergeVectorTiles(sourceDbs, z, x, tmsY);
		}

		// For non-basemap or single database, use existing logic
		return await getSingleTile(sourceDbs, z, x, tmsY);
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

// Get single tile (existing logic)
async function getSingleTile(
	sourceDbs: DatabaseEntry[],
	z: number,
	x: number,
	tmsY: number
): Promise<ArrayBuffer | null> {
	// Try to get tile from databases (fallback logic)
	for (const dbEntry of sourceDbs) {
		// Check if zoom level is within database range
		if (dbEntry.minzoom !== undefined && z < dbEntry.minzoom) {
			continue;
		}
		if (dbEntry.maxzoom !== undefined && z > dbEntry.maxzoom) {
			continue;
		}

		try {
			const stmt = dbEntry.db.prepare(
				'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?'
			);

			stmt.bind([z, x, tmsY]);

			if (stmt.step()) {
				const tileData = stmt.get(0) as Uint8Array;
				stmt.finalize();

				if (tileData && tileData.length > 0) {
					// Decompress if needed and return
					return await processRawTileData(tileData);
				}
			} else {
				stmt.finalize();
			}
		} catch (dbError) {
			console.warn(`Error querying ${dbEntry.filename} for tile z=${z} x=${x} y=${tmsY}:`, dbError);
			continue;
		}
	}

	return null;
}

// Process raw tile data (decompress if needed)
async function processRawTileData(tileData: Uint8Array): Promise<ArrayBuffer> {
	// Check if tile is gzipped (common in MBTiles)
	if (isGzipped(tileData)) {
		// Decompress gzipped tile
		return await gunzip(tileData);
	} else {
		// Return tile data as-is
		const typedArray = tileData as Uint8Array;
		// Create a new ArrayBuffer to ensure it's not SharedArrayBuffer
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
	sourceDbs: DatabaseEntry[],
	z: number,
	x: number,
	tmsY: number
): Promise<ArrayBuffer | null> {
	// Collect raw tile data from all relevant databases
	const tilesToMerge: { filename: string; data: ArrayBuffer }[] = [];

	for (const dbEntry of sourceDbs) {
		// Check if zoom level is within database range
		if (dbEntry.minzoom !== undefined && z < dbEntry.minzoom) {
			continue;
		}
		if (dbEntry.maxzoom !== undefined && z > dbEntry.maxzoom) {
			continue;
		}

		try {
			const stmt = dbEntry.db.prepare(
				'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?'
			);
			stmt.bind([z, x, tmsY]);

			if (stmt.step()) {
				const rawTileData = stmt.get(0) as Uint8Array;
				stmt.finalize();

				if (rawTileData && rawTileData.length > 0) {
					// Process and decompress the tile data
					const processedData = await processRawTileData(rawTileData);
					tilesToMerge.push({
						filename: dbEntry.filename,
						data: processedData
					});
				}
			} else {
				stmt.finalize();
			}
		} catch (dbError) {
			console.warn(`Error getting tile for merge from ${dbEntry.filename}:`, dbError);
			continue;
		}
	}

	// If no tiles to merge, return null
	if (tilesToMerge.length === 0) {
		return null;
	}

	// If only one tile, return it directly
	if (tilesToMerge.length === 1) {
		return tilesToMerge[0].data;
	}

	// Parse vector tiles and merge them
	try {
		return await mergeVectorTileData(tilesToMerge, z, x, tmsY);
	} catch (error) {
		console.error(`Vector tile merge failed:`, error);
		// Fallback to first tile if merge fails
		return tilesToMerge[0].data;
	}
}

interface TileToMerge {
	filename: string;
	data: ArrayBuffer;
}

// Merge vector tile data using the existing mergeTiles function
async function mergeVectorTileData(
	tilesToMerge: TileToMerge[],
	z: number,
	x: number,
	tmsY: number
): Promise<ArrayBuffer> {
	// Convert ArrayBuffers to Uint8Arrays for mergeTiles function
	const tileArrays: Uint8Array[] = tilesToMerge.map(({ data }) => new Uint8Array(data));

	try {
		// Use the existing mergeTiles function
		const mergedTile = await mergeTiles(tileArrays);

		// Convert back to ArrayBuffer
		return mergedTile.buffer.slice(
			mergedTile.byteOffset,
			mergedTile.byteOffset + mergedTile.byteLength
		);
	} catch (error) {
		console.error(`mergeTiles() failed:`, error);
		throw error;
	}
}
function getDatabasesBySource(source: string): DatabaseEntry[] {
	const matchingDbs: DatabaseEntry[] = [];
	const sourceLower = source.toLowerCase();

	// Special handling for basemap - merge multiple basemap databases
	if (sourceLower === 'basemap') {
		// Look for any database that could be a basemap
		const basemapPatterns = [
			'basemap', // Direct match
			'base-map', // Hyphenated
			'base_map', // Underscore
			'osm', // OpenStreetMap basemap
			'planet', // Planet extracts often used as basemap
			'world', // World basemap
			'background' // Background layer
		];

		for (const [filename, db] of openDatabases) {
			const filenameLower = filename.toLowerCase();

			// Check if filename matches any basemap pattern
			const isBasemap = basemapPatterns.some(
				(pattern) =>
					filenameLower.includes(pattern) ||
					// Also check if it doesn't match other specific layer types
					(!filenameLower.includes('poi') &&
						!filenameLower.includes('building') &&
						!filenameLower.includes('place') &&
						!filenameLower.includes('transport') &&
						!filenameLower.includes('amenity'))
			);

			if (isBasemap) {
				// Get the database entry from our index but avoid duplicates
				let foundInThisSource = false;
				for (const [key, entries] of dbIndex.entries()) {
					for (const entry of entries) {
						if (entry.filename === filename && !matchingDbs.some((db) => db === entry)) {
							matchingDbs.push(entry);
							foundInThisSource = true;
							break;
						}
					}
					if (foundInThisSource) break; // Only add once per filename
				}
			}
		}

		return matchingDbs;
	}

	// For non-basemap sources, use exact/simple matching
	for (const [filename, db] of openDatabases) {
		const filenameLower = filename.toLowerCase();

		// Simple matching: source name should be contained in filename
		if (filenameLower.includes(sourceLower)) {
			// Get the database entry from our index but avoid duplicates
			let foundInThisSource = false;
			for (const [key, entries] of dbIndex.entries()) {
				for (const entry of entries) {
					if (entry.filename === filename && !matchingDbs.some((db) => db === entry)) {
						matchingDbs.push(entry);
						foundInThisSource = true;
						break;
					}
				}
				if (foundInThisSource) break; // Only add once per filename
			}
		}
	}

	return matchingDbs;
}

// Check if data is gzipped
function isGzipped(data: Uint8Array): boolean {
	return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

// Gunzip decompression using modern Compression Streams API
async function gunzip(data: Uint8Array): Promise<ArrayBuffer> {
	try {
		// Ensure we have an ArrayBuffer, not SharedArrayBuffer
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

// Send ready message when worker starts
postMessage({
	type: 'ready',
	data: 'Worker is ready'
} satisfies WorkerResponse);

// Search for features across all mbtiles databases
export interface SearchResult {
	id: string;
	name: string;
	class: string;
	subclass?: string;
	category?: string;
	lng: number;
	lat: number;
	database: string;
	layer: string;
	zoom: number;
	tileX: number;
	tileY: number;
}

// Fast feature search (optimized from archived worker)
async function searchFeatures(
	query: string,
	limit: number = 10000,
	options: {
		onProgress?: (results: SearchResult[], isComplete: boolean, currentDatabase?: string) => void;
	} = {}
): Promise<SearchResult[]> {
	if (!query || query.trim().length < 2) {
		return [];
	}

	const normalizedQuery = normalizeForName(query.trim());
	const results: SearchResult[] = [];
	const seenIds = new Set<string>();

	console.log(
		`🔍 Starting FAST search for: "${query}" (normalized: "${normalizedQuery}"), limit: ${limit}`
	);

	// Define POI layers to search
	const POI_SOURCE_LAYERS = [
		'poi_attraction',
		'poi_education',
		'poi_entertainment',
		'poi_facility',
		'poi_food_and_drink',
		'poi_healthcare',
		'poi_leisure',
		'poi_lodging',
		'poi_natural',
		'poi_place',
		'poi_shop',
		'poi_transportation'
	];

	// Constants optimized from archived worker
	const MAX_RESULTS = limit;
	const BATCH_SIZE = 500; // Process tiles in batches
	const MAX_CONCURRENT_TILES = 8; // Limit concurrent tile processing
	const ZOOM_LEVEL = 14; // Standard POI zoom level

	// Process databases with controlled concurrency
	const dbEntries = Array.from(openDatabases.entries());
	const relevantDbs = dbEntries.filter(([filename]) => {
		const filenameLower = filename.toLowerCase();
		return (
			filenameLower.includes('poi') ||
			filenameLower.includes('place') ||
			filenameLower.includes('osm') ||
			filenameLower.includes('planet')
		);
	});

	console.log(`📚 Found ${relevantDbs.length} relevant databases to search`);

	// Process databases in parallel with controlled concurrency
	for (const [filename, db] of relevantDbs) {
		if (results.length >= MAX_RESULTS) break;

		try {
			console.log(`🗃️ Searching database: ${filename}`);

			const previousResultsCount = results.length;

			await processDatabaseForSearch(
				db,
				filename,
				ZOOM_LEVEL,
				POI_SOURCE_LAYERS,
				normalizedQuery,
				results,
				seenIds,
				BATCH_SIZE,
				MAX_CONCURRENT_TILES,
				MAX_RESULTS
			);

			const newResultsCount = results.filter((r) => r.database === filename).length;
			console.log(`✅ Completed ${filename}: ${newResultsCount} results`);

			// Send progress update after each database if we have new results
			if (options.onProgress && results.length > previousResultsCount) {
				options.onProgress([...results], false, filename);
			}
		} catch (error) {
			console.error(`❌ Error searching ${filename}:`, error);
			continue;
		}
	}

	console.log(`🎉 Search completed: found ${results.length} total results`);

	return results.slice(0, limit);
}

// Convert tile coordinates to lng/lat (approximate center of tile)
function tileToLngLat(x: number, y: number, zoom: number): { lng: number; lat: number } {
	const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
	return {
		lng: (x / Math.pow(2, zoom)) * 360 - 180,
		lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
	};
}

// Helper functions from archived worker
function normalizeForName(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

// Optimized database processing (from archived worker)
async function processDatabaseForSearch(
	db: OpfsDatabase,
	filename: string,
	zoomLevel: number,
	wantedLayers: string[],
	normalizedQuery: string,
	results: SearchResult[],
	seenIds: Set<string>,
	batchSize: number,
	maxConcurrentTiles: number,
	maxResults: number
): Promise<void> {
	let offset = 0;
	let hasMore = true;
	let dbTileRows = 0;

	console.log(`[DB ${filename}] Starting optimized processing...`);

	while (hasMore && results.length < maxResults) {
		// Optimized query - removed ORDER BY for better performance
		const stmt = db.prepare(`
			SELECT tile_data, tile_column, tile_row
			FROM tiles
			WHERE zoom_level = ?
			LIMIT ? OFFSET ?
		`);

		try {
			stmt.bind([zoomLevel, batchSize, offset]);

			// Collect tiles from this batch
			const batchTiles: Array<{
				tileData: Uint8Array;
				x: number;
				tmsY: number;
			}> = [];

			let batchCount = 0;
			while (stmt.step() && results.length < maxResults) {
				batchCount++;
				dbTileRows++;

				batchTiles.push({
					tileData: stmt.get(0) as Uint8Array,
					x: stmt.get(1) as number,
					tmsY: stmt.get(2) as number
				});
			}

			hasMore = batchCount === batchSize;
			offset += batchCount;

			// Process this batch with controlled concurrency
			await processTileBatch(
				batchTiles,
				zoomLevel,
				filename,
				wantedLayers,
				normalizedQuery,
				results,
				seenIds,
				maxConcurrentTiles,
				maxResults
			);
		} finally {
			stmt.finalize();
		}
	}

	console.log(
		`[DB ${filename}] z=${zoomLevel} SUMMARY: ${dbTileRows} tiles, ${results.filter((r) => r.database === filename).length} matches`
	);
}

// Process a batch of tiles with controlled concurrency
async function processTileBatch(
	tiles: Array<{ tileData: Uint8Array; x: number; tmsY: number }>,
	zoomLevel: number,
	filename: string,
	wantedLayers: string[],
	normalizedQuery: string,
	results: SearchResult[],
	seenIds: Set<string>,
	maxConcurrentTiles: number,
	maxResults: number
): Promise<void> {
	const activeTasks = new Set<Promise<void>>();

	for (const { tileData, x, tmsY } of tiles) {
		if (results.length >= maxResults) break;

		// Wait if we have too many concurrent tile operations
		while (activeTasks.size >= maxConcurrentTiles) {
			await Promise.race(activeTasks);
		}

		const tileTask = processSingleTileOptimized(
			tileData,
			x,
			tmsY,
			zoomLevel,
			filename,
			wantedLayers,
			normalizedQuery,
			results,
			seenIds,
			maxResults
		).finally(() => {
			activeTasks.delete(tileTask);
		});

		activeTasks.add(tileTask);
	}

	// Wait for all remaining tasks in this batch
	await Promise.all(activeTasks);
}

// Process a single tile with proper vector tile parsing (like archived worker)
async function processSingleTileOptimized(
	tileData: Uint8Array,
	x: number,
	tmsY: number,
	zoomLevel: number,
	filename: string,
	wantedLayers: string[],
	normalizedQuery: string,
	results: SearchResult[],
	seenIds: Set<string>,
	maxResults: number
): Promise<void> {
	if (results.length >= maxResults) return;

	try {
		const n = 1 << zoomLevel;
		const y = n - 1 - tmsY; // Convert from TMS to XYZ

		// Decompress tile data (tilemaker always generates gzipped tiles)
		const buffer = await gunzip(tileData);

		// Parse vector tile using proper library (like archived worker)
		const tile = new VectorTile(new Protobuf(buffer));

		// Process each wanted layer
		for (const sourceLayer of wantedLayers) {
			if (results.length >= maxResults) break;

			const layer = tile.layers[sourceLayer];
			if (!layer) continue;

			// Iterate through features in this layer
			for (let i = 0; i < layer.length; i++) {
				if (results.length >= maxResults) break;

				const vectorTileFeature = layer.feature(i);
				const props = vectorTileFeature.properties as Record<string, any>;

				// Check name properties - prioritize name:en, fallback to name
				const nameEn = props['name:en'];
				const name = props['name'];

				let isMatch = false;
				let matchedName = '';

				// Quick exit if no searchable properties
				if (!name && !nameEn) continue;

				// Check name:en first (preferred)
				if (nameEn && fastMatchesQuery(nameEn, normalizedQuery)) {
					isMatch = true;
					matchedName = nameEn;
				}
				// If no match in name:en, check regular name
				else if (name && fastMatchesQuery(name, normalizedQuery)) {
					isMatch = true;
					matchedName = name;
				}

				if (isMatch) {
					// Convert to GeoJSON to get proper coordinates
					const geojsonFeature = vectorTileFeature.toGeoJSON(x, y, zoomLevel);

					// Extract coordinates from GeoJSON
					let lng: number, lat: number;

					if (geojsonFeature.geometry.type === 'Point') {
						[lng, lat] = geojsonFeature.geometry.coordinates;
					} else if (
						geojsonFeature.geometry.type === 'LineString' ||
						geojsonFeature.geometry.type === 'Polygon'
					) {
						// Use first coordinate for lines/polygons
						const coords =
							geojsonFeature.geometry.type === 'Polygon'
								? geojsonFeature.geometry.coordinates[0][0]
								: geojsonFeature.geometry.coordinates[0];
						[lng, lat] = coords;
					} else {
						// Fallback: use tile center
						const tileCenter = tileToLngLat(x, y, zoomLevel);
						lng = tileCenter.lng;
						lat = tileCenter.lat;
					}

					const fid = String(props['id'] || `${filename}:${sourceLayer}:${x}:${y}:${i}`);
					const dedupKey = `${filename}|${sourceLayer}|${fid}`;

					if (!seenIds.has(dedupKey)) {
						seenIds.add(dedupKey);

						// Extract class from layer name
						const featureClass = sourceLayer.startsWith('poi_')
							? sourceLayer.replace('poi_', '')
							: 'poi';

						results.push({
							id: fid,
							name: matchedName,
							class: featureClass,
							subclass: props['subclass'],
							category: props['category'],
							lng: lng,
							lat: lat,
							database: filename,
							layer: sourceLayer,
							zoom: zoomLevel,
							tileX: x,
							tileY: y
						});
					}
				}
			}
		}
	} catch (tileError) {
		// Silently skip problematic tiles to maintain performance
		// console.warn(`Error processing tile ${x}/${tmsY}:`, tileError);
	}
}

// Fast and optimized search matching
function fastMatchesQuery(target: string, normalizedQuery: string): boolean {
	if (!target || !normalizedQuery) return false;

	// Convert target to lowercase for case-insensitive search
	const targetLower = target.toLowerCase();
	const queryLower = normalizedQuery.toLowerCase();

	// Fast path: direct substring match (most common case)
	if (targetLower.includes(queryLower)) return true;

	// Slower path: full normalization only when needed
	const normalizedTarget = normalizeForName(target);
	return normalizedTarget.includes(normalizedQuery);
}
