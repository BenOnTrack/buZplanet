---
alwaysApply: true
---

When implementing cross-component map interactions (like zooming to features from lists), create a centralized MapControl store using Svelte 5 runes to manage map state and interactions. Export functions like zoomToAndSelectStoredFeature() that handle both map navigation and feature selection, and use proper accessibility patterns (onclick, onkeydown, tabindex, role, aria-label) for interactive elements.
