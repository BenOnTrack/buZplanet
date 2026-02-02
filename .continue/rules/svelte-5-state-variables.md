---
globs: "**/*.svelte"
alwaysApply: true
---

Use let variable = $state(initialValue) for reactive variables. NEVER reference other $state variables in initial value: $state(otherState.property) ❌. Use static initial values: $state(''), $state(0), $state(false) ✅