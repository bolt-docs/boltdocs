# @bdocs/zig-critters

## 0.2.2

### Patch Changes

- [`8b7a4f8`](https://github.com/bolt-docs/boltdocs/commit/8b7a4f8ef18f787735cca6c273f300e0dc2e9f30) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Faster critical CSS extraction (zig-critters): worker-threads pool, resident WASM CSS, single-pass injection
  - **Worker-threads pool**: each pool worker owns a private WASM instance (up to `min(availableParallelism, 8)`, capped by render concurrency), so pages extract in parallel instead of queuing on one process-global instance. The serial API remains as fallback.
  - **Resident CSS in WASM memory**: the stylesheet is encoded and copied into each instance once per build (cached by string reference) instead of once per page.
  - **Single-pass injection**: the SSG render path wraps the extraction result itself, removing the previous inject-then-regex-extract double scan of every page and fixing a `'\\n'` literal-join bug in multi-tag extraction.
  - **Cheaper cache keys**: the stylesheet is hashed once per build and the digest is passed to `createCriticalCssCacheKey` (internal), removing a repeated O(css) SHA-256 per page.
  - **Correctness fixes**: the legacy `turbo` option now actually enables zig-critters (it previously resolved to disabled); the critters pool is disposed at build end; and dropped extractions now warn instead of failing silently when critical CSS exceeds the default 8 KB `maxSize` budget.

  Measured on the docs site (259 pages, identical client bundle): critters p50 468ms → 210ms, p95 1644ms → 1064ms, render phase 82.9s → 34.0s, with byte-identical critical CSS output.

## 0.2.1

### Patch Changes

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Update beasties and selector Zig sources with WASM types.

## 0.2.0

### Minor Changes

- [`491cf14`](https://github.com/bolt-docs/boltdocs/commit/491cf14de05bb06757047b301c88448a25880406) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Smart Selector Filtering & Size Budget**:
  - Exclude layout-related classes (sidebar, navbar, toc, etc.) from critical CSS inlining.
  - Exclude complex selectors (> 2 parts) natively in Zig.
  - Implement an 8 KB size budget in JS to discard critical CSS if the payload is too large.
