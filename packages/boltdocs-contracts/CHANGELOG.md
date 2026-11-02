# @bdocs/contracts

## 0.1.0

### Minor Changes

- [`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Boltdocs 3.4.0 — architecture contracts and incremental build foundation.

  This release publishes the new `@bdocs/contracts` package as the framework-neutral
  contract layer for routes, plugin lifecycle, plugin definitions, highlighting,
  search documents, and configuration. Its first public version is **`0.1.0`**
  (kept pre-1.0 while 4.0 reshapes the seam). `boltdocs` now re-exports those
  contracts so the existing 3.x public API keeps working unchanged.

  Highlights:
  - introduce `@bdocs/contracts` with route, plugin, lifecycle, highlighting, and configuration contracts;
  - keep `boltdocs` exports backward compatible through re-exports;
  - make `@bdocs/processor-satteri` consume the shared lifecycle contract directly;
  - align `@bdocs/ssg` and `@bdocs/plugin-ask-ai` on the new contract boundary;
  - ship the Vite 8.1 toolchain alignment and the content-addressed SSG page cache;
  - avoid full-site re-render on a single page edit.
