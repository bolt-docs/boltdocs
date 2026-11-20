# @bdocs/ssg

## 0.6.0

### Minor Changes

- Vite 8.3.5, and only Vite 8.3.

### Patch Changes

- Every package type checks.

## 0.5.0

### Minor Changes

- Boltdocs 3.4.0 — architecture contracts and incremental build foundation.

### Patch Changes

- Transform the HTML entry instead of the request URL in dev The SSG dev middleware called `server.transformIndexHtml(url, template)` with the request URL.
- Fix a render scheduling bug that serialized page rendering across the worker pool.

## 0.4.4

### Patch Changes

- Align internal Vite development and build tooling on Vite 8.1, make the Boltdocs versus Docusaurus Faster benchmark cold-cache aware, and preserve route-level SSG render identity when a client build cannot emit a route-specific chunk.

## 0.4.3

### Patch Changes

- Ultra-warm fast path restored; locale pages no longer destroyed by post-build mirroring output directory that post-build tooling (deployment mirror scripts) produced instead of the pipeline.
- Lazy external pages: marketing pages no longer ship inside the docs entry bundle roadmap) can now be declared as dynamic `loader`s instead of static `component` imports.
- OnThisPage always renders: stale critical CSS no longer survives client-side navigation, and collection posts resolve their route metadata page inlines a `<style data-zig-critters>` block containing the utilities that page uses.

## 0.4.2

### Patch Changes

- Make the critical-CSS inline budget configurable and raise the default so real sites actually get inline critical CSS.
- Extractor binary identity now participates in render-cache and critical-CSS cache keys
- Per-pack render granularity: text-only edits re-render only the edited page's chunk pack instead of the whole site
- Real content hashing for SSG caches: git checkouts no longer invalidate any build, and critical CSS is persisted across builds
- Faster incremental builds: SSR module prewarm in parallel with bundle builds, higher finalize/render concurrency, and Node compile cache for the CLI
- Fix mobile layout rendering on desktop: critical CSS no longer drops every desktop `@media` block Three extractor bugs shipped together produced an inline critical `<style>` with zero media queries.

## 0.4.1

### Patch Changes

- Faster critical CSS extraction (zig-critters): worker-threads pool, resident WASM CSS, single-pass injection Measured on the docs site (259 pages, identical client bundle): critters p50 468ms → 210ms, p95 1644ms → 1064ms, render phase 82.9s → 34.0s, with byte-identical critical CSS output.

## 0.4.0

### Minor Changes

- Add a cache/render pipeline with benchmark-gated metrics, include framework dist code in the client cache hash, and parallelize client/server Vite builds for faster cold builds.

### Patch Changes

- Every CLI command now uses the brand terracotta palette (`#eb5828` / `#d34013`) — dev, preview, build, doctor, and audit outputs share the same wordmark gradient, borders, bullets, and badges instead of mixing generic cyan/sky/blue status colors.

## 0.3.1

### Patch Changes

- Make `@bdocs/zig-critters` an optional dependency so installations do not fail when the local workspace package is unavailable.

## 0.3.0

### Minor Changes

- Boltdocs 3.2.0 — Nitro Phase 1 performance optimizations

## 0.2.0

### Minor Changes

- - **SSG Rendering Performance** (both modes)

### Patch Changes

## 0.1.1

### Patch Changes

- Fix SSR rendering error with i18n configurations by safely guarding route path accesses on index/fallback routes. Correctly write performance metrics to build output directory.

## 0.1.0

### Minor Changes

- - **Route-level code splitting support**: Enabled eager compilation of MDX files on SSR builds for static rendering while supporting client-side lazy chunks.

### Patch Changes

## 0.0.7

### Patch Changes

- Replace `kolorist` with `@bdocs/dui` for all terminal output.

## 0.0.6

### Patch Changes

- Fall back to the original route loader when the static data manifest or data file is unavailable, instead of returning null.

## 0.0.5

### Patch Changes

- Fix React 19 hydration mismatch and route double-rendering in production by performing synchronous hydration and inlining initial page loader data.
- Fix React 19 hydration mismatches and route duplication/double-rendering on subpage refreshes by configuring the router's basename, prepending the basename prefix during SSR query rendering, and extracting/inlining static router hydration data into the head.
- Switch to flat HTML output (`about.html` instead of `about/index.html`), generate own `__staticRouterHydrationData` script, sanitize hydration data, and fix fallback route index handling for docs base path.

## 0.0.4

### Patch Changes

- Fix empty page on docs base path redirects, breadcrumbs, TOC, and active sidebar link highlight.

## 0.0.3

### Patch Changes

- fix: resolve SSG route resolution causing home page content to leak into all routes

## 0.0.2

### Patch Changes

- perf(ssg): Improved performance in warm
