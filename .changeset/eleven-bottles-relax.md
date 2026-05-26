---
"boltdocs": minor
"@bdocs/ssg": minor
---

Route-level code splitting for instant dev startup.

- **Lazy MDX modules**: Client builds (dev + prod) use `import.meta.glob()` without `eager: true`. Each MDX page becomes a separate chunk loaded on demand via `React.lazy`-style dynamic import.

- **Eager SSR builds**: The SSR build uses `eager: true` so all modules are available synchronously during `renderToString` — no changes to the SSG pipeline.

- **Background prefetch**: After first paint, all MDX modules are prefetched in batches of 6 via `requestIdleCallback`. By the time the user navigates, the module is already in Vite's module cache — navigation is instant.

- **Batch pre-warming**: Dev server pre-warming now compiles MDX files in parallel batches of 8 (was sequential with 50ms delay), reducing warm-up time from 3.4s to ~1.8s for 68 pages.
