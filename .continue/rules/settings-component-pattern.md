---
description: Apply when working with settings components that need to access
  global app state
alwaysApply: false
---

For settings components that use AppState, directly consume the already-initialized appState without doing component-level initialization. Check appState.initialized only for loading states, but rely on the app-level initialization in +page.svelte that calls appState.ensureInitialized() before rendering any components.
