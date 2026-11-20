# boltdocs

## 4.0.0

### Major Changes

- Add `@bdocs/runtime`: the browser half of Boltdocs, split out of the core.
- Add `boltdocs migrate`, which reports and fixes the 3.x patterns that 4.0 changed.
- Add `@bdocs/theme-neutral`: the neutral theme as an installable package.
- The engine no longer ships the UI layer.
- Drop the CommonJS build. The published tarball goes from **5.84 MB to 2.93 MB** (−49.8%), 195 files to 100.
- Make the highlighter pipeline genuinely engine-agnostic.
- Move sitemap, robots.txt and route SEO metadata into `@bdocs/plugin-seo`.
- Replace the built-in Shiki highlighter with `@bdocs/highlight`, a Prism-based, dependency-free (no Oniguruma/WASM) syntax highlighter.
- Extract the React binding out of the engine (SPEC §5/§6).
- Replace `react-aria-components` with `@bdocs/primitives`.
- Finish search: the `search:index` hook works, and two real engines ship.
- Move search document generation into `@bdocs/plugin-search`, and drop `flexsearch` from the core.
- Move the vendored Shiki grammars and themes into `@bdocs/grammars`. The core tarball drops from **2.93 MB to 0.35 MB**.
- The engine depends on nothing but the contracts.
- The engine ships no stylesheet. The reset is the theme's.
- Renames the theme's style-neutral layer from `primitives` to `composition`, removes two dead files, and collapses four package aliases into one boundary each.

### Minor Changes

- Make the core CSS-agnostic: remove Tailwind/Vite Tailwind coupling and CSS-framework assumptions from the engine and neutral theme, replace `cn` with framework-neutral `clsx` class joining (no Tailwind merge), ship the neutral theme as plain CSS only, and update scaffolding/templates to opt into Tailwind explicitly via `@bdocs/plugin-tailwindcss` when needed.
- Extend `boltdocs migrate` so it can import Docusaurus and Starlight (Astro) documentation sites in addition to upgrading Boltdocs 3.x projects.
- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.
- The production build stops loading a browser it never renders in.
- The syntax highlighter uses the Oniguruma engine by default.
- Vite 8.3.5, and only Vite 8.3.

### Patch Changes

- Update the documentation site to present Boltdocs 4.0 as the current release.
- Drop `isomorphic-dompurify` and jsdom: 8.4 MB and 55 fewer packages, and 25x faster on the frontmatter path.
- Every package type checks.
- Restores UI that Tailwind was never told to generate.
- Add first-party git metadata plugins and wire the documented `routes:resolved` hook.
- Make image optimization opt-in instead of mandatory The image optimizer was imported at the top of the plugin module and injected unconditionally, which made image processing a requirement for every project.
- Stop the plugin lifecycle from loading the build pipeline.
- The highlighter's default engine is Oniguruma, and the JavaScript engine is gone from the default path.
- Support every documented Shiki code theme, and drop 1.8 MB from the install.
- Align the docs and benchmark tooling with SPEC.md:
- The benchmark gate has a baseline, and knows what it measured.
- The engine's stylesheet no longer assumes a CSS framework.
- The type checker is clean, and the highlighting configuration has one type.
- `@bdocs/theme-neutral` ships native CSS, and the core no longer advertises a stylesheet it never built.
- Converts the layout chrome to native CSS, with a visual harness that proves the UI did not change.
- Ship 11.7 MB fewer installed packages by depending on the Shiki packages actually used.

## 3.4.1

### Patch Changes

- Fix i18n locale switching for collection routes (blog posts)

## 3.4.0

### Minor Changes

- Add viewport-triggered route prefetching so scrolling to a link warms it before the click.
- Boltdocs 3.4.0 — architecture contracts and incremental build foundation.

### Patch Changes

- Render client-side redirects through the framework's own router `buildRedirectRoutes` rendered its redirect boundary with `useNavigate` from `react-router-dom`, but the framework ships its own context-based router (`packages/boltdocs-engine/src/client/router`) and never mounts a react-router provider.
- Fix the favicon and logo preload URLs in the dev server The dev HTML middleware injected the head meta itself and then called `server.transformIndexHtml`, whose hook injected it again, so every injected `<link>`/`<meta>` was emitted twice.
- Silence the dev server when a dependency is inlined by the optimizer `react-fast-compare` and `invariant` were listed in `optimizeDeps.include`, but they are transitive dependencies of `react-helmet-async` that pnpm does not hoist to the project root.
- Defer dependency prewarming until the optimizer settles `setupPrewarming` warmed the optimized dependencies synchronously in `configureServer`, racing Vite's dependency optimizer.
- Fix site-root external pages 404ing in `dev` when a `base` is configured, and fix link autocompletion dropping external and collection routes.
- Give every focusable element a visible keyboard focus indicator.
- Make server-rendered dates deterministic and fix theme-dependent assets Three classes of hydration mismatch, all caused by the server and the browser computing different markup for the same content.
- Restore React Fast Refresh for sites configured with a non-root `base`, and stop forcing a full reload when a layout or external page is edited.
- Fix two routing bugs that broke server-rendered pages looped over every configured locale to build the localized variants of an external page, including the default one.

## 3.3.6

### Patch Changes

- Accessibility: axe-core clean across docs surfaces navigation tabs can opt out of the ARIA `tablist` widget semantics (a tablist requires `tab` children and failed automated audits).
- Finish the Ask AI integration: restore public plugin metadata and floating client slots, harden provider routing and server errors, enforce request/input limits across every adapter, add a customizable accessible chat UI, and expand security and DOM regression coverage.
- Avoid static default imports when generating plugin MDX components.
- Align internal Vite development and build tooling on Vite 8.1, make the Boltdocs versus Docusaurus Faster benchmark cold-cache aware, and preserve route-level SSG render identity when a client build cannot emit a route-specific chunk.

## 3.3.5

### Patch Changes

- Entry bundle diet: KaTeX baked at build time, FlexSearch loaded on demand the build and emits `<BlockMath html={...}>` / `<MathComponent html={...}>` carrying the pre-rendered HTML.
- Lazy external pages: marketing pages no longer ship inside the docs entry bundle roadmap) can now be declared as dynamic `loader`s instead of static `component` imports.
- OnThisPage always renders: stale critical CSS no longer survives client-side navigation, and collection posts resolve their route metadata page inlines a `<style data-zig-critters>` block containing the utilities that page uses.

## 3.3.4

### Patch Changes

- Finer Sätteri chunk packs and a single-scan public-asset URL rewrite pages (was 50), 20 for 50–200 (was 30).

## 3.3.3

### Patch Changes

- Make the critical-CSS inline budget configurable and raise the default so real sites actually get inline critical CSS.
- Make code syntax highlighting engine-agnostic: the core now renders via a `CodeHighlighterAdapter` resolved from a registry instead of calling Shiki directly.
- Per-pack render granularity: text-only edits re-render only the edited page's chunk pack instead of the whole site
- Faster incremental builds: SSR module prewarm in parallel with bundle builds, higher finalize/render concurrency, and Node compile cache for the CLI

## 3.3.2

### Patch Changes

## 3.3.1

### Patch Changes

- Faster critical CSS extraction (zig-critters): worker-threads pool, resident WASM CSS, single-pass injection Measured on the docs site (259 pages, identical client bundle): critters p50 468ms → 210ms, p95 1644ms → 1064ms, render phase 82.9s → 34.0s, with byte-identical critical CSS output.

## 3.3.0

### Minor Changes

- Add locale support to `experimental.fileRouting`: a top-level `pages-external/{locale}/` directory matching a configured locale now provides the localized variant of a page (`es/roadmap.mdx` → `/es/roadmap`).
- Add a first-class `aliases` configuration API for project-specific module aliases while preserving Boltdocs' internal aliases.
- **Sidebar primitives**: `Sidebar.Items` now accepts `classNames` (per-piece `SidebarSlots` merged over the defaults with `tailwind-merge`) plus `componentItem` and `componentGroup` render props for full structural replacement.
- Every CLI command now uses the brand terracotta palette (`#eb5828` / `#d34013`) — dev, preview, build, doctor, and audit outputs share the same wordmark gradient, borders, bullets, and badges instead of mixing generic cyan/sky/blue status colors.
- Release 3.3.0: replace react-router-dom with a custom micro-router, make the core CSS-agnostic (Tailwind is no longer assumed), add the `definePlugin` API with typed lifecycle hooks, opt-in JSON-LD structured data, View Transitions, and `experimental.fileRouting` for literal `pages-external/` files.

### Patch Changes

- Fix a dev-server race where a `server.restart()` could dispose the shared route-cache context while the new server's virtual modules still held a reference to it, surfacing as "Route cache context has been disposed" errors on reload.
- Rebrand the CLI output (dev/preview server boxes, build summary, doctor, update prompt) from the former terracotta brand color to an azure-blue accent (`#3d8bfa`), matching the updated primary palette.
- Fix locale selector becoming unresponsive after switching languages.
- Fix dev server HMR for `pages-external/` files: explicitly watching `pages-external/index.*` raced with chokidar's initial recursive scan, so files such as `roadmap.mdx` and underscore-prefixed section components were never watched and edits had no effect.

## 3.2.2

### Patch Changes

## 3.2.1

### Patch Changes

- Fix SSR build errors by externalizing react-router-dom during server-side rendering.

## 3.2.0

### Minor Changes

- feat(ask-ai): multi-provider support, dev-mode token chip, `useConfig`-driven client config.
- Reduce package weight for downstream consumers.
- Boltdocs 3.2.0 — Nitro Phase 1 performance optimizations
- Phase 1 of the new plugin API.
- Phase 2 of the new plugin API: enrich `PluginContext` with four new APIs every lifecycle hook receives: // Cache something without reaching into core internals ctx.caches .transform('my-plugin-rewrites') .set('foo', 'bar') // Surface a structured warning the dev server can render in an overlay ctx.diagnostics.report( 'warn', 'MY_PLUGIN_CONFIG', 'config.foo is missing — using the default', { filePath: ctx.docsDir + '/config.ts' }, ) // Avoid hand-rolled path joins const link = ctx.paths.resolveDocs('assets', 'banner.png') // Expose a custom virtual module to clients ctx.virtualModules.add( 'virtual:@my-plugin/runtime-config', () => `export default ${JSON.stringify({ ...
- Phase 7 of the new plugin API: transform middleware pipeline and lazy slot loading.

### Patch Changes

- Fix mermaid pages having extra scroll space at the bottom

## 3.1.0

### Minor Changes

- Feature:

### Patch Changes

## 3.0.2

### Patch Changes

- fix: filter collections and search by locale/version with default fallback
- fix: resolve SSG build and pnpm 10+ install failures

## 3.0.1

### Patch Changes

## 3.0.0

### Major Changes

- feat: Boltdocs v3.0.0 - Native Parser, Vercel Analytics, Giscus, and More
- Restructure integrations config into sections (breaking change)

### Patch Changes

## 2.9.3

### Patch Changes

- fix(seo): inject `config.seo` tags into global HTML template and move `<Head>` to root shell The homepage `/` was missing SEO tags from `config.seo` (og:image, custom metatags, etc.) because: 1.

## 2.9.2

### Patch Changes

- Fix React hydration mismatch by initializing resolvedTheme to 'light' on client initial mount, and add a dedicated isolated 'boltdocs/server' entrypoint to completely prevent serverless execution crashes due to heavy build dependencies.

## 2.9.1

### Patch Changes

- Refactor main Node entrypoint imports to use dynamic imports for heavy build-time dependencies, preventing runtime crashes in Vercel serverless functions.

## 2.9.0

### Minor Changes

- - **boltdocs (Minor)**:

### Patch Changes

## 2.8.4

### Patch Changes

- fix: solve various bugs including theme flashing, i18n sidebar disappearing/duplication, upgrade check reliability, CLI port/host support, and create-boltdocs project name argument support.

## 2.8.3

### Patch Changes

- Revert base path configuration override in Vite plugin to restore correct asset routing and fix 404 errors in production.

## 2.8.2

### Patch Changes

- Fix SSR rendering error with i18n configurations by safely guarding route path accesses on index/fallback routes. Correctly write performance metrics to build output directory.

## 2.8.1

### Patch Changes

- fix: repared style of block-code

## 2.8.0

### Minor Changes

- - **Route-level code splitting**: MDX pages are now lazy-loaded on demand client-side using dynamic imports, with background prefetching in idle time and parallelized compilation pre-warming.

### Patch Changes

## 2.7.11

### Patch Changes

- Exclude src/client from published files, point Tailwind @source to dist, disable minify for client build

## 2.7.10

### Patch Changes

- feat(dui): add `configure()`/`getConfig()` for runtime identity — log prefix, server box titles, and update command are now configurable at the CLI entry point instead of hardcoded.
- Remove `ansiCodes` raw ANSI export from `@bdocs/dui`. Core CLI `ui.ts` now re-exports `dui.colors` (picocolors) directly — no more ANSI escape code usage anywhere. `formatLog` and `confirm` use picocolors functions.
- Fix picocolors usage across `@bdocs/dui` (use function calls instead of template literal interpolation).
- Complete migration from `ui.ts` wrapper to direct `@bdocs/dui` imports across core. Move `confirm`/`formatLog` into dui. Remove `ui.ts` entirely. Phase 3: migrate changelog generator output to dui logger/box.
- Create `@bdocs/dui` terminal UI package with boxes, logger, lists, and dividers. Wire into core CLI (`ui.ts`) and update-check (`update-check.ts`).

## 2.7.9

### Patch Changes

- Fix false positive "broken internal link" reports for URLs inside fenced code blocks and inline code in the `boltdocs doctor` command.
- Fix duplicate sidebar links caused by fallback metadata entries copying `filePath` and `slugParts` from the original route. The fallback entry now sets `filePath: ''` and `slugParts: []` so the sidebar code skips it.
- Rewrite README with benchmark comparisons, tech stack showcase, detailed features with code examples, ecosystem table, roadmap, and improved structure. Add README to `packages/boltdocs-engine/` for npm package display.
- Show update notification when a new version of boltdocs is available.

## 2.7.8

### Patch Changes

- Fix React 19 hydration mismatches and route duplication/double-rendering on subpage refreshes by configuring the router's basename, prepending the basename prefix during SSR query rendering, and extracting/inlining static router hydration data into the head.
- Switch to flat HTML output (`about.html` instead of `about/index.html`), generate own `__staticRouterHydrationData` script, sanitize hydration data, and fix fallback route index handling for docs base path.

## 2.7.7

### Patch Changes

- Fix empty page on docs base path redirects, breadcrumbs, TOC, and active sidebar link highlight.

## 2.7.6

### Patch Changes

- fix: resolve SSG route resolution causing home page content to leak into all routes

## 2.7.5

### Patch Changes

- perf: refine incremental build caching and fix loader hash stability fix: ensure docs layout wrapper is constrained to the base docs path to prevent hijacking external routes (like homepage/about) during client-side hydration.

## 2.7.4

### Patch Changes

- fix: resolve config syntax and ssr optimizeDeps interop

## 2.7.3

### Patch Changes

- fix: resolve CJS/ESM interop issues for react-fast-compare and react-router-dom - Add react-fast-compare to optimizeDeps.include (browser) and ssr.optimizeDeps.include (SSR) to fix missing default export - Add react-router-dom to ssr.noExternal to fix 'module is not defined' in Vite 8 SSR module runner - Apply same fixes to plugin config hook for consumer-side usage

## 2.7.2

### Patch Changes

- perf(core): Improved performance in warm

## 2.7.1

### Patch Changes

- fix: repared error of ssg

## 2.7.0

### Minor Changes

- - **feat**: Added support for `lastUpdated` property in documentation pages.

## 2.6.2

### Patch Changes

- fix: repared bug collision pages & navigation fix: repared bug 404 when switch version in home feat: support types-generator for better autocomplete

## 2.6.1

### Patch Changes

- fix: error in developer in build

## 2.6.0

### Minor Changes

- feat: new engine ssg feat: line-number & word-wrap in code-block feat: support languagues rust & toml fix: removed ogImage feat: support seo granular configuration in frontmatter & config fix: removed shadow image fix: support detect xml in sitemap fix: removed hover in field style: updated Admonition styles fix: removed style uppercase in sidebar & onthispage fix: repared warning each child of react key feat: support icons external

## 2.5.6

### Patch Changes

- fix: repared error in mode developer

## 2.5.5

### Patch Changes

- repared error use-external

## 2.5.4

### Patch Changes

- fix: added use-async-external-store with in optimizeDeps

## 2.5.3

### Patch Changes

- removed integrations of config

## 2.5.2

### Patch Changes

- removed sandbox integrations

## 2.5.1

### Patch Changes

- repared error show visible CodeBlock & repared error components Plugins

## 2.5.0

### Minor Changes

- Updated imports to simples, support CPS, Support External-Page with file

### Patch Changes

- export types of plugins, Config & theme

## 2.4.2

### Patch Changes

- fix: repared error in build with virtual-imports

## 2.4.1

### Patch Changes

- updated width with pathname
- added name tabs in URLs & repared icons size

## 2.4.0

### Minor Changes

- Support icons & title CodeBlock, Better Scroll, export Skeleton Component

## 2.3.0

### Minor Changes

- feat: added new primitives `Skeleton`

## 2.2.0

### Minor Changes

- feat: support i18n in links & tabs feat: change component Loading feat: dectecttheme of system perf: better calc in the routes & navigation

## 2.1.1

### Patch Changes

- fix: repared error of deploy

## 2.1.0

### Minor Changes

- feat: extract vite.config.ts for used boltdocs.config.ts, support favicon, robots, ogImage

## 2.0.0

### Major Changes

- fix: secutity in build & production, repare error in build with virtual:boltdocs-layout
