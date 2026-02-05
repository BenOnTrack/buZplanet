import type { StyleSpecification } from 'svelte-maplibre';

/**
 * Asset organization for offline maps:
 * - Glyphs: static/glyphs/ (served as static files)
 * - Sprites: static/sprites/ (served as static files for MapLibre compatibility)
 */

// Create the map style specification
export function createMapStyle(origin: string): StyleSpecification {
	return {
		version: 8,
		name: 'Basic',
		sources: {
			// Example source - you can add your tile sources here
			// osm: {
			//   type: 'raster',
			//   tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
			//   tileSize: 256,
			//   attribution: '© OpenStreetMap contributors'
			// }
		},
		// Glyphs path - served from static folder for offline access
		glyphs: `${origin}/glyphs/{fontstack}/{range}.pbf`,
		// Sprite path - MapLibre expects the base path without extension
		// This will automatically look for busyplanet.json, busyplanet.png, busyplanet@2x.json, busyplanet@2x.png
		sprite: `${origin}/sprites/busyplanet`,
		layers: []
	};
}
