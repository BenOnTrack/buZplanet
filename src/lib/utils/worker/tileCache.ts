// Enhanced Tile Cache - Multi-level caching with prefetching (Organic Maps style)
// Level 1: Memory Cache (RAM) - Fastest (microseconds)
// Level 2: OPFS MBTiles - Fast (milliseconds)

interface CachedTile {
	data: ArrayBuffer;
	timestamp: number;
	accessCount: number;
	lastAccessed: number;
	source: string;
	z: number;
	x: number;
	y: number;
	size: number; // Bytes
}

interface TileCacheConfig {
	maxMemorySize: number; // Memory cache limit (bytes) - default 256MB
	prefetchRadius: number; // How many tiles around viewport to prefetch - default 1
	prefetchZoomLevels: number[]; // Which zoom levels to prefetch relative to current - default [-1, +1]
	prefetchDirection: boolean; // Enable direction-based prefetching - default true
	maxPrefetchQueue: number; // Max prefetch requests in queue - default 50
}

interface Viewport {
	z: number;
	centerX: number;
	centerY: number;
	tilesX: number;
	tilesY: number;
}

interface TileRequest {
	source: string;
	z: number;
	x: number;
	y: number;
	priority: number; // Higher = more important
	isPrefetch: boolean;
}

interface MovementVector {
	dx: number;
	dy: number;
	magnitude: number;
}

export class TileCache {
	private memoryCache = new Map<string, CachedTile>();
	private config: TileCacheConfig;
	private currentMemorySize = 0;
	private prefetchQueue: TileRequest[] = [];
	private isPrefetching = false;
	private lastViewport: Viewport | null = null;
	private movementHistory: MovementVector[] = [];
	private stats = {
		memoryHits: 0,
		opfsFetches: 0,
		prefetchedTiles: 0,
		evictions: 0
	};

	constructor(config: Partial<TileCacheConfig> = {}) {
		this.config = {
			maxMemorySize: config.maxMemorySize ?? 256 * 1024 * 1024, // 256MB default
			prefetchRadius: config.prefetchRadius ?? 1,
			prefetchZoomLevels: config.prefetchZoomLevels ?? [-1, 1],
			prefetchDirection: config.prefetchDirection ?? true,
			maxPrefetchQueue: config.maxPrefetchQueue ?? 50
		};
	}

	/**
	 * Get tile from memory cache (fastest path)
	 */
	getFromMemory(source: string, z: number, x: number, y: number): CachedTile | null {
		const startTime = performance.now();
		const key = this.getTileKey(source, z, x, y);
		const cached = this.memoryCache.get(key);

		if (cached) {
			const endTime = performance.now();
			const duration = endTime - startTime;

			// Update access statistics
			cached.lastAccessed = Date.now();
			cached.accessCount++;
			this.stats.memoryHits++;

			//console.log(`🚀 MEMORY HIT: ${key} (${duration.toFixed(3)}ms - RAM cache)`);
			return cached;
		}

		return null;
	}

	/**
	 * Increment OPFS fetch counter
	 */
	incrementOPFSFetch(): void {
		this.stats.opfsFetches++;
	}

	/**
	 * Store tile in memory cache with intelligent eviction
	 */
	async storeInMemory(
		source: string,
		z: number,
		x: number,
		y: number,
		data: ArrayBuffer,
		isPrefetch = false
	): Promise<void> {
		const key = this.getTileKey(source, z, x, y);
		const size = data.byteLength;

		// Don't cache if tile is too large (protect against memory bloat)
		if (size > this.config.maxMemorySize / 10) {
			console.warn(`🔴 Tile too large for cache: ${key} (${size} bytes)`);
			return;
		}

		// Create cached tile entry
		const cachedTile: CachedTile = {
			data: data.slice(), // Create a copy to avoid reference issues
			timestamp: Date.now(),
			accessCount: isPrefetch ? 0 : 1,
			lastAccessed: Date.now(),
			source,
			z,
			x,
			y,
			size
		};

		// Evict tiles if needed to make space
		await this.evictIfNeeded(size);

		// Store in memory
		this.memoryCache.set(key, cachedTile);
		this.currentMemorySize += size;

		if (isPrefetch) {
			this.stats.prefetchedTiles++;
			//console.log(`📦 PREFETCH STORED: ${key} (${this.formatBytes(size)})`);
		}
		// else {
		// 	console.log(`💾 STORED: ${key} (${this.formatBytes(size)})`);
		// }
	}

	/**
	 * Update viewport and trigger intelligent prefetching
	 */
	updateViewport(
		z: number,
		centerX: number,
		centerY: number,
		tilesX: number,
		tilesY: number
	): void {
		const viewport: Viewport = { z, centerX, centerY, tilesX, tilesY };

		// Calculate movement vector if we have a previous viewport
		if (this.lastViewport && this.config.prefetchDirection) {
			const dx = centerX - this.lastViewport.centerX;
			const dy = centerY - this.lastViewport.centerY;
			const magnitude = Math.sqrt(dx * dx + dy * dy);

			if (magnitude > 0.1) {
				// Significant movement detected
				const vector: MovementVector = { dx, dy, magnitude };
				this.updateMovementHistory(vector);
			}
		}

		this.lastViewport = viewport;

		// Schedule prefetching (don't await - run in background)
		this.schedulePrefetch(viewport);
	}

	/**
	 * Schedule prefetch operations based on viewport and movement
	 */
	private schedulePrefetch(viewport: Viewport): void {
		if (this.isPrefetching) return;

		// Clear old prefetch queue
		this.prefetchQueue = [];

		// 1. Prefetch surrounding tiles at current zoom
		this.addSurroundingTilesToQueue(viewport);

		// 2. Prefetch tiles at adjacent zoom levels
		this.addZoomLevelTilesToQueue(viewport);

		// 3. Prefetch tiles in movement direction
		if (this.config.prefetchDirection) {
			this.addDirectionalTilesToQueue(viewport);
		}

		// Sort queue by priority and start prefetching
		this.prefetchQueue.sort((a, b) => b.priority - a.priority);
		this.startPrefetching();
	}

	/**
	 * Add surrounding tiles to prefetch queue
	 */
	private addSurroundingTilesToQueue(viewport: Viewport): void {
		const { z, centerX, centerY, tilesX, tilesY } = viewport;
		const radius = this.config.prefetchRadius;

		// Calculate tile bounds for current viewport
		const minTileX = Math.floor(centerX - tilesX / 2) - radius;
		const maxTileX = Math.ceil(centerX + tilesX / 2) + radius;
		const minTileY = Math.floor(centerY - tilesY / 2) - radius;
		const maxTileY = Math.ceil(centerY + tilesY / 2) + radius;

		for (let x = minTileX; x <= maxTileX; x++) {
			for (let y = minTileY; y <= maxTileY; y++) {
				// Skip tiles already in viewport (already loaded)
				if (
					x >= Math.floor(centerX - tilesX / 2) &&
					x <= Math.ceil(centerX + tilesX / 2) &&
					y >= Math.floor(centerY - tilesY / 2) &&
					y <= Math.ceil(centerY + tilesY / 2)
				) {
					continue;
				}

				// Calculate distance-based priority (closer = higher priority)
				const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
				const priority = Math.max(1, 10 - distance);

				this.addTileToQueue('basemap', z, x, y, priority, true);
			}
		}
	}

	/**
	 * Add tiles at adjacent zoom levels to prefetch queue
	 */
	private addZoomLevelTilesToQueue(viewport: Viewport): void {
		const { z, centerX, centerY } = viewport;

		for (const deltaZ of this.config.prefetchZoomLevels) {
			const targetZ = z + deltaZ;
			if (targetZ < 0 || targetZ > 22) continue;

			// Calculate corresponding tile coordinates at different zoom level
			const scale = Math.pow(2, deltaZ);
			let targetX: number, targetY: number;

			if (deltaZ > 0) {
				// Higher zoom - more tiles needed
				targetX = Math.floor(centerX * scale);
				targetY = Math.floor(centerY * scale);
				// Add surrounding tiles at higher zoom
				for (let dx = 0; dx < scale; dx++) {
					for (let dy = 0; dy < scale; dy++) {
						this.addTileToQueue('basemap', targetZ, targetX + dx, targetY + dy, 5, true);
					}
				}
			} else {
				// Lower zoom - fewer tiles needed
				targetX = Math.floor(centerX / Math.abs(scale));
				targetY = Math.floor(centerY / Math.abs(scale));
				this.addTileToQueue('basemap', targetZ, targetX, targetY, 7, true);
			}
		}
	}

	/**
	 * Add tiles in predicted movement direction to prefetch queue
	 */
	private addDirectionalTilesToQueue(viewport: Viewport): void {
		if (this.movementHistory.length === 0) return;

		const { z, centerX, centerY } = viewport;
		const recentMovement = this.getAverageMovement();

		if (recentMovement.magnitude < 0.1) return;

		// Predict future position
		const predictionSteps = 3;
		for (let step = 1; step <= predictionSteps; step++) {
			const futureX = centerX + recentMovement.dx * step;
			const futureY = centerY + recentMovement.dy * step;

			const tileX = Math.floor(futureX);
			const tileY = Math.floor(futureY);

			// Add predicted tiles with high priority
			const priority = 15 - step; // Nearer predictions have higher priority
			this.addTileToQueue('basemap', z, tileX, tileY, priority, true);

			// Add surrounding tiles around prediction
			for (let dx = -1; dx <= 1; dx++) {
				for (let dy = -1; dy <= 1; dy++) {
					if (dx === 0 && dy === 0) continue;
					this.addTileToQueue('basemap', z, tileX + dx, tileY + dy, priority - 2, true);
				}
			}
		}
	}

	/**
	 * Add tile to prefetch queue if not already cached
	 */
	private addTileToQueue(
		source: string,
		z: number,
		x: number,
		y: number,
		priority: number,
		isPrefetch: boolean
	): void {
		// Skip if already in memory cache
		if (this.getFromMemory(source, z, x, y)) return;

		// Skip if queue is full
		if (this.prefetchQueue.length >= this.config.maxPrefetchQueue) return;

		// Check if already in queue
		const exists = this.prefetchQueue.some(
			(req) => req.source === source && req.z === z && req.x === x && req.y === y
		);
		if (exists) return;

		this.prefetchQueue.push({ source, z, x, y, priority, isPrefetch });
	}

	/**
	 * Start background prefetching
	 */
	private async startPrefetching(): Promise<void> {
		if (this.isPrefetching || this.prefetchQueue.length === 0) return;

		this.isPrefetching = true;
		console.log(`🎯 Starting prefetch: ${this.prefetchQueue.length} tiles queued`);

		try {
			// Process prefetch queue
			while (this.prefetchQueue.length > 0) {
				const request = this.prefetchQueue.shift()!;

				try {
					// This will be called by the enhanced tile worker
					await this.prefetchTile(request);
				} catch (error) {
					// Don't let prefetch errors stop the process
					console.debug(
						`Prefetch failed for ${request.source} ${request.z}/${request.x}/${request.y}:`,
						error
					);
				}

				// Small delay to prevent blocking main operations
				await this.sleep(1);
			}
		} finally {
			this.isPrefetching = false;
			//console.log(`✅ Prefetch completed: ${this.stats.prefetchedTiles} tiles cached`);
		}
	}

	/**
	 * Prefetch a single tile (implemented by the enhanced tile worker)
	 */
	async prefetchTile(request: TileRequest): Promise<void> {
		// Skip if already in memory cache
		if (this.getFromMemory(request.source, request.z, request.x, request.y)) {
			return;
		}

		// Load tile from OPFS and cache it
		const tileData = await this.loadTileFromOPFS(request.source, request.z, request.x, request.y);
		if (tileData) {
			await this.storeInMemory(request.source, request.z, request.x, request.y, tileData, true);
		}
	}

	/**
	 * Set the OPFS tile loader function (called by the enhanced tile worker)
	 */
	setOPFSLoader(
		loader: (source: string, z: number, x: number, y: number) => Promise<ArrayBuffer | null>
	): void {
		this.loadTileFromOPFS = loader;
	}

	/**
	 * OPFS tile loader function (will be set by the enhanced tile worker)
	 */
	private loadTileFromOPFS: (
		source: string,
		z: number,
		x: number,
		y: number
	) => Promise<ArrayBuffer | null> = async () => {
		throw new Error('OPFS loader not set. Call setOPFSLoader first.');
	};

	/**
	 * Intelligent cache eviction using LFU + LRU hybrid
	 */
	private async evictIfNeeded(newTileSize: number): Promise<void> {
		const spaceNeeded = this.currentMemorySize + newTileSize - this.config.maxMemorySize;
		if (spaceNeeded <= 0) return;

		console.log(`🧹 Evicting tiles to free ${this.formatBytes(spaceNeeded)} space`);

		// Convert cache to array for sorting
		const tiles = Array.from(this.memoryCache.entries()).map(([key, tile]) => ({
			key,
			tile,
			score: this.calculateEvictionScore(tile)
		}));

		// Sort by eviction score (lower score = evict first)
		tiles.sort((a, b) => a.score - b.score);

		let freedSpace = 0;
		const evicted: string[] = [];

		for (const { key, tile } of tiles) {
			this.memoryCache.delete(key);
			this.currentMemorySize -= tile.size;
			freedSpace += tile.size;
			evicted.push(key);
			this.stats.evictions++;

			if (freedSpace >= spaceNeeded) break;
		}

		console.log(`🗑️ Evicted ${evicted.length} tiles, freed ${this.formatBytes(freedSpace)} space`);
	}

	/**
	 * Calculate eviction score (lower = evict first)
	 * Combines recency and frequency
	 */
	private calculateEvictionScore(tile: CachedTile): number {
		const now = Date.now();
		const ageMinutes = (now - tile.lastAccessed) / (1000 * 60);
		const accessFrequency = tile.accessCount;

		// Score based on: recency (newer = higher) + frequency (more accessed = higher)
		return accessFrequency * 10 - ageMinutes;
	}

	/**
	 * Update movement history for directional prefetching
	 */
	private updateMovementHistory(vector: MovementVector): void {
		this.movementHistory.push(vector);

		// Keep only recent movements (last 5)
		if (this.movementHistory.length > 5) {
			this.movementHistory.shift();
		}
	}

	/**
	 * Get average recent movement for prediction
	 */
	private getAverageMovement(): MovementVector {
		if (this.movementHistory.length === 0) {
			return { dx: 0, dy: 0, magnitude: 0 };
		}

		const avgDx =
			this.movementHistory.reduce((sum, v) => sum + v.dx, 0) / this.movementHistory.length;
		const avgDy =
			this.movementHistory.reduce((sum, v) => sum + v.dy, 0) / this.movementHistory.length;
		const magnitude = Math.sqrt(avgDx * avgDx + avgDy * avgDy);

		return { dx: avgDx, dy: avgDy, magnitude };
	}

	/**
	 * Generate unique key for tile
	 */
	private getTileKey(source: string, z: number, x: number, y: number): string {
		return `${source}-${z}-${x}-${y}`;
	}

	/**
	 * Format bytes for logging
	 */
	private formatBytes(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	/**
	 * Utility sleep function
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Get cache statistics
	 */
	getStats(): any {
		return {
			...this.stats,
			memorySize: this.currentMemorySize,
			memorySizeFormatted: this.formatBytes(this.currentMemorySize),
			maxMemorySize: this.config.maxMemorySize,
			maxMemorySizeFormatted: this.formatBytes(this.config.maxMemorySize),
			tilesInMemory: this.memoryCache.size,
			memoryUtilization: (this.currentMemorySize / this.config.maxMemorySize) * 100,
			prefetchQueueSize: this.prefetchQueue.length,
			isPrefetching: this.isPrefetching
		};
	}

	/**
	 * Get detailed cache contents for debugging
	 */
	getCacheContents(): { key: string; tile: any }[] {
		return Array.from(this.memoryCache.entries()).map(([key, tile]) => ({
			key,
			tile: {
				...tile,
				data: `ArrayBuffer(${tile.data.byteLength} bytes)` // Don't serialize the actual data
			} as any
		}));
	}

	/**
	 * Get tiles by zoom level
	 */
	getTilesByZoom(zoom: number): { key: string; tile: CachedTile }[] {
		return this.getCacheContents().filter(({ tile }) => tile.z === zoom);
	}

	/**
	 * Get most recently accessed tiles
	 */
	getRecentTiles(limit: number = 10): { key: string; tile: CachedTile; accessedAgo: string }[] {
		const now = Date.now();
		return this.getCacheContents()
			.sort((a, b) => b.tile.lastAccessed - a.tile.lastAccessed)
			.slice(0, limit)
			.map(({ key, tile }) => ({
				key,
				tile,
				accessedAgo: this.timeAgo(now - tile.lastAccessed)
			}));
	}

	/**
	 * Get most frequently accessed tiles
	 */
	getPopularTiles(limit: number = 10): { key: string; tile: CachedTile }[] {
		return this.getCacheContents()
			.sort((a, b) => b.tile.accessCount - a.tile.accessCount)
			.slice(0, limit);
	}

	/**
	 * Format time difference
	 */
	private timeAgo(ms: number): string {
		if (ms < 1000) return `${ms}ms ago`;
		if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
		if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
		return `${Math.floor(ms / 3600000)}h ago`;
	}

	/**
	 * Clear all caches (for debugging)
	 */
	clear(): void {
		this.memoryCache.clear();
		this.currentMemorySize = 0;
		this.prefetchQueue = [];
		this.movementHistory = [];
		this.lastViewport = null;
		this.isPrefetching = false;
		console.log('🧹 All caches cleared');
	}
}
