---
'boltdocs': patch
'@bdocs/ssg': patch
---

Lazy external pages: marketing pages no longer ship inside the docs entry bundle

- External pages registered through `pages-external` (landing, about, showcase,
  roadmap) can now be declared as dynamic `loader`s instead of static
  `component` imports. Both mechanisms wrap the page in `React.lazy` with the
  same `record.lazy` flow MDX pages already use: the SSG pre-renders the real
  HTML server-side and the client hydrates when the lazy chunk arrives, so
  there is no flash of empty content.
- The generated entry now emits dynamic imports for file-routed external pages.
- The docs site converts its `pages-external/index.tsx` map to loaders.
- Measured on the docs site: entry chunk 1,239 KB → 1,023 KB raw (338 → 266 KB
  gz, −21%); the landing component tree now loads on demand as its own chunk.
- Landing hero WebGL effect (LightRays) capped: dpr 1, 30 fps, paused while the
  tab is hidden, and disabled under `prefers-reduced-motion`.
