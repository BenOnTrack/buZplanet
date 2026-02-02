---
globs: "**/*.svelte"
alwaysApply: true
---

Use Svelte 5 runes syntax: $state() for reactive state, $derived() for computed values, $props() for component props, $effect() for side effects. Replace export let declarations with $props(), reactive statements ($:) with $derived(), and let declarations that need reactivity with $state(). Use {@render children()} instead of <slot>.