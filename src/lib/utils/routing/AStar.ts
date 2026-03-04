/**
 * A* pathfinding algorithm for finding the shortest walking route between two points
 * Uses the route graph built from transportation MBTILES data
 * Note: Interfaces are globally declared in app.d.ts
 */

interface AStarNode {
	id: string;
	gScore: number; // Actual cost from start
	fScore: number; // Estimated total cost (gScore + heuristic)
	parent: string | null;
}

export class AStar {
	private graph: RouteGraph;
	private readonly WALKING_SPEED_MS = 1.4; // Average walking speed: 1.4 m/s (~5 km/h)

	constructor(graph: RouteGraph) {
		this.graph = graph;
	}

	/**
	 * Find the best walking route between two coordinates
	 */
	async findRoute(
		startCoordinates: [number, number],
		endCoordinates: [number, number],
		maxSearchDistance: number = 1000 // Increased from 500m to 1000m for better off-road POI snapping
	): Promise<RouteResult> {
		console.log(
			`🔍 Finding route from [${startCoordinates.join(', ')}] to [${endCoordinates.join(', ')}]`
		);

		try {
			// Find nearest nodes to start and end points
			const startNodeId = this.graph.spatialIndex.findNearest(startCoordinates, maxSearchDistance);
			const endNodeId = this.graph.spatialIndex.findNearest(endCoordinates, maxSearchDistance);

			console.log(`🎯 Nearest node search results:`, {
				start: { coordinates: startCoordinates, nodeId: startNodeId },
				end: { coordinates: endCoordinates, nodeId: endNodeId },
				totalGraphNodes: this.graph.nodes.size
			});

			if (!startNodeId || !endNodeId) {
				console.warn('⚠️ No nearby walkable roads found, falling back to straight line');
				return this.createStraightLineRoute(startCoordinates, endCoordinates);
			}

			// Log node connection details
			const startNode = this.graph.nodes.get(startNodeId);
			const endNode = this.graph.nodes.get(endNodeId);
			console.log(`🔗 Node connections:`, {
				start: { nodeId: startNodeId, connections: startNode?.connections.size || 0 },
				end: { nodeId: endNodeId, connections: endNode?.connections.size || 0 }
			});

			// Run A* algorithm
			const astarResult = await this.runAStar(startNodeId, endNodeId);

			if (!astarResult.success) {
				console.warn('⚠️ A* pathfinding failed, falling back to straight line');
				return this.createStraightLineRoute(startCoordinates, endCoordinates);
			}

			// Build the complete route including connections to start/end points
			return this.buildCompleteRoute(
				startCoordinates,
				endCoordinates,
				astarResult.path,
				astarResult.distance,
				astarResult.roadTypes
			);
		} catch (error) {
			console.error('❌ Error in route finding:', error);
			return this.createStraightLineRoute(startCoordinates, endCoordinates);
		}
	}

	/**
	 * Run the A* algorithm between two nodes
	 */
	private async runAStar(
		startNodeId: string,
		endNodeId: string
	): Promise<{
		success: boolean;
		path: string[];
		distance: number;
		roadTypes: string[];
	}> {
		const openSet = new Set<string>([startNodeId]);
		const closedSet = new Set<string>();
		const nodes = new Map<string, AStarNode>();

		// Initialize start node
		nodes.set(startNodeId, {
			id: startNodeId,
			gScore: 0,
			fScore: this.heuristicDistance(startNodeId, endNodeId),
			parent: null
		});

		let iterations = 0;
		const maxIterations = 10000; // Prevent infinite loops

		console.log(`🗺️ Starting A* search from ${startNodeId} to ${endNodeId}`);

		while (openSet.size > 0 && iterations < maxIterations) {
			iterations++;

			// Log progress every 1000 iterations
			if (iterations % 1000 === 0) {
				console.log(
					`🔄 A* iteration ${iterations}: openSet size = ${openSet.size}, closedSet size = ${closedSet.size}`
				);
			}

			// Find node with lowest fScore
			let currentNodeId: string | null = null;
			let lowestFScore = Infinity;

			for (const nodeId of openSet) {
				const node = nodes.get(nodeId);
				if (node && node.fScore < lowestFScore) {
					lowestFScore = node.fScore;
					currentNodeId = nodeId;
				}
			}

			if (!currentNodeId) break;

			// Remove current from open set and add to closed set
			openSet.delete(currentNodeId);
			closedSet.add(currentNodeId);

			// Check if we reached the goal
			if (currentNodeId === endNodeId) {
				const pathResult = this.reconstructPath(nodes, endNodeId);
				console.log(`✅ A* search completed successfully in ${iterations} iterations:`, {
					totalDistance: `${pathResult.distance.toFixed(0)}m`,
					roadTypes: pathResult.roadTypes,
					pathLength: pathResult.path.length
				});
				return pathResult;
			}

			// Examine neighbors
			const currentGraphNode = this.graph.nodes.get(currentNodeId);
			if (!currentGraphNode) continue;

			const currentAStarNode = nodes.get(currentNodeId)!;

			for (const [neighborId, edge] of currentGraphNode.connections) {
				if (closedSet.has(neighborId)) continue;

				const tentativeGScore = currentAStarNode.gScore + edge.cost;

				let neighborAStarNode = nodes.get(neighborId);
				if (!neighborAStarNode) {
					neighborAStarNode = {
						id: neighborId,
						gScore: Infinity,
						fScore: Infinity,
						parent: null
					};
					nodes.set(neighborId, neighborAStarNode);
				}

				if (tentativeGScore < neighborAStarNode.gScore) {
					// This path is better
					neighborAStarNode.parent = currentNodeId;
					neighborAStarNode.gScore = tentativeGScore;
					neighborAStarNode.fScore =
						tentativeGScore + this.heuristicDistance(neighborId, endNodeId);

					openSet.add(neighborId);
				}
			}

			// Yield control occasionally to prevent blocking
			if (iterations % 1000 === 0) {
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}

		console.warn(`⚠️ A* search exhausted after ${iterations} iterations`);
		return { success: false, path: [], distance: 0, roadTypes: [] };
	}

	/**
	 * Reconstruct the path from A* node data
	 */
	private reconstructPath(
		nodes: Map<string, AStarNode>,
		endNodeId: string
	): {
		success: boolean;
		path: string[];
		distance: number;
		roadTypes: string[];
	} {
		const path: string[] = [];
		const roadTypes: string[] = [];
		let totalDistance = 0;
		let currentNodeId: string | null = endNodeId;

		// Build path backwards from end to start
		while (currentNodeId) {
			path.unshift(currentNodeId);

			const currentNode = nodes.get(currentNodeId);
			if (!currentNode || !currentNode.parent) break;

			// Get edge information for distance and road type
			const parentGraphNode = this.graph.nodes.get(currentNode.parent);
			if (parentGraphNode) {
				const edge = parentGraphNode.connections.get(currentNodeId);
				if (edge) {
					totalDistance += edge.distance;
					if (!roadTypes.includes(edge.roadCategory)) {
						roadTypes.push(edge.roadCategory);
					}
				}
			}

			currentNodeId = currentNode.parent;
		}

		return {
			success: true,
			path,
			distance: totalDistance,
			roadTypes
		};
	}

	/**
	 * Build the complete route including start/end connections
	 */
	private buildCompleteRoute(
		startCoordinates: [number, number],
		endCoordinates: [number, number],
		nodePath: string[],
		graphDistance: number,
		roadTypes: string[]
	): RouteResult {
		const routeCoordinates: [number, number][] = [];

		// Add start point
		routeCoordinates.push(startCoordinates);

		// Add connection to first node if different from start
		const firstNode = this.graph.nodes.get(nodePath[0]);
		if (firstNode && !this.coordinatesEqual(startCoordinates, firstNode.coordinates)) {
			routeCoordinates.push(firstNode.coordinates);
		}

		// Add detailed path between nodes
		for (let i = 0; i < nodePath.length - 1; i++) {
			const currentNodeId = nodePath[i];
			const nextNodeId = nodePath[i + 1];

			const currentNode = this.graph.nodes.get(currentNodeId);
			if (currentNode) {
				const edge = currentNode.connections.get(nextNodeId);
				if (edge && edge.geometry) {
					// Add intermediate points from the road geometry
					routeCoordinates.push(...edge.geometry.slice(1)); // Skip first point to avoid duplication
				} else {
					// Fallback to direct connection
					const nextNode = this.graph.nodes.get(nextNodeId);
					if (nextNode) {
						routeCoordinates.push(nextNode.coordinates);
					}
				}
			}
		}

		// Add connection to end point if different from last node
		const lastNode = this.graph.nodes.get(nodePath[nodePath.length - 1]);
		if (lastNode && !this.coordinatesEqual(endCoordinates, lastNode.coordinates)) {
			routeCoordinates.push(endCoordinates);
		}

		// Add end point
		if (!this.coordinatesEqual(routeCoordinates[routeCoordinates.length - 1], endCoordinates)) {
			routeCoordinates.push(endCoordinates);
		}

		// Calculate total distance including start/end connections
		const startConnectionDistance = firstNode
			? this.calculateStraightLineDistance(startCoordinates, firstNode.coordinates)
			: 0;
		const endConnectionDistance = lastNode
			? this.calculateStraightLineDistance(lastNode.coordinates, endCoordinates)
			: 0;

		const totalDistance = startConnectionDistance + graphDistance + endConnectionDistance;

		return {
			success: true,
			path: routeCoordinates,
			distance: totalDistance,
			estimatedWalkingTime: totalDistance / this.WALKING_SPEED_MS / 60, // Convert to minutes
			roadTypes,
			fallbackToStraightLine: false
		};
	}

	/**
	 * Create a straight-line route as fallback
	 */
	private createStraightLineRoute(
		startCoordinates: [number, number],
		endCoordinates: [number, number]
	): RouteResult {
		const distance = this.calculateStraightLineDistance(startCoordinates, endCoordinates);

		return {
			success: true,
			path: [startCoordinates, endCoordinates],
			distance,
			estimatedWalkingTime: distance / this.WALKING_SPEED_MS / 60,
			roadTypes: ['straight_line'],
			fallbackToStraightLine: true
		};
	}

	/**
	 * Heuristic function for A* (straight-line distance)
	 */
	private heuristicDistance(nodeId1: string, nodeId2: string): number {
		const node1 = this.graph.nodes.get(nodeId1);
		const node2 = this.graph.nodes.get(nodeId2);

		if (!node1 || !node2) return Infinity;

		return this.calculateStraightLineDistance(node1.coordinates, node2.coordinates);
	}

	/**
	 * Calculate straight-line distance between two coordinates (in meters)
	 */
	private calculateStraightLineDistance(
		coord1: [number, number],
		coord2: [number, number]
	): number {
		// Using Haversine formula for more accurate distance
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
	 * Check if two coordinates are approximately equal
	 */
	private coordinatesEqual(
		coord1: [number, number],
		coord2: [number, number],
		precision: number = 6
	): boolean {
		return (
			Math.abs(coord1[0] - coord2[0]) < Math.pow(10, -precision) &&
			Math.abs(coord1[1] - coord2[1]) < Math.pow(10, -precision)
		);
	}
}
