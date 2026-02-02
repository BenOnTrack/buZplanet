---
globs: "**/*.svelte"
alwaysApply: false
---

Always create small, reusable components rather than coding entire functionality in a single large Svelte file. Use $lib/components/... path structure for imports. Store reusable CSS in global files, only use component-scoped styles for component-specific styling. Handle complex logic in separate .ts files and use shared $state classes in svelte.ts files for cross-component state management.