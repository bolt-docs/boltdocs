---
'@bdocs/ssg': patch
---

Real content hashing for SSG caches: git checkouts no longer invalidate any build, and critical CSS is persisted across builds

- **Render cache**: per-page identity is now a sha1 of the source file's content instead of `mtimeMs:size`. A `git checkout` / branch switch (which rewrites mtimes) no longer re-renders all 259 pages (~232s observed); only genuinely edited pages re-render. Legacy `mtime:size` cache entries miss once and are rewritten.
- **Critical CSS**: extracted payloads are persisted to disk keyed by (engine, page structure, stylesheet). Text-only edits keep their page structure, so rebuilds skip the ~1s WASM extraction per page; in-memory dedupe behavior is unchanged. Payloads are pruned by 30-day TTL and a 5000-entry cap.
- **Client build cache is now fully content-based** (framework dist, everything under docs/, config files). The previous Sätteri-manifest proxy had a one-build lag — the manifest only updates during the client build, so content edits invalidated the bundle one build late and left the shipped client (search index / route chunks) stale for a build. Direct hashing reacts to the same edit within the build that sees it. Lockfiles are excluded (their bytes never enter the bundle and their mtimes churn on checkout), and framework hashing now covers `.mjs`/`.cjs` bundles that a stat-only extension filter previously missed.
- Fixed `cachedAllCssHash` being typed as `string` while holding a Buffer digest.
