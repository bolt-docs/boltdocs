# @bdocs/plugin-git-meta

## 1.0.0

### Minor Changes

- Add first-party git metadata plugins and wire the documented `routes:resolved` hook.

### Patch Changes

- The engine no longer ships the UI layer.
- Fixed a critical compatibility bug: the engine read the **monorepo root** package version (1.11.0) instead of its own (3.4.1) when checking plugin ranges.
- The engine depends on nothing but the contracts.
