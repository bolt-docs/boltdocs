---
'@bdocs/plugin-rss': patch
---

Fix RSS feeds not being generated: generate feeds on the reliable `build:generate` pipeline hook (absolute `outDir` after SSG finalizes) instead of the client-build-only `afterBuild` hook, bucket default-locale routes (`locale: undefined`) into the default-locale feed so `rss-en.xml` is not empty, resolve a relative `ctx.outDir` against `ctx.rootDir` in the compatibility fallback, and detect the page locale from any path segment (not just the first) so translated docs under a shared base (`/docs/es/...`) get the correct `rss-es.xml` link.
