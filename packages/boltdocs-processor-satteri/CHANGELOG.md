# @bdocs/processor-satteri

## 1.0.0

### Minor Changes

- 4fb6ed1: Make the highlighter pipeline genuinely engine-agnostic.

  The registry already accepted any adapter — `theme.codeHighlighting.engine` takes a string id, an adapter instance or a factory, and `registerPluginHighlighter` lets a plugin add one. That part was true. The _render pipeline_ was not: two of its paths assumed the engine was Shiki, and Shiki was the only engine registered, so nothing ever exercised them.

  Both are now covered by tests that use a fake engine, because a test against Shiki proves nothing about agnosticism — Shiki satisfies every accidental requirement the pipeline happens to have.

  ## `lang: 'plaintext'` was a Shiki convention sent to arbitrary engines

  When a grammar failed to load, the pipeline degraded the block by re-rendering it with `lang: 'plaintext'`. That id is Shiki's: its name for a grammar with no rules. An engine that has never heard of it throws — so the code written to rescue a broken code block failed the same way the block did.

  ```ts
  // before — reached for a language id the contract never defined
  const plainHast = highlighter.codeToHast(codeText, {
    ...options,
    lang: "plaintext",
  });
  ```

  `CodeHighlighterAdapter` now carries the capability instead:

  ```ts
  interface CodeHighlighterAdapter {
    renderPlaintext?(
      code: string,
      options: Record<string, unknown>,
    ): Promise<string>;
  }
  ```

  Optional, so an adapter never has to implement it. The framework falls back to an escaped `<pre>` when it is absent — already correct, and better than asking a third-party engine to speak a dialect it was never taught.

  ## `shiki-fallback` named the default engine in the markup

  The last-resort class was `shiki-fallback`, and `reset.css` keyed 28 rules off `.shiki`. Every non-Shiki engine was a guest in Shiki's stylesheet.

  State is now expressed as data:

  ```html
  <pre data-code-state="highlighted" data-code-engine="shiki" …></pre>
  ```

  `.shiki-fallback` is kept as a CSS alias, alongside the aliases this file already carried for `data-theme-mode`, `data-line-numbers` and `data-word-wrap`. A theme styles the attribute and never needs to know which engine ran.

  ## `CodeTheme` is open

  ```ts
  export type CodeTheme =
    | string
    | { light: string; dark: string }
    | { tokens: Record<string, string> }
    | Record<string, unknown>;
  ```

  An engine with semantic tokens or a CSS custom-property palette cannot be expressed by a name or a light/dark pair. Narrowing the union to enumerate engines would make every future engine a breaking change to the framework, which is backwards.

  ## What the tests found

  Writing the CSS assertion first surfaced a fourth leak that was not in the plan: `pre span.shiki-line-highlight` was the one rule in `reset.css` with no neutral counterpart. It now pairs with `[data-line-highlight]`, and `tests/node/highlight-styles.test.ts` fails on any future `.shiki` selector that has no neutral form — which is exactly the regression that would quietly make the stylesheet Shiki-only again.

  **Verified:** 1002 core tests, 36 contract tests, 120 Sätteri tests, 257 documentation pages with byte-identical highlighting and `data-code-state="highlighted"` present in the output.

- 9a4c13b: Replace the built-in Shiki highlighter with `@bdocs/highlight`, a Prism-based, dependency-free (no Oniguruma/WASM) syntax highlighter.
  - The default `theme.codeHighlighting.engine` is now `highlight` (alias `light`). Code is tokenized with Prism grammars, emitted with line wrappers and `bd-token-*` classes themed via `--bdocs-code-*` CSS variables, and also keeps Prism `token` classes for theme flexibility.
  - `boltdocs` no longer ships the Shiki adapter/transformers; Shiki packages move out of the core dependency graph. Custom engines remain supported through the engine-agnostic adapter/registry contract (`engine` as id, instance, or factory).
  - `@bdocs/processor-satteri` resolves and pre-renders highlighting through the pluggable adapter/runtime.

- 5f7a09c: Vite 8.3.5, and only Vite 8.3.

  The framework now builds on Vite 8.3.5 and requires it. The peer dependency
  range moved from `^8.1.0` to `^8.3.0`, so a site on Vite 8.1 or 8.2 has to
  update before it can install the new Boltdocs.

  Two version checks went away with it, because the versions they served no
  longer exist:
  - The build used to choose between `build.rolldownOptions` and
    `build.rollupOptions` depending on the installed Vite. Vite 8 is Rolldown,
    and the two option names are not interchangeable — the options moved with
    the bundler, not with the options — so the check only ever chose the wrong
    one for a Vite it did not support anyway.
  - The build used to look for the manifests in the output root on Vite before
    5, which had no `.vite` directory. There is no such Vite left to support.

  The output does not change: the documentation site's 260 pages are byte for
  byte identical across the two versions, and the client bundle grows by four
  bytes.

  `@types/node` moved from 22.0.0 to 22.12.0 across the workspace, which is
  what Vite 8.3 asks for, and an override pins it so the whole tree resolves
  one copy.

- ffb5e55: A user plugin's MDX hook can be rebuilt in a build worker, so a site with one keeps its parallel MDX compile.

  A remark or rehype plugin is a function, and a function cannot cross a worker
  boundary. A site with such a plugin therefore compiled its MDX on the main
  thread, one page at a time, while the rest of the machine waited. On the
  documentation site — 234 pages, with the Mermaid plugin transforming code
  blocks — that was 6.4 s of the build on one core.

  A plugin can now declare the same hook for a worker:

  ```ts
  export default function mermaidPlugin(options: MermaidPluginOptions = {}) {
    return {
      name: "boltdocs-plugin-mermaid",
      remarkPlugins: [[remarkMermaid, remarkOptions]],
      workerHooks: {
        remark: [
          {
            module: "@bdocs/plugin-mermaid",
            export: "remarkMermaid",
            options: remarkOptions,
            kind: "code",
            language: "mermaid",
            component: "Mermaid",
          },
        ],
      },
    };
  }
  ```

  The worker imports the module from the project — the way the site's own code
  resolves it — and calls the export to obtain the same plugin. The compiled
  pages are byte for byte identical to the ones the main thread compiles: the
  same 253 pages, compared file by file.

  The pool is used only when every user plugin that has an in-process hook also
  declares a worker hook. A plugin that does not is left to the main thread,
  because a worker that could not reproduce it would compile pages differently
  from the main thread, and the output would depend on which worker compiled
  which page.

  `options` crosses the boundary by structured clone, so it holds data rather
  than functions. A plugin that needs a function at runtime keeps its
  in-process hook and does not declare a worker hook.

  The pool is also smaller than it was: each worker loads the site's grammars
  for itself, so past four workers the duplicated warm-up costs more than the
  parallelism buys. Measured on the documentation site, four workers compile the
  234 pages in 5.4 s and eight in 8.4 s, while a single thread takes 6.4 s.

  |                | Before | After      |
  | -------------- | ------ | ---------- |
  | MDX precompile | 6.4 s  | **5.4 s**  |
  | Cold build     | 20.8 s | **19.7 s** |

### Patch Changes

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

- ffb5e55: A code block keeps its own fence title, whichever page was compiled first.

  The highlight cache is keyed by the language, the resolved options and the
  code. The resolved options carry the fence meta — the title, the line numbers,
  the word wrap — but the meta's properties are defined as non-enumerable, so
  `JSON.stringify` dropped them. Two blocks with the same code and a different
  title therefore shared one cache entry, and the first one to be compiled lent
  its title to the other.

  Which title a page showed depended on the order the pages were compiled in.
  The documentation site compiled the same page in two ways — on the main thread
  and in a build worker — and the two produced different titles for six code
  blocks out of three thousand.

  The cache key carries the fence meta now, so an entry is only reused for a
  block that renders the same.

  Two smaller fixes travel with it. A grammar can include another one, and the
  inclusion only resolves if the included grammar is loaded: the Markdown
  grammar includes the YAML grammar to highlight a leading `---` block as front
  matter, and whether that resolved used to depend on whether some other page
  happened to use YAML first. And the fence meta is now read from the copy
  Sätteri fills in itself, which does not compete with the other visitors of
  the same node.

- Add a real Sätteri fidelity test covering the four constructs named in SPEC
  §2.4: fenced code blocks, inline HTML, GFM tables and custom components. The
  test checks both the parsed mdast tree and the compiled JSX, with no mocks.
- 94aebbc: The engine depends on nothing but the contracts.

  The package graph, measured from the manifests:

  ```text
  @bdocs/contracts   (no dependencies)
  @bdocs/primitives  (no dependencies)
  @bdocs/runtime     → @bdocs/contracts
  @bdocs/theme-neutral → @bdocs/contracts, @bdocs/primitives, @bdocs/runtime
  @bdocs/ssg         → @bdocs/contracts
  boltdocs (engine)  → @bdocs/contracts, @bdocs/processor-satteri, @bdocs/ssg
  ```

  **The `Boltdocs` global namespace moved to `@bdocs/contracts`.**

  It is augmented by the generated route types, and TypeScript rejects two
  `declare global` blocks for the same namespace, so it has exactly one home. It
  lived in `@bdocs/runtime`, which made the engine's re-export a type-only
  dependency on the browser half — one that compiles, ships nothing, and was
  therefore invisible in every install-size measurement.

  The contract layer cannot name React, so the MDX component map became a
  generic there, and `@bdocs/runtime` instantiates it with `ComponentType`. The
  shape a consumer sees is unchanged.

  **The engine declares no peer dependency at all.**

  It renders nothing. React, React DOM and the router are the browser half's
  business, and the browser half is a package the site installs. A site that
  installs a theme already installs React; a site that does not should not be
  made to.

  **The plugins read the contract types from the contracts.**

  `RouteMeta`, `SearchIndexParams` and `RouteContributor` now come from
  `@bdocs/contracts` rather than from the engine, so a plugin can be written
  against the contract layer alone. The engine-bound types — `PluginContext` and
  `BoltdocsPlugin`, which are the contracts' generics bound to the engine's
  config and to Node's request and response types — still come from the engine,
  because that binding is the value the plugin gets from it.

- 59b5f67: Three performance changes, and a grammar that was missing.

  **The theme's build surface is its own entry.**

  `createRoutes` and the shell are what the _build_ drives, not what a reader
  imports. They were in the theme's main entry, so every site that imported one
  component — `cn`, a `Link`, a hook — downloaded the route builder with it, and
  every page chunk carried a copy.

  They are published as `@bdocs/theme-neutral/ssg` now, and the engine imports
  them from there.

  |                                  | Before    | After         |
  | -------------------------------- | --------- | ------------- |
  | The theme's published main entry | 69,666 B  | **4,277 B**   |
  | The app chunk                    | 653,989 B | **491,923 B** |
  | The eager set, raw               | 966.2 kB  | **901.7 kB**  |
  | The eager set, gzip              | 236.7 kB  | **218.9 kB**  |
  | The whole client bundle          | 5.586 MB  | **5.524 MB**  |

  **A theme says where its entries live in source.**

  ```json
  { "boltdocs": { "source": { ".": "./src/index.ts" } } }
  ```

  The dev server and the build alias a theme's _source_ rather than its built
  copy, so an edit to a theme is picked up without rebuilding the package. Before,
  only the main entry was aliased: the subpaths resolved to a built file that
  could be minutes behind the source it was built from.

  **esbuild's asynchronous transform.**

  `transformSync` starts an esbuild service per call and tears it down
  afterwards; `transform` keeps one alive. Measured on a compiled page: 5.2 ms
  per call against 2.0 ms, and the difference is paid once per page. The cold
  build of the documentation site went from 27.4 s to 26.1 s, and the MDX
  precompile from 10.5 s to 9.8 s.

  **The `diff` grammar is bundled.**

  A ```diff block rendered without highlighting, and every build printed a
  warning about a language the framework did not have. It is a common language
  for documentation; it is in the bundle now.

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

- Updated dependencies [1413a37]
- Updated dependencies [4fb6ed1]
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [f7464bf]
- Updated dependencies
- Updated dependencies [4fb6ed1]
- Updated dependencies [223e891]
- Updated dependencies [5f7a09c]
- Updated dependencies [4fb6ed1]
- Updated dependencies [d80c6e1]
- Updated dependencies [d1e7f76]
- Updated dependencies [cdd636a]
- Updated dependencies [7a26134]
- Updated dependencies [a19cc4a]
- Updated dependencies [be963fa]
- Updated dependencies
- Updated dependencies [3007d0b]
- Updated dependencies [9a4c13b]
- Updated dependencies
- Updated dependencies [fd11c2f]
- Updated dependencies [4fb6ed1]
- Updated dependencies [4fb6ed1]
- Updated dependencies [c2e2b6b]
- Updated dependencies [e6837b3]
- Updated dependencies
- Updated dependencies [4fb6ed1]
- Updated dependencies [40a4c01]
- Updated dependencies [80b8bba]
- Updated dependencies [94aebbc]
- Updated dependencies [40a4c01]
- Updated dependencies [53ba421]
- Updated dependencies [84e874d]
- Updated dependencies [cf79338]
- Updated dependencies [32d05b3]
- Updated dependencies [727f796]
- Updated dependencies [cc053a8]
- Updated dependencies [597897b]
- Updated dependencies [5f7a09c]
- Updated dependencies [ffb5e55]
  - @bdocs/contracts@0.2.0
  - boltdocs@4.0.0
  - @bdocs/unist-utils@0.3.0
  - @bdocs/highlight@1.1.0

## 0.4.0

### Minor Changes

- [`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Boltdocs 3.4.0 — architecture contracts and incremental build foundation.

  This release publishes the new `@bdocs/contracts` package as the framework-neutral
  contract layer for routes, plugin lifecycle, plugin definitions, highlighting,
  search documents, and configuration. Its first public version is **`0.1.0`**
  (kept pre-1.0 while 4.0 reshapes the seam). `boltdocs` now re-exports those
  contracts so the existing 3.x public API keeps working unchanged.

  Highlights:
  - introduce `@bdocs/contracts` with route, plugin, lifecycle, highlighting, and configuration contracts;
  - keep `boltdocs` exports backward compatible through re-exports;
  - make `@bdocs/processor-satteri` consume the shared lifecycle contract directly;
  - align `@bdocs/ssg` and `@bdocs/plugin-ask-ai` on the new contract boundary;
  - ship the Vite 8.1 toolchain alignment and the content-addressed SSG page cache;
  - avoid full-site re-render on a single page edit.

### Patch Changes

- [`c00f9ff`](https://github.com/bolt-docs/boltdocs/commit/c00f9ffb422109918e246974c4172ba10b362554) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Stop shipping every highlighted code block twice to the browser.

  The Shiki rehype plugin attached the serialized HTML as `data-highlighted-html` and also left the HAST children on the node. The MDX compiler turns both into output, so every code block reached the client twice: once as an HTML string and once as a React tree.

  The tree was dead weight. `CodeBlockPre` renders `data-highlighted-html` through `dangerouslySetInnerHTML` and ignores children entirely; the copy button and the expand/collapse logic both read the rendered DOM via `preRef.current.textContent`, not the children.

  Children are now emitted only when serialization fails, which is the one case where the JSX path is the only rendering route. On the 263-page docs site this removed all 11,539 duplicate React code-block nodes and cut the JavaScript delivered per visit from 2440 KB to 1907 KB (-22%), and the total built client from 8310 KB to 5672 KB.

- [`147d39f`](https://github.com/bolt-docs/boltdocs/commit/147d39fb2e23c575b92cfa281869fffa50221a50) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Drop whitespace-only text nodes inside table sections during MDX compilation

  The compiler preserved the newlines that separate table rows and cells and
  emitted them as text children of `<tbody>` and `<tr>`. React rejects that
  outright: during server rendering the whitespace is written into the HTML, and
  by the time the client hydrates the browser's parser has already discarded
  those text nodes while building the table, so the two sides disagree and React
  discards the whole page (error [#418](https://github.com/bolt-docs/boltdocs/issues/418)).

  The fix removes the whitespace from the HAST rather than from the component
  layer, so it also applies to user-supplied mappings of the table elements.

- Updated dependencies [[`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b)]:
  - @bdocs/contracts@0.1.0

## 0.3.4

### Patch Changes

- [`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Align internal Vite development and build tooling on Vite 8.1, make the Boltdocs versus Docusaurus Faster benchmark cold-cache aware, and preserve route-level SSG render identity when a client build cannot emit a route-specific chunk.

## 0.3.3

### Patch Changes

- [`f5f2a1d`](https://github.com/bolt-docs/boltdocs/commit/f5f2a1dd7fa90740ff7a4cd862bc0abc52deadb1) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Finer Sätteri chunk packs and a single-scan public-asset URL rewrite
  - **Sätteri chunk packs are smaller**: 15 pages/pack for sites of 200–500
    pages (was 50), 20 for 50–200 (was 30). Pack size is also the incremental
    render granularity, so a one-page text edit on the docs site re-renders the
    edited pack (15 pages) instead of 50 — measured 43 new / 216 cached vs
    78/181 before.
  - **`rewriteHtmlPublicAssetUrls` runs one fused scan instead of two**
    full-document passes, with pre-compiled module-level regexes instead of
    per-call `new RegExp`. Output is byte-identical with the old two-pass
    behavior (including `data-srcset` list handling); ~7% cheaper per page over
    real rendered docs HTML.
  - Resolvers built by `createPublicAssetResolver` now expose a `mightRewrite`
    gate; pages that cannot reference a public asset skip the rewrite scan
    entirely.

  🤖 Generated with Codebuff

## 0.3.2

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

- [`eed5613`](https://github.com/bolt-docs/boltdocs/commit/eed56139c20fac1b13a575acffdb1104480c6be2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix two silent bugs that disabled the MDX precompile cache on every build
  - **Absolute `docsDir` corrupted the precompile scan path** — core passes a resolved absolute `docsDir`, but the plugin joined it onto the Vite root (`path.join(root, docsDir)`), producing a nonexistent path. `fs.existsSync` failed silently and the whole precompile pass (and its worker pool) was skipped on every build. Now uses `path.resolve`, which handles both relative and absolute paths.
  - **Per-process nonce invalidated the manifest `globalKey`** — non-persistent user plugins were signed with a `pid:Date.now():Math.random()` nonce baked into the compiler signature, so the manifest key differed on every process and the on-disk compiled-MDX cache could never produce a hit: all pages were recompiled on every build. The nonce is replaced by the stable `__boltdocsCacheSignature` (name@version:options) identity marker.

  Measured on the 259-page docs site: warm builds now report `precompile: 231 hit / 0 miss / 1.5s` instead of recompiling the full site invisibly on every build.

- Updated dependencies [[`67e9a00`](https://github.com/bolt-docs/boltdocs/commit/67e9a00b410720bf21f5516c214c991d544b6e1e)]:
  - @bdocs/unist-utils@0.2.1

## 0.3.1

### Patch Changes

- [`fbd8502`](https://github.com/bolt-docs/boltdocs/commit/fbd850235fba791b65945fe14ff519cff9dedd25) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix two silent bugs that disabled the MDX precompile cache on every build
  - **Absolute `docsDir` corrupted the precompile scan path** — core passes a resolved absolute `docsDir`, but the plugin joined it onto the Vite root (`path.join(root, docsDir)`), producing a nonexistent path. `fs.existsSync` failed silently and the whole precompile pass (and its worker pool) was skipped on every build. Now uses `path.resolve`, which handles both relative and absolute paths.
  - **Per-process nonce invalidated the manifest `globalKey`** — non-persistent user plugins were signed with a `pid:Date.now():Math.random()` nonce baked into the compiler signature, so the manifest key differed on every process and the on-disk compiled-MDX cache could never produce a hit: all pages were recompiled on every build. The nonce is replaced by the stable `__boltdocsCacheSignature` (name@version:options) identity marker.

  Measured on the 259-page docs site: warm builds now report `precompile: 231 hit / 0 miss / 1.5s` instead of recompiling the full site invisibly on every build.

## 0.3.0

### Minor Changes

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Precompile MDX early from `configResolved()`, size the worker pool dynamically based on CPU count and file count, and fix remaining JSX transpilation in compiler workers with stale cache invalidation.

### Patch Changes

- [`97af04d`](https://github.com/bolt-docs/boltdocs/commit/97af04da95657e1e72ecee548b1c1cc55c3d5f81) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Declare `esbuild` as a runtime dependency so published processor builds can resolve it in pnpm-isolated consumer projects.

- [`a33d512`](https://github.com/bolt-docs/boltdocs/commit/a33d512b965bcc701ed76e98db632dcf45fd8bd9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix a dev-server race where a `server.restart()` could dispose the shared route-cache context while the new server's virtual modules still held a reference to it, surfacing as "Route cache context has been disposed" errors on reload. The route cache context is now re-created defensively when a disposed context is detected during route regeneration.

  Fix code highlighting when a single `codeTheme` string (e.g. `codeTheme: 'github-dark'`) is configured: the Sätteri rehype-shiki plugin now receives the resolved `codeTheme` and passes it to the Shiki adapter, instead of silently falling back to the default light/dark dual theme (which produced dual-theme CSS variables that broke single-theme color rendering).

  Fix stale compiled-MDX output after processor changes: the compiled-pages cache key now includes the `@bdocs/processor-satteri` package version and the manifest version is bumped, so any published change to the compiler pipeline (e.g. Shiki highlighting) invalidates previously cached pages instead of serving pre-fix output.

  Fix code-block syntax highlighting disappearing in dark mode: the theme's Shiki light/dark color rules were applied to every `.shiki` block via `color: var(--shiki-dark) !important`, which wiped single-theme inline token colors (e.g. `codeTheme: 'github-dark'`) because `--shiki-dark` is undefined on that output. Those rules are now scoped to dual-theme output (`.shiki.shiki-themes`) and cover both light and dark modes, leaving single-theme inline colors intact.

  Fix code blocks in languages outside the bundled grammar list (e.g. `nginx`, `apache`) silently rendering as unformatted plain text: the Sätteri rehype-shiki plugin now retries unknown languages as `plaintext` so the block keeps its Shiki styling instead of falling back to an unstyled pre, and the bundled language list is expanded with common documentation-site languages (`nginx`, `apache`, `dockerfile`, `docker`, `json5`, `scss`, `less`, `python`, `go`, `java`, `php`, `sql`, `graphql`, `http`, `xml`, `vue`, `svelte`, `ruby`, `kotlin`, `swift`, `powershell`, `c`, `cpp`, `elixir`).

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
