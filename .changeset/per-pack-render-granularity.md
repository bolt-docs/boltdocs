---
'@bdocs/ssg': patch
'boltdocs': patch
---

Per-pack render granularity: text-only edits re-render only the edited page's chunk pack instead of the whole site

- **Per-route render identity**: each route's identity is now the Sätteri chunk-pack hash (strategy 1.5 in `computeRouteClientAssetHash`), mixed with an SSR-bundle identity guard (entry/layouts/theme, page-body chunk and manifests excluded) and a stylesheet-identity guard. Layout/CSS edits still re-render everything — correctly; text edits don't.
- **Cache-hit entry-script rewrite**: a cache hit that survives a client rebuild rewrites the stale `app-*.js` URL embedded in the cached HTML to the fresh bundle's URL, instead of re-rendering the page.
- **Fixed an SSR/client race** in the virtual-module plugins: the client entry no longer reads the shared global resolved config (which the SSR build could overwrite last — client builds raced into the SSR branch, inlining `combined.mjs` and skipping the `search.json` asset). Per-call `ssr` resolution now uses `this.environment.config.consumer`.
- **`_rawContent` out of the client bundle**: full MDX source text no longer ships inside `virtual:boltdocs-routes`/`app-*.js` (~1.1MB smaller shared chunk). It's served lazily via `page-source.json` (fetched by CopyMarkdown at copy time, one session-cached request).
- Measured on the docs site: 1-page text edit re-renders 78/259 pages (was 259), no-op builds 0.5s, revert oscillation eliminated, ultra-warm fast path intact.
