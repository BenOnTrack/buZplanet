import { AStar } from './AStar';

/**
 * RouteOptimizer - Finds optimal order to visit multiple POIs using walking routes
 * Similar to solving the Traveling Salesman Problem (TSP) but optimized for walking
 * Note: Interfaces are globally declared in app.d.ts
 */

interface OptimizationResult {
	success: boolean;
	totalDistance: number;
	totalWalkingTime: number;
	routes: RouteResult[];
	visitOrder: number[]; // Indices of original POI array in optimal order
	fallbackUsed: boolean;
}

export class RouteOptimizer {
	private router: AStar;

	constructor(graph: RouteGraph) {
		this.router = new AStar(graph);
	}

	/**
	 * Find optimal walking route through multiple POIs
	 * Uses nearest neighbor heuristic for performance with larger sets
	 * For small sets (≤5), tries multiple starting points for better optimization
	 */
	async optimizeRoute(pois: [number, number][]): Promise<OptimizationResult> {
		console.log(`🎯 Optimizing route through ${pois.length} POIs`);

		if (pois.length < 2) {
			return {
				success: false,
				totalDistance: 0,
				totalWalkingTime: 0,
				routes: [],
				visitOrder: [],
				fallbackUsed: false
			};
		}

		if (pois.length === 2) {
			// Simple case: direct route between two points
			return this.createDirectRoute(pois);
		}

		// For small sets, try optimization from different starting points
		if (pois.length <= 5) {
			return this.optimizeSmallSet(pois);
		}

		// For larger sets, use nearest neighbor heuristic
		return this.optimizeLargeSet(pois);
	}

	/**
	 * Create direct route between two POIs
	 */
	private async createDirectRoute(pois: [number, number][]): Promise<OptimizationResult> {
		const route = await this.router.findRoute(pois[0], pois[1]);

		return {
			success: route.success,
			totalDistance: route.distance,
			totalWalkingTime: route.estimatedWalkingTime,
			routes: [route],
			visitOrder: [0, 1],
			fallbackUsed: route.fallbackToStraightLine || false
		};
	}

	/**
	 * Optimize small set of POIs by trying different starting points
	 */
	private async optimizeSmallSet(pois: [number, number][]): Promise<OptimizationResult> {
		let bestResult: OptimizationResult | null = null;

		// Try starting from first 3 POIs (or all if fewer than 3)
		const startingPoints = Math.min(3, pois.length);

		for (let startIndex = 0; startIndex < startingPoints; startIndex++) {
			console.log(`🔄 Trying optimization starting from POI ${startIndex}`);

			const result = await this.nearestNeighborFromStart(pois, startIndex);

			if (result.success && (!bestResult || result.totalDistance < bestResult.totalDistance)) {
				bestResult = result;
			}
		}

		return bestResult || this.createFallbackResult(pois);
	}

	/**
	 * Optimize larger set using nearest neighbor heuristic (single start point)
	 */
	private async optimizeLargeSet(pois: [number, number][]): Promise<OptimizationResult> {
		console.log(`🏃‍♂️ Using nearest neighbor for ${pois.length} POIs`);
		return this.nearestNeighborFromStart(pois, 0);
	}

	/**
	 * Nearest neighbor heuristic starting from specific POI index
	 */
	private async nearestNeighborFromStart(
		pois: [number, number][],
		startIndex: number
	): Promise<OptimizationResult> {
		const visited = new Set<number>([startIndex]);
		const visitOrder: number[] = [startIndex];
		const routes: RouteResult[] = [];
		let totalDistance = 0;
		let totalWalkingTime = 0;
		let fallbackUsed = false;

		let currentIndex = startIndex;

		while (visited.size < pois.length) {
			let nearestIndex = -1;
			let nearestDistance = Infinity;
			let bestRoute: RouteResult | null = null;

			// Find nearest unvisited POI
			for (let i = 0; i < pois.length; i++) {
				if (visited.has(i)) continue;

				// Calculate route to this POI
				const route = await this.router.findRoute(pois[currentIndex], pois[i]);

				if (route.success && route.distance < nearestDistance) {
					nearestDistance = route.distance;
					nearestIndex = i;
					bestRoute = route;
				}
			}

			if (nearestIndex === -1 || !bestRoute) {
				console.warn('⚠️ Could not find route to any remaining POI');
				break;
			}

			// Add this leg to the route
			visited.add(nearestIndex);
			visitOrder.push(nearestIndex);
			routes.push(bestRoute);
			totalDistance += bestRoute.distance;
			totalWalkingTime += bestRoute.estimatedWalkingTime;

			if (bestRoute.fallbackToStraightLine) {
				fallbackUsed = true;
			}

			currentIndex = nearestIndex;
		}

		return {
			success: routes.length > 0,
			totalDistance,
			totalWalkingTime,
			routes,
			visitOrder,
			fallbackUsed
		};
	}

	/**
	 * Create fallback result using straight lines between all POIs
	 */
	private createFallbackResult(pois: [number, number][]): OptimizationResult {
		console.log('⚠️ Creating fallback straight-line routes');

		const visitOrder: number[] = [];
		const routes: RouteResult[] = [];
		let totalDistance = 0;

		// Simple sequential order
		for (let i = 0; i < pois.length; i++) {
			visitOrder.push(i);

			if (i > 0) {
				// Create straight-line route from previous POI
				const distance = this.calculateStraightLineDistance(pois[i - 1], pois[i]);
				const walkingTime = distance / 1.4 / 60; // 1.4 m/s walking speed

				routes.push({
					success: true,
					path: [pois[i - 1], pois[i]],
					distance,
					estimatedWalkingTime: walkingTime,
					roadTypes: ['straight_line'],
					fallbackToStraightLine: true
				});

				totalDistance += distance;
			}
		}

		return {
			success: true,
			totalDistance,
			totalWalkingTime: totalDistance / 1.4 / 60,
			routes,
			visitOrder,
			fallbackUsed: true
		};
	}

	/**
	 * Calculate straight-line distance between coordinates (Haversine formula)
	 */
	private calculateStraightLineDistance(
		coord1: [number, number],
		coord2: [number, number]
	): number {
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
	 * Get the router instance for individual route queries
	 */
	getRouter(): AStar {
		return this.router;
	}
}
