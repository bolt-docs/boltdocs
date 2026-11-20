# @bdocs/unist-utils

## 0.3.0

### Minor Changes

- The type checker is clean, and the highlighting configuration has one type.

### Patch Changes

- The `unist` dependency is gone.
- Every package type checks.

## 0.2.1

### Patch Changes

- Make code syntax highlighting engine-agnostic: the core now renders via a `CodeHighlighterAdapter` resolved from a registry instead of calling Shiki directly.

## 0.2.0

### Minor Changes

- Phase 1 of the new plugin API.
