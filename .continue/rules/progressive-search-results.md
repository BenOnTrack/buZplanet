---
globs: '**/*Search*.{ts,svelte}'
description: When implementing search functionality that may take time to
  complete, always use progressive/streaming results to improve user experience
alwaysApply: false
---

For search operations that process large datasets or multiple databases, implement progressive result updates by sending intermediate results to the UI as they become available. Use worker progress callbacks to stream results and provide real-time feedback showing current database being searched and result count accumulating. Display partial results immediately while search continues in background.
