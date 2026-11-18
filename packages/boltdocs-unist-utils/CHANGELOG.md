# @bdocs/unist-utils

## 0.3.0

### Minor Changes

- cf79338: The type checker is clean, and the highlighting configuration has one type.

  **The `CodeHighlightConfig` drift is gone.**

  Three packages declared the same configuration with three different shapes:
  the contract layer's open one, the pipeline's narrow one, and the processor's
  own copy. The engine produced the first and handed it to functions that
  expected the second, and the type checker said so — nine errors in the core,
  reported for months, in a package whose `tsc --noEmit` nobody ran.

  The contract layer's type is the public one and stays open by design: an
  engine with its own colour model cannot be enumerated. The pipeline's
  normalizer now reads that type and _narrows_ the theme to what it can use,
  dropping a theme it cannot read rather than passing it on as a pair of
  `undefined`s. The Shiki adapter does the same, and the cast that hid the
  problem is gone.

  **Two `tsconfig` files were not configuring anything.**

  `@bdocs/unist-utils` and `@bdocs/processor-satteri` extended the repository's
  root `tsconfig.json`, which is a solution file with no compiler options. The
  type checker fell back to its defaults — no `module`, no `target`, no
  `esModuleInterop` — and reported 39 errors that had nothing to do with the
  code, while hiding the real ones. Both packages now configure themselves, and
  the processor's 35 errors are 0.

  **The search index types are a type alias.**

  `SearchIndexParams` was an interface, and an interface has no implicit index
  signature, so it was not assignable to the `Record<string, unknown>` the hook
  chain threads its parameters through. The alias is, and the hook's own
  signature accepts it.

  **A renamed function was never updated.**

  `@bdocs/theme-neutral`'s code block read `stateIsHighlighted`, which was
  renamed to `isHighlighted` when the state module was split out. The call site
  had been broken since; the type checker had been reporting it.

  ### Evidence
  - `tsc --noEmit` is clean in the core, the runtime, the contracts, the
    primitives, the theme, the processor and the unist utils. The core went
    from 9 errors to 0, the processor from 35 to 0, the theme from 4 to 0.
  - Every package's tests pass; the documentation site builds.

### Patch Changes

- 5f7a09c: The `unist` dependency is gone.

  It pinned `unist@^3.0.0`, and no such version exists — the package's last
  release is 0.0.1. The dependency was only ever used for its types, and the
  package that carries them, `@types/unist`, was already a dependency. The
  code imports the types from `@types/unist` now.

  The pin made `pnpm install` fail for the whole workspace: the resolver
  stopped at `unist@^3.0.0` and never got to the rest of the tree.

- d80c6e1: Every package type checks.

  `tsc --noEmit` is now clean in all twenty-three packages that have a
  `tsconfig.json`. The core, the runtime, the contracts, the primitives, the
  theme, the processor, the unist utils, the SSG and every official plugin.

  ### Most of the errors were configuration, not code

  Eight packages extended the repository's root `tsconfig.json` — a solution
  file with no compiler options. The type checker fell back to its defaults: no
  `module`, no `target`, no `esModuleInterop`, no `jsx`. It reported 39 errors
  that had nothing to do with the code, and hid the real ones behind them.

  The base is now `tsconfig.base.json`, and the root solution file extends it so
  that a package which extends the root gets the same options as one that
  configures itself. The three plugins that had no `tsconfig` at all have one
  now.

  ### Two copies of Vite

  `@types/node` was a range in some packages and an exact version in others, and
  the version is part of the peer variant a package resolves against. Three
  copies of the same Vite were installed, and their `Plugin` types were not the
  same type. Every package now pins the same version, and there is one copy.

  ### Four bugs the type checker had been reporting for months
  - The Algolia plugin sent the batch action `delete`. Algolia's endpoint takes
    `deleteObject`; every stale-record removal would have failed.
  - The Tailwind and UnoCSS plugins wrapped the plugin list in another array.
    Vite flattens nested lists, so it worked — and the engine received a list of
    lists.
  - The Mermaid plugin passed an object to a class-name helper that only joins
    strings, which would have rendered `[object Object]` as a class.
  - The theme's code block called a function that was renamed when its state
    module was split out.

  ### A flake, fixed

  `@bdocs/plugin-ssg`'s critical-dependency test used `vi.doMock` with a dynamic
  import, and the mock only applied when the module had not been loaded yet —
  which depended on which test file ran first. The test resets the module
  registry now, and it passes in any order.

- Updated dependencies [1413a37]
- Updated dependencies [4fb6ed1]
- Updated dependencies [cdd636a]
- Updated dependencies [4fb6ed1]
- Updated dependencies [80b8bba]
- Updated dependencies [94aebbc]
- Updated dependencies [cf79338]
- Updated dependencies [ffb5e55]
  - @bdocs/contracts@0.2.0

## 0.2.1

### Patch Changes

- [`67e9a00`](https://github.com/bolt-docs/boltdocs/commit/67e9a00b410720bf21f5516c214c991d544b6e1e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Make code syntax highlighting engine-agnostic: the core now renders via a `CodeHighlighterAdapter` resolved from a registry instead of calling Shiki directly.
  - **`theme.codeHighlighting`**: new configuration surface (`engine`, `theme`, `options`) that replaces `theme.codeTheme`. Shiki remains the built-in default engine (`engine: 'shiki'`); any adapter instance or factory can be injected inline. A **string shorthand** is accepted — `codeHighlighting: 'shiki'` is equivalent to `{ engine: 'shiki' }`. `theme.codeTheme` still works as a deprecated alias resolving to `codeHighlighting.theme`. Single-string themes render single-theme output (no dual-mode CSS variables), and objects keep the dual light/dark `data-theme-mode="dual"` rendering.
  - **Highlighter registry** (`boltdocs/node/highlight`): `getCodeHighlighterAdapter()`, `registerHighlighter()` / `registerPluginHighlighter()`, and `prewarmHighlighter()`. Engines that are never selected cost nothing at runtime; the current engine is prewarmed during build and after the dev server starts. A broken or unresolvable engine falls back to Shiki with a warning instead of failing the build.
  - **Plugin field `codeHighlighter`**: plugins expose their engine under `plugin.name`, so `theme.codeHighlighting.engine` can select it by id.
  - **`options.regexEngine: 'oniguruma' | 'javascript'`** for the Shiki engine: the **JavaScript regex engine is now the default**, cutting highlighter startup from ~2.5s to ~200ms per compile-pool worker. Unsupported grammar regexes degrade approximately (`forgiving` mode) instead of failing. Pass `regexEngine: 'oniguruma'` for bit-exact TextMate fidelity on exotic grammars.
  - **Single grammar pass per code block**: the Sätteri rehype plugin serializes the highlighted HAST (`hast-util-to-html`) instead of re-running the grammar through `codeToHtml`, roughly halving highlighting CPU per block. `data-highlighted-html` output is byte-equivalent.
  - **Per-worker highlight cache**: identical `(lang, options, code)` blocks highlight once per long-lived compile-pool worker (LRU, 2000 entries) — repeated install commands and shared snippets across hundreds of pages are free.
  - **Grammar prewarm at pool start**: compile workers now prewarm with fenced blocks in every eager language, so grammar loading overlaps pool spin-up instead of running serially on the first pages.
  - The Sätteri rehype plugin is renamed to `satteriRehypeCodeHighlightPlugin` (`satteriRehypeShikiPlugin` kept as an alias) and emits engine-neutral `data-code-engine` / `data-theme-mode` attributes while keeping the `.shiki-*` classes for backwards compatibility.

## 0.2.0

### Minor Changes

- [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Phase 1 of the new plugin API. The unist/mdast/hast utilities that used to
  live in `boltdocs/node/plugins/plugin-utils` (visit helpers, builders,
  h-properties, class-list helpers) and the shiki-internal `parseMetaString`
  move into a new public package: **`@bdocs/unist-utils`**.

  For `boltdocs` core (no public-API impact): internal code now imports
  directly from `@bdocs/unist-utils`. The old paths
  (`boltdocs/node/plugins/plugin-utils` through barrel,
  `packages/boltdocs-engine/src/node/mdx/types`) keep working as a back-compat shim.

  `parseMetaString` and the `ParsedMeta` interface also moved; shiki-adapter
  re-imports them from the new package and the `__raw` field is now typed
  as `string | undefined`.

  The new package is `sideEffects: false`, ships with strict types end-to-end
  and is published under the standard Boltdocs organisation namespace so
  external plugin authors can adopt it directly. Migration notes for plugin
  authors live in `packages/boltdocs-unist-utils/README.md`.
