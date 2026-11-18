# @bdocs/plugin-search

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

- 4fb6ed1: Move search document generation into `@bdocs/plugin-search`, and drop `flexsearch` from the core.

  The 4.0 roadmap names Search among the integrations `@bdocs/core-node` must not import: "`@bdocs/core-node` will own configuration resolution, route generation, frontmatter validation, plugin lifecycle, build orchestration, dev-server state, and invalidation. It will not import optional integrations such as Mermaid, Math, Ask AI, **Search**, RSS, or image optimization."

  ```bash
  pnpm add @bdocs/plugin-search
  ```

  ```ts
  import searchPlugin from "@bdocs/plugin-search";

  export default defineConfig({ plugins: [searchPlugin()] });
  ```

  Without it the build emits no `search.json` and prints one informational line. `boltdocs migrate` adds the import and the call for you.

  ## `flexsearch` was dead weight

  It sat in the core's `dependencies` and was imported nowhere in its source. It is the _query_ engine, and it belongs to whoever reads the index — `@bdocs/theme-neutral` for the built-in dialog — not to the process that writes the file. Every install paid for it.

  ## A registry, not a dependency

  The dependency runs the other way. The core exposes `boltdocs/node/search` and the plugin registers a generator into it. Both alternatives were tried:
  - **A `dependencies` entry from core to plugin** is a workspace cycle — the plugin needs `boltdocs` for its config types — and it would make search mandatory for every site, the exact coupling this change removes.
  - **Keeping the generator inline** duplicates the code and fails the same requirement.

  First registration wins, so two plugins generating `search.json` cannot make its contents depend on plugin load order — the rule `registerPluginHighlighter` already follows.

  The plugin reaches the registry through the core (`await import('boltdocs/node/search')`) rather than importing it directly. A static import resolves to this package's **built** copy of the registry while the core reads its **source** copy: two module instances, one empty registry, and a site that configured the plugin and still got no `search.json`. That was the first implementation, and `SearchNoticeStep` caught it on the first build.

  ## Why the notice is `info`, not `warn`

  Losing `@bdocs/plugin-seo` costs `sitemap.xml` and `robots.txt`, which nothing reports until search traffic stops arriving weeks later. Losing the search plugin costs a dialog that returns nothing — visible the moment someone types in it, and a deliberate choice for a site that never wanted one. Escalating it would train people to ignore build output.

  `SearchNoticeStep` runs _after_ `RoutesEnrich`, because that is the step that fires the `build:routes` hook the plugin registers in. Before it, the notice fired on every build of every site that had correctly configured the plugin.

  ## Two document shapes, deliberately

  `SearchResultDocument` (core registry) carries `url` and `display` — the deep link and the breadcrumb, which is all a query layer needs. `SearchDocument` (`@bdocs/contracts`) carries `path`, `headings` and raw `frontmatter`, and is the _input_ an engine plugin receives. They are not unified: an engine plugin should not have to re-derive the breadcrumb, and the runtime asset should not carry frontmatter no query engine reads.

  ## Verified

  11 generator tests, 5 registry tests, 3 notice tests. The documentation site emits 2095 documents in a 1.08 MB `search.json`, byte-identical to what the core produced before the move.

### Patch Changes

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
