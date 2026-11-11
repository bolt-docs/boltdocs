---
'@bdocs/highlight': minor
'boltdocs': major
'@bdocs/processor-satteri': minor
'@bdocs/theme-neutral': patch
---

Replace the built-in Shiki highlighter with `@bdocs/highlight`, a Prism-based, dependency-free (no Oniguruma/WASM) syntax highlighter.

- The default `theme.codeHighlighting.engine` is now `highlight` (alias `light`). Code is tokenized with Prism grammars, emitted with line wrappers and `bd-token-*` classes themed via `--bdocs-code-*` CSS variables, and also keeps Prism `token` classes for theme flexibility.
- `boltdocs` no longer ships the Shiki adapter/transformers; Shiki packages move out of the core dependency graph. Custom engines remain supported through the engine-agnostic adapter/registry contract (`engine` as id, instance, or factory).
- `@bdocs/processor-satteri` resolves and pre-renders highlighting through the pluggable adapter/runtime.
