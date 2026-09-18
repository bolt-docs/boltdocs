---
'boltdocs': patch
'@bdocs/ssg': patch
---

Make the critical-CSS inline budget configurable and raise the default so real sites actually get inline critical CSS.

- **`ssg.criticalCssMaxSize`** (new config option, bytes): per-page budget for the `<style data-zig-critters>` block. Pages whose extracted critical CSS exceeds the budget skip inlining (with a build warning naming the page and sizes).
- **Default raised from 8KB to 24KB**: the engine's inherited 8KB budget silently discarded the critical CSS of real docs sites — the boltdocs docs site measures 16–18KB per page, so every page shipped with no inline critical CSS. With the new default the docs build inlines critical CSS on all pages again (direct LCP/FCP win; render-blocking CSS no longer blocks first paint).
- Zig-critters 0.2.x users outside boltdocs are unaffected; the WASM `maxSize` contract is unchanged, boltdocs now passes the budget explicitly.
