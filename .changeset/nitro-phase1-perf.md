---
'boltdocs': minor
'@bdocs/ssg': minor
---

Boltdocs 3.2.0 — Nitro Phase 1 performance optimizations

### Cache & Build Performance

- **Server build skip preserved**: `.vite-react-ssg-temp` no longer deleted when client code hasn't changed, making warm builds skip the expensive SSR Vite bundle (~40s saved)
- **Mtime cache in memory**: `getFileMtime()` now uses an in-memory TTL cache (2s) instead of `fs.statSync()` on every call — 5.9x faster for repeated stat calls
- **Client hash single stat**: `computeClientCodeHash()` reduced from 3 stat calls per file to 1 — 66% fewer syscalls
- **Hash meta persistence**: `hash-meta.json` stores file count + last mtime for fast cache validation without full directory scans
- **Dev gzip skipped**: `TransformCache` no longer gzips cache shards in dev mode

### MDX & Routes

- **MDX cache key for dev**: Uses file path + mtime instead of content hash in dev mode — cache survives restarts when files haven't changed
- **Bounded route parsing**: `Promise.all` replaced with `runWithConcurrency(32)` to prevent memory pressure and I/O contention
- **docCache loaded flag**: `docCache.load()` skips disk read when already in memory

### Dev Server & HMR

- **HMR O(1) module graph lookup**: Pre-built lowercase index replaces brute-force O(N) scan for faster content edits
- **Prewarming with route priority**: Index pages and getting-started are prewarmed first; 150ms delay to avoid CPU contention with first page request

### Pipeline & Syntax Highlighting

- **Pipeline parallel steps**: SEO validation and type generation run concurrently via `addParallelSteps()`
- **Pipeline timing logs**: Per-step timing reported after build completion
- **Critical CSS concurrency**: Beasties processor runs at `concurrency: min(cpus, 4)` instead of 1
- **Shiki WASM engine**: Oniguruma WASM engine replaces JavaScript regex — 13% faster syntax highlighting
