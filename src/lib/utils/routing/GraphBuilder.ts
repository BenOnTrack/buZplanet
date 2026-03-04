import {
	shouldIncludeInWalkingNetwork,
	calculateWalkingCost
} from '$lib/utils/routing/WalkingRouteConfig';
import { GridSpatialIndex } from '$lib/utils/routing/RouteGraph';
import { lineString } from '@turf/helpers';
import { length } from '@turf/length';
import { getWorker } from '$lib/utils/worker/dualWorkerManager';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';

/**
 * GraphBuilder - Constructs a walking route graph from transportation MBTILES data
 * Uses the worker system to query transportation_highway source layer from OPFS MBTILES
 */
export class GraphBuilder {
	private graph: RouteGraph;
	private isBuilding = false;
	private lastBuildBounds: [number, number, number, number] | null = null;
	constructor() {
		this.graph = {
			nodes: new Map(),
			spatialIndex: new GridSpatialIndex()
		};
	}

	/**
	 * Build the walking route graph for a given bounding box
	 * Uses worker system to query transportation.mbtiles from OPFS
	 */
	async buildGraph(bounds: [number, number, number, number]): Promise<RouteGraph> {
		// Check if we already built a graph for these bounds
		if (this.lastBuildBounds && this.boundsEqual(bounds, this.lastBuildBounds)) {
			console.log('🗺️ Reusing existing graph for bounds:', bounds);
			return this.graph;
		}

		if (this.isBuilding) {
			console.log('⏳ Graph building in progress, waiting...');
			// Wait for current build to complete
			while (this.isBuilding) {
				await new Promise((resolve) => setTimeout(resolve, 100));
			}
			return this.graph;
		}

		this.isBuilding = true;
		console.log('🏗️ Building walking route graph for bounds:', bounds);

		try {
			// Clear existing graph
			this.graph = {
				nodes: new Map(),
				spatialIndex: new GridSpatialIndex()
			};

			// Query transportation highways from OPFS MBTILES via worker
			const roadFeatures = await this.queryTransportationHighways(bounds);
			console.log(`📊 Found ${roadFeatures.length} road features in bounds`);

			// Filter for walking-suitable roads
			const allRoadTypes = new Map<string, number>();
			const filteredOutTypes = new Map<string, number>();

			const walkableRoads = roadFeatures.filter((feature) => {
				const category = feature.properties?.category || 'unknown';
				allRoadTypes.set(category, (allRoadTypes.get(category) || 0) + 1);

				const isWalkable = shouldIncludeInWalkingNetwork(feature.properties);
				if (!isWalkable) {
					filteredOutTypes.set(category, (filteredOutTypes.get(category) || 0) + 1);
				}
				return isWalkable;
			});

			console.log(`🚶 Filtered to ${walkableRoads.length} walkable road segments`);
			console.log('📊 All road types found:', Object.fromEntries(allRoadTypes));
			console.log('❌ Filtered OUT road types:', Object.fromEntries(filteredOutTypes));

			// Analyze road type distribution
			const roadTypeStats = new Map<string, number>();
			for (const road of walkableRoads) {
				const category = road.properties?.category || 'unknown';
				roadTypeStats.set(category, (roadTypeStats.get(category) || 0) + 1);
			}
			console.log('📊 Walkable road types found:', Object.fromEntries(roadTypeStats));

			// Log a sample of walkable roads
			if (walkableRoads.length > 0) {
				const sample = walkableRoads.slice(0, 5); // Increased sample size
				console.log(
					'🔍 Sample walkable roads:',
					sample.map((r) => ({
						id: r.id,
						category: r.properties?.category,
						class: r.properties?.class,
						subclass: r.properties?.subclass,
						coordinates: r.geometry.coordinates.length,
						start: r.geometry.coordinates[0],
						end: r.geometry.coordinates[r.geometry.coordinates.length - 1]
					}))
				);
			}

			// Build graph from walkable roads
			this.buildGraphFromRoads(walkableRoads);

			this.lastBuildBounds = [...bounds] as [number, number, number, number];
			console.log(`✅ Graph built successfully: ${this.graph.nodes.size} nodes`);

			return this.graph;
		} catch (error) {
			console.error('❌ Failed to build route graph:', error);
			throw error;
		} finally {
			this.isBuilding = false;
		}
	}

	/**
	 * Query transportation highway features from OPFS transportation MBTILES via worker
	 */
	private async queryTransportationHighways(
		bounds: [number, number, number, number]
	): Promise<any[]> {
		try {
			const worker = getWorker();
			await worker.waitForReady();

			const features: any[] = [];
			const ZOOM_LEVEL = 14; // Transportation highway features are available at zoom 14

			console.log(`🔍 Querying transportation tiles at zoom ${ZOOM_LEVEL} for bounds:`, bounds);

			// Calculate tile range for the bounds at zoom level 14
			const tileRange = this.boundsToTileRange(bounds, ZOOM_LEVEL);
			console.log(
				`📐 Tile range: x(${tileRange.minX}-${tileRange.maxX}) y(${tileRange.minY}-${tileRange.maxY}) - Total: ${(tileRange.maxX - tileRange.minX + 1) * (tileRange.maxY - tileRange.minY + 1)} tiles`
			);

			// Query each tile in the range
			let tilesQueried = 0;
			let tilesFound = 0;
			for (let x = tileRange.minX; x <= tileRange.maxX; x++) {
				for (let y = tileRange.minY; y <= tileRange.maxY; y++) {
					tilesQueried++;
					try {
						// Request tile from worker (transportation.mbtiles)
						const tileData = await worker.requestTile('transportation', ZOOM_LEVEL, x, y);

						if (tileData) {
							tilesFound++;
							console.log(
								`✅ Found transportation tile at ${ZOOM_LEVEL}/${x}/${y} (${tileData.byteLength} bytes)`
							);
							// Parse vector tile and extract transportation_highway features
							const tileFeatures = await this.extractTransportationFeatures(
								tileData,
								x,
								y,
								ZOOM_LEVEL,
								bounds
							);
							features.push(...tileFeatures);
						} else {
							console.debug(`❌ No transportation tile at ${ZOOM_LEVEL}/${x}/${y}`);
						}
					} catch (tileError) {
						// Skip missing tiles - this is normal for sparse data
						console.debug(`❌ Error fetching tile ${ZOOM_LEVEL}/${x}/${y}:`, tileError);
					}
				}
			}

			console.log(`📊 Tile query summary: Found ${tilesFound}/${tilesQueried} tiles with data`);
			console.log(`🛣️ Extracted ${features.length} total transportation features`);
			return features;
		} catch (error) {
			console.error('❌ Error querying transportation highways from worker:', error);
			return [];
		}
	}

	/**
	 * Extract transportation_highway features from a vector tile
	 */
	private async extractTransportationFeatures(
		tileData: ArrayBuffer,
		x: number,
		y: number,
		zoom: number,
		bounds: [number, number, number, number]
	): Promise<any[]> {
		try {
			// Parse the vector tile
			const tile = new VectorTile(new Protobuf(tileData));
			const features: any[] = [];

			// Get the transportation_highway layer
			const layer = tile.layers['transportation_highway'];
			if (!layer) {
				console.debug(`No transportation_highway layer in tile ${zoom}/${x}/${y}`);
				return [];
			}

			console.log(
				`🚧 Processing ${layer.length} features from transportation_highway layer in tile ${zoom}/${x}/${y}`
			);

			// Process each feature in the layer
			let featuresProcessed = 0;
			let featuresIncluded = 0;
			for (let i = 0; i < layer.length; i++) {
				featuresProcessed++;
				const vectorFeature = layer.feature(i);
				const properties = vectorFeature.properties as Record<string, any>;

				// Convert to GeoJSON to get real-world coordinates
				const geoJSONFeature = vectorFeature.toGeoJSON(x, y, zoom);

				// Only include LineString features (roads/paths)
				if (geoJSONFeature.geometry.type === 'LineString') {
					// Check if feature intersects with our bounds
					if (this.featureIntersectsBounds(geoJSONFeature, bounds)) {
						featuresIncluded++;
						// Log first few features for debugging
						if (featuresIncluded <= 3) {
							console.log(`🎅 Feature ${featuresIncluded} in tile ${zoom}/${x}/${y}:`, {
								id: properties.id,
								class: properties.class,
								subclass: properties.subclass,
								category: properties.category,
								coordinateCount: geoJSONFeature.geometry.coordinates.length,
								startCoord: geoJSONFeature.geometry.coordinates[0],
								endCoord:
									geoJSONFeature.geometry.coordinates[
										geoJSONFeature.geometry.coordinates.length - 1
									]
							});
						}

						// Add feature with normalized properties
						features.push({
							id: properties.id || `${x}_${y}_${i}`,
							geometry: geoJSONFeature.geometry,
							properties: {
								class: properties.class || 'transportation',
								subclass: properties.subclass,
								category: properties.category,
								...properties
							}
						});
					}
				}
			}

			console.log(
				`📊 Tile ${zoom}/${x}/${y} summary: ${featuresIncluded}/${featuresProcessed} features included`
			);
			return features;
		} catch (error) {
			console.error(`❌ Error parsing transportation tile ${zoom}/${x}/${y}:`, error);
			return [];
		}
	}

	/**
	 * Convert bounds to tile range at given zoom level
	 */
	private boundsToTileRange(
		bounds: [number, number, number, number],
		zoom: number
	): {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number;
	} {
		const [minLng, minLat, maxLng, maxLat] = bounds;

		// Convert to tile coordinates
		const minTile = this.lngLatToTile(minLng, maxLat, zoom); // Note: maxLat for minY
		const maxTile = this.lngLatToTile(maxLng, minLat, zoom); // Note: minLat for maxY

		return {
			minX: Math.max(0, minTile.x),
			maxX: Math.min((1 << zoom) - 1, maxTile.x),
			minY: Math.max(0, minTile.y),
			maxY: Math.min((1 << zoom) - 1, maxTile.y)
		};
	}

	/**
	 * Convert lng/lat to tile coordinates
	 */
	private lngLatToTile(lng: number, lat: number, zoom: number): { x: number; y: number } {
		const x = Math.floor(((lng + 180) / 360) * Math.pow(2, zoom));
		const y = Math.floor(
			((1 -
				Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) /
				2) *
				Math.pow(2, zoom)
		);
		return { x, y };
	}

	/**
	 * Build the route graph from walkable road features
	 * Improved version that properly connects intersecting roads
	 */
	private buildGraphFromRoads(roadFeatures: any[]): void {
		console.log(`🔗 Building road network graph from ${roadFeatures.length} features...`);

		// First pass: Create all nodes and collect intersection points
		const intersectionNodes = new Map<string, string>(); // coord key -> node ID
		const roadSegments: Array<{
			id: string;
			coordinates: [number, number][];
			category: string;
			properties: any;
		}> = [];

		for (const feature of roadFeatures) {
			if (feature.geometry.type !== 'LineString') {
				continue;
			}

			const coordinates = feature.geometry.coordinates;
			const roadCategory = feature.properties.category || 'unknown';
			const roadId = String(feature.id);

			roadSegments.push({
				id: roadId,
				coordinates,
				category: roadCategory,
				properties: feature.properties
			});

			// Create nodes for all coordinate points (not just start/end)
			// This helps with intersections and gives more routing options
			for (let i = 0; i < coordinates.length; i++) {
				const coord = coordinates[i];
				const nodeId = this.getOrCreateNode(coord);

				// Track intersection points (start/end of roads are likely intersections)
				if (i === 0 || i === coordinates.length - 1) {
					const coordKey = this.getCoordinateKey(coord);
					if (!intersectionNodes.has(coordKey)) {
						intersectionNodes.set(coordKey, nodeId);
					}
				}
			}
		}

		console.log(
			`🎯 Created ${this.graph.nodes.size} nodes, ${intersectionNodes.size} potential intersections`
		);

		// Second pass: Create edges between consecutive points in each road
		let edgesCreated = 0;
		for (const segment of roadSegments) {
			for (let i = 0; i < segment.coordinates.length - 1; i++) {
				const startCoord = segment.coordinates[i];
				const endCoord = segment.coordinates[i + 1];

				const startNodeId = this.getNodeIdForCoordinate(startCoord);
				const endNodeId = this.getNodeIdForCoordinate(endCoord);

				if (startNodeId && endNodeId && startNodeId !== endNodeId) {
					// Calculate distance and cost for this segment
					const segmentCoords = [startCoord, endCoord];
					const distance = this.calculateSegmentLength(segmentCoords);
					const cost = calculateWalkingCost(distance, segment.category, segment.properties);

					// Create bidirectional edges
					this.addEdge(
						startNodeId,
						endNodeId,
						distance,
						cost,
						segment.category,
						segment.id,
						segmentCoords
					);
					this.addEdge(endNodeId, startNodeId, distance, cost, segment.category, segment.id, [
						endCoord,
						startCoord
					]);
					edgesCreated += 2;
				}
			}
		}

		console.log(`🔗 Created ${edgesCreated} bidirectional edges`);

		// Third pass: Verify connectivity
		let connectedNodes = 0;
		let isolatedNodes = 0;
		for (const [nodeId, node] of this.graph.nodes) {
			if (node.connections.size > 0) {
				connectedNodes++;
			} else {
				isolatedNodes++;
			}
		}

		console.log(
			`📊 Network analysis: ${connectedNodes} connected nodes, ${isolatedNodes} isolated nodes`
		);

		// Sample some nodes to verify they have connections
		if (connectedNodes > 0) {
			const sampleNodes = Array.from(this.graph.nodes.entries())
				.filter(([_, node]) => node.connections.size > 0)
				.slice(0, 3);

			console.log(
				`🔍 Sample connected nodes:`,
				sampleNodes.map(([id, node]) => ({
					id,
					coordinates: node.coordinates,
					connections: node.connections.size,
					connectedTo: Array.from(node.connections.keys()).slice(0, 3)
				}))
			);
		}
	}

	/**
	 * Get coordinate key for deduplication
	 */
	private getCoordinateKey(coord: [number, number]): string {
		const precision = 6;
		return `${coord[0].toFixed(precision)},${coord[1].toFixed(precision)}`;
	}

	/**
	 * Get existing node ID for a coordinate
	 */
	private getNodeIdForCoordinate(coord: [number, number]): string | null {
		const nodeId = this.getCoordinateKey(coord);
		return this.graph.nodes.has(nodeId) ? nodeId : null;
	}

	/**
	 * Calculate length of a coordinate segment
	 */
	private calculateSegmentLength(coordinates: [number, number][]): number {
		if (coordinates.length < 2) return 0;

		try {
			const line = lineString(coordinates);
			return length(line, { units: 'meters' });
		} catch (error) {
			// Fallback to Euclidean distance
			const [lng1, lat1] = coordinates[0];
			const [lng2, lat2] = coordinates[1];
			const dx = (lng2 - lng1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
			const dy = (lat2 - lat1) * 111000;
			return Math.sqrt(dx * dx + dy * dy);
		}
	}

	/**
	 * Get or create a node for given coordinates
	 */
	private getOrCreateNode(coordinates: [number, number]): string {
		// Use coordinate-based ID with precision to avoid floating point issues
		const precision = 6; // ~0.1m precision
		const nodeId = `${coordinates[0].toFixed(precision)},${coordinates[1].toFixed(precision)}`;

		if (!this.graph.nodes.has(nodeId)) {
			const node: RouteNode = {
				id: nodeId,
				coordinates: [coordinates[0], coordinates[1]],
				connections: new Map()
			};

			this.graph.nodes.set(nodeId, node);
			this.graph.spatialIndex.insert(nodeId, coordinates);
		}

		return nodeId;
	}

	/**
	 * Add an edge between two nodes
	 */
	private addEdge(
		fromNodeId: string,
		toNodeId: string,
		distance: number,
		cost: number,
		roadCategory: string,
		roadId: string,
		geometry: [number, number][]
	): void {
		const fromNode = this.graph.nodes.get(fromNodeId);
		if (!fromNode) return;

		const edge: RouteEdge = {
			targetNodeId: toNodeId,
			distance,
			cost,
			roadCategory,
			roadId,
			geometry
		};

		fromNode.connections.set(toNodeId, edge);
	}

	/**
	 * Calculate the length of a LineString in meters
	 */
	private calculateLineStringLength(coordinates: [number, number][]): number {
		try {
			const line = lineString(coordinates);
			return length(line, { units: 'meters' });
		} catch (error) {
			// Fallback: simple Euclidean distance
			console.warn('Failed to calculate precise length, using approximation:', error);

			let totalLength = 0;
			for (let i = 1; i < coordinates.length; i++) {
				const [lng1, lat1] = coordinates[i - 1];
				const [lng2, lat2] = coordinates[i];

				// Approximate distance in meters
				const dx = (lng2 - lng1) * 111000 * Math.cos((lat1 * Math.PI) / 180);
				const dy = (lat2 - lat1) * 111000;
				totalLength += Math.sqrt(dx * dx + dy * dy);
			}

			return totalLength;
		}
	}

	/**
	 * Check if a feature intersects with the given bounds
	 */
	private featureIntersectsBounds(feature: any, bounds: [number, number, number, number]): boolean {
		const [minLng, minLat, maxLng, maxLat] = bounds;

		if (feature.geometry.type === 'LineString') {
			// Check if any coordinate is within bounds
			return feature.geometry.coordinates.some(([lng, lat]: [number, number]) => {
				return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
			});
		}

		return false;
	}

	/**
	 * Check if two bounds arrays are equal
	 */
	private boundsEqual(
		bounds1: [number, number, number, number],
		bounds2: [number, number, number, number]
	): boolean {
		return bounds1.every((val, index) => Math.abs(val - bounds2[index]) < 0.001);
	}

	/**
	 * Get the built graph
	 */
	getGraph(): RouteGraph {
		return this.graph;
	}

	/**
	 * Find the nearest walkable node to given coordinates with improved snapping
	 * Uses larger search radius to account for POIs being slightly off-road (like in OSM/Organic Maps)
	 */
	findNearestNode(coordinates: [number, number], maxDistance: number = 1000): string | null {
		// Try different search radii, starting small and expanding
		const searchRadii = [100, 250, 500, 750, 1000]; // meters

		for (const radius of searchRadii) {
			const result = this.graph.spatialIndex.findNearest(coordinates, radius);
			if (result) {
				const node = this.graph.nodes.get(result);
				const distance = this.calculateDistance(coordinates, node?.coordinates || [0, 0]);
				console.log(`🎯 Found nearest node at ${radius}m radius:`, {
					nodeId: result,
					actualDistance: `${Math.round(distance)}m`,
					nodeCoords: node?.coordinates,
					targetCoords: coordinates,
					connections: node?.connections.size || 0
				});
				return result;
			}
		}

		console.warn(
			`⚠️ No walkable nodes found within ${maxDistance}m of [${coordinates.join(', ')}]`
		);
		return null;
	}

	/**
	 * Calculate distance between two coordinates in meters
	 */
	private calculateDistance(coord1: [number, number], coord2: [number, number]): number {
		const R = 6371000; // Earth's radius in meters
		const φ1 = (coord1[1] * Math.PI) / 180;
		const φ2 = (coord2[1] * Math.PI) / 180;
		const Δφ = ((coord2[1] - coord1[1]) * Math.PI) / 180;
		const Δλ = ((coord2[0] - coord1[0]) * Math.PI) / 180;

		const a =
			Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
			Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
		const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

		return R * c;
	}

	/**
	 * Clear the graph (useful for memory management)
	 */
	clear(): void {
		this.graph = {
			nodes: new Map(),
			spatialIndex: new GridSpatialIndex()
		};
		this.lastBuildBounds = null;
	}
}
