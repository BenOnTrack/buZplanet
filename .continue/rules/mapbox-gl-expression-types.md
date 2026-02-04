---
globs: '**/*.svelte'
regex: filter=\{|paint=\{|layout=\{
---

When using Mapbox GL expressions that TypeScript doesn't recognize (like "!in", "!has", etc.), wrap them with a type assertion helper: const expr = (expression: any) => expression as any; and use expr([...]) around problematic filter expressions.
