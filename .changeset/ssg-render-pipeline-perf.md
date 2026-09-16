---
'@bdocs/ssg': patch
'boltdocs': patch
---

Faster incremental builds: SSR module prewarm in parallel with bundle builds, higher finalize/render concurrency, and Node compile cache for the CLI

- **SSG (`@bdocs/ssg`)**: when the SSR bundle is cached on disk, its ES module is imported in parallel with the bundle builds instead of serially after them (removes up to ~10s from the critical path on incremental builds).
- **SSG (`@bdocs/ssg`)**: finalize queue concurrency raised to match the critters WASM pool size, and the default SSG render worker count scales with available cores (RAM-aware guard kept).
- **Core (`boltdocs`)**: the CLI enables Node's `module.enableCompileCache()` when available, skipping repeated JS parse work on every command.
