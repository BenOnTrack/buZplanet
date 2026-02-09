---
globs: '**/worker/**/*.ts'
description: When managing multiple MBTiles databases, optimize tile serving
  performance by detecting boundaries
alwaysApply: false
---

Use smart boundary detection to minimize expensive tile merging operations. Only merge tiles when multiple MBTiles databases have tiles at the same location. Cache boundary decisions and use efficient database queries to check tile existence before attempting expensive merging operations.
