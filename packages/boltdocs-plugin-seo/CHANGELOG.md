# @bdocs/plugin-seo

## 2.0.0

### Minor Changes

- Move sitemap, robots.txt and route SEO metadata into `@bdocs/plugin-seo`.

### Patch Changes

- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.
- The engine depends on nothing but the contracts.
