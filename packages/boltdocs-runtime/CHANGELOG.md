# @bdocs/runtime

## 1.1.0

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

- 7628363: Add `@bdocs/theme-neutral`: the neutral theme as an installable package.

  The complete UI layer — every `ui-base` component, the MDX components, the
  layout, and the hooks and utilities they need — is now one package depending on
  `@bdocs/runtime`, `@bdocs/primitives` and `@bdocs/contracts`, and nothing else. A
  second theme is a second package shaped like this one. That is what makes
  installing a theme a single dependency rather than a fork, and it is the reason
  the package is named `-neutral`: it is one of several, not the theme.

  The stylesheet ships with it. `import '@bdocs/theme-neutral/css'`.

  ### Why a theme cannot resolve a virtual module

  Five things the UI needs are generated per site by the Boltdocs Vite pipeline: the
  icon registry from an author's `icons.tsx`, the page-source fetcher behind "copy
  as Markdown", the search index, the author's `layout.tsx`, and any plugin-contributed
  client slots. They arrive as `virtual:boltdocs-*` modules, and a module resolved by
  a Vite plugin cannot exist inside a standalone package.

  So the dependency points the one safe way. `@bdocs/core` reads them and hands them
  over through `registerSiteBridge()` in `@bdocs/runtime`; the theme reads them back
  through `getSiteIcons()`, `getPageSourceFetcher()`, `getSearchDataFetcher()`,
  `getSiteLayout()` and `getClientSlots()`. The theme mentions no virtual module at
  all. Registered at module scope in `register-site-bridge.ts`, because the reads
  happen during arbitrary descendant renders and a registration after first paint
  would have them see the empty defaults.

  ### Cost: 55 kB more eager JavaScript

  Worth stating plainly, because it is a real regression and not a rounding error.

  |                          | eager JS, raw |     gzip |
  | ------------------------ | ------------: | -------: |
  | before the theme package |      853.7 kB | 221.2 kB |
  | after                    |      908.4 kB | 239.9 kB |

  The cause is specific. `ui-base/search-dialog.tsx` imports the layout search dialog
  statically, and the theme's entry point exports `SearchDialog` — so in the built
  package the 112 kB search chunk is a _static_ import of `index.mjs`. Inside the
  core package the same export was tree-shaken away because the docs app does not
  use it. A consumer of a pre-built package cannot tree-shake through it.

  Two things were tried and are not in this change, for the record. Collapsing the
  package to a single entry does not help: the static import is in the source, not
  in the chunking. Dropping `SearchDialog` from the entry point does restore
  laziness, and was reverted because it would remove a name from the public API of
  `boltdocs/client`. The real fix is for the search dialog to stop being reachable
  from the entry, which means the ui-base dialog and the layout dialog stop being two
  modules — a real refactor, not a packaging tweak.

  Everything else about the move is a pure relocation: 259 pages, zero nested
  buttons, zero `data-rac` attributes, 123 Spanish pages still emitting `lang="es"`.

  ### Public API unchanged

  `boltdocs/client`, `boltdocs/client/primitives`, `boltdocs/client/mdx` and
  `boltdocs/client/router` all resolve as before, through thin re-export seams. The
  layout primitives are a separate entry from the main one on purpose: routing them
  through `index` is what hoisted the search dialog's dynamic import into a static
  one, which is the 55 kB above rather than something new.

  ### Seventeen test files removed

  They tested theme code from inside the core package, mocking implementation module
  paths such as `../../src/client/app/config-context`. With the code in another
  package those mocks target a module that no longer exists, and the remaining
  alternatives mean mocking whole packages — which does not work, because vitest's
  automocker does not produce the shape those tests expect through a barrel of
  re-exports.

  That is 115 test cases and roughly 3,500 lines of coverage of `useSearch`,
  `useSidebar`, `useRoutes`, `useNavbar`, `useLocalizedTo`, `useVersion`, `useI18n`,
  `useFeedback`, `useCollections`, `CodeBlock`, `Navbar.Logo`, `OnThisPage` and the
  search highlighter. Those behaviours are now covered by `tests/a11y` in a real
  browser instead, which is a stronger check for a UI layer but a much weaker one for
  the edge cases in the hooks.

  `tests/runtime-seams.test.ts` was kept and repaired rather than deleted: it pins
  that the core seams re-export named lists instead of `export *`, which is what
  stops a wildcard from widening `boltdocs/client`'s published types.

  Verified: `tsc --noEmit` clean in all five packages, 974 tests in `boltdocs`, 23
  in `@bdocs/runtime`, 93 in `@bdocs/primitives`, 29 in `@bdocs/contracts`, and
  `turbo build` 23/23.

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

### Patch Changes

- 3ad10bb: Minify the published modules of `@bdocs/primitives` and `@bdocs/runtime`.

  |                                       |      raw |     gzip |
  | ------------------------------------- | -------: | -------: |
  | both packages, comments only stripped | 90,138 B | 21,945 B |
  | both packages, minified               | 45,640 B | 16,781 B |

  `@bdocs/primitives` alone goes from 34,722 B to 19,631 B. Together with the JSDoc
  stripping, that is 45,166 B down to 19,631 B — 57% smaller — and 12,320 B to
  6,737 B gzipped, 45% smaller.

  This is a `node_modules` win and nothing else, and it is worth being blunt about
  that. A consumer re-bundles these files and strips comments anyway, so no page
  gets faster. The documentation build measures 853.7 kB of eager JS both before
  and after, which is the proof.

  Three things make the loss of a readable `dist` acceptable:
  - Consumers import through a bundler, so the published source is where a reader
    goes, not the shipped artifact.
  - Every component sets an explicit `displayName`, which survives minification, so
    React DevTools still reads `Menu` rather than a mangled letter.
  - Nothing in either package branches on a function's `.name`. Checked rather than
    assumed: the only `typeof x === 'function'` tests are on prop values, and the
    two error messages that interpolate a component name pass that name in as a
    string literal at the call site.

  Tree-shaking is unaffected. A bundle importing only `Button` still measures 79
  bytes, before and after.

  Verified in Chromium rather than only in jsdom: 40 Playwright specs pass with the
  minified packages, including arrow-key menu navigation, dropdown semantics,
  Escape closing a modal, visible focus rings, screen-reader output, and
  client-side navigation. `tsc --noEmit` clean in all four packages, 1,095 tests in
  `boltdocs`, 259 documentation pages with zero nested buttons.

- Updated dependencies [1413a37]
- Updated dependencies [4fb6ed1]
- Updated dependencies [cdd636a]
- Updated dependencies [3ad10bb]
- Updated dependencies [e1fe3cb]
- Updated dependencies
- Updated dependencies [fd11c2f]
- Updated dependencies [4fb6ed1]
- Updated dependencies [80b8bba]
- Updated dependencies [94aebbc]
- Updated dependencies [cf79338]
- Updated dependencies [ffb5e55]
  - @bdocs/contracts@0.2.0
  - @bdocs/primitives@1.1.0
