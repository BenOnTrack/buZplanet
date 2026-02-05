---
description: Ensures AppState IndexedDB storage is properly initialized before use
alwaysApply: true
---

Always ensure appState.ensureInitialized() is called before using any AppState functionality. Check appState.initialized before accessing configuration properties.
