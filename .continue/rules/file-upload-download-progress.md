---
globs: '**/*upload*.{ts,js,svelte}'
description: Apply when implementing file upload/download features that interact
  with OPFS and need real-time progress feedback
alwaysApply: false
---

When implementing file upload or download functionality, always include progress bars with percentage and current file name tracking. After successful file operations to OPFS, always refresh the worker database index using refreshWorkerDatabases() or similar worker.scanDatabases() calls to ensure the map can immediately access new files without page refresh.
