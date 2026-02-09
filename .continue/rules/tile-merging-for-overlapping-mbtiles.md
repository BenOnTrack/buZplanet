---
description: Apply when working with .mbtiles tile handling, vector tile
  merging, or OPFS database operations
alwaysApply: false
---

When handling tile requests where multiple .mbtiles files contain data for the same z/x/y coordinate, collect all matching tiles from different databases and merge them using mergeTiles() function. This enables combining partial data from multiple sources (e.g., one .mbtiles with buildings in the western half and another with buildings in the eastern half). Always decompress gzipped tiles before merging, handle single tiles without merging overhead, and provide fallback to first tile if merging fails. Log merge operations for debugging.
