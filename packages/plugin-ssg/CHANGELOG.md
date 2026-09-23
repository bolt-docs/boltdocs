# @bdocs/ssg

## 0.4.3

### Patch Changes

- [`75863f2`](https://github.com/bolt-docs/boltdocs/commit/75863f226dab04ea25bb5686221918352a8ddef5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Ultra-warm fast path restored; locale pages no longer destroyed by post-build mirroring
  - The SSG output state gained an `extraFiles` list: files present in the
    output directory that post-build tooling (deployment mirror scripts)
    produced instead of the pipeline. The reuse check requires registered
    extras to still exist and no unregistered file to appear; the state
    self-heals within one build when tooling changes its footprint.
  - The ultra-warm fast path no longer demands an empty `auxiliaryFiles` list.
    Deterministic SEO/llms/RSS output is accepted when every file still exists
    (routes + config are already covered by the client-hash gate); anything
    unexpected still forces the full pipeline. Measured on a 259-page site:
    no-op builds are back to ~0.5s with the dist directory left untouched.
  - `readSsgOutputState` now round-trips the `extraFiles` field instead of
    silently dropping it on load.

- [`f05a7d2`](https://github.com/bolt-docs/boltdocs/commit/f05a7d20bd76ccf59eb79bdb98c630f1c610cf77) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Lazy external pages: marketing pages no longer ship inside the docs entry bundle
  - External pages registered through `pages-external` (landing, about, showcase,
    roadmap) can now be declared as dynamic `loader`s instead of static
    `component` imports. Both mechanisms wrap the page in `React.lazy` with the
    same `record.lazy` flow MDX pages already use: the SSG pre-renders the real
    HTML server-side and the client hydrates when the lazy chunk arrives, so
    there is no flash of empty content.
  - The generated entry now emits dynamic imports for file-routed external pages.
  - The docs site converts its `pages-external/index.tsx` map to loaders.
  - Measured on the docs site: entry chunk 1,239 KB → 1,023 KB raw (338 → 266 KB
    gz, −21%); the landing component tree now loads on demand as its own chunk.
  - Landing hero WebGL effect (LightRays) capped: dpr 1, 30 fps, paused while the
    tab is hidden, and disabled under `prefers-reduced-motion`.

- [`b8e272f`](https://github.com/bolt-docs/boltdocs/commit/b8e272f532c298606539dafb4fe10945a080bc42) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - OnThisPage always renders: stale critical CSS no longer survives client-side navigation, and collection posts resolve their route metadata
  - **Stale critters inline styles removed after hydration.** Each pre-rendered
    page inlines a `<style data-zig-critters>` block containing the utilities
    that page uses. After a client-side navigation the first page's block stayed
    in `<head>`, emitted after the external stylesheet, so its `.hidden` (and
    any other shared utility) beat the stylesheet for the rest of the session —
    pages reached via SPA silently lost styles the landing never used (the
    OnThisPage rail is hidden by default and revealed by `xl:flex`, so it
    vanished on every SPA path). The shell now removes these blocks on mount;
    the external stylesheet is always present before hydration, so removal
    cannot cause a flash.
  - **Collection posts resolve `currentRoute` on the client.** Collection post
    route records are registered without the docs base (and sometimes without a
    leading slash), while the browser URL carries both, so `useRoutes()` missed
    and every consumer of `currentRoute` (OnThisPage, navbar docs detection,
    edit links) received `undefined` on post pages. When the direct lookup
    misses, registered collection routes now fall back to the longest
    segment-tail match against the current pathname, restricted to
    `route.collection` so regular docs pages can never be shadowed.
  - **Client hash includes the site's `src/` directory.** Theme layouts,
    components and styles are bundled by Vite like framework code but were not
    hashed, so a theme-only edit skipped the client build and every cached page
    silently kept the previous layout. `src/` now participates in the client
    code hash.

## 0.4.2

### Patch Changes

- [`f8b96e0`](https://github.com/bolt-docs/boltdocs/commit/f8b96e0c868592743b0de0604709731d98e0e73a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Make the critical-CSS inline budget configurable and raise the default so real sites actually get inline critical CSS.
  - **`ssg.criticalCssMaxSize`** (new config option, bytes): per-page budget for the `<style data-zig-critters>` block. Pages whose extracted critical CSS exceeds the budget skip inlining (with a build warning naming the page and sizes).
  - **Default raised from 8KB to 24KB**: the engine's inherited 8KB budget silently discarded the critical CSS of real docs sites — the boltdocs docs site measures 16–18KB per page, so every page shipped with no inline critical CSS. With the new default the docs build inlines critical CSS on all pages again (direct LCP/FCP win; render-blocking CSS no longer blocks first paint).
  - Zig-critters 0.2.x users outside boltdocs are unaffected; the WASM `maxSize` contract is unchanged, boltdocs now passes the budget explicitly.

- [`34f16ca`](https://github.com/bolt-docs/boltdocs/commit/34f16caa5e820538942471aeaa4611edf1de8ba2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Extractor binary identity now participates in render-cache and critical-CSS cache keys
  - **`getEngineIdentity()`** (new, `@bdocs/zig-critters`): returns a sha1 of the WASM binary so consumers can key caches on the extractor version.
  - **Render cache**: pages without a source file (synthetic routes like `/docs`, locale roots) keyed their identity on the client-bundle hash alone, so a rebuilt extractor never re-rendered them — they kept serving HTML with stale embedded critical CSS. The extractor identity is now mixed into the fallback identity for those routes and into every critical-CSS cache key; shipping a new extractor binary re-renders exactly the affected pages once.
  - Downgrades two pending changesets from `minor` to `patch` (critical-CSS budget config, highlighting SPI) to keep the release line patch-only.

- [`0302a58`](https://github.com/bolt-docs/boltdocs/commit/0302a581a9fce6be012b01ab52d67028ccb479b8) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Per-pack render granularity: text-only edits re-render only the edited page's chunk pack instead of the whole site
  - **Per-route render identity**: each route's identity is now the Sätteri chunk-pack hash (strategy 1.5 in `computeRouteClientAssetHash`), mixed with an SSR-bundle identity guard (entry/layouts/theme, page-body chunk and manifests excluded) and a stylesheet-identity guard. Layout/CSS edits still re-render everything — correctly; text edits don't.
  - **Cache-hit entry-script rewrite**: a cache hit that survives a client rebuild rewrites the stale `app-*.js` URL embedded in the cached HTML to the fresh bundle's URL, instead of re-rendering the page.
  - **Fixed an SSR/client race** in the virtual-module plugins: the client entry no longer reads the shared global resolved config (which the SSR build could overwrite last — client builds raced into the SSR branch, inlining `combined.mjs` and skipping the `search.json` asset). Per-call `ssr` resolution now uses `this.environment.config.consumer`.
  - **`_rawContent` out of the client bundle**: full MDX source text no longer ships inside `virtual:boltdocs-routes`/`app-*.js` (~1.1MB smaller shared chunk). It's served lazily via `page-source.json` (fetched by CopyMarkdown at copy time, one session-cached request).
  - Measured on the docs site: 1-page text edit re-renders 78/259 pages (was 259), no-op builds 0.5s, revert oscillation eliminated, ultra-warm fast path intact.

- [`a9189d6`](https://github.com/bolt-docs/boltdocs/commit/a9189d6be7e5adf56f3f43c60ecde97137b2714c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Real content hashing for SSG caches: git checkouts no longer invalidate any build, and critical CSS is persisted across builds
  - **Render cache**: per-page identity is now a sha1 of the source file's content instead of `mtimeMs:size`. A `git checkout` / branch switch (which rewrites mtimes) no longer re-renders all 259 pages (~232s observed); only genuinely edited pages re-render. Legacy `mtime:size` cache entries miss once and are rewritten.
  - **Critical CSS**: extracted payloads are persisted to disk keyed by (engine, page structure, stylesheet). Text-only edits keep their page structure, so rebuilds skip the ~1s WASM extraction per page; in-memory dedupe behavior is unchanged. Payloads are pruned by 30-day TTL and a 5000-entry cap.
  - **Client build cache is now fully content-based** (framework dist, everything under docs/, config files). The previous Sätteri-manifest proxy had a one-build lag — the manifest only updates during the client build, so content edits invalidated the bundle one build late and left the shipped client (search index / route chunks) stale for a build. Direct hashing reacts to the same edit within the build that sees it. Lockfiles are excluded (their bytes never enter the bundle and their mtimes churn on checkout), and framework hashing now covers `.mjs`/`.cjs` bundles that a stat-only extension filter previously missed.
  - Fixed `cachedAllCssHash` being typed as `string` while holding a Buffer digest.

- [`4da1cae`](https://github.com/bolt-docs/boltdocs/commit/4da1cae105a0919c5280bd4f57c7a561fbfca5cd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Faster incremental builds: SSR module prewarm in parallel with bundle builds, higher finalize/render concurrency, and Node compile cache for the CLI
  - **SSG (`@bdocs/ssg`)**: when the SSR bundle is cached on disk, its ES module is imported in parallel with the bundle builds instead of serially after them (removes up to ~10s from the critical path on incremental builds).
  - **SSG (`@bdocs/ssg`)**: finalize queue concurrency raised to match the critters WASM pool size, and the default SSG render worker count scales with available cores (RAM-aware guard kept).
  - **Core (`boltdocs`)**: the CLI enables Node's `module.enableCompileCache()` when available, skipping repeated JS parse work on every command.

- [`1a044a2`](https://github.com/bolt-docs/boltdocs/commit/1a044a209d03cf3d94528c1bc93cc14784518905) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix mobile layout rendering on desktop: critical CSS no longer drops every desktop `@media` block

  Three extractor bugs shipped together produced an inline critical `<style>` with zero media queries. Because that style tag sits after the stylesheet `<link>`, its mobile-first base rules won the cascade over the full CSS forever — navbar, sidebar and docs layout rendered in their mobile form on desktop:
  - **Escaped quotes killed the parser**: a selector like `.font-features-[\ 'ss01\',\'cv01\']` (escaped quotes are part of the identifier) was treated as a string start, swallowing the rest of the stylesheet to EOF. Every rule after it — including all desktop media queries, measured past ~52KB of a 115KB Tailwind bundle — was silently dropped. Escaped characters in selectors are now consumed as identifier data.
  - **Layout selectors were excluded from the critical set**: navbar/sidebar/nav rules were hard-skipped, so desktop media queries whose only rules targeted them lost every child and the whole `@media` block was removed. They now match like any other selector.
  - **Silent truncation from a fixed arena**: the WASM extractor allocated a fixed ~2MB scratch buffer derived from CSS size and discarded rules silently when it filled. It now grows with linear memory; extraction covers the full stylesheet.

  Also:
  - Critical-CSS budget default raised 24KB → 32KB: the old value was calibrated against the poisoned output (~17KB); honest extraction of the same docs site measures ~26KB, which the old default silently discarded.
  - Cache format bumps (`ssg-cache.json` v3, critical-CSS disk cache v2) so persisted pages embedding the broken critical CSS re-render exactly once.

  Measured on the boltdocs docs site: critical CSS 17.4KB → 26.6KB with 9 desktop `@media` blocks (previously 0); `lg:flex`, `md:px-*`, sidebar and navbar rules present in the inline critical CSS.

- Updated dependencies [[`34f16ca`](https://github.com/bolt-docs/boltdocs/commit/34f16caa5e820538942471aeaa4611edf1de8ba2), [`1a044a2`](https://github.com/bolt-docs/boltdocs/commit/1a044a209d03cf3d94528c1bc93cc14784518905)]:
  - @bdocs/zig-critters@0.2.3

## 0.4.1

### Patch Changes

- [`8b7a4f8`](https://github.com/bolt-docs/boltdocs/commit/8b7a4f8ef18f787735cca6c273f300e0dc2e9f30) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Faster critical CSS extraction (zig-critters): worker-threads pool, resident WASM CSS, single-pass injection
  - **Worker-threads pool**: each pool worker owns a private WASM instance (up to `min(availableParallelism, 8)`, capped by render concurrency), so pages extract in parallel instead of queuing on one process-global instance. The serial API remains as fallback.
  - **Resident CSS in WASM memory**: the stylesheet is encoded and copied into each instance once per build (cached by string reference) instead of once per page.
  - **Single-pass injection**: the SSG render path wraps the extraction result itself, removing the previous inject-then-regex-extract double scan of every page and fixing a `'\\n'` literal-join bug in multi-tag extraction.
  - **Cheaper cache keys**: the stylesheet is hashed once per build and the digest is passed to `createCriticalCssCacheKey` (internal), removing a repeated O(css) SHA-256 per page.
  - **Correctness fixes**: the legacy `turbo` option now actually enables zig-critters (it previously resolved to disabled); the critters pool is disposed at build end; and dropped extractions now warn instead of failing silently when critical CSS exceeds the default 8 KB `maxSize` budget.

  Measured on the docs site (259 pages, identical client bundle): critters p50 468ms → 210ms, p95 1644ms → 1064ms, render phase 82.9s → 34.0s, with byte-identical critical CSS output.

- Updated dependencies [[`8b7a4f8`](https://github.com/bolt-docs/boltdocs/commit/8b7a4f8ef18f787735cca6c273f300e0dc2e9f30)]:
  - @bdocs/zig-critters@0.2.2

## 0.4.0

### Minor Changes

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Add a cache/render pipeline with benchmark-gated metrics, include framework dist code in the client cache hash, and parallelize client/server Vite builds for faster cold builds.

### Patch Changes

- [`36c959e`](https://github.com/bolt-docs/boltdocs/commit/36c959e922b491fa0e0de16f53be4dd6f894ba4b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Every CLI command now uses the brand terracotta palette (`#eb5828` / `#d34013`) — dev, preview, build, doctor, and audit outputs share the same wordmark gradient, borders, bullets, and badges instead of mixing generic cyan/sky/blue status colors. The `DEV`, `PREVIEW`, version, and `UPDATE` chips are brand-colored, the doctor header carries the branded wordmark with version badge and terracotta section titles (low-severity chips also match the brand; high/warning keep their semantic red/yellow), and the audit renders plugin names, low-risk tags, and the summary table borders in terracotta while staying dependency-free. The build summary was rewritten as a single compact block (header with version badge, per-phase timings, and a one-line metrics summary — pages, JS, CSS, output dir), replacing the previous steps + divider + total + table + box sequence and cutting the number of stdout writes during a build. The SSG worker-pool diagnostics log is now emitted only in benchmark mode so ordinary builds stay quiet.

  Two sidebar-related fixes land with it: `meta.json` resolution is now scoped per tab and per locale (so groups that share a directory name across tabs, like `(guides)/content` vs `(plugins)/content`, no longer clobber each other, and localized sites resolve their own translated meta instead of falling back to English titles), and an explicit `meta.json` `order` takes precedence over an index page's own `sidebarPosition` for group ordering. Collection pages (blog lists and posts) are also detected from any URL path segment rather than only the first one, which stops the docs sidebar from rendering on collection posts whose routes are registered without the docs base (e.g. `/blog/post` vs `/docs/blog/post`).

- Updated dependencies [[`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2)]:
  - @bdocs/zig-critters@0.2.1

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
