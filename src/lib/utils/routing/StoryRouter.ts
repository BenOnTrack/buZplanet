import { GraphBuilder } from './GraphBuilder';
import { RouteOptimizer } from './RouteOptimizer';

/**
 * StoryRouter - Main integration class for generating walking routes for stories
 * Replaces the existing straight-line story connections with real road-based routes
 * Note: Interfaces are globally declared in app.d.ts
 */

export class StoryRouter {
	private graphBuilder: GraphBuilder;

	constructor() {
		this.graphBuilder = new GraphBuilder();
	}

	/**
	 * Generate walking routes for a story's POIs
	 * This replaces the existing generateStoryConnectionPath function
	 */
	async generateStoryRoutes(story: Story): Promise<StoryRouteResult> {
		console.log(`🗺️ Generating walking routes for story: ${story.title}`);

		try {
			// Extract POI coordinates from story
			const pois = this.extractPOICoordinates(story);

			if (pois.length < 2) {
				console.log('ℹ️ Story has fewer than 2 POIs, no routes to generate');
				return this.createEmptyResult();
			}

			console.log(`📍 Found ${pois.length} POIs to connect`);

			// Calculate bounds for all POIs with some padding
			const bounds = this.calculateBoundsWithPadding(pois, 1000); // 1km padding

			// Build or get the route graph for this area
			console.log('🏗️ Building/retrieving route graph...');
			const graph = await this.graphBuilder.buildGraph(bounds);

			if (graph.nodes.size === 0) {
				console.warn('⚠️ No walkable roads found in area, using straight-line fallback');
				return this.createStraightLineRoutes(story, pois);
			}

			// Optimize the route through all POIs
			console.log('🎯 Optimizing route through POIs...');
			const optimizer = new RouteOptimizer(graph);
			const optimization = await optimizer.optimizeRoute(pois);

			if (!optimization.success) {
				console.warn('⚠️ Route optimization failed, using straight-line fallback');
				return this.createStraightLineRoutes(story, pois);
			}

			// Convert to GeoJSON format compatible with existing system
			const geoJson = this.convertToGeoJSON(story, optimization);

			return {
				success: true,
				geoJson,
				totalDistance: optimization.totalDistance,
				totalWalkingTime: optimization.totalWalkingTime,
				routeInfo: {
					segmentCount: optimization.routes.length,
					roadTypesUsed: this.extractUniqueRoadTypes(optimization.routes),
					fallbackSegments: optimization.routes.filter((r) => r.fallbackToStraightLine).length,
					visitOrder: optimization.visitOrder
				}
			};
		} catch (error) {
			console.error('❌ Error generating story routes:', error);

			// Fallback to straight-line routes
			const pois = this.extractPOICoordinates(story);
			return this.createStraightLineRoutes(story, pois);
		}
	}

	/**
	 * Extract POI coordinates from story content
	 */
	private extractPOICoordinates(story: Story): [number, number][] {
		const coordinates: [number, number][] = [];

		story.content.forEach((node) => {
			if (node.type === 'feature' && node.feature) {
				let coords: [number, number] | null = null;

				// Handle StoredFeature
				if ('geometry' in node.feature) {
					const storedFeature = node.feature as StoredFeature;
					if (storedFeature.geometry?.type === 'Point') {
						coords = storedFeature.geometry.coordinates as [number, number];
					}
				}
				// Handle SearchResult
				else if ('lng' in node.feature && 'lat' in node.feature) {
					const searchResult = node.feature as SearchResult;
					coords = [searchResult.lng, searchResult.lat];
				}

				if (coords) {
					coordinates.push(coords);
				}
			}
		});

		return coordinates;
	}

	/**
	 * Calculate bounding box for POIs with padding
	 */
	private calculateBoundsWithPadding(
		pois: [number, number][],
		paddingMeters: number
	): [number, number, number, number] {
		if (pois.length === 0) {
			return [0, 0, 0, 0];
		}

		let minLng = Infinity,
			minLat = Infinity;
		let maxLng = -Infinity,
			maxLat = -Infinity;

		// Find bounds
		for (const [lng, lat] of pois) {
			if (lng < minLng) minLng = lng;
			if (lng > maxLng) maxLng = lng;
			if (lat < minLat) minLat = lat;
			if (lat > maxLat) maxLat = lat;
		}

		// Add padding (rough conversion: 1 degree ≈ 111km)
		const paddingDeg = paddingMeters / 111000;

		return [minLng - paddingDeg, minLat - paddingDeg, maxLng + paddingDeg, maxLat + paddingDeg];
	}

	/**
	 * Convert optimization result to GeoJSON format
	 */
	private convertToGeoJSON(story: Story, optimization: any): GeoJSON.FeatureCollection {
		const features: GeoJSON.Feature[] = [];

		// Create individual route segments
		for (let i = 0; i < optimization.routes.length; i++) {
			const route = optimization.routes[i];
			const fromIndex = optimization.visitOrder[i];
			const toIndex = optimization.visitOrder[i + 1];

			features.push({
				type: 'Feature',
				properties: {
					storyId: story.id,
					connectionType: 'walking_route',
					segmentIndex: i,
					fromPOI: fromIndex,
					toPOI: toIndex,
					distance: route.distance,
					walkingTime: route.estimatedWalkingTime,
					roadTypes: route.roadTypes,
					fallback: route.fallbackToStraightLine || false
				},
				geometry: {
					type: 'LineString',
					coordinates: route.path
				}
			});
		}

		// Also create a single combined route for overall visualization
		if (optimization.routes.length > 0) {
			const allCoordinates: [number, number][] = [];

			// Combine all route paths
			for (const route of optimization.routes) {
				if (allCoordinates.length === 0) {
					allCoordinates.push(...route.path);
				} else {
					// Skip first coordinate to avoid duplication
					allCoordinates.push(...route.path.slice(1));
				}
			}

			features.push({
				type: 'Feature',
				properties: {
					storyId: story.id,
					connectionType: 'walking_route_combined',
					totalDistance: optimization.totalDistance,
					totalWalkingTime: optimization.totalWalkingTime,
					segmentCount: optimization.routes.length,
					fallbackSegments: optimization.routes.filter((r: any) => r.fallbackToStraightLine).length
				},
				geometry: {
					type: 'LineString',
					coordinates: allCoordinates
				}
			});
		}

		return {
			type: 'FeatureCollection',
			features
		};
	}

	/**
	 * Extract unique road types from routes
	 */
	private extractUniqueRoadTypes(routes: RouteResult[]): string[] {
		const roadTypes = new Set<string>();

		for (const route of routes) {
			for (const roadType of route.roadTypes) {
				roadTypes.add(roadType);
			}
		}

		return Array.from(roadTypes);
	}

	/**
	 * Create fallback straight-line routes (compatible with existing system)
	 */
	private createStraightLineRoutes(story: Story, pois: [number, number][]): StoryRouteResult {
		console.log('📏 Creating straight-line fallback routes');

		if (pois.length < 2) {
			return this.createEmptyResult();
		}

		// Use existing logic for straight-line connections
		const features: GeoJSON.Feature[] = [];
		let totalDistance = 0;

		// Create sequential connections
		for (let i = 0; i < pois.length - 1; i++) {
			const distance = this.calculateDistance(pois[i], pois[i + 1]);
			totalDistance += distance;

			features.push({
				type: 'Feature',
				properties: {
					storyId: story.id,
					connectionType: 'straight_line_fallback',
					segmentIndex: i,
					distance,
					fallback: true
				},
				geometry: {
					type: 'LineString',
					coordinates: [pois[i], pois[i + 1]]
				}
			});
		}

		return {
			success: true,
			geoJson: {
				type: 'FeatureCollection',
				features
			},
			totalDistance,
			totalWalkingTime: totalDistance / 1.4 / 60, // Assume 1.4 m/s walking speed
			routeInfo: {
				segmentCount: features.length,
				roadTypesUsed: ['straight_line'],
				fallbackSegments: features.length,
				visitOrder: Array.from({ length: pois.length }, (_, i) => i)
			}
		};
	}

	/**
	 * Create empty result for stories with insufficient POIs
	 */
	private createEmptyResult(): StoryRouteResult {
		return {
			success: false,
			geoJson: {
				type: 'FeatureCollection',
				features: []
			},
			totalDistance: 0,
			totalWalkingTime: 0,
			routeInfo: {
				segmentCount: 0,
				roadTypesUsed: [],
				fallbackSegments: 0,
				visitOrder: []
			}
		};
	}

	/**
	 * Calculate straight-line distance between two coordinates (meters)
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
	 * Clear the graph builder cache (useful for memory management)
	 */
	clearCache(): void {
		this.graphBuilder.clear();
	}
}
