---
'@bdocs/ssg': patch
'@bdocs/zig-critters': patch
---

Extractor binary identity now participates in render-cache and critical-CSS cache keys

- **`getEngineIdentity()`** (new, `@bdocs/zig-critters`): returns a sha1 of the WASM binary so consumers can key caches on the extractor version.
- **Render cache**: pages without a source file (synthetic routes like `/docs`, locale roots) keyed their identity on the client-bundle hash alone, so a rebuilt extractor never re-rendered them — they kept serving HTML with stale embedded critical CSS. The extractor identity is now mixed into the fallback identity for those routes and into every critical-CSS cache key; shipping a new extractor binary re-renders exactly the affected pages once.
- Downgrades two pending changesets from `minor` to `patch` (critical-CSS budget config, highlighting SPI) to keep the release line patch-only.
