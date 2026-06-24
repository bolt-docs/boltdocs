---
"@bdocs/ssg": minor
---

- **SSG Rendering Performance** (both modes)
  - Replaced JSDOM DOM manipulation with string-based HTML operations
  - Preload links generated as HTML strings (no `document.createElement`)
  - `__staticRouterHydrationData` removed via regex instead of DOM queries
  - Output directories pre-created before rendering loop (eliminates ~241 `ensureDir` calls)
  - Critical CSS (beasties/zig-critters) initialized once before loop instead of per-page
  - Server Vite build skipped when client hash unchanged (saves ~5s on cached builds)
