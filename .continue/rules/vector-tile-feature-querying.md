---
alwaysApply: true
---

When using querySourceFeatures() for vector tiles, always specify the zoom level where features are available (e.g., zoom: 14) in the query options. Vector tile features are only present at specific zoom levels based on the tile pyramid, so querying without the correct zoom level may return empty results even if the feature exists.
