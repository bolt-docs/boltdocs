---
'@bdocs/zig-critters': patch
'@bdocs/ssg': patch
---

Fix mobile layout rendering on desktop: critical CSS no longer drops every desktop `@media` block

Three extractor bugs shipped together produced an inline critical `<style>` with zero media queries. Because that style tag sits after the stylesheet `<link>`, its mobile-first base rules won the cascade over the full CSS forever — navbar, sidebar and docs layout rendered in their mobile form on desktop:

- **Escaped quotes killed the parser**: a selector like `.font-features-[\ 'ss01\',\'cv01\']` (escaped quotes are part of the identifier) was treated as a string start, swallowing the rest of the stylesheet to EOF. Every rule after it — including all desktop media queries, measured past ~52KB of a 115KB Tailwind bundle — was silently dropped. Escaped characters in selectors are now consumed as identifier data.
- **Layout selectors were excluded from the critical set**: navbar/sidebar/nav rules were hard-skipped, so desktop media queries whose only rules targeted them lost every child and the whole `@media` block was removed. They now match like any other selector.
- **Silent truncation from a fixed arena**: the WASM extractor allocated a fixed ~2MB scratch buffer derived from CSS size and discarded rules silently when it filled. It now grows with linear memory; extraction covers the full stylesheet.

Also:

- Critical-CSS budget default raised 24KB → 32KB: the old value was calibrated against the poisoned output (~17KB); honest extraction of the same docs site measures ~26KB, which the old default silently discarded.
- Cache format bumps (`ssg-cache.json` v3, critical-CSS disk cache v2) so persisted pages embedding the broken critical CSS re-render exactly once.

Measured on the boltdocs docs site: critical CSS 17.4KB → 26.6KB with 9 desktop `@media` blocks (previously 0); `lg:flex`, `md:px-*`, sidebar and navbar rules present in the inline critical CSS.
