# @bdocs/plugin-search-algolia

## 2.0.0

### Minor Changes

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

- Fixed a critical compatibility bug: the engine read the **monorepo root**
  package version (1.11.0) instead of its own (3.4.1) when checking plugin
  ranges. That silently failed every plugin validation, and the swallowed error
  dropped all extra Vite plugins — including Tailwind — so docs utility classes
  were never generated. Version resolution now walks up by package name, and the
  validation error is logged instead of swallowed.

  Enforce SPEC §2.3: `boltdocs audit` now runs as a preflight for both `build`
  and `dev`, and fails the command on unresolved plugins, scan errors, truncated
  scans or high-risk findings. Every shipped plugin declares `version` and
  `boltdocsVersion`, and the validator requires them. Plugin identity can name a
  different package via `packageName` (used by git-meta's two exports).

  The scanner now treats spawning/forking a fixed local process as a warning and
  reserves `high` for shell execution; Mermaid no longer auto-installs Chromium
  with `npx` behind the user's back. The metadata version check compares the
  engine version against the plugin's supported range instead of the plugin's own
  version. CI runs `boltdocs audit` after building.

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

- Updated dependencies [1413a37]
- Updated dependencies [4fb6ed1]
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [f7464bf]
- Updated dependencies
- Updated dependencies [4fb6ed1]
- Updated dependencies [223e891]
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
