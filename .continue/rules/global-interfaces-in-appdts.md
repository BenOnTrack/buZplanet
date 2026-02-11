---
description: Ensures consistent interface organization by centralizing all
  TypeScript interfaces in the global app.d.ts file following SvelteKit best
  practices
alwaysApply: true
---

All TypeScript interfaces must be defined as global declarations in src/app.d.ts within the `declare global` block. Never create separate interface files or export interfaces from individual modules. This ensures centralized type management and follows SvelteKit conventions.
