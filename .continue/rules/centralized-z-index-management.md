---
alwaysApply: true
---

Always use the centralized z-index system from '$lib/styles/z-index.js'. Import { zIndexClass } and use zIndexClass('KEY_NAME') for Tailwind classes, or import individual constants for CSS-in-JS. Never use hardcoded z-index values. Update /src/lib/styles/z-index.ts when adding new layering requirements. Maintain the documented hierarchy: base content (0-10), drawers (40-60), selected feature drawer (70), navigation (100), modals (300+), tooltips (500+), notifications (700+), debug tools (9000+).
