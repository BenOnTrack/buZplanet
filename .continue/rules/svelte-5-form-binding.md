---
globs: '**/*.svelte'
alwaysApply: true
---

Can only bind to: Identifiers (bind:value={variable}), MemberExpressions (bind:value={obj.prop}), or get/set pairs. NEVER bind to function calls: bind:value={derived()} ❌. Create bindable $state variables for complex derived values ✅
