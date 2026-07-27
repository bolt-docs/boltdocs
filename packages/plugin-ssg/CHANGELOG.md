# @bdocs/ssg

## 0.3.1

### Patch Changes

- [`9c570fe`](https://github.com/bolt-docs/boltdocs/commit/9c570fe616da29fde6591359e9543de79b9454e9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Make `@bdocs/zig-critters` an optional dependency so installations do not fail when the local workspace package is unavailable.

## 0.3.0

### Minor Changes

- [`46e288d`](https://github.com/bolt-docs/boltdocs/commit/46e288d485bf50ae226a3b3c70c0a93040b8ae0c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Boltdocs 3.2.0 — Nitro Phase 1 performance optimizations

  ### Cache & Build Performance
  - **SSR output consolidated**: Moved from `.vite-react-ssg-temp/` to `.boltdocs/build/ssr/` — all build artifacts now live under a single `.boltdocs/` directory
  - **Server build skip preserved**: SSR output no longer deleted when client code hasn't changed, making warm builds skip the expensive SSR Vite bundle (~40s saved)
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

## 0.2.0

### Minor Changes

- [`efd4872`](https://github.com/bolt-docs/boltdocs/commit/efd4872b34502ed06e9c98b20f2e0577c754f683) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **SSG Rendering Performance** (both modes)
  - Replaced JSDOM DOM manipulation with string-based HTML operations
  - Preload links generated as HTML strings (no `document.createElement`)
  - `__staticRouterHydrationData` removed via regex instead of DOM queries
  - Output directories pre-created before rendering loop (eliminates ~241 `ensureDir` calls)
  - Critical CSS (beasties/zig-critters) initialized once before loop instead of per-page
  - Server Vite build skipped when client hash unchanged (saves ~5s on cached builds)

### Patch Changes

- Updated dependencies [[`491cf14`](https://github.com/bolt-docs/boltdocs/commit/491cf14de05bb06757047b301c88448a25880406)]:
  - @bdocs/zig-critters@0.2.0

## 0.1.1

### Patch Changes

- [`d55094d`](https://github.com/bolt-docs/boltdocs/commit/d55094db2b7afe4d7e00e2477d08483647ec1d8d) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix SSR rendering error with i18n configurations by safely guarding route path accesses on index/fallback routes. Correctly write performance metrics to build output directory.

## 0.1.0

### Minor Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Route-level code splitting support**: Enabled eager compilation of MDX files on SSR builds for static rendering while supporting client-side lazy chunks.
  - **Build performance metrics compilation**: Added automatic tracking of size budgets and timings at the end of the SSG build process, generating metrics for diagnostic auditing.
  - **Console build output sanitization**: Restructured build reports to suppress verbose Vite asset lists, replaced individual page compiler outputs with a clean running counter, and polished phase separators.
  - **Directory cache path updates**: Realigned SSG compiler logic with the new `.boltdocs/build/` and `.boltdocs/cache/` structure.
  - **Performance optimizations**: Refactored recursive file traversal and file hash caching to execute non-blockingly.

### Patch Changes

- Updated dependencies [[`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32)]:
  - @bdocs/dui@0.1.2

## 0.0.7

### Patch Changes

- [`36a7d09`](https://github.com/bolt-docs/boltdocs/commit/36a7d093a0304620ddaed6c2ed8616edbaa62987) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Replace `kolorist` with `@bdocs/dui` for all terminal output. Migrates `build.ts`, `dev.ts`, `cli.ts`, `utils.ts` (buildLog), `vite-plugin/index.ts`, `state.ts`, and `invariant.ts` — all `console.*` calls replaced with `dui.logger.*` and all `kolorist` colors replaced with `dui.colors`. Removes `kolorist` dependency.

- Updated dependencies [[`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a), [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72), [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0), [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133), [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18)]:
  - @bdocs/dui@0.1.1

## 0.0.6

### Patch Changes

- [`ee67a51`](https://github.com/bolt-docs/boltdocs/commit/ee67a5141282d4cbc9db0cf839c2073364f3f44a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fall back to the original route loader when the static data manifest or data file is unavailable, instead of returning null. This prevents 'Cannot read properties of null' crashes on navigation when the loader data fetch fails.

## 0.0.5

### Patch Changes

- [`f0c9703`](https://github.com/bolt-docs/boltdocs/commit/f0c9703e9b568c03ddfe5061bb0faa1942c84b4f) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix React 19 hydration mismatch and route double-rendering in production by performing synchronous hydration and inlining initial page loader data.

- [`09b3cbf`](https://github.com/bolt-docs/boltdocs/commit/09b3cbf21553cdcf24afbfd03fb6c9f8391a0b6a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix React 19 hydration mismatches and route duplication/double-rendering on subpage refreshes by configuring the router's basename, prepending the basename prefix during SSR query rendering, and extracting/inlining static router hydration data into the head.

- [`cbb1914`](https://github.com/bolt-docs/boltdocs/commit/cbb1914745217fe66e0c5854c2d592b521a1b26b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Switch to flat HTML output (`about.html` instead of `about/index.html`), generate own `__staticRouterHydrationData` script, sanitize hydration data, and fix fallback route index handling for docs base path. This resolves hydration mismatches and page duplication on subpage refresh across all deployment platforms.

## 0.0.4

### Patch Changes

- [`b5e54f1`](https://github.com/bolt-docs/boltdocs/commit/b5e54f16e9b792f4c3616ad7a3ee368f4a1a8fda) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix empty page on docs base path redirects, breadcrumbs, TOC, and active sidebar link highlight.
  Fix hydration crash and caching bug for static loader data in production by adding cache-busting query parameters and safe JSON fetch handling.

## 0.0.3

### Patch Changes

- [`e5e5ebb`](https://github.com/bolt-docs/boltdocs/commit/e5e5ebbf370acdeb9eaab77a296f37493f7b5d0f) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve SSG route resolution causing home page content to leak into all routes

## 0.0.2

### Patch Changes

- [`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - perf(ssg): Improved performance in warm
