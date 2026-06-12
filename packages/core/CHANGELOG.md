# boltdocs

## 2.9.1

### Patch Changes

- [`85cf6ba`](https://github.com/bolt-docs/boltdocs/commit/85cf6baf7dcfd2bee3952d44f250d309bb955fea) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Refactor main Node entrypoint imports to use dynamic imports for heavy build-time dependencies, preventing runtime crashes in Vercel serverless functions.

## 2.9.0

### Minor Changes

- [`b819f24`](https://github.com/bolt-docs/boltdocs/commit/b819f240fa420d873db0e0f3ff0443e6ff1a3e7b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **boltdocs (Minor)**:
  - Extracted the `@bdocs/dui` toolkit as a standalone terminal UI package.
  - Added native feedback integrations supporting Vercel, Netlify, and AWS Lambda adapters.
  - Supported the new `transformSource` plugin lifecycle hook for custom Remark/Rehype preprocessing.
  - Added new CLI dev server flags: `--port`, `--host`, and `--force`.
  - Implemented Phase 0 performance optimizations: deduplicated dev config resolution, instant dev server prewarming, pre-loaded Shiki highlighter during plugin configuration, and added debounced `TransformCache` index persistence.
  - Fixed collection routes provider wrapping at the global shell level, corrected `cover` frontmatter fallbacks, and updated outdated collections hook documentation examples.
  - **create-boltdocs (Minor)**:
    - Completed a full rewrite of the scaffolding CLI templates using the `@bdocs/dui` terminal package.
    - Added integration setup helpers and automated deployment adapters.
  - **@bdocs/plugin-image-optimizer (Minor)**:
    - Added the `@bdocs/plugin-image-optimizer` package to automatically optimize and cache WebP/SVG/PNG assets during static build compilation.
  - **@bdocs/plugin-mermaid (Patch)**:
    - Performance optimizations to prevent Mermaid scripts from blocking client rendering.

### Patch Changes

- Updated dependencies [[`b819f24`](https://github.com/bolt-docs/boltdocs/commit/b819f240fa420d873db0e0f3ff0443e6ff1a3e7b)]:
  - @bdocs/plugin-image-optimizer@0.2.0

## 2.8.4

### Patch Changes

- [`5fb0685`](https://github.com/bolt-docs/boltdocs/commit/5fb06852bfbd94e84cd502f5e874acd1e5f6d947) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: solve various bugs including theme flashing, i18n sidebar disappearing/duplication, upgrade check reliability, CLI port/host support, and create-boltdocs project name argument support.

  Specifically for i18n, sidebar, and fallback route routing:
  - Refactored `useSidebar` to perform hierarchical tree calculations cleanly without mutations.
  - Filtered out fallback redirect routes in `useSidebar` via the `fallback` route property to eliminate duplicate entries in the sidebar.
  - Preserved `filePath` properties on index/container route nodes so that client-side language switching and active link highlighting operate correctly.

## 2.8.3

### Patch Changes

- [`af3a19c`](https://github.com/bolt-docs/boltdocs/commit/af3a19c8836b0712ac186ba99d4987d828945612) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Revert base path configuration override in Vite plugin to restore correct asset routing and fix 404 errors in production.

## 2.8.2

### Patch Changes

- [`d55094d`](https://github.com/bolt-docs/boltdocs/commit/d55094db2b7afe4d7e00e2477d08483647ec1d8d) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix SSR rendering error with i18n configurations by safely guarding route path accesses on index/fallback routes. Correctly write performance metrics to build output directory.

- Updated dependencies [[`d55094d`](https://github.com/bolt-docs/boltdocs/commit/d55094db2b7afe4d7e00e2477d08483647ec1d8d)]:
  - @bdocs/ssg@0.1.1

## 2.8.1

### Patch Changes

- [`bbba61c`](https://github.com/bolt-docs/boltdocs/commit/bbba61c7351e56d138bd5957f236f0036e3bbe28) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared style of block-code

## 2.8.0

### Minor Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Route-level code splitting**: MDX pages are now lazy-loaded on demand client-side using dynamic imports, with background prefetching in idle time and parallelized compilation pre-warming.
  - **Diagnostic performance budgets**: Added checks for bundle and page HTML sizes, image/font counts, and build times under a new `checks.performance` configuration in `doctor.json`, run via `boltdocs doctor --budget`.
  - **Plugin system simplification & safety**: Removed complex dynamic sandboxes and the `permissions` configuration. Added chain-pattern MDX/HTML transformation hooks (`transformMdx` and `transformHtml`), simplified available lifecycle hooks, and automated file-system access containment warnings.
  - **Strict route path typing**: Introduced compiler-generated route path maps to support type-safe autocomplete for navigation navbar/sidebar definitions and custom Link components.
  - **Directory caches reorganised**: Re-structured `.boltdocs/` internal metadata caches into specific `build/`, `cache/`, `generated/`, and `reports/` subdirectories.
  - **Codeblock destructuring & plugin utils**: Refactored traversal helper functions to run across generic AST formats. Fixed React DOM warnings on code block node attributes.
  - **Bug Fix**: Fixed a config loader exception by correctly exporting `MDX_NODES` from the core entry point.
  - **Miscellaneous improvements**: Configured `react-router-dom` in server-side bundling to prevent SSR load exceptions, added horizontal overflow scrolling for tabs, and improved mobile layout padding.

### Patch Changes

- Updated dependencies [[`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32), [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32)]:
  - @bdocs/dui@0.1.2
  - @bdocs/ssg@0.1.0

## 2.7.11

### Patch Changes

- [`1182df9`](https://github.com/bolt-docs/boltdocs/commit/1182df9a1964409da9e0e4b7b1977f9ec887e4aa) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Exclude src/client from published files, point Tailwind @source to dist, disable minify for client build

## 2.7.10

### Patch Changes

- [`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat(dui): add `configure()`/`getConfig()` for runtime identity — log prefix, server box titles, and update command are now configurable at the CLI entry point instead of hardcoded. fix(dui): default `updateCommand` corrected from `@bdocs/dui` to `boltdocs`. fix(dui): `stripAnsi()` now handles OSC hyperlinks and CSI cursor sequences, not just SGR colors. refactor(dui): `devServer()`/`previewServer()` consolidated via shared `buildServerBox()` helper. chore(dui): `padLeft` renamed to `padRight` for clarity. chore(dui): comprehensive tests added for logger, config, confirm, and formatLog. fix(ssg): missing kolorist-to-dui migration in `build.ts` (`dim`, `cyan`, `green`, `gray`, `red` bare calls) resolved — fixes runtime `ReferenceError: gray is not defined`. fix(core): `dev-server.ts` `console.error('[boltdocs]')` → `dui.error()`; `cli-entry.ts` adds `configure()` call.

- [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Remove `ansiCodes` raw ANSI export from `@bdocs/dui`. Core CLI `ui.ts` now re-exports `dui.colors` (picocolors) directly — no more ANSI escape code usage anywhere. `formatLog` and `confirm` use picocolors functions.

- [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix picocolors usage across `@bdocs/dui` (use function calls instead of template literal interpolation). Add `ansiCodes` export for backward-compatible raw ANSI sequences. Migrate doctor output to use `@bdocs/dui` — replace raw ANSI with picocolors functions and use `dui.box.double()` for diagnosis summary.

- [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Complete migration from `ui.ts` wrapper to direct `@bdocs/dui` imports across core. Move `confirm`/`formatLog` into dui. Remove `ui.ts` entirely. Phase 3: migrate changelog generator output to dui logger/box.

- [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Create `@bdocs/dui` terminal UI package with boxes, logger, lists, and dividers. Wire into core CLI (`ui.ts`) and update-check (`update-check.ts`).

- Updated dependencies [[`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a), [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72), [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0), [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133), [`36a7d09`](https://github.com/bolt-docs/boltdocs/commit/36a7d093a0304620ddaed6c2ed8616edbaa62987), [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18)]:
  - @bdocs/dui@0.1.1
  - @bdocs/ssg@0.0.7

## 2.7.9

### Patch Changes

- [`d600cdf`](https://github.com/bolt-docs/boltdocs/commit/d600cdf1086009762409323802c9b7302bb327df) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix false positive "broken internal link" reports for URLs inside fenced code blocks and inline code in the `boltdocs doctor` command. The link checker now strips code block content before scanning for links, preventing demo/example code from being treated as actual broken links.

- [`ac10e5b`](https://github.com/bolt-docs/boltdocs/commit/ac10e5be26a93a5ca2403f72a670b806461cbc20) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix duplicate sidebar links caused by fallback metadata entries copying `filePath` and `slugParts` from the original route. The fallback entry now sets `filePath: ''` and `slugParts: []` so the sidebar code skips it.

- [`ae0d6ad`](https://github.com/bolt-docs/boltdocs/commit/ae0d6ad51ba81b83f6d9ef45e310133c7072d883) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Rewrite README with benchmark comparisons, tech stack showcase, detailed features with code examples, ecosystem table, roadmap, and improved structure. Add README to `packages/core/` for npm package display.

- [`9e7094d`](https://github.com/bolt-docs/boltdocs/commit/9e7094d2e5ebc2e0b7f14cce0fb61ee9f69b5db3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Show update notification when a new version of boltdocs is available. The `dev`, `build`, and `doctor` commands now check the npm registry and display a colored box with the current and latest version when an upgrade is available.

- Updated dependencies [[`ee67a51`](https://github.com/bolt-docs/boltdocs/commit/ee67a5141282d4cbc9db0cf839c2073364f3f44a)]:
  - @bdocs/ssg@0.0.6

## 2.7.8

### Patch Changes

- [`09b3cbf`](https://github.com/bolt-docs/boltdocs/commit/09b3cbf21553cdcf24afbfd03fb6c9f8391a0b6a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix React 19 hydration mismatches and route duplication/double-rendering on subpage refreshes by configuring the router's basename, prepending the basename prefix during SSR query rendering, and extracting/inlining static router hydration data into the head.

- [`cbb1914`](https://github.com/bolt-docs/boltdocs/commit/cbb1914745217fe66e0c5854c2d592b521a1b26b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Switch to flat HTML output (`about.html` instead of `about/index.html`), generate own `__staticRouterHydrationData` script, sanitize hydration data, and fix fallback route index handling for docs base path. This resolves hydration mismatches and page duplication on subpage refresh across all deployment platforms.

- Updated dependencies [[`f0c9703`](https://github.com/bolt-docs/boltdocs/commit/f0c9703e9b568c03ddfe5061bb0faa1942c84b4f), [`09b3cbf`](https://github.com/bolt-docs/boltdocs/commit/09b3cbf21553cdcf24afbfd03fb6c9f8391a0b6a), [`cbb1914`](https://github.com/bolt-docs/boltdocs/commit/cbb1914745217fe66e0c5854c2d592b521a1b26b)]:
  - @bdocs/ssg@0.0.5

## 2.7.7

### Patch Changes

- [`b5e54f1`](https://github.com/bolt-docs/boltdocs/commit/b5e54f16e9b792f4c3616ad7a3ee368f4a1a8fda) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix empty page on docs base path redirects, breadcrumbs, TOC, and active sidebar link highlight.
  Fix hydration crash and caching bug for static loader data in production by adding cache-busting query parameters and safe JSON fetch handling.
- Updated dependencies [[`b5e54f1`](https://github.com/bolt-docs/boltdocs/commit/b5e54f16e9b792f4c3616ad7a3ee368f4a1a8fda)]:
  - @bdocs/ssg@0.0.4

## 2.7.6

### Patch Changes

- [`e5e5ebb`](https://github.com/bolt-docs/boltdocs/commit/e5e5ebbf370acdeb9eaab77a296f37493f7b5d0f) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve SSG route resolution causing home page content to leak into all routes

- Updated dependencies [[`e5e5ebb`](https://github.com/bolt-docs/boltdocs/commit/e5e5ebbf370acdeb9eaab77a296f37493f7b5d0f)]:
  - @bdocs/ssg@0.0.3

## 2.7.5

### Patch Changes

- [`b9af040`](https://github.com/bolt-docs/boltdocs/commit/b9af040f70158409ae563b2b6776efa6d3607707) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - perf: refine incremental build caching and fix loader hash stability
  fix: ensure docs layout wrapper is constrained to the base docs path to prevent hijacking external routes (like homepage/about) during client-side hydration.

## 2.7.4

### Patch Changes

- [`2ca7562`](https://github.com/bolt-docs/boltdocs/commit/2ca7562b7f6b95955426afdbf15b94b82b5d3e60) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve config syntax and ssr optimizeDeps interop

## 2.7.3

### Patch Changes

- [`ca0f95a`](https://github.com/bolt-docs/boltdocs/commit/ca0f95a1e34289c5f591497d513786fd2917ff4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve CJS/ESM interop issues for react-fast-compare and react-router-dom - Add react-fast-compare to optimizeDeps.include (browser) and ssr.optimizeDeps.include (SSR) to fix missing default export - Add react-router-dom to ssr.noExternal to fix 'module is not defined' in Vite 8 SSR module runner - Apply same fixes to plugin config hook for consumer-side usage

## 2.7.2

### Patch Changes

- [`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - perf(core): Improved performance in warm

- Updated dependencies [[`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75)]:
  - @bdocs/ssg@0.0.2

## 2.7.1

### Patch Changes

- [`044ce18`](https://github.com/bolt-docs/boltdocs/commit/044ce18cf54812e486f0af0befdf952e26ebb2f9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error of ssg

## 2.7.0

### Minor Changes

- [`b04fce4`](https://github.com/bolt-docs/boltdocs/commit/b04fce42678230b607adcde349e8bb95f6dca1f3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **feat**: Added support for `lastUpdated` property in documentation pages.
  - **feat**: Significant performance improvements in documentation parsing through a new caching parser.
  - **feat**: Doctor is now stable.
  - **feat**: Added banner on site home page.
  - **feat**: Added Google Analytics 4 support & Google Tag Manager support.
  - **feat**: Added Changelog Generator. he UI to have a better look.
  - **feat**: Updated File-Routing to support new features. - Support Deeper Nested routes - Support metadata file naming (meta.json & \_meta.json) - Support collapsible/collapsed directories - Support custom directory icons
  - **feat**: Added `base` support for base-url routing.
  - **feat**: Added custom-frontmatter & extended MDX frontmatter support.
  - **feat**: Search highlight now works with accents & Mark search works on dynamic content.
  - **fix**: Improved mobile support and responsive layout consistency across the site.
  - **fix**: Resolved styling issues and improved integration for Mermaid diagrams.
  - **fix**: Corrected locale labels in example projects.
  - **fix**: Optimized Tabs and Navbar components to reduce unnecessary re-renders.
  - **fix**: Removed config prop from CopyMarkdown component.
  - **fix**: Removed the need to define `homePage` in `boltdocs.config.ts` when using `pages-external/index.tsx` for a custom home page.
  - **fix**: Added export code-block support for Custom Components.

## 2.6.2

### Patch Changes

- [`2960c55`](https://github.com/bolt-docs/boltdocs/commit/2960c5523040723f2389568b5e72866875617789) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared bug collision pages & navigation
  fix: repared bug 404 when switch version in home
  feat: support types-generator for better autocomplete

## 2.6.1

### Patch Changes

- [`bdc7634`](https://github.com/bolt-docs/boltdocs/commit/bdc7634239ba5e220a4b1fe2792aaa66e6944e46) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: error in developer in build

## 2.6.0

### Minor Changes

- [`6a6d829`](https://github.com/bolt-docs/boltdocs/commit/6a6d82941328c1f2c016781d8d0f004d3a890237) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: new engine ssg
  feat: line-number & word-wrap in code-block
  feat: support languagues rust & toml
  fix: removed ogImage
  feat: support seo granular configuration in frontmatter & config
  fix: removed shadow image
  fix: support detect xml in sitemap
  fix: removed hover in field
  style: updated Admonition styles
  fix: removed style uppercase in sidebar & onthispage
  fix: repared warning each child of react key
  feat: support icons external

## 2.5.6

### Patch Changes

- [`5236e13`](https://github.com/bolt-docs/boltdocs/commit/5236e1379f94699bbbb176826b6eabb4dbb8faa7) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error in mode developer

## 2.5.5

### Patch Changes

- [`c31cfe3`](https://github.com/bolt-docs/boltdocs/commit/c31cfe3777e77b4ef0290aa726696b493f9c51db) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - repared error use-external

## 2.5.4

### Patch Changes

- [`7477d85`](https://github.com/bolt-docs/boltdocs/commit/7477d85ee486af85cdae0ca26aba67ae9071cce9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: added use-async-external-store with in optimizeDeps

## 2.5.3

### Patch Changes

- [`613b4b7`](https://github.com/bolt-docs/boltdocs/commit/613b4b7c256b2dec3af6d2aa7eb00f1b9a9beea1) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - removed integrations of config

## 2.5.2

### Patch Changes

- [`862634f`](https://github.com/bolt-docs/boltdocs/commit/862634fb0df4e10112877e05e31b12ce7a4f480e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - removed sandbox integrations

## 2.5.1

### Patch Changes

- [`6f47dae`](https://github.com/bolt-docs/boltdocs/commit/6f47dae6a572e1d2ec8c28e56c648ab2db7b96d5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - repared error show visible CodeBlock & repared error components Plugins

## 2.5.0

### Minor Changes

- [`de41957`](https://github.com/bolt-docs/boltdocs/commit/de4195754bbb6dea90cbcd91e1ae3ddc398a8fdb) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Updated imports to simples, support CPS, Support External-Page with file

### Patch Changes

- [`f54fc62`](https://github.com/bolt-docs/boltdocs/commit/f54fc62982411e893beeccb2ebcb20d7a4925bdd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - export types of plugins, Config & theme

## 2.4.2

### Patch Changes

- [`3073b74`](https://github.com/bolt-docs/boltdocs/commit/3073b747b9bd90e154c24758b5a502dfe51c043e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error in build with virtual-imports

## 2.4.1

### Patch Changes

- [`80de4bd`](https://github.com/bolt-docs/boltdocs/commit/80de4bd49c3de90ec234148c8077b479935db2cf) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - updated width with pathname

- [`c49cefa`](https://github.com/bolt-docs/boltdocs/commit/c49cefa292075606ae626826a890a93bda939ba5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - added name tabs in URLs & repared icons size

## 2.4.0

### Minor Changes

- [`0ee1f85`](https://github.com/bolt-docs/boltdocs/commit/0ee1f8525500ca6b6dc1eb78260fc257b3698fd4) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Support icons & title CodeBlock, Better Scroll, export Skeleton Component

## 2.3.0

### Minor Changes

- [`5d53fd0`](https://github.com/jesusalcaladev/boltdocs/commit/5d53fd0eddbcc0e22b092f52cea82df78063376b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: added new primitives `Skeleton`
  feat: added new loading with `Skeleton` primitives
  feat: added new command `boltdocs doctor` for diagnostic your project
  feat: support full-text search
  fix: better calc in page-nav

## 2.2.0

### Minor Changes

- [`766daf2`](https://github.com/jesusalcaladev/boltdocs/commit/766daf21becafaa173a65cc8bea4d31b32ce8640) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: support i18n in links & tabs
  feat: change component Loading
  feat: dectecttheme of system
  perf: better calc in the routes & navigation

## 2.1.1

### Patch Changes

- [`1ce39bb`](https://github.com/jesusalcaladev/boltdocs/commit/1ce39bbe07974f35f6a04c341c5578c337f37024) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error of deploy

## 2.1.0

### Minor Changes

- [`06650d4`](https://github.com/jesusalcaladev/boltdocs/commit/06650d458c26c7bbf4cc2da7ea6bec6352c0c530) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: extract vite.config.ts for used boltdocs.config.ts, support favicon, robots, ogImage

## 2.0.0

### Major Changes

- [`105352e`](https://github.com/jesusalcaladev/boltdocs/commit/105352efc13f081c5fdb6bbcad11891be78f87a7) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: secutity in build & production, repare error in build with virtual:boltdocs-layout
