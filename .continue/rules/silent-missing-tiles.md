---
globs: src/**/*.{ts,js}
regex: tile.*request|mbtiles|protocol.*handler|No tile found
description: Apply when working with tile loading, MBTiles databases, or
  protocol handlers that handle map tile requests.
alwaysApply: false
---

Never log "No tile found" errors as console errors. Missing tiles are normal behavior in mapping applications. Only log actual errors (network issues, database corruption, etc.). For missing tiles, either silently ignore or log at debug/info level if logging is needed.
