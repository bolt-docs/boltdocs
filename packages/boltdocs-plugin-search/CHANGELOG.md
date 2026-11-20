# @bdocs/plugin-search

## 2.0.0

### Minor Changes

- Finish search: the `search:index` hook works, and two real engines ship.
- Move search document generation into `@bdocs/plugin-search`, and drop `flexsearch` from the core.

### Patch Changes

- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.
