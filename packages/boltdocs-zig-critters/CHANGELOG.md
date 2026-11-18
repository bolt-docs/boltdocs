# @bdocs/zig-critters

## 0.3.0

### Minor Changes

- b595d7c: The critical-CSS extractor asks the page before it walks the elements.

  Matching a rule means trying it against every element of the page, and the
  stylesheet of the documentation site has fifteen hundred rules: a page spends
  more than a million attempts on a question that is almost always "no". Almost
  all of those attempts are hopeless before they start — a rule whose subject
  asks for a class the page does not have cannot match, and the page knows it.

  The extractor now builds a filter of the names the page has — every tag, class
  and id, each kind kept apart — and drops a rule without touching the elements
  when the name it needs is not there. The filter is a bitmap of hashes, not a
  set: a name that is absent can still be reported as possibly present, which
  costs the match it would have cost before. A name that is present is never
  reported as absent, so no rule that could match is ever dropped.

  | One extraction, 185 kB stylesheet | Before | After     |
  | --------------------------------- | ------ | --------- |
  | The documentation page            | 53 ms  | **12 ms** |
  | The home page                     | 52 ms  | **18 ms** |

  The output is byte-identical: all 260 pages of the documentation site, against
  the stylesheet the build actually produces, come out of both binaries with the
  same bytes.

  In the build of the documentation site, the critical-CSS extraction went from
  111 ms to 69 ms at the median and the finalise queue from 113 ms to 78 ms. The
  cold build went from 18.1 s to 17.3 s, measured back to back with three runs
  each.

  The extractor is Zig compiled to WebAssembly, so the WASM is rebuilt with this
  change. The build needs `wasm-ld` on the path — on this machine it lives in
  `/usr/lib/llvm21/bin` — and without it the WASM build fails and the previous
  binary is used.

- 35f7d82: The critical-CSS extractor parses the stylesheet once.

  It parsed the stylesheet on every page. Parsing is the expensive half: on a
  180 kB stylesheet it costs 91 ms, and matching it against one page costs
  44 ms. The stylesheet is the same for every page of a build, so the parse
  belonged to the build and the matching to the page.

  The stylesheet is now parsed once per extractor instance, and the tokenised
  selectors — which were also rebuilt per page — are shared with it.

  |                                   | Before       | After            |
  | --------------------------------- | ------------ | ---------------- |
  | One extraction, 180 kB stylesheet | 138 ms       | **23 ms**        |
  | The output                        | 23,950 bytes | **23,950 bytes** |

  The output is byte-identical: the same page extracted through both paths
  produces the same bytes.

  The cold build of the documentation site went from 24.7 s to 22.1 s, measured
  back to back on the same machine with three runs each.

  The extractor is Zig compiled to WebAssembly, so the WASM is rebuilt with this
  change. The build needs `wasm-ld` on the path — on this machine it lives in
  `/usr/lib/llvm21/bin` — and without it the WASM build fails and the previous
  binary is used.

## 0.2.3

### Patch Changes

- [`34f16ca`](https://github.com/bolt-docs/boltdocs/commit/34f16caa5e820538942471aeaa4611edf1de8ba2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Extractor binary identity now participates in render-cache and critical-CSS cache keys
  - **`getEngineIdentity()`** (new, `@bdocs/zig-critters`): returns a sha1 of the WASM binary so consumers can key caches on the extractor version.
  - **Render cache**: pages without a source file (synthetic routes like `/docs`, locale roots) keyed their identity on the client-bundle hash alone, so a rebuilt extractor never re-rendered them — they kept serving HTML with stale embedded critical CSS. The extractor identity is now mixed into the fallback identity for those routes and into every critical-CSS cache key; shipping a new extractor binary re-renders exactly the affected pages once.
  - Downgrades two pending changesets from `minor` to `patch` (critical-CSS budget config, highlighting SPI) to keep the release line patch-only.

- [`1a044a2`](https://github.com/bolt-docs/boltdocs/commit/1a044a209d03cf3d94528c1bc93cc14784518905) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix mobile layout rendering on desktop: critical CSS no longer drops every desktop `@media` block

  Three extractor bugs shipped together produced an inline critical `<style>` with zero media queries. Because that style tag sits after the stylesheet `<link>`, its mobile-first base rules won the cascade over the full CSS forever — navbar, sidebar and docs layout rendered in their mobile form on desktop:
  - **Escaped quotes killed the parser**: a selector like `.font-features-[\ 'ss01\',\'cv01\']` (escaped quotes are part of the identifier) was treated as a string start, swallowing the rest of the stylesheet to EOF. Every rule after it — including all desktop media queries, measured past ~52KB of a 115KB Tailwind bundle — was silently dropped. Escaped characters in selectors are now consumed as identifier data.
  - **Layout selectors were excluded from the critical set**: navbar/sidebar/nav rules were hard-skipped, so desktop media queries whose only rules targeted them lost every child and the whole `@media` block was removed. They now match like any other selector.
  - **Silent truncation from a fixed arena**: the WASM extractor allocated a fixed ~2MB scratch buffer derived from CSS size and discarded rules silently when it filled. It now grows with linear memory; extraction covers the full stylesheet.

  Also:
  - Critical-CSS budget default raised 24KB → 32KB: the old value was calibrated against the poisoned output (~17KB); honest extraction of the same docs site measures ~26KB, which the old default silently discarded.
  - Cache format bumps (`ssg-cache.json` v3, critical-CSS disk cache v2) so persisted pages embedding the broken critical CSS re-render exactly once.

  Measured on the boltdocs docs site: critical CSS 17.4KB → 26.6KB with 9 desktop `@media` blocks (previously 0); `lg:flex`, `md:px-*`, sidebar and navbar rules present in the inline critical CSS.

## 0.2.2

### Patch Changes

- [`8b7a4f8`](https://github.com/bolt-docs/boltdocs/commit/8b7a4f8ef18f787735cca6c273f300e0dc2e9f30) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Faster critical CSS extraction (zig-critters): worker-threads pool, resident WASM CSS, single-pass injection
  - **Worker-threads pool**: each pool worker owns a private WASM instance (up to `min(availableParallelism, 8)`, capped by render concurrency), so pages extract in parallel instead of queuing on one process-global instance. The serial API remains as fallback.
  - **Resident CSS in WASM memory**: the stylesheet is encoded and copied into each instance once per build (cached by string reference) instead of once per page.
  - **Single-pass injection**: the SSG render path wraps the extraction result itself, removing the previous inject-then-regex-extract double scan of every page and fixing a `'\\n'` literal-join bug in multi-tag extraction.
  - **Cheaper cache keys**: the stylesheet is hashed once per build and the digest is passed to `createCriticalCssCacheKey` (internal), removing a repeated O(css) SHA-256 per page.
  - **Correctness fixes**: the legacy `turbo` option now actually enables zig-critters (it previously resolved to disabled); the critters pool is disposed at build end; and dropped extractions now warn instead of failing silently when critical CSS exceeds the default 8 KB `maxSize` budget.

  Measured on the docs site (259 pages, identical client bundle): critters p50 468ms → 210ms, p95 1644ms → 1064ms, render phase 82.9s → 34.0s, with byte-identical critical CSS output.

## 0.2.1

### Patch Changes

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Update beasties and selector Zig sources with WASM types.

## 0.2.0

### Minor Changes

- [`491cf14`](https://github.com/bolt-docs/boltdocs/commit/491cf14de05bb06757047b301c88448a25880406) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Smart Selector Filtering & Size Budget**:
  - Exclude layout-related classes (sidebar, navbar, toc, etc.) from critical CSS inlining.
  - Exclude complex selectors (> 2 parts) natively in Zig.
  - Implement an 8 KB size budget in JS to discard critical CSS if the payload is too large.
