# @bdocs/plugin-search-algolia

## 2.0.0

### Minor Changes

- Finish search: the `search:index` hook works, and two real engines ship.

### Patch Changes

- Every package type checks.
- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.
- The engine depends on nothing but the contracts.
