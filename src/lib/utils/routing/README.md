# Walking Route System

This directory contains a complete walking route system that generates realistic routes between story POIs using road/path data from your transportation MBTILES files.

## Overview

The system replaces straight-line connections with actual walking routes that follow roads, paths, and walkways suitable for pedestrians. It uses your `transportation.mbtiles` data with the `transportation_highway` source layer to build a routing network.

## Key Features

- **Walking-focused routing** - Prioritizes footways, paths, and pedestrian-friendly roads
- **Intelligent fallback** - Uses straight lines when no walking path exists (e.g., crossing bodies of water)
- **Route optimization** - Finds optimal order to visit multiple POIs (traveling salesman problem)
- **Performance-oriented** - Pre-computed routes with caching for repeated use
- **Visual distinction** - Different styling for real walking routes vs. fallback straight lines

## Components

### Core Classes

1. **`StoryRouter`** - Main integration class
   - `generateStoryRoutes(story: Story)` - Primary method to generate walking routes
   - Integrates with existing story connection system
   - Handles fallbacks gracefully

2. **`GraphBuilder`** - Builds road network from MBTILES
   - Queries `transportation_highway` source layer
   - Filters for walking-suitable roads
   - Builds spatial index for fast nearest-neighbor queries

3. **`AStar`** - A\* pathfinding algorithm
   - Finds shortest walking route between two points
   - Uses walking-friendly cost function
   - Handles disconnected road networks

4. **`RouteOptimizer`** - Optimizes routes through multiple POIs
   - Nearest neighbor heuristic for performance
   - Multiple starting point optimization for small POI sets
   - Traveling salesman problem solver

5. **`WalkingRouteConfig`** - Walking preferences
   - Defines which OSM highway types are walkable
   - Priority system (footway > path > residential > secondary, etc.)
   - Avoids motorways and other non-pedestrian infrastructure

### Supporting Classes

- **`RouteGraph`** - Graph data structures for road network
- **`GridSpatialIndex`** - Fast spatial indexing for nearest node lookup

## Road Type Priorities (Walking)

The system uses OpenStreetMap highway classifications with walking-specific priorities:

**Best for Walking (Priority 1-3):**

- `footway` - Dedicated pedestrian paths
- `pedestrian` - Pedestrian zones
- `steps` - Stairs/steps
- `path` - Walking/hiking paths
- `track` - Unpaved tracks
- `bridleway` - Horse/walking paths
- `cycleway` - Bike paths (walkable)

**Acceptable (Priority 4-6):**

- `living_street` - Quiet residential
- `residential` - Residential streets
- `service` - Service roads
- `unclassified` - Minor roads
- `road` - General roads

**Use if necessary (Priority 7-9):**

- `tertiary` - Tertiary roads
- `secondary` - Secondary roads
- `primary` - Primary roads

**Avoided (Priority 10):**

- `motorway` - Highways (not walkable)
- `trunk` - Major roads
- `construction` - Under construction

## Usage

### Basic Usage (Recommended)

```typescript
import { generateStoryConnectionPath } from '$lib/utils/storyConnections';

// Generate walking routes for a story
const mapInstance = mapControl.getMapInstance();
const connectionGeoJSON = await generateStoryConnectionPath(story, mapInstance);

// Display on map
if (connectionGeoJSON.features.length > 0) {
	mapControl.setStoryConnection(connectionGeoJSON, true);
}
```

### Advanced Usage

```typescript
import { StoryRouter } from '$lib/utils/routing';

const router = new StoryRouter(mapInstance);
const result = await router.generateStoryRoutes(story);

console.log(`Generated ${result.routeInfo.segmentCount} route segments`);
console.log(`Total walking distance: ${(result.totalDistance / 1000).toFixed(1)} km`);
console.log(`Estimated walking time: ${Math.round(result.totalWalkingTime)} minutes`);
console.log(`Road types used: ${result.routeInfo.roadTypesUsed.join(', ')}`);
console.log(`Fallback segments: ${result.routeInfo.fallbackSegments}`);
```

## GeoJSON Output Format

The system generates GeoJSON compatible with the existing `StoryConnectionGeojsonSource` component:

```json
{
	"type": "FeatureCollection",
	"features": [
		{
			"type": "Feature",
			"properties": {
				"storyId": "story-123",
				"connectionType": "walking_route",
				"segmentIndex": 0,
				"distance": 245,
				"walkingTime": 3.2,
				"roadTypes": ["footway", "residential"],
				"fallback": false
			},
			"geometry": {
				"type": "LineString",
				"coordinates": [
					[2.3522, 48.8566],
					[2.3499, 48.853]
				]
			}
		}
	]
}
```

## Visual Styling

The updated `StoryConnectionGeojsonSource` component provides different styling:

- **Blue lines** - Real walking routes using roads/paths
- **Orange lines** - Straight-line fallback connections
- **Red dashed lines** - Fallback segments within walking routes
- **Subtle overlay** - Animated dashes for walking routes

## Performance Considerations

- **Graph building** is cached per map bounds
- **Route optimization** uses efficient heuristics for larger POI sets
- **Spatial indexing** enables fast nearest-neighbor queries
- **Incremental loading** prevents UI blocking during route generation

## Fallback Behavior

The system gracefully handles various scenarios:

1. **No transportation data** - Falls back to straight lines
2. **No walkable roads nearby** - Uses straight-line connections
3. **Disconnected road network** - Combines walking routes with straight-line bridges
4. **Route generation errors** - Always provides straight-line backup

## Testing

See `examples.ts` for testing utilities:

```typescript
import { testWalkingRoutes, compareRoutingSystems } from '$lib/utils/routing/examples';

// Test the routing system
await testWalkingRoutes(mapInstance);

// Compare old vs new approaches
await compareRoutingSystems(mapInstance);
```

## Integration Notes

- **Fully backward compatible** - Existing story connections continue to work
- **Async by design** - All routing operations are non-blocking
- **Map instance required** - Needs access to transportation MBTILES via map
- **No breaking changes** - Extends existing functionality seamlessly

## Future Enhancements

Potential improvements for future versions:

- **Multiple transportation modes** (cycling, driving)
- **Real-time routing** (traffic, temporary closures)
- **Accessibility routing** (wheelchair accessible routes)
- **Elevation-aware routing** (avoid steep hills)
- **Scenic route preferences** (prefer parks, waterfront paths)
- **Time-based routing** (account for opening hours of paths)
