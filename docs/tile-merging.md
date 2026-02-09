# Tile Merging for Overlapping MBTiles

This implementation solves the problem of overlapping .mbtiles files where multiple files contain partial data for the same tile coordinates.

## Problem

When generating .mbtiles files using tilemaker, tiles at the edge of regions may only contain partial data. For example:

- `region_west.mbtiles` contains building data for the western half of tile `14/8738/5678`
- `region_east.mbtiles` contains building data for the eastern half of the same tile

Without merging, only one of these tiles would be shown, resulting in incomplete data.

## Solution

The worker now:

1. **Identifies Multiple Sources**: When a tile request comes in, it searches all .mbtiles files that match the source name
2. **Collects All Tiles**: Instead of returning the first tile found, it collects tiles from ALL matching databases
3. **Merges Vector Tiles**: Uses the `mergeTiles()` function to combine multiple MVT (Mapbox Vector Tile) files into a single tile
4. **Handles Different Cases**:
   - No tiles found: Returns `null`
   - Single tile found: Returns the tile directly (no merging overhead)
   - Multiple tiles found: Merges them and returns the combined result

## Implementation Details

### Worker Changes

The `handleTileRequest` function in `worker.ts` was enhanced to:

```typescript
// Collect all tiles from matching databases
const tilesToMerge: Uint8Array[] = [];

for (const dbEntry of sourceDbs) {
    // Check zoom level bounds
    if (dbEntry.minzoom !== undefined && z < dbEntry.minzoom) continue;
    if (dbEntry.maxzoom !== undefined && z > dbEntry.maxzoom) continue;

    // Query for tile and add to collection if found
    const tileData = /* ... query database ... */;
    if (tileData && tileData.length > 0) {
        // Decompress if gzipped
        const processedTileData = isGzipped(tileData)
            ? await gunzip(tileData)
            : tileData;
        tilesToMerge.push(processedTileData);
    }
}

// Handle the collected tiles
if (tilesToMerge.length === 1) {
    return tilesToMerge[0]; // Single tile, no merging needed
} else if (tilesToMerge.length > 1) {
    return await mergeTiles(tilesToMerge); // Merge multiple tiles
}
```

### Database Matching

Enhanced source matching to find all relevant .mbtiles files:

```typescript
function getDatabasesBySource(source: string): DatabaseEntry[] {
	// Enhanced matching patterns:
	// 1. poi.mbtiles -> poi (exact)
	// 2. region_poi.mbtiles -> poi (contains)
	// 3. poi_shops.mbtiles -> poi (prefix)
	// 4. osm_poi.mbtiles -> poi (suffix)

	const isMatch =
		filenameLower === `${sourceLower}.mbtiles` ||
		filenameLower.includes(sourceLower) ||
		filenameLower.startsWith(`${sourceLower}_`) ||
		filenameLower.endsWith(`_${sourceLower}.mbtiles`);
}
```

## Merge Function

The `mergeTiles()` function (in `src/lib/utils/map/mergeTiles.ts`):

1. **Parses** each input tile into vector tile layers
2. **Groups** layers by name across all input tiles
3. **Merges** features from all layers with the same name
4. **Unifies** the keys/values dictionaries and remaps feature properties
5. **Handles** different extents by rescaling geometry coordinates
6. **Returns** a single combined MVT tile

## Usage

The merging happens transparently. Map sources just need to use the `mbtiles://` protocol:

```javascript
map.addSource('buildings', {
	type: 'vector',
	url: 'mbtiles://building' // Will merge all *building*.mbtiles files
});
```

## File Naming Conventions

For optimal merging, name your .mbtiles files with clear source indicators:

- ✅ `poi_region1.mbtiles`, `poi_region2.mbtiles` → matches source "poi"
- ✅ `building.mbtiles`, `building_extra.mbtiles` → matches source "building"
- ✅ `osm_natural.mbtiles`, `custom_natural.mbtiles` → matches source "natural"

## Testing

Use the `TileMergeTest.svelte` component to:

1. **View** all available databases in OPFS
2. **Test** automatic tile merging for common coordinates
3. **Request** specific tiles to see merge behavior
4. **Monitor** console logs for merge operations

## Performance Considerations

- **Single tiles**: No performance impact (direct passthrough)
- **Multiple tiles**: Small overhead for merging, but enables complete data
- **Caching**: Merged tiles are served directly to MapLibre; browser handles caching
- **Memory**: Temporary memory usage during merge operation

## Debugging

Enable console logging to see merge operations:

```
🔍 Found 2 matching databases for source 'poi': poi_west.mbtiles, poi_east.mbtiles
🔧 Merging 2 tiles for poi 14/8738/5678
```

## Fallbacks

- If merging fails, the system returns the first available tile
- If no tiles are found, returns `null` (normal behavior)
- Corrupted tiles are skipped during collection

This implementation ensures that users see complete data even when it's spread across multiple .mbtiles files, making the offline mapping experience seamless and comprehensive.
