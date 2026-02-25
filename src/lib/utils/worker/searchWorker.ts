// Dedicated Search Worker - handles ONLY search operations
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import type { OpfsDatabase, Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';

// Global state for search worker
let sqlite3: Sqlite3Static | null = null;
let opfsRoot: FileSystemDirectoryHandle | null = null;
const openDatabases = new Map<string, OpfsDatabase>();
const dbIndex = new Map<string, DatabaseEntry[]>(); // Add the indexing system
let currentSearchController: AbortController | null = null;

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
					data: 'Search worker initialized',
					id
				});
				break;

			case 'search-features':
				// Cancel any existing search
				if (currentSearchController) {
					currentSearchController.abort();
				}

				const searchResults = await searchFeatures(data.query, data.limit || 1000, {
					language: data.language || 'name',
					userLocation: data.userLocation,
					onProgress: (results, isComplete, currentDatabase) => {
						postMessage({
							type: 'search-progress',
							data: {
								results: [...results],
								isComplete,
								currentDatabase,
								total: results.length
							},
							id
						});
					}
				});

				postMessage({
					type: 'search-results',
					data: [...searchResults],
					id
				});
				break;

			case 'cancel-search':
				if (currentSearchController) {
					currentSearchController.abort();
					console.log('🚫 Search cancellation requested');
				}
				postMessage({
					type: 'search-cancelled',
					data: 'Search cancelled successfully',
					id
				});
				break;

			case 'ping':
				postMessage({
					type: 'pong',
					data: 'Search worker is alive!',
					id
				});
				break;

			case 'task':
				// Example task processing
				const taskResult = `Task completed by search worker: ${data}`;
				postMessage({
					type: 'task-completed',
					data: taskResult,
					id
				});
				break;

			case 'scan-databases':
				// Scan and index all .mbtiles files
				const scanResult = await scanAndIndexDatabases();
				postMessage({
					type: 'databases-scanned',
					data: scanResult,
					id
				});
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
				});
				break;

			case 'opfs-save-file':
				// Save file to OPFS (implement a basic version)
				try {
					const savedPath = await saveFileToOPFS(
						data.filename,
						data.fileData,
						data.directory || ''
					);
					postMessage({
						type: 'opfs-file-saved',
						data: { savedPath },
						id
					});
				} catch (error) {
					postMessage({
						type: 'error',
						data: error instanceof Error ? error.message : 'OPFS save failed',
						id,
						error: true
					});
				}
				break;

			case 'opfs-list-files':
				// List files in OPFS
				try {
					const fileList = await listOPFSFiles(data.directory || '');
					postMessage({
						type: 'opfs-files-listed',
						data: { files: fileList },
						id
					});
				} catch (error) {
					postMessage({
						type: 'error',
						data: error instanceof Error ? error.message : 'OPFS list failed',
						id,
						error: true
					});
				}
				break;

			case 'query-database':
				// Execute query on specific database
				try {
					const queryResult = await queryDatabase(data.filename, data.query, data.params);
					postMessage({
						type: 'query-result',
						data: queryResult,
						id
					});
				} catch (error) {
					postMessage({
						type: 'error',
						data: error instanceof Error ? error.message : 'Query failed',
						id,
						error: true
					});
				}
				break;

			case 'close-database':
				// Close specific database
				try {
					closeDatabase(data.filename);
					postMessage({
						type: 'database-closed',
						data: `Database ${data.filename} closed`,
						id
					});
				} catch (error) {
					postMessage({
						type: 'error',
						data: error instanceof Error ? error.message : 'Close database failed',
						id,
						error: true
					});
				}
				break;

			case 'get-databases':
				// Get list of available databases
				try {
					const databases = getDatabaseList();
					postMessage({
						type: 'database-list',
						data: databases,
						id
					});
				} catch (error) {
					postMessage({
						type: 'error',
						data: error instanceof Error ? error.message : 'Get databases failed',
						id,
						error: true
					});
				}
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
				console.warn(`Failed to open ${name} in search worker:`, error);
			}
		}
	}
}

// Optimized yielding for better performance
let yieldCounter = 0;
const OPTIMIZED_YIELD_FREQUENCY = 100; // Yield every 100 operations instead of 20
const PROGRESS_UPDATE_THROTTLE = 2000; // Update progress every 150ms instead of every 2 batches

async function optimizedYieldControl(): Promise<void> {
	yieldCounter++;
	if (yieldCounter >= OPTIMIZED_YIELD_FREQUENCY) {
		yieldCounter = 0;
		// Use requestIdleCallback-like behavior with timeout
		await new Promise((resolve) => {
			if (typeof MessageChannel !== 'undefined') {
				const { port1, port2 } = new MessageChannel();
				port1.onmessage = () => resolve(undefined);
				port2.postMessage(null);
			} else {
				setTimeout(resolve, 0);
			}
		});
	}
}

// Simple yielding for search operations (less frequent)
async function yieldControl(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
}

// Search features implementation (copied from your existing worker)
async function searchFeatures(
	query: string,
	limit: number = 1000,
	options: {
		language?: string;
		userLocation?: { lng: number; lat: number };
		onProgress?: (results: SearchResult[], isComplete: boolean, currentDatabase?: string) => void;
	} = {}
): Promise<SearchResult[]> {
	if (!query || query.trim().length < 2) {
		return [];
	}

	// Create an AbortController for this search
	const searchController = new AbortController();
	currentSearchController = searchController;

	const normalizedQuery = normalizeForName(query.trim());
	const results: SearchResult[] = [];
	const seenIds = new Set<string>();

	console.log(
		`🔍 Starting search for: "${query}" (normalized: "${normalizedQuery}"), limit: ${limit}`
	);

	if (options.userLocation) {
		console.log(`📍 User location: [${options.userLocation.lng}, ${options.userLocation.lat}]`);
	}

	try {
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

		const MAX_RESULTS = limit;
		const ZOOM_LEVEL = 14;

		// Filter relevant databases
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

		const preferredLanguage = options.language || 'name';
		console.log(`🌍 Using language preference: ${preferredLanguage}`);

		// Prioritize databases based on user location if available
		let prioritizedDbs: Array<[string, any, number]> = [];
		if (options.userLocation) {
			prioritizedDbs = prioritizeDatabasesByLocation(relevantDbs, options.userLocation);
			console.log(`📍 Prioritized ${prioritizedDbs.length} databases by location`);
		} else {
			prioritizedDbs = relevantDbs.map(([filename, db]) => [filename, db, 0]);
		}

		// Process databases
		for (const [filename, db, distance] of prioritizedDbs) {
			// Check if search was cancelled
			if (searchController.signal.aborted) {
				console.log(`🛑 Search cancelled by user`);
				throw new Error('Search cancelled');
			}

			if (results.length >= MAX_RESULTS) {
				console.log(`🛑 Reached maximum results limit (${MAX_RESULTS}), stopping search`);
				break;
			}

			try {
				const distanceInfo = distance > 0 ? ` (${Math.round(distance)}km away)` : '';
				console.log(`🗃️ Searching database: ${filename}${distanceInfo}`);

				await processDatabaseForSearch(
					db,
					filename,
					ZOOM_LEVEL,
					POI_SOURCE_LAYERS,
					normalizedQuery,
					results,
					seenIds,
					MAX_RESULTS,
					preferredLanguage,
					options.userLocation,
					options.onProgress,
					searchController.signal
				);

				const newResultsCount = results.filter((r) => r.database === filename).length;
				console.log(`✅ Completed ${filename}: ${newResultsCount} results`);
			} catch (error) {
				if (error instanceof Error && error.message === 'Search cancelled') {
					throw error;
				}
				console.error(`❌ Error searching ${filename}:`, error);
				continue;
			}
		}
	} catch (error) {
		if (error instanceof Error && error.message === 'Search cancelled') {
			console.log(`🚫 Search was cancelled`);
			return results.slice(0, limit);
		}
		throw error;
	} finally {
		if (currentSearchController === searchController) {
			currentSearchController = null;
		}
	}

	console.log(`🎉 Search completed: found ${results.length} total results`);
	return results.slice(0, limit);
}

// Helper functions (copied from your existing implementation)
function normalizeForName(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

function prioritizeDatabasesByLocation(
	databases: Array<[string, any]>,
	userLocation: { lng: number; lat: number }
): Array<[string, any, number]> {
	const prioritized: Array<[string, any, number]> = [];

	for (const [filename, db] of databases) {
		try {
			const metadataRows = db.selectArrays('SELECT name, value FROM metadata');
			let bounds: [number, number, number, number] | undefined;

			for (const [name, value] of metadataRows) {
				if (name === 'bounds' && typeof value === 'string') {
					bounds = value.split(',').map(Number) as [number, number, number, number];
					break;
				}
			}

			if (bounds) {
				const [west, south, east, north] = bounds;
				const centerLng = (west + east) / 2;
				const centerLat = (south + north) / 2;
				const distance = calculateDistance(
					userLocation.lat,
					userLocation.lng,
					centerLat,
					centerLng
				);

				const isWithinBounds =
					userLocation.lng >= west &&
					userLocation.lng <= east &&
					userLocation.lat >= south &&
					userLocation.lat <= north;

				const finalDistance = isWithinBounds ? 0 : distance;
				prioritized.push([filename, db, finalDistance]);
			} else {
				prioritized.push([filename, db, 9999]);
			}
		} catch (error) {
			console.warn(`Failed to get bounds for ${filename}:`, error);
			prioritized.push([filename, db, 9999]);
		}
	}

	prioritized.sort((a, b) => a[2] - b[2]);
	return prioritized;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371;
	const dLat = (lat2 - lat1) * (Math.PI / 180);
	const dLng = (lng2 - lng1) * (Math.PI / 180);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1 * (Math.PI / 180)) *
			Math.cos(lat2 * (Math.PI / 180)) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

async function processDatabaseForSearch(
	db: OpfsDatabase,
	filename: string,
	zoomLevel: number,
	wantedLayers: string[],
	normalizedQuery: string,
	results: SearchResult[],
	seenIds: Set<string>,
	maxResults: number,
	preferredLanguage: string,
	userLocation?: { lng: number; lat: number },
	onProgress?: (results: SearchResult[], isComplete: boolean, currentDatabase?: string) => void,
	abortSignal?: AbortSignal
): Promise<void> {
	let offset = 0;
	let hasMore = true;
	const batchSize = 100; // Larger batch size to reduce overhead
	let lastProgressUpdate = Date.now();
	let processedBatches = 0;

	console.log(`[DB ${filename}] Starting search processing...`);

	while (hasMore && results.length < maxResults) {
		if (abortSignal?.aborted) {
			throw new Error('Search cancelled');
		}

		const stmt = db.prepare(`
			SELECT tile_data, tile_column, tile_row
			FROM tiles
			WHERE zoom_level = ?
			LIMIT ? OFFSET ?
		`);

		try {
			stmt.bind([zoomLevel, batchSize, offset]);

			const batchTiles: Array<{
				tileData: Uint8Array;
				x: number;
				tmsY: number;
			}> = [];

			let batchCount = 0;
			while (stmt.step() && results.length < maxResults) {
				if (abortSignal?.aborted) {
					throw new Error('Search cancelled');
				}

				batchCount++;
				batchTiles.push({
					tileData: stmt.get(0) as Uint8Array,
					x: stmt.get(1) as number,
					tmsY: stmt.get(2) as number
				});

				// Less frequent yielding
				if (batchCount % 50 === 0) {
					await optimizedYieldControl();
				}
			}

			hasMore = batchCount === batchSize;
			offset += batchCount;

			// Process batch
			for (const tileInfo of batchTiles) {
				if (abortSignal?.aborted) {
					throw new Error('Search cancelled');
				}
				if (results.length >= maxResults) break;

				await processSingleTile(
					tileInfo.tileData,
					tileInfo.x,
					tileInfo.tmsY,
					zoomLevel,
					filename,
					wantedLayers,
					normalizedQuery,
					results,
					seenIds,
					maxResults,
					preferredLanguage
				);
			}

			// Throttled progress updates based on time instead of batch count
			processedBatches++;
			const now = Date.now();
			if (onProgress && now - lastProgressUpdate >= PROGRESS_UPDATE_THROTTLE) {
				lastProgressUpdate = now;
				onProgress([...results], false, filename);
				// Yield after progress update to let main thread process it
				await optimizedYieldControl();
			}
		} finally {
			stmt.finalize();
		}
	}

	console.log(
		`[DB ${filename}] Completed: found ${results.filter((r) => r.database === filename).length} results`
	);
}

async function processSingleTile(
	tileData: Uint8Array,
	x: number,
	tmsY: number,
	zoomLevel: number,
	filename: string,
	wantedLayers: string[],
	normalizedQuery: string,
	results: SearchResult[],
	seenIds: Set<string>,
	maxResults: number,
	preferredLanguage: string
): Promise<void> {
	if (results.length >= maxResults) return;

	try {
		// Decompress tile data
		const buffer = await gunzip(tileData);
		const tile = new VectorTile(new Protobuf(buffer));

		// Process each wanted layer
		for (const sourceLayer of wantedLayers) {
			if (results.length >= maxResults) break;

			const layer = tile.layers[sourceLayer];
			if (!layer) continue;

			// Process features with less frequent yielding
			for (let i = 0; i < layer.length; i++) {
				if (results.length >= maxResults) break;

				// Only yield every 100 features instead of 50
				if (i % 100 === 0) {
					await optimizedYieldControl();
				}

				const vectorTileFeature = layer.feature(i);
				const props = vectorTileFeature.properties as Record<string, any>;

				// Extract name properties
				const names: { [key: string]: string } = {};
				let hasAnyName = false;

				for (const [key, value] of Object.entries(props)) {
					if (key === 'name' || key.startsWith('name:')) {
						if (value && typeof value === 'string') {
							names[key] = value;
							hasAnyName = true;
						}
					}
				}

				if (!hasAnyName) continue;

				// Check for matches
				let isMatch = false;
				const searchOrder = createLanguageAwareSearchOrder(preferredLanguage, Object.keys(names));

				for (const nameKey of searchOrder) {
					const nameValue = names[nameKey];
					if (nameValue && fastMatchesQuery(nameValue, normalizedQuery)) {
						isMatch = true;
						break;
					}
				}

				if (!isMatch) continue;

				// Convert to GeoJSON to get coordinates
				const n = 1 << zoomLevel;
				const y = n - 1 - tmsY;
				const geojsonFeature = vectorTileFeature.toGeoJSON(x, y, zoomLevel);

				let lng: number, lat: number;
				if (geojsonFeature.geometry.type === 'Point') {
					[lng, lat] = geojsonFeature.geometry.coordinates;
				} else if (
					geojsonFeature.geometry.type === 'LineString' ||
					geojsonFeature.geometry.type === 'Polygon'
				) {
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

					const featureClass = sourceLayer.startsWith('poi_')
						? sourceLayer.replace('poi_', '')
						: 'poi';

					results.push({
						id: fid,
						names: names,
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
	} catch (tileError) {
		// Skip problematic tiles
	}
}

// Helper functions
function createLanguageAwareSearchOrder(
	preferredLanguage: string,
	availableKeys: string[]
): string[] {
	if (preferredLanguage === 'name') {
		return [
			'name',
			'name:en',
			...availableKeys.filter((k) => k !== 'name' && k !== 'name:en').sort()
		];
	}

	const preferredKey = `name:${preferredLanguage}`;
	return [
		preferredKey,
		'name',
		'name:en',
		...availableKeys.filter((k) => k !== preferredKey && k !== 'name' && k !== 'name:en').sort()
	].filter((key) => availableKeys.includes(key));
}

function fastMatchesQuery(target: string, normalizedQuery: string): boolean {
	if (!target || !normalizedQuery) return false;

	const targetLower = target.toLowerCase();
	const queryLower = normalizedQuery.toLowerCase();

	function splitIntoWords(text: string): string[] {
		return text.split(/[\s\-_.,]+/).filter((word) => word.length > 0);
	}

	const queryWords = splitIntoWords(queryLower);
	const targetWords = splitIntoWords(targetLower);

	if (queryWords.length === 1) {
		const singleQuery = queryWords[0];

		if (targetWords.some((targetWord) => targetWord.startsWith(singleQuery))) {
			return true;
		}

		for (let i = 0; i < targetWords.length; i++) {
			let concatenated = '';
			for (let j = i; j < targetWords.length; j++) {
				concatenated += targetWords[j];
				if (concatenated.startsWith(singleQuery)) {
					return true;
				}
			}
		}

		const normalizedTarget = normalizeForName(target);
		const normalizedTargetWords = splitIntoWords(normalizedTarget);
		const normalizedSingleQuery = normalizeForName(singleQuery);

		if (normalizedTargetWords.some((word) => word.startsWith(normalizedSingleQuery))) {
			return true;
		}

		return false;
	}

	return queryWords.every((queryWord) => {
		if (targetWords.some((targetWord) => targetWord.startsWith(queryWord))) {
			return true;
		}

		if (targetLower.includes(queryWord)) {
			return true;
		}

		const normalizedTarget = normalizeForName(target);
		const normalizedQueryWord = normalizeForName(queryWord);

		if (normalizedTarget.includes(normalizedQueryWord)) {
			return true;
		}

		return false;
	});
}

function tileToLngLat(x: number, y: number, zoom: number): { lng: number; lat: number } {
	const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
	return {
		lng: (x / Math.pow(2, zoom)) * 360 - 180,
		lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
	};
}

// Check if data is gzipped
function isGzipped(data: Uint8Array): boolean {
	return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
}

// Gunzip decompression
async function gunzip(data: Uint8Array): Promise<ArrayBuffer> {
	if (!isGzipped(data)) {
		const typedArray = data as Uint8Array;
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

	// Process each database with yielding
	for (const filename of mbtilesList) {
		try {
			await processDatabaseFile(filename);
			// Yield after each database to keep system responsive
			await yieldControl();
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

	// Notify about corrupted files if any
	if (corruptedFiles.length > 0) {
		postMessage({
			type: 'corrupted-databases-detected',
			data: {
				corruptedFiles,
				message: 'Some database files were corrupted and removed. Please re-download these files.'
			}
		});
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
	} catch (error) {
		console.error(`Failed to remove corrupted file ${filename}:`, error);
	}
}

// Get list of available databases
function getDatabaseList(): Array<{ filename: string; metadata: any }> {
	const databases: Array<{ filename: string; metadata: any }> = [];

	for (const [filename, db] of openDatabases) {
		try {
			const metadataRows = db.selectArrays('SELECT name, value FROM metadata');
			const metadata: any = {};

			for (const [name, value] of metadataRows) {
				if (value === null || value === undefined) continue;

				switch (name) {
					case 'bounds':
						if (typeof value === 'string') {
							metadata.bounds = value.split(',').map(Number);
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

// Basic OPFS file operations
async function saveFileToOPFS(
	filename: string,
	data: ArrayBuffer,
	directory: string = ''
): Promise<string> {
	if (!opfsRoot) {
		throw new Error('OPFS not initialized');
	}

	try {
		const dirHandle = directory
			? await opfsRoot.getDirectoryHandle(directory, { create: true })
			: opfsRoot;

		// Generate unique filename if file already exists
		let finalFilename = filename;
		let counter = 1;

		while (await fileExists(dirHandle, finalFilename)) {
			const nameWithoutExt = filename.replace(/\.[^/.]+$/, '');
			const ext = filename.match(/\.[^/.]+$/)?.[0] || '';
			finalFilename = `${nameWithoutExt}_${counter}${ext}`;
			counter++;
		}

		const fileHandle = await dirHandle.getFileHandle(finalFilename, { create: true });

		if ('createWritable' in fileHandle) {
			const writable = await (fileHandle as any).createWritable();
			await writable.write(data);
			await writable.close();
		} else if ('createSyncAccessHandle' in fileHandle) {
			const accessHandle = await (fileHandle as any).createSyncAccessHandle();
			try {
				accessHandle.truncate(0);
				accessHandle.write(new Uint8Array(data), { at: 0 });
				accessHandle.flush();
			} finally {
				accessHandle.close();
			}
		} else {
			throw new Error('OPFS write operations not supported in this browser version');
		}

		return directory ? `${directory}/${finalFilename}` : finalFilename;
	} catch (error) {
		throw new Error(`Failed to save file: ${error}`);
	}
}

async function listOPFSFiles(directory: string = ''): Promise<string[]> {
	if (!opfsRoot) {
		throw new Error('OPFS not initialized');
	}

	try {
		const dirHandle = directory ? await opfsRoot.getDirectoryHandle(directory) : opfsRoot;
		const files: string[] = [];

		for await (const [name, handle] of (dirHandle as any).entries()) {
			if (handle.kind === 'file') {
				files.push(name);
			}
		}

		return files;
	} catch (error) {
		return [];
	}
}

async function fileExists(
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

// Send ready message
postMessage({
	type: 'ready',
	data: 'Search worker is ready'
});
