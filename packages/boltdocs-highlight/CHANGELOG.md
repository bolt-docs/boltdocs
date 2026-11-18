# @bdocs/highlight

## 1.1.0

### Minor Changes

- 9a4c13b: Replace the built-in Shiki highlighter with `@bdocs/highlight`, a Prism-based, dependency-free (no Oniguruma/WASM) syntax highlighter.
  - The default `theme.codeHighlighting.engine` is now `highlight` (alias `light`). Code is tokenized with Prism grammars, emitted with line wrappers and `bd-token-*` classes themed via `--bdocs-code-*` CSS variables, and also keeps Prism `token` classes for theme flexibility.
  - `boltdocs` no longer ships the Shiki adapter/transformers; Shiki packages move out of the core dependency graph. Custom engines remain supported through the engine-agnostic adapter/registry contract (`engine` as id, instance, or factory).
  - `@bdocs/processor-satteri` resolves and pre-renders highlighting through the pluggable adapter/runtime.

### Patch Changes

- Updated dependencies [1413a37]
- Updated dependencies [5f7a09c]
- Updated dependencies [4fb6ed1]
- Updated dependencies [d80c6e1]
- Updated dependencies [cdd636a]
- Updated dependencies [4fb6ed1]
- Updated dependencies [80b8bba]
- Updated dependencies [94aebbc]
- Updated dependencies [cf79338]
- Updated dependencies [ffb5e55]
  - @bdocs/contracts@0.2.0
  - @bdocs/unist-utils@0.3.0
