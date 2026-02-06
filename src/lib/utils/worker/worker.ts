// Web Worker TypeScript implementation
// This worker runs in a separate thread and can communicate with the main thread
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { OpfsDatabase, Sqlite3Static } from '@sqlite.org/sqlite-wasm';

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

			// Create writable stream and write file
			const writable = await fileHandle.createWritable();
			await writable.write(data);
			await writable.close();

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

// Handle tile requests
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
			// No database found for this source - this is normal, just return null
			return null;
		}

		// Convert XYZ to TMS Y coordinate (MBTiles use TMS scheme)
		const tmsY = (1 << z) - 1 - y;

		// Try to get tile from databases (prioritize first match)
		for (const dbEntry of sourceDbs) {
			// Check if zoom level is within database range
			if (dbEntry.minzoom !== undefined && z < dbEntry.minzoom) continue;
			if (dbEntry.maxzoom !== undefined && z > dbEntry.maxzoom) continue;

			try {
				const stmt = dbEntry.db.prepare(
					'SELECT tile_data FROM tiles WHERE zoom_level=? AND tile_column=? AND tile_row=?'
				);

				stmt.bind([z, x, tmsY]);

				if (stmt.step()) {
					const tileData = stmt.get(0) as Uint8Array;
					stmt.finalize();

					if (tileData && tileData.length > 0) {
						// Check if tile is gzipped (common in MBTiles)
						if (isGzipped(tileData)) {
							// Decompress gzipped tile
							const decompressed = await gunzip(tileData);
							return decompressed;
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
							return buffer.slice(
								typedArray.byteOffset,
								typedArray.byteOffset + typedArray.byteLength
							);
						}
					}
				} else {
					stmt.finalize();
				}
			} catch (dbError) {
				console.warn(`Error querying ${dbEntry.filename}:`, dbError);
				continue;
			}
		}

		// No tile found in any database - return null
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
		// Return null instead of throwing error
		return null;
	}
}

// Get databases by source name - simplified and more flexible
function getDatabasesBySource(source: string): DatabaseEntry[] {
	const matchingDbs: DatabaseEntry[] = [];
	const sourceLower = source.toLowerCase();

	// Check all open databases for matches
	for (const [filename, db] of openDatabases) {
		const filenameLower = filename.toLowerCase();

		// Simple matching: source name should be contained in filename
		// This covers cases like:
		// - poi.mbtiles -> poi
		// - building_xyz.mbtiles -> building
		// - basemap_osm.mbtiles -> basemap
		if (filenameLower.includes(sourceLower)) {
			// Get the database entry from our index
			for (const [key, entries] of dbIndex.entries()) {
				for (const entry of entries) {
					if (entry.filename === filename) {
						matchingDbs.push(entry);
						break;
					}
				}
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
