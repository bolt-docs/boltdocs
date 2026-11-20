# @bdocs/plugin-rss

## 3.0.0

### Patch Changes

- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.
- The engine depends on nothing but the contracts.

## 2.0.3

### Patch Changes

- Fix RSS feeds not being generated: generate feeds on the reliable `build:generate` pipeline hook (absolute `outDir` after SSG finalizes) instead of the client-build-only `afterBuild` hook, bucket default-locale routes (`locale: undefined`) into the default-locale feed so `rss-en.xml` is not empty, resolve a relative `ctx.outDir` against `ctx.rootDir` in the compatibility fallback, and detect the page locale from any path segment (not just the first) so translated docs under a shared base (`/docs/es/...`) get the correct `rss-es.xml` link.
- Add Shiki languages/themes and zod dependencies, and refresh build configs.

## 2.0.2

### Patch Changes

## 2.0.1

### Patch Changes

## 2.0.0

### Patch Changes

## 1.0.0

### Patch Changes
