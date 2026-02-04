---
globs: '**/*.svelte'
alwaysApply: true
---

Use Svelte 5 event attribute syntax (onclick, onsubmit, etc.) instead of deprecated on: directive syntax. For form submission, handle preventDefault in the event handler function by accepting the event parameter.
