import { distance } from '@turf/distance';
import { point } from '@turf/helpers';
import { StoryRouter } from './routing/StoryRouter';

/**
 * Generate a connection path between story features using walking routes
 * Uses real roads/paths from transportation MBTILES when possible, falls back to straight lines
 * This replaces the old straight-line connection system
 */
export async function generateStoryConnectionPath(
	story: Story
): Promise<GeoJSON.FeatureCollection> {
	// Try to use walking routes via worker system
	try {
		const router = new StoryRouter();
		const result = await router.generateStoryRoutes(story);

		if (result.success) {
			console.log(`✅ Generated walking routes for story "${story.title}":`);
			console.log(`   📏 Total distance: ${(result.totalDistance / 1000).toFixed(2)} km`);
			console.log(`   ⏱️ Walking time: ${result.totalWalkingTime.toFixed(0)} minutes`);
			console.log(`   🛣️ Road types: ${result.routeInfo.roadTypesUsed.join(', ')}`);
			console.log(
				`   📏 Fallback segments: ${result.routeInfo.fallbackSegments}/${result.routeInfo.segmentCount}`
			);

			return result.geoJson;
		}
	} catch (error) {
		console.warn('⚠️ Walking route generation failed, falling back to straight lines:', error);
	}

	// Fallback to straight-line connections
	console.log('📏 Using straight-line connections for story:', story.title);
	return generateStraightLineConnectionPath(story);
}

/**
 * Generate straight-line connection path (legacy method, kept for compatibility)
 * This creates a LineString that connects all feature coordinates in an optimized order
 */
export function generateStraightLineConnectionPath(story: Story): GeoJSON.FeatureCollection {
	// Extract feature coordinates from story content
	const featureCoordinates: [number, number][] = [];
	const featureInfo: Array<{ id: string; displayText: string; coordinates: [number, number] }> = [];

	story.content.forEach((node) => {
		if (node.type === 'feature' && node.feature) {
			let coordinates: [number, number] | null = null;

			// Extract coordinates based on feature type
			if ('geometry' in node.feature) {
				// StoredFeature
				const storedFeature = node.feature as StoredFeature;
				if (storedFeature.geometry?.type === 'Point') {
					coordinates = storedFeature.geometry.coordinates as [number, number];
				}
			} else if ('lng' in node.feature && 'lat' in node.feature) {
				// SearchResult
				const searchResult = node.feature as SearchResult;
				coordinates = [searchResult.lng, searchResult.lat];
			}

			if (coordinates) {
				featureCoordinates.push(coordinates);
				featureInfo.push({
					id: node.featureId,
					displayText: node.customText || node.displayText,
					coordinates
				});
			}
		}
	});

	// Return empty collection if we have less than 2 features
	if (featureCoordinates.length < 2) {
		return {
			type: 'FeatureCollection',
			features: []
		};
	}

	// For 2 features, just connect them directly
	if (featureCoordinates.length === 2) {
		return {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					properties: {
						storyId: story.id,
						connectionType: 'direct'
					},
					geometry: {
						type: 'LineString',
						coordinates: featureCoordinates
					}
				}
			]
		};
	}

	// For multiple features, we have several connection strategies:
	// 1. Sequential: Connect features in story order
	// 2. Nearest neighbor: Connect to nearest unvisited feature
	// 3. Optimized tour: Use a simplified TSP solution

	let connectionPath: [number, number][];

	// Strategy selection based on number of features
	if (featureCoordinates.length <= 5) {
		// For small sets, use optimized tour (TSP-like approach)
		connectionPath = generateOptimizedTour(featureCoordinates);
	} else {
		// For larger sets, use nearest neighbor heuristic for performance
		connectionPath = generateNearestNeighborPath(featureCoordinates);
	}

	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				properties: {
					storyId: story.id,
					connectionType: 'optimized',
					featureCount: featureCoordinates.length
				},
				geometry: {
					type: 'LineString',
					coordinates: connectionPath
				}
			}
		]
	};
}

/**
 * Generate an optimized tour using a simplified TSP approach
 * Good for small numbers of features (≤ 5)
 */
function generateOptimizedTour(coordinates: [number, number][]): [number, number][] {
	if (coordinates.length <= 2) {
		return coordinates;
	}

	// For small sets, try a few different starting points and pick the shortest
	let bestPath: [number, number][] = [];
	let bestDistance = Infinity;

	// Try starting from each point
	for (let startIndex = 0; startIndex < Math.min(coordinates.length, 3); startIndex++) {
		const path = generateNearestNeighborPathFromStart(coordinates, startIndex);
		const distance = calculatePathDistance(path);

		if (distance < bestDistance) {
			bestDistance = distance;
			bestPath = path;
		}
	}

	return bestPath;
}

/**
 * Generate path using nearest neighbor heuristic starting from a specific index
 */
function generateNearestNeighborPathFromStart(
	coordinates: [number, number][],
	startIndex: number = 0
): [number, number][] {
	const path: [number, number][] = [];
	const unvisited = new Set(coordinates.map((_, i) => i));

	// Start from the specified index
	let currentIndex = startIndex;
	path.push(coordinates[currentIndex]);
	unvisited.delete(currentIndex);

	// Visit nearest unvisited point until all are visited
	while (unvisited.size > 0) {
		let nearestIndex = -1;
		let nearestDistance = Infinity;

		const currentPoint = coordinates[currentIndex];

		for (const index of unvisited) {
			const candidate = coordinates[index];
			const distance_km = distance(point(currentPoint), point(candidate), { units: 'kilometers' });

			if (distance_km < nearestDistance) {
				nearestDistance = distance_km;
				nearestIndex = index;
			}
		}

		if (nearestIndex !== -1) {
			currentIndex = nearestIndex;
			path.push(coordinates[currentIndex]);
			unvisited.delete(currentIndex);
		}
	}

	return path;
}

/**
 * Generate path using nearest neighbor heuristic
 * Good for larger numbers of features for performance
 */
function generateNearestNeighborPath(coordinates: [number, number][]): [number, number][] {
	return generateNearestNeighborPathFromStart(coordinates, 0);
}

/**
 * Calculate total distance of a path
 */
function calculatePathDistance(path: [number, number][]): number {
	let totalDistance = 0;

	for (let i = 1; i < path.length; i++) {
		totalDistance += distance(point(path[i - 1]), point(path[i]), { units: 'kilometers' });
	}

	return totalDistance;
}

/**
 * Generate a sequential connection path (connects features in story order)
 * This is an alternative strategy that preserves the narrative flow
 */
export function generateSequentialConnectionPath(story: Story): GeoJSON.FeatureCollection {
	const coordinates: [number, number][] = [];

	// Extract coordinates in story order
	story.content.forEach((node) => {
		if (node.type === 'feature' && node.feature) {
			let featureCoords: [number, number] | null = null;

			if ('geometry' in node.feature) {
				// StoredFeature
				const storedFeature = node.feature as StoredFeature;
				if (storedFeature.geometry?.type === 'Point') {
					featureCoords = storedFeature.geometry.coordinates as [number, number];
				}
			} else if ('lng' in node.feature && 'lat' in node.feature) {
				// SearchResult
				const searchResult = node.feature as SearchResult;
				featureCoords = [searchResult.lng, searchResult.lat];
			}

			if (featureCoords) {
				coordinates.push(featureCoords);
			}
		}
	});

	// Return empty if less than 2 features
	if (coordinates.length < 2) {
		return {
			type: 'FeatureCollection',
			features: []
		};
	}

	return {
		type: 'FeatureCollection',
		features: [
			{
				type: 'Feature',
				properties: {
					storyId: story.id,
					connectionType: 'sequential',
					featureCount: coordinates.length
				},
				geometry: {
					type: 'LineString',
					coordinates
				}
			}
		]
	};
}
