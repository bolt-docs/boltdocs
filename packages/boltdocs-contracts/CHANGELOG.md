# @bdocs/contracts

## 0.2.0

### Minor Changes

- 1413a37: Add `@bdocs/runtime`: the browser half of Boltdocs, split out of the core.

  Routing, navigation, hydration and the client contexts now live in their own
  package. None of it needs the filesystem, Vite, or any of the build-time
  integrations, so none of it should have been sitting inside the engine that
  produces the page. This is roadmap slice 5, and it is the prerequisite for slice
  3 (`@bdocs/ui`), not its successor — the theme components render against these
  contexts, so the contexts have to move first.

  ### What moved
  - `client/router/` — the router, the URL contract, viewport prefetch
  - six client contexts: config, doc route, MDX components, routes, theme, UI
  - `client/types.ts`, `client/utils/path.ts`, `client/utils/i18n.ts`,
    `client/view-transitions.ts`

  ### What stayed, and why

  Page composition — `doc-page`, `docs-layout`, `head`, `mdx-component` — stays in
  the core for now. Those files import the docs components directly, and moving
  them is slice 3's job.

  ### The contract types moved too, because they are read at runtime

  `BoltdocsThemeConfig` and `BoltdocsSocialLink` moved from
  `core/src/shared/types.ts` into `@bdocs/contracts`. They are not build-time
  details: the navbar renders the theme title, the logo and the social entries, so
  a runtime that cannot name them is a runtime that has to guess. `theme` is now
  part of `BoltdocsConfigContract` for the same reason, and there is one definition
  of each shape rather than one in the core and one in the runtime.

  The `Boltdocs` global namespace — the one generated route types augment — moved
  to `@bdocs/runtime` and is declared exactly once. TypeScript rejects two
  `declare global` blocks for the same namespace, and both packages need it, so it
  had to have one home.

  ### Nothing changed for a consumer

  Every path still resolves. `boltdocs/client`, `boltdocs/client/router` and every
  internal import go through thin re-export seams, so the public API is identical
  and no site changes anything.

  The seams are written as explicit name lists rather than `export *`, which
  matters twice over. `client/index.ts` does `export type * from './types'`, so a
  wildcard would republish whatever the runtime grows next as `boltdocs/client`
  types. And `rolldown-plugin-dts` — which builds the `.d.ts` — crashes outright on
  a cross-package `export *`, because the re-export it synthesises has a member
  expression where Babel demands an identifier. `tests/runtime-seams.test.ts` pins
  every seam so neither can happen quietly.

  ### Verified

  No behaviour change, and no size change either: the documentation build is 259
  pages at 853.7 kB of eager JS, byte-for-byte the same number as before the move,
  which is what a package relocation should look like.

  Beyond the unit and build checks, this is the first slice verified in a real
  browser rather than only in jsdom. `tests/a11y` runs 54 Playwright specs against
  Chromium, covering arrow-key menu navigation, dropdown semantics, Escape closing
  a modal, visible focus rings, and focus moving to the new document after a
  client-side navigation. Note that the suite is load-sensitive on this machine:
  a full parallel run produces two or three failures that differ between runs and
  between a baseline `HEAD` worktree and this branch, and every one of them passes
  when run on its own in both trees. Treat a green full run as necessary and not
  as sufficient.

  `@bdocs/runtime` also ships its own 25 tests, which it did not before. Writing
  them turned up that `theme-context` had never been unit-tested at all, because
  jsdom does not implement `matchMedia` and every attempt to mount the provider
  threw — the test setup now stubs it.

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

- 4fb6ed1: Finish search: the `search:index` hook works, and two real engines ship.

  ## The hook existed and nothing called it

  `search:index` was declared in `@bdocs/contracts` and implemented in
  `core/src/node/plugins/search-contract.ts` — 58 lines whose comment named
  FlexSearch, Pagefind, Algolia and Meilisearch as destinations — with zero call
  sites. `SearchIndexStep` fires it now, between the type generation and the SSG
  render, so an engine that only needs metadata (Algolia) finishes inside the
  build.

  The step refreshes the virtual-module search cache afterwards. Without that the
  client bundle emitted whatever the module cache held from _before_ the step ran,
  which is how a site that configured the plugin stopped shipping `search.json`
  while the pipeline reported the step as completed in 92 ms.

  ## Two document shapes, named

  `SearchDocument` is the engine-facing **input**: a page with its headings and
  frontmatter. `SearchIndexEntry` is what reaches the browser: `url` and
  `display`, no frontmatter. They were one type in `search-contract.ts` and
  another in the registry; an engine plugin compiled against the contracts one and
  received the registry one.

  They stay separate. An engine that indexes a page wants everything about it; a
  browser rendering a result wants a link and a label. Carrying frontmatter into
  a 1 MB asset to satisfy an engine that never reads it costs every visitor bytes,
  and making each engine re-derive a breadcrumb means each implements it slightly
  differently.

  `createSearchDocuments` now imports the contracts type instead of declaring a
  third copy.

  ## `@bdocs/plugin-search-algolia`

  The client half of Algolia support shipped long before the build half.
  `useSearch` reads `integrations.search.algolia`, queries an index, and parses
  `hierarchy`, `anchor` and `_snippetResult` off every hit — and nothing ever
  uploaded anything. A configured site got an empty result set with no error
  anywhere: every part reported success.

  The records are generated against the field names the client already reads, not
  against a shape invented here. An index that queries successfully and renders
  blank rows is the failure this avoids.

  `adminApiKey` is build-time only and read from the environment; the search-only
  key stays in `integrations.search.algolia`, which is what reaches the browser.
  A failed upload warns and continues — the site built, the previous index still
  serves, and failing a deploy over a search index is the wrong trade.

  ## Incremental uploads

  `incremental: true` fingerprints each record and sends only what changed. A full
  push on every build re-sends every record, which on a 2000-page site is
  thousands of needless operations and a quota bill on Algolia's free tier.

  Records that disappear upstream are **deleted** from the index. Leaving them
  means a deleted page keeps answering searches, the reader follows the link, and
  the 404 is indistinguishable from a broken search.

  Off by default: the fingerprint lives in memory, so it only helps a process that
  stays alive across builds.

  ## `@bdocs/plugin-search-pagefind`

  Wired to `build:generate`, not `search:index` — Pagefind crawls the **built
  HTML**, so the output has to exist first. It indexes exactly what a visitor sees,
  including prose from MDX components that never touched frontmatter.

  A missing binary warns and the build continues. The indexer is an optional peer
  (`@pagefind/linux-x64`, `@pagefind/darwin-arm64`, …) so a site downloads only
  its platform's binary.

  ## Detection

  `boltdocs migrate` reports Algolia configured for the client with no uploader —
  the asymmetry that makes search silently return nothing. Reported as `manual`:
  an upload needs an admin key, and a codemod that invents one produces a build
  that fails on the first request.

  **Verified:** 1011 core, 26 search, 20 Algolia, 8 Pagefind, 36 contracts, 188
  SSG, 120 Sätteri. The documentation site emits 2095 documents, byte-identical to
  before this change.

- 80b8bba: The production build stops loading a browser it never renders in.

  Every build imported jsdom and constructed a document before it started. The
  import alone costs 705 ms, and the window it installs is what react-helmet's
  compatibility layer had to defend against: with `window` defined, the library
  believed it was running in a browser and skipped the server branch of its
  state.

  None of it was reachable. A production build renders its pages inside the SSG
  worker pool, and those workers never installed a shim — the only jsdom lived on
  the main thread, which imports the SSR bundle and hands work to the pool. The
  documentation site builds and renders all 260 pages without it, and the output
  is byte-identical to the build that had a browser in memory.

  | Cold build of the docs site                                 | With jsdom | Without    |
  | ----------------------------------------------------------- | ---------- | ---------- |
  | Work between resolving the Vite config and the first bundle | 1589 ms    | **486 ms** |

  That segment is single-threaded, so it is the honest place to look: the rest of
  the build competes for the same four cores and buries a one-second change in
  the noise. Three cold runs of the whole build spent 66 s of CPU against the
  70 s of the previous revision.

  A project whose modules read `document` or `window` while they are imported can
  ask for the shim back with `ssg.mock: true`. The dev server is unaffected: it
  renders in-process, so it keeps the shim unconditionally.

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

- cdd636a: Add first-party git metadata plugins and wire the documented `routes:resolved` hook.

  `@bdocs/plugin-git-meta` exports `lastUpdatedPlugin()` and `contributorsPlugin()`, both backed by a single HEAD-cached `git log` scan. Route metadata gains `contributors`, and a new `page:footer:start` client slot lets plugins render content in the default page footer. The plugin's client entry exports customizable `Contributors`, `LastUpdated`, and `GitMetaFooter` components.

  The official docs now use both plugins to show git-backed last-updated dates and contributor avatars.

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

## 0.1.0

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
