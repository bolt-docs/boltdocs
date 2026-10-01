---
'@bdocs/contracts': minor
'@bdocs/processor-satteri': minor
'@bdocs/ssg': minor
'@bdocs/plugin-ask-ai': minor
'boltdocs': minor
---

Boltdocs 3.4.0 — architecture contracts and incremental build foundation.

This release publishes the new `@bdocs/contracts` package as the framework-neutral
contract layer for routes, plugin lifecycle, plugin definitions, highlighting,
search documents, and configuration. `boltdocs` now re-exports those contracts so
the existing 3.x public API keeps working unchanged.

Highlights:

- introduce `@bdocs/contracts` with route, plugin, lifecycle, highlighting, and configuration contracts;
- keep `boltdocs` exports backward compatible through re-exports;
- make `@bdocs/processor-satteri` consume the shared lifecycle contract directly;
- align `@bdocs/ssg` and `@bdocs/plugin-ask-ai` on the new contract boundary;
- ship the Vite 8.1 toolchain alignment and the content-addressed SSG page cache;
- avoid full-site re-render on a single page edit.
