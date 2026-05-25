# @bdocs/ssg

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
