---
'boltdocs': patch
'@bdocs/plugin-math': patch
---

Entry bundle diet: KaTeX baked at build time, FlexSearch loaded on demand

- The math plugin's `transformSource` hook now renders TeX with KaTeX during
  the build and emits `<BlockMath html={...}>` / `<MathComponent html={...}>`
  carrying the pre-rendered HTML. Client math components render the baked
  `html` synchronously; direct MDX usage without the bake falls back to an
  on-demand `import('katex')` (raw TeX stays visible until it resolves, so
  SSR and the first client render agree). The ~250 KB of KaTeX no longer
  ships in the entry bundle of every page.
- FlexSearch is imported dynamically when the search dialog opens instead of
  statically at startup (~49 KB out of the entry).
- Measured on the docs site: entry chunk 1,023 KB → 718 KB raw (266 → 172 KB
  gzipped, −35%); KaTeX and FlexSearch now load as on-demand chunks.
