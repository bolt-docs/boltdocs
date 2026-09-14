---
'boltdocs': patch
'@bdocs/ssg': patch
'@bdocs/zig-critters': patch
---

Faster critical CSS extraction (zig-critters): worker-threads pool, resident WASM CSS, single-pass injection

- **Worker-threads pool**: each pool worker owns a private WASM instance (up to `min(availableParallelism, 8)`, capped by render concurrency), so pages extract in parallel instead of queuing on one process-global instance. The serial API remains as fallback.
- **Resident CSS in WASM memory**: the stylesheet is encoded and copied into each instance once per build (cached by string reference) instead of once per page.
- **Single-pass injection**: the SSG render path wraps the extraction result itself, removing the previous inject-then-regex-extract double scan of every page and fixing a `'\\n'` literal-join bug in multi-tag extraction.
- **Cheaper cache keys**: the stylesheet is hashed once per build and the digest is passed to `createCriticalCssCacheKey` (internal), removing a repeated O(css) SHA-256 per page.
- **Correctness fixes**: the legacy `turbo` option now actually enables zig-critters (it previously resolved to disabled); the critters pool is disposed at build end; and dropped extractions now warn instead of failing silently when critical CSS exceeds the default 8 KB `maxSize` budget.

Measured on the docs site (259 pages, identical client bundle): critters p50 468ms → 210ms, p95 1644ms → 1064ms, render phase 82.9s → 34.0s, with byte-identical critical CSS output.
