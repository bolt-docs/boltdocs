# @bdocs/ssg

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
