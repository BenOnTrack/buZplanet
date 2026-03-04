/**
 * Walking route configuration based on OpenStreetMap highway types
 * Defines which road types are suitable for walking and their preferences
 */

export interface RoadTypeConfig {
	category: string;
	walkable: boolean;
	priority: number; // Lower = better for walking (1-10)
	maxSpeed?: number; // For future use if needed
}

/**
 * Walking preferences for different OSM highway categories
 * Based on your MBTILES structure and OSM definitions
 * Priorities are now more balanced to prevent extreme detours
 */
export const WALKING_ROAD_TYPES: Record<string, RoadTypeConfig> = {
	// Dedicated walking infrastructure (highest priority)
	footway: { category: 'footway', walkable: true, priority: 1 },
	pedestrian: { category: 'pedestrian', walkable: true, priority: 1 },
	steps: { category: 'steps', walkable: true, priority: 1 },

	// Walking paths and trails (high priority)
	path: { category: 'path', walkable: true, priority: 1.5 },
	track: { category: 'track', walkable: true, priority: 1.5 },
	bridleway: { category: 'bridleway', walkable: true, priority: 1.5 },

	// Cycling paths (good for walking)
	cycleway: { category: 'cycleway', walkable: true, priority: 2 },

	// Residential and minor roads (very acceptable for walking)
	minor: { category: 'minor', walkable: true, priority: 2.5 }, // This covers residential, living_street, unclassified, road
	living_street: { category: 'minor', walkable: true, priority: 2.5 },
	residential: { category: 'minor', walkable: true, priority: 2.5 },
	unclassified: { category: 'minor', walkable: true, priority: 3.5 },
	road: { category: 'minor', walkable: true, priority: 3.5 },
	service: { category: 'service', walkable: true, priority: 3 },

	// Tertiary roads (acceptable for walking)
	tertiary: { category: 'tertiary', walkable: true, priority: 4.5 },
	tertiary_link: { category: 'link', walkable: true, priority: 4.5 },

	// Secondary roads (walkable but not preferred)
	secondary: { category: 'secondary', walkable: true, priority: 6 },
	secondary_link: { category: 'link', walkable: true, priority: 6 },

	// Primary roads (avoid if possible but still walkable)
	primary: { category: 'primary', walkable: true, priority: 8 },
	primary_link: { category: 'link', walkable: true, priority: 8 },

	// Highway infrastructure (not suitable for walking)
	motorway: { category: 'motorway', walkable: false, priority: 10 },
	motorway_link: { category: 'link', walkable: false, priority: 10 },
	trunk: { category: 'trunk', walkable: false, priority: 10 },
	trunk_link: { category: 'link', walkable: false, priority: 10 },

	// Other categories
	byway: { category: 'byway', walkable: true, priority: 2 },
	construction: { category: 'construction', walkable: false, priority: 10 }
};

/**
 * Get walking suitability for a road category
 */
export function isWalkable(category: string): boolean {
	const config = WALKING_ROAD_TYPES[category];
	return config ? config.walkable : false;
}

/**
 * Get walking priority for a road category (lower = better)
 */
export function getWalkingPriority(category: string): number {
	const config = WALKING_ROAD_TYPES[category];
	return config ? config.priority : 10; // Default to worst priority
}

/**
 * Calculate walking cost for a road segment
 * Prioritizes shortest path above all else - road type is just a tiebreaker
 */
export function calculateWalkingCost(distance: number, category: string, properties?: any): number {
	// Cost is primarily distance with tiny road-type tiebreaker
	// This ensures shortest path wins unless distances are nearly identical
	const priority = getWalkingPriority(category);

	// Distance dominates: road type adds maximum 2% variation
	const tiebreaker = 1 + (priority - 1) * 0.002; // Range: 1.000 to 1.016

	return distance * tiebreaker;
}

/**
 * Check if a road segment should be included in walking routes
 */
export function shouldIncludeInWalkingNetwork(properties: any): boolean {
	const category = properties.category;

	if (!category) {
		return false;
	}

	// Check if the road type is walkable
	if (!isWalkable(category)) {
		return false;
	}

	// Additional filters could be added here:
	// - Access restrictions (private roads)
	// - Surface conditions
	// - Temporary closures

	return true;
}
