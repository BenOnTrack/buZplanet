---
globs: src/**/*.{svelte,ts}
regex: MapLibre|maplibre-gl|protocol.*handler
description: Prevents race conditions where MapLibre tries to fetch tiles before
  protocol handlers are registered, which causes 'URL scheme not supported'
  errors.
alwaysApply: false
---

Always ensure MapLibre and other map-related components are only initialized after protocol handlers are properly registered. Use the appInitializer utility to manage initialization state and only render MapView when isAppReady is true.