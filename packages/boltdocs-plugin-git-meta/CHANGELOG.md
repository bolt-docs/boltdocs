# @bdocs/plugin-git-meta

## 1.0.0

### Minor Changes

- cdd636a: Add first-party git metadata plugins and wire the documented `routes:resolved` hook.

  `@bdocs/plugin-git-meta` exports `lastUpdatedPlugin()` and `contributorsPlugin()`, both backed by a single HEAD-cached `git log` scan. Route metadata gains `contributors`, and a new `page:footer:start` client slot lets plugins render content in the default page footer. The plugin's client entry exports customizable `Contributors`, `LastUpdated`, and `GitMetaFooter` components.

  The official docs now use both plugins to show git-backed last-updated dates and contributor avatars.

### Patch Changes

- 4a2de60: The engine no longer ships the UI layer.

  Until 4.0 the `boltdocs` package carried the whole client stack: the layout,
  the components, the contexts, the router and the MDX components. A site got
  all of it by installing the engine, and reached it through `boltdocs/client`,
  `boltdocs/primitives` and `boltdocs/mdx`.

  In 4.0 the engine is the engine.

  ### What moved
  - The client code — the route builder, the shell, the MDX page, the collection
    routes — is now in `@bdocs/theme-neutral`. It renders the theme's
    components, so the engine could not keep it without depending on a theme.
  - `boltdocs` no longer exports `./client`, `./client/router`, `./primitives` or
    `./mdx`. It publishes the engine: the CLI, the config, the route generation,
    the plugin lifecycle, the SSG bridge (`./ssg`) and the engine stylesheet
    (`./theme/reset.css`).
  - The theme is resolved from the project, not from the engine. `themePackage`
    in the configuration names it (default `@bdocs/theme-neutral`), and the
    engine imports the route surface from it. A second theme is a second
    package, not a fork of the engine.

  ### What a site has to do

  ```bash
  pnpm add @bdocs/theme-neutral
  npx boltdocs migrate --apply
  ```

  The command splits a `boltdocs/client` import by name: every symbol goes to
  the package that exports it — components, layout and MDX components to
  `@bdocs/theme-neutral`, the router and the contexts to `@bdocs/runtime`. It
  rewrites the import examples in Markdown as well, and it adds the theme to
  the manifest.

  | 3.x                                           | 4.0                                |
  | --------------------------------------------- | ---------------------------------- |
  | `boltdocs/client` (components, layout, hooks) | `@bdocs/theme-neutral`             |
  | `boltdocs/client` (router, contexts)          | `@bdocs/runtime`                   |
  | `boltdocs/primitives`                         | `@bdocs/theme-neutral/composition` |
  | `boltdocs/mdx`                                | `@bdocs/theme-neutral`             |
  | `boltdocs/client/router`                      | `@bdocs/runtime/router`            |

  ### How the two halves still meet

  The generated per-site artifacts — the icon registry, the page-source fetcher,
  the search index, the site's `layout.tsx`, the plugin slots and the site's own
  MDX components — reach the theme through the runtime's site bridge, which the
  engine fills from a generated `virtual:boltdocs-site-bridge` module. The
  theme still mentions no virtual module, which is what lets it be installed on
  its own.

  The official plugins were moved the same way: a plugin's client code imports
  `@bdocs/runtime` for the contexts and `@bdocs/primitives` for the style-neutral
  helpers, so a plugin works with whatever theme the site uses.

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
- Updated dependencies [3ad10bb]
- Updated dependencies [be963fa]
- Updated dependencies
- Updated dependencies [3007d0b]
- Updated dependencies [e1fe3cb]
- Updated dependencies
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
  - @bdocs/runtime@1.1.0
  - boltdocs@4.0.0
  - @bdocs/primitives@1.1.0
