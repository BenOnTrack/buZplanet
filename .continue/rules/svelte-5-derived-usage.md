---
globs: '**/*.svelte'
alwaysApply: true
---

Use $derived(() => expression) with arrow function syntax. NEVER use $derived(expression) without function wrapper ❌. For complex objects: $derived(() => { return complexCalculation; }) ✅
