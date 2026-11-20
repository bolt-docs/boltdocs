# boltdocs

## 4.0.0

### Major Changes

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

- 4fb6ed1: Add `boltdocs migrate`, which reports and fixes the 3.x patterns that 4.0 changed.

  ```bash
  npx boltdocs migrate            # dry run: reports, writes nothing
  npx boltdocs migrate --apply    # applies every fixable finding
  ```

  Slice 7 of the 4.0 roadmap was migration tooling: codemods, compatibility adapters, diagnostics and an upgrade guide. This is the codemods and the diagnostics. The upgrade guide is [the 4.0 upgrade page](https://boltdocs.com/docs/guides/operations/upgrading-4-0).

  ### What it fixes

  | Finding              | Change                                                                                                 |
  | -------------------- | ------------------------------------------------------------------------------------------------------ |
  | `react-aria/import`  | `react-aria-components` → `@bdocs/primitives`                                                          |
  | `theme/subpath`      | `@bdocs/theme-neutral/components/primitives` → `/composition`, `/client` and `/mdx` → the package root |
  | `seo/plugin-missing` | Adds `@bdocs/plugin-seo` when `siteUrl`, `robots` or `seo` are configured without it                   |
  | `deps/react-aria`    | Removes the stale `react-aria-components` entry                                                        |
  | `deps/primitives`    | Declares `@bdocs/primitives` when react-aria was referenced                                            |

  ### What it refuses to fix

  `onPress`, `isSelected` and `<SSRProvider>` are reported with their replacements, never rewritten. `onPress` becomes `onAction` on a menu item, but the new handler also receives the intent (`press` or `close`) — renaming the prop mechanically produces code that type-checks and does the wrong thing at runtime, which is worse than a line in a report.

  The same applies to a `plugins` array it cannot read: a shorthand (`plugins,`), an array built from a variable, or a single-line array is reported rather than edited. Appending to an array the tool cannot see into would produce a config that loads fine and silently drops every plugin.

  ### Why it is hand-written rather than TypeScript-based

  `typescript` is a devDependency of `boltdocs`, not a runtime one, so a published command cannot import its compiler — and it should not: this runs against projects whose build is already broken, and a compiler that fails to load would fail the one command whose job is fixing a broken tree. The scanner in `migrate/source.ts` is anchored so it matches module specifiers and nothing that merely resembles one, and skips specifiers inside comments — `trimmed.indexOf(' from ')` has exactly the shape of an import clause.

  ### Exit codes

  `0` when there are no blocking findings, `1` when there are. The blocking findings are the two that produce silent regressions: a missing `@bdocs/plugin-seo` costs you `sitemap.xml` and `robots.txt`, and the core only warns about it during the build.

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

- 4fb6ed1: Drop the CommonJS build. The published tarball goes from **5.84 MB to 2.93 MB** (−49.8%), 195 files to 100.

  |         | before              | after               |
  | ------- | ------------------- | ------------------- |
  | tarball | 5.84 MB (195 files) | 2.93 MB (100 files) |
  | outputs | ESM + CJS           | ESM                 |

  The CJS build was 2.87 MB — 49% of the tarball — and nothing resolved to it. The package was already `"type": "module"`, the `boltdocs` binary is ESM, and every consumer in the ecosystem (Vite, Rolldown, RSC, Node itself) takes the ESM path.

  ### Breaking

  A CommonJS consumer must convert to ESM. There is no `require` condition on any export, so this fails loudly at resolve time (`ERR_PACKAGE_PATH_NOT_EXPORTED`) rather than halfway through someone's build. From CommonJS, `await import('boltdocs')` works today.

  ### Why the exports use `default` rather than `import`

  ```jsonc
  ".": {
    "types": "./dist/node/index.d.ts",
    "default": "./dist/node/index.mjs"
  }
  ```

  With only one format left, `default` is what Node's resolver matches for both `import` and `require`. Keeping the key named `import` would have left a `require()` reaching an `.mjs` file and failing at parse instead of at resolve.

  ### Guarded by a test

  `tests/package-format.test.ts` asserts `type: module`, that no export declares a `require` condition, that every declared export target exists in `dist`, and that no `.cjs` file is present. The third assertion is the one that matters: it walks the built output rather than trusting the manifest, because a stale `require` condition pointing at a file the build no longer produces is exactly what a config-only change leaves behind.

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

- 3007d0b: Move sitemap, robots.txt and route SEO metadata into `@bdocs/plugin-seo`.

  Until 4.0 the core wrote `sitemap.xml` and `robots.txt` itself, so every site had them. Those two files and the per-route SEO enrichment now live in `@bdocs/plugin-seo`. Add it to your config:

  ```ts
  import seo from "@bdocs/plugin-seo";

  export default defineConfig({
    siteUrl: "https://example.com",
    plugins: [seo()],
  });
  ```

  The core warns during the build when it finds `siteUrl`, `robots` or `seo` configured but no SEO plugin, so a site that upgrades without adding it is told rather than silently losing its sitemap.

  Two things had to change for a plugin to be able to do this work at all:
  - **`build:routes`** is a new plugin hook that fires after routes are generated and before the SSG render. It is the only window in which a plugin can influence what gets rendered, which route SEO enrichment needs in order for `canonical` and `og:url` to be present in the HTML.
  - **`build:generate` no longer lives inside the SEO step.** It used to be the tail of `SEOWriteStep`, so `@bdocs/plugin-rss` depended on an SEO step it had nothing to do with, and the hook was unreachable for anyone not using SEO. It has its own `Generate` step now.

  The JSON-LD factories (`createArticleStructuredData` and friends) moved to `@bdocs/contracts`, which is where pure framework-neutral code belongs, and `boltdocs` and `boltdocs/client` keep re-exporting them. They are not part of the plugin: reaching them through an optional plugin would make it look like the plugin is required to use them.

  Also fixes a `robots.txt` bug: a site listing its own sitemap under `robots.sitemaps` got a duplicate `Sitemap:` line, because the implicit entry and the explicit list were both emitted.

- 9a4c13b: Replace the built-in Shiki highlighter with `@bdocs/highlight`, a Prism-based, dependency-free (no Oniguruma/WASM) syntax highlighter.
  - The default `theme.codeHighlighting.engine` is now `highlight` (alias `light`). Code is tokenized with Prism grammars, emitted with line wrappers and `bd-token-*` classes themed via `--bdocs-code-*` CSS variables, and also keeps Prism `token` classes for theme flexibility.
  - `boltdocs` no longer ships the Shiki adapter/transformers; Shiki packages move out of the core dependency graph. Custom engines remain supported through the engine-agnostic adapter/registry contract (`engine` as id, instance, or factory).
  - `@bdocs/processor-satteri` resolves and pre-renders highlighting through the pluggable adapter/runtime.

- Extract the React binding out of the engine (SPEC §5/§6). The engine no longer
  imports `@vitejs/plugin-react`, ships `react-helmet-async` or `react-refresh`,
  or generates React-specific entry code. It resolves `uiBindingPackage` by name
  (default `@bdocs/react-binding`) and asks it for Vite plugins and for `createRoot`.
  The binding owns Fast Refresh, JSX/SSR/dedupe config, prewarm entries and the
  client root. Core footprint dropped slightly (104067 → 103943 gzip bytes).
- fd11c2f: Replace `react-aria-components` with `@bdocs/primitives`.

  The client primitives now come from a package in this repository instead of from
  `react-aria-components`. That tree was 23.4 MB across 113 packages and was a
  **required peer** of `boltdocs`, so every site paid for it whether or not it used
  a single interactive component.

  ### Measured effect

  Per-visit JS on the documentation site, measured on the same machine against a
  build of `4.0` at `fc13afeb`:

  |                         | eager JS, raw          | eager JS, gzip        |
  | ----------------------- | ---------------------- | --------------------- |
  | `react-aria-components` | 1014.3 kB              | 271.9 kB              |
  | `@bdocs/primitives`     | 853.8 kB               | 221.3 kB              |
  | **delta**               | **−160.5 kB (−15.8%)** | **−50.6 kB (−18.6%)** |

  The application chunk alone goes from 736.5 kB to 576.0 kB. Install closure
  drops by the full size of the react-aria tree. Rendered output is unchanged: of
  the 259 pages in the documentation build, every one is byte-identical once
  react-aria's internal bookkeeping (`data-rac`, `data-react-aria-pressable`,
  `react-aria-*` ids, a redundant `tabindex="0"` on buttons, and the order in which
  JSX attributes are serialised) is normalised away. The single structural
  difference on each page is the `relative inline-block` wrapper around a menu
  trigger, which CSS-anchored positioning needs in place of a positioning engine.

  ### What is not implemented
  - **No viewport collision or flipping.** Popovers and menus are positioned with
    CSS relative to their trigger. Boltdocs anchors them to navbar and sidebar
    items where the surrounding layout already decides the side, so a full
    collision solver would be cost without a use. A popover near a viewport edge
    will overflow rather than flip.
  - **`SSRProvider` is gone, not replaced.** It existed because react-aria derives
    element ids from a module-level counter that starts at a different value on
    the server and in the browser. `@bdocs/primitives` uses React's `useId`, which
    agrees across the boundary by construction, so there is nothing to reconcile.

  ### Accessibility changes worth knowing

  These are deliberate, and in two cases they are corrections rather than parity:
  - A selectable `Menu` renders `menuitemradio` for one-of-many and
    `menuitemcheckbox` for many-of-many, with `aria-checked` only when the menu can
    select. A plain `menuitem` carrying `aria-checked` is not a combination the
    authoring practices define.
  - `MenuTrigger` clones a trigger that is already a control and wraps anything
    else in a real `button`. A `<span>` handed in as a trigger would otherwise
    receive `aria-expanded` and the event handlers while remaining unreachable by
    keyboard and unannounced by a screen reader.
  - A trigger now carries `aria-controls` pointing at the popup. react-aria
    omitted it.
  - `Separator` no longer ships a background colour. It was `bg-border`, which
    competed with the caller's own background, and which of two same-specificity
    background utilities wins is decided by their order in the generated
    stylesheet rather than the order they are written in.

  ### Migration

  `react-aria-components` is no longer a peer dependency, a dependency, or a dev
  dependency of `boltdocs`, and is no longer scaffolded by `create-boltdocs`. There
  is nothing to uninstall from a host app's `package.json` other than the entry
  itself. Theme components that were written against the react-aria props
  (`placement`, `offset`, `crossOffset`, `onPress` on a menu item, `isSelected` and
  `onSelectionChange` on a menu) need the `@bdocs/primitives` equivalents: menus are
  positioned with `className`, and `MenuItem` reports activation through
  `onAction`.

  ### Other fixes in this change
  - `packages/boltdocs-engine` type-checks clean. The 46 errors it carried were all
    `TS7016` implicit-`any` imports of the vendored Shiki grammars and themes,
    introduced when those assets were vendored; each vendored `.mjs` now has a
    sibling `.d.mts`.

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

- 4fb6ed1: Move the vendored Shiki grammars and themes into `@bdocs/grammars`. The core tarball drops from **2.93 MB to 0.35 MB**.

  |                   | before              | after                  |
  | ----------------- | ------------------- | ---------------------- |
  | `boltdocs`        | 2.93 MB (100 files) | **0.35 MB (63 files)** |
  | `@bdocs/grammars` | —                   | 2.62 MB (127 files)    |

  The grammar data is 2.6 MB and the framework's own JavaScript is 0.3 MB. A site with no C++ blocks never reads `cpp.mjs` — but it downloaded it anyway, because it shipped inside `boltdocs`.

  ### No user-facing change

  `boltdocs` depends on `@bdocs/grammars`, so it installs on its own and every site gets the same 39 languages, the same seven themes and byte-identical highlighted output. Nothing to configure, nothing to import differently, no breaking change for a user.

  This is the reason it is a _dependency_ rather than an optional one. Making the grammars opt-in would have saved the same bytes but required every site using C++, Rust, PHP, Vue or any of the other 29 languages to know that and install a second package — trading a silent 2.6 MB for a silent broken code block.

  ### The split is along the existing seam

  The engine was already pluggable (`theme.codeHighlighting.engine` resolves through a registry that a plugin can extend). The grammars were not — they were hardcoded in `shiki-langs.ts`. Those are two different axes:
  - **engine** — which highlighter implementation. Already free.
  - **grammars** — which language tables. Now a package.

  Choosing a different engine still changes what consumes these; it does not change this package's role as the registry of languages.

  ### A build bug this surfaced

  `tsdown` emits a chunk for every `import('./grammars/x.mjs')` _and_ the copy step placed the original beside it. The first build of the package weighed 5.9 MB instead of 2.9 — two copies of every grammar. `neverBundle` on the grammar and theme directories is what makes the copied files the only ones; there is a comment at that line in `tsdown.config.ts` so the next person does not "simplify" it away.

  ### Verified

  `tests/node/grammar-loading.test.ts` in the core covers the seam: ten languages still register eagerly, a lazy one (`rust`) still resolves through its dynamic import, and `cpp` still loads with its four sibling grammars. The grammar suite moved with the data — including two new assertions that every vendored `.mjs` has a sibling `.d.mts`, and that this package declares no runtime dependency on the framework it serves.

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

- 84e874d: The engine ships no stylesheet. The reset is the theme's.

  `boltdocs/theme/reset.css` was the engine's stylesheet: the page reset, the
  code-block rules and the accessibility baseline. The engine does not have a look
  any more — the theme does — so the stylesheet moved with it.

  ```diff
  - @import "boltdocs/theme/reset.css";
  + @import "@bdocs/theme-neutral/reset";
  ```

  `boltdocs migrate` rewrites the import, in a site's stylesheets as well as in
  its code.

  The values did not change. The reset now reads the theme's own tokens
  (`--bdocs-canvas`, `--bdocs-ink`, `--bdocs-primary`) where it used to read the
  host's (`--color-main`, `--color-body`, `--color-primary-500`), and a site that
  overrode those tokens overrides them in one place. Two tokens were added for
  the cases the old file had no name for: `--bdocs-diff-add`, the green a diff
  addition uses — which was Tailwind's `emerald-500` and not the theme's
  `--bdocs-success` — and the page-level fonts, `--bdocs-page-font` and
  `--bdocs-code-font`, which the document uses and the components do not.

  **Two rules that the build was dropping now apply.**

  Comparing the two builds' stylesheets — by their resolved declarations, not by
  their text — leaves ten differences, and nine of them are the same value
  written two ways. The tenth is two rules the framework's own compiler was
  discarding:
  - The line highlight's coloured bar was compiled to `:after`, a pseudo-class,
    where the source said `::after`. The browser discards a rule with an invalid
    pseudo-class, so the bar never rendered.
  - The line-number gutter's `display` and `width` were lost because two rules
    shared a selector and the compiler kept only the last one's declarations.

  Both are written out by hand now, and both render.

- 32d05b3: Renames the theme's style-neutral layer from `primitives` to `composition`, removes two dead files, and collapses four package aliases into one boundary each.

  ## Renamed

  `@bdocs/theme-neutral/components/primitives` is now `@bdocs/theme-neutral/composition`.

  The word `primitives` had come to mean the `@bdocs/primitives` package — behaviour, zero CSS — and the theme was shipping a directory called `primitives` whose files _import_ that package. Two unrelated things, one word, and a public export.

  The clash was not cosmetic. The package exported two different `Navbar`s and two different `Sidebar`s under the same name from two entries: 241 styled lines from `.`, 760 style-neutral lines from `./components/primitives`. A site that reached for the wrong subpath got unstyled slots with no way to tell.

  `boltdocs/client/primitives` keeps its `3.x` name and now re-exports the composition layer; only its documentation changed.

  The `dist` entry is `composition.mjs` and the split stays load-bearing: the composition barrel reaches the search dialog behind a dynamic import, and merging it back into `index` made tsdown hoist that lazy chunk into the first visit (853.7 kB eager instead of 965 kB).

  ## Removed
  - `components/composition/skeleton.tsx` — no export, no consumer. An earlier claim that Skeleton was deleted was wrong: the docs page and the export went, the file stayed.
  - `src/primitives.ts` — an orphan barrel. Nothing imported it and it was not a build entry.

  ## Aliases

  `.`, `./client`, `./composition` and `./mdx` all resolved to the same `dist/index.mjs`. Four names for one barrel, which is how the confusion compounded. Now there is `.`, `./composition` and `./css`, each one boundary.

  ## Not extracted: `ui-base`

  `ui-base` stays in the theme package. SPEC §6 asks for it as its own package, and this change does not do that, deliberately.

  Measured first. The theme ships 24 component stylesheets; the style-neutral layer consumes 16 of them and `ui-base` consumes 4 (`banner`, `not-found`, `giscus`, `selectors`). The layer named as unstyled is where the styling lives. Extracting `ui-base` as-is would have produced a package that emits almost none of its own classes and whose appearance comes entirely from a stylesheet it does not own — the opposite of a reusable package, and it would have left four styled components with nothing to style them.

  There is also a cycle in the way. `ui-base` needs `composition` (5 imports), `internal`, `mdx`, 17 hooks and 8 utils from the theme, while the theme's default layout imports `Navbar`, `Sidebar`, `Breadcrumbs`, `PageNav`, `ErrorBoundary` and `CopyMarkdown` from `ui-base`. Breaking that requires deciding who owns the hooks and the slot layer, which is a design decision rather than a move.

  ## MDX: card, field, image

  Converted, sharing one `prose.css`. The card's body lost `prose prose-neutral dark:prose-invert max-w-none` and is now four rules of its own.

  ## Reverted: the heading scale

  `typographics.tsx` keeps its six heading class strings. I converted them to CSS keyed off a new `data-level` attribute on the heading primitive, and it changed every heading on every page: `h2` went from 16px to 28px and `h3` from 16px to 22.4px, for a 27% pixel difference on a prose page.

  The mechanism is worth recording, because `:where()` is used everywhere in this package and the trap is not obvious. Wrapped in `:where()`, a rule has zero specificity — which means it can never lose, and therefore always wins when the property is otherwise unset. The docs site has a latent bug: its own `HEADING_CLASSES` lost the `text-(--text-h2)` size utility, so nothing set the size and it fell back to 16px. My rule filled that hole. Every page moved.

  A site whose heading scale is intact would have been unaffected, and the mechanism is sound for them. But a conversion that silently restyles every page is not a conversion, so it is reverted.

  ## Verified

  0 differences of computed value across 166 measured selectors on five pages: `h2`, `h3`, `p`, inline `code`, `ul`, `ol`, `li`, `pre`, `strong` and `hr` are identical to the pre-conversion build. The 5 remaining differences are all on `index.html`, the external bento page, whose independent difference was already open before this change.

  The comparison harness had a bug of its own: a selector matching nothing in _both_ trees was reported as "appeared in B", which reads as a regression that does not exist. It now distinguishes no-data-in-both from a component that stopped rendering.

  `theme-neutral` 10/10, `core` 962/962, `tsc` clean.

### Minor Changes

- f7464bf: Make the core CSS-agnostic: remove Tailwind/Vite Tailwind coupling and CSS-framework assumptions from the engine and neutral theme, replace `cn` with framework-neutral `clsx` class joining (no Tailwind merge), ship the neutral theme as plain CSS only, and update scaffolding/templates to opt into Tailwind explicitly via `@bdocs/plugin-tailwindcss` when needed.
- a19cc4a: Extend `boltdocs migrate` so it can import Docusaurus and Starlight (Astro) documentation sites in addition to upgrading Boltdocs 3.x projects.

  ```bash
  npx boltdocs migrate                          # autodetect the source
  npx boltdocs migrate --from docusaurus        # dry run
  npx boltdocs migrate --from starlight --apply # write the safe changes
  ```

  The command detects the source framework from config files and dependencies, or accepts an explicit `--from` (`auto`, `boltdocs`, `docusaurus`, `starlight`). For external frameworks it generates a starter `boltdocs.config.ts`, rewrites common frontmatter and admonitions (`:::note` / `<Aside>` → `<Callout>`), copies content and assets, rewrites dependencies and scripts, and converts category files, locales and versioned content when the mapping is provable. Ambiguous changes are reported as `manual` and never applied silently.

  Shared helpers were extracted into `framework-common.ts`, a declarative config renderer into `framework-config.ts`, and code-fence-aware admonition converters into `framework-content.ts`, so both migrators use the same safe file operations and the same `package.json` rewrite. The dry-run report and `--apply` continue to share one analysis path.

  Blog frontmatter is mapped too: inline author objects become Boltdocs `author` entries (`image_url` → `avatar`), plain author strings and `image` → `coverImage` are rewritten, while author lists/YAML aliases and `<!--truncate-->` are reported as manual findings. A route-generation verification test runs the real `generateRoutes` against a migrated fixture to prove that folders, frontmatter and `meta.json` produce working routes, groups, locales and blog collections.

  Internal links are mapped: Docusaurus version-prefixed destinations (`/docs/next/...`, `/docs/<version>/...`) in Markdown links, reference definitions and `href` attributes become canonical `/docs/...` links; CRLF/BOM are preserved and external/anchor links are untouched. Starlight links that omit the docs base are reported as `manual` because the correct base depends on the target config.

  A custom Docusaurus docs directory is detected from plugin/preset options (`path` under `@docusaurus/plugin-content-docs` or the classic preset) and written as `docsDir` in the generated config; content, blog, locales, versions and sidebar migration all use that directory instead of assuming `docs/`.

  `--apply` no longer exits with code 1 for blocking findings it already resolved: the exit code now reflects only what remains after the rewrite. An unknown `--from` value is rejected with a clear error.

  Config values assigned to simple string constants (`const TITLE = '...'; title: TITLE`) are resolved and written to the generated config. Values that require executing the config (environment variables, member expressions, function calls, spreads) are reported as `manual` findings with file, line and the exact expression instead of being silently dropped.

  Docusaurus `sidebars.js/ts` is now converted automatically: a small literal parser reads categories, nested categories, doc ids, positions, labels and autogenerated sections, then rebuilds them as folders, `sidebarPosition`/`sidebarLabel` frontmatter and `meta.json` (merging existing meta fields). Expressions it cannot read — spreads, function calls, external links — are reported as manual findings instead of being guessed.

  The migration is idempotent: a second `--apply` reports no fixable changes. Conversion preserves CRLF/BOM, ignores examples inside fenced code blocks, handles nested admonitions, skips commented-out config values, validates `--from`, and refuses to invent SEO URLs. An exhaustive suite covers Docusaurus 3.10.2 and Astro 5 / Starlight 0.36-era config shapes.

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

- 53ba421: The syntax highlighter uses the Oniguruma engine by default.

  It used the JavaScript engine, on the strength of its startup cost: the code
  claimed it cut the engine build from ~2.5 s to ~200 ms. Measured on this
  machine that claim no longer held, and it pointed at the wrong cost.

  |                   | Oniguruma | JavaScript |
  | ----------------- | --------- | ---------- |
  | Engine startup    | 548 ms    | 357 ms     |
  | One code block    | 2.8 ms    | 9.9 ms     |
  | 654 unique blocks | 1.8 s     | 6.4 s      |

  A build pays the startup once and the blocks once per language, so the blocks
  decide. On the documentation site's 971 code blocks the precompile — 96% of
  which is highlighting — went from 8.9 s to 6.4 s, measured across three
  interleaved A/B builds.

  Oniguruma is also the faithful engine: the JavaScript one degrades unsupported
  grammar regexes to approximate matches, while Oniguruma matches TextMate
  exactly. The rendered output of the documentation site's code blocks is
  byte-identical between the two.

  Set `theme.codeHighlighting.options.regexEngine: 'javascript'` to trade that
  fidelity for the smaller startup — the right choice for a site with few code
  blocks.

  This also fixes an inconsistency: `highlight()` chose JavaScript while
  `ensureLanguage()` chose Oniguruma, so a caller that loaded a grammar lazily
  ended up building a _second_ highlighter with the other engine.

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

### Patch Changes

- Update the documentation site to present Boltdocs 4.0 as the current release. The hero version, both localized announcement banners, the releases index and the roadmap page now describe 4.0 as shipped instead of planned, with a link to the 4.0 upgrade guide.
- 223e891: Drop `isomorphic-dompurify` and jsdom: 8.4 MB and 55 fewer packages, and 25x faster on the frontmatter path.

  `isomorphic-dompurify` exists to shim a DOM for Node, so it depends on jsdom. That put 9.2 MB and 63 packages on every install to handle two call sites, and neither needed a DOM.

  **Frontmatter.** `title`, `description`, `badge` and `excerpt` were being run through an HTML sanitizer. They are plain text: they reach React as text children, which escape automatically, and as `<meta content>` and `<title>` values, which React also escapes. None of them is an HTML sink — the only three in the client are the Shiki output, the JSON-LD block, and icon markup, and none of those is fed from frontmatter.

  That was wrong in three ways at once. It cost jsdom. It was slow: 441µs per value against 17µs for the regex, so ~350ms across a 259-page build. And it double-escaped — a title of `A < B` came back as `A &lt; B` and React escaped the `&` again, so the heading rendered as the literal `A &lt; B`. They are now reduced to plain text by `stripTags`.

  `sanitizeHtml` is gone rather than reimplemented. Hand-rolling an HTML sanitizer to keep it would have been the wrong trade: an allowlist parser is exactly the thing that gets bypassed. Nothing needed it, and removing markup is a stronger guarantee for the case that mattered — markup in frontmatter cannot survive at all, instead of surviving as allowed-but-inert HTML.

  **Icons.** Sanitizing icon markup _is_ a real sink, so it stays, on `dompurify`'s browser build — the browser already has a DOM, and the Node shim was never needed there. It is now memoized by exact markup: `IconRenderer` re-runs on every parent render, and each pass was re-parsing and re-serializing the same SVG. The cache is keyed on the markup and never on an icon name, because the name is the part a caller controls.

  Two boundaries worth stating, since they are judgment calls. A bare `<` survives (`if (a<b)` is a comparison, and requiring a `>` terminator is what keeps it intact), and an unterminated raw-text element loses its tags but keeps its body as text, rather than swallowing the rest of the string the way a browser would.

  Verified: core 1084 tests across 120 files, ssg 188, plugin-seo 41, contracts 29, docs build 259 pages. The 259-page build contains no double-escaped title.

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

- d1e7f76: Restores UI that Tailwind was never told to generate.

  ## The bug

  Tailwind v4 uses the directory of the CSS entry as its base for automatic source
  detection. For this site that is `docs/`, and the theme lives in `packages/` —
  outside it. Every utility used only inside a theme component was therefore never
  emitted into the stylesheet.

  Three were missing, measured rather than assumed:

  | Utility            | Component     | What was missing                                         |
  | ------------------ | ------------- | -------------------------------------------------------- |
  | `sm:text-sm`       | breadcrumbs   | the breadcrumbs rendered at 12px at every width, forever |
  | `hover:bg-surface` | sidebar links | no hover state at all                                    |
  | `md:flex`          | copy buttons  | the "Copy Markdown" button never rendered                |

  The existing `@source "./node_modules/boltdocs/dist"` was the same problem from
  before the packages were split: it worked because the client components happened to
  be bundled into the core package, and it stopped working the moment the theme
  became its own package.

  ## What changes on screen

  Twenty measured boxes move. The navbar grows from 87px to 105px and regains its
  two rows of links, the sidebar and navbar link rows go from `0x0` to laid out,
  and the "Copy Markdown" control appears. These are restorations: the previous
  rendering was the broken one.

  ## Not fixed here

  The `@source` lines use monorepo paths. A site installing the theme from npm needs
  `node_modules/@bdocs/theme-neutral/dist`, and the general fix belongs in
  `@bdocs/plugin-tailwindcss`, which is the only place the path can be resolved rather
  than written by hand into every project's CSS. A site on 4.0 with a Tailwind theme
  needs that line until the plugin resolves it.

- cdd636a: Add first-party git metadata plugins and wire the documented `routes:resolved` hook.

  `@bdocs/plugin-git-meta` exports `lastUpdatedPlugin()` and `contributorsPlugin()`, both backed by a single HEAD-cached `git log` scan. Route metadata gains `contributors`, and a new `page:footer:start` client slot lets plugins render content in the default page footer. The plugin's client entry exports customizable `Contributors`, `LastUpdated`, and `GitMetaFooter` components.

  The official docs now use both plugins to show git-backed last-updated dates and contributor avatars.

- 7a26134: Make image optimization opt-in instead of mandatory

  The image optimizer was imported at the top of the plugin module and injected
  unconditionally, which made image processing a requirement for every project.
  `sharp` and `svgo` are peer dependencies of the optimizer, so every installation
  resolved and downloaded those native binaries whether or not a single image was
  ever processed.

  Enable it explicitly when a project wants it:

  ```ts
  export default defineConfig({
    experimental: {
      imageOptimizer: true,
      // or, to also tune which files are processed:
      // imageOptimizer: { includePublic: false },
    },
  });
  ```

  The optimizer is resolved through `createRequire` inside the enabled branch, and
  is no longer a dependency of the core package. A static import at module scope
  would put the optimizer, and through it `sharp`, back into every load, so the
  resolution has to stay guarded.

  If the option is on but the package is not installed, the build warns and
  continues without image optimization rather than failing: a project that asked
  for an optimization gets a build without it, not a build that cannot produce.

- be963fa: Stop the plugin lifecycle from loading the build pipeline.

  `PluginLifecycleManager` imported the `Pipeline` step runner from the
  `node/pipeline` barrel, and that barrel re-exports `createBuildPipeline` — which
  imports every build step, and with them the SSG package and its tooling. The
  first route generation of a dev server, and the first plugin hook of a build,
  paid for a module graph they never used.

  The step runner now lives in its own module (`node/pipeline/pipeline.ts`) with
  no dependencies beyond its own types, and the lifecycle imports it from there.
  The barrel keeps the same public surface, so nothing outside the core changes.

  Measured on the `routes:resolved` hook path, module init for the plugin
  lifecycle dropped from 3248 ms to 852 ms, and the hook test file that timed
  out on a loaded machine now runs in 716 ms.

- c2e2b6b: The highlighter's default engine is Oniguruma, and the JavaScript engine is gone from the default path.

  Shiki's JavaScript regex engine produces different highlighting for identical input between runs, so code blocks can differ between builds.

  Measured on unmodified 3.4/4.0 code, no Boltdocs code involved — upstream `@shikijs/core@3.23.0` with `@shikijs/engine-javascript` and the grammars from `@shikijs/langs`:

  ```js
  const start = Date.now();
  ```

  produced four distinct tokenizations across eight runs, among them merging `= Date.now()` into one span or splitting `now` out as a function call. Switching the same input to `@shikijs/engine-oniguruma` gave the same output six times out of six, and the most accurate of the variants.

  Oniguruma is also the faster engine for the work a build actually does. Highlighting is 96% of an MDX compile — on the documentation site's 971 code blocks it is 8.5 s of a 12.9 s compile — and the engine was chosen on the strength of a startup cost that no longer held: the code claimed it cut the engine build from ~2.5 s to ~200 ms, and measured today it is 548 ms against 357 ms. The startup was the wrong cost to weigh.

  |                   | Oniguruma | JavaScript |
  | ----------------- | --------- | ---------- |
  | Engine startup    | 548 ms    | 357 ms     |
  | One code block    | 2.8 ms    | 9.9 ms     |
  | 654 unique blocks | 1.8 s     | 6.4 s      |

  A build pays the startup once and the blocks once per language, so the blocks decide. The documentation site's precompile went from 8.6 s to 6.6 s, and the build from 24.2 s to 21.6 s — measured across three interleaved A/B builds.

  Set `theme.codeHighlighting.options.regexEngine` to `'javascript'` to trade that reproducibility and accuracy for the smaller startup — the right choice for a site with few code blocks.

- e6837b3: Support every documented Shiki code theme, and drop 1.8 MB from the install.

  Setting `theme.codeTheme` to `dracula`, `tokyo-night`, `nord`, `one-dark-pro` or `one-light` failed the build with `Theme 'dracula' not found`, even though `CodeTheme` accepts any string and the theme module's own comment listed all seven as supported. Only `github-light` and `github-dark` were ever registered.

  All seven are now registered, so the five that were broken work. Verified end to end: a documentation build of 259 pages with `theme: 'dracula'` emits the canonical dracula palette (`#FF79C6`, `#50FA7B`, `#6272A4`, `#F8F8F2`) rather than falling back.

  The themes are vendored rather than imported from `@shikijs/themes`, which ships 66 themes for 1.8 MB; the seven registered cost 196 KB. Default rendering is unchanged — the 259 pages are byte-identical to the previous output.

- Align the docs and benchmark tooling with SPEC.md:
  - Rewrite `theme-primitives.mdx` (EN + ES): no more references to the deleted
    `engine/src/client` path or Tailwind-only guidance — the current contract is
    `@bdocs/primitives` behavior plus native CSS in `@bdocs/theme-neutral`.
  - Turn `fileRouting` off in the production docs config (§2.5/§2.6); external
    pages are already declared in `pages-external/index.tsx`. It stays on in dev
    because the HMR end-to-end tests create a temporary external route.
  - Make the benchmark fixture match the §2.2 definition: 100 `.mdx` pages with 3
    code blocks, 2 tables, 5 default-theme components and ~1,500 words each, and
    no stale `boltdocs/client` layout.
  - The benchmark gate no longer passes silently when the baseline was measured
    on another machine; it requires an explicit `--allow-machine-mismatch`.
  - New `pnpm benchmark:fixture` / `benchmark:fixture:gate` profile and gate the
    SPEC-defined 100-page MDX fixture against `scripts/benchmarks/baseline-100.json`.
    CI runs both, so §2.2 is enforced on every release instead of being a manual
    command against the docs site.

- 40a4c01: The benchmark gate has a baseline, and knows what it measured.

  `scripts/benchmarks/baseline.json` did not exist, so the gate in SPEC §2.2
  could never run: it wrote a baseline on the first invocation and had nothing
  to compare against afterwards. There is one now, and it records the machine it
  came from — the CPU model, the core count, the memory and the Node version.

  A build time is a property of the machine as much as of the code, so the gate
  compares only what it can compare. On the machine the baseline came from it
  enforces the threshold; on another machine it says the comparison is not
  meaningful and exits without a verdict, rather than failing a build on
  hardware.

  The three tests that live outside a package — the benchmark helpers' — had no
  configuration to run under: they used the global `describe` and `it` that
  `globals: true` provides, and there was no config that set it. They were dead
  files, written and never run. They run now.

- 40a4c01: The engine's stylesheet no longer assumes a CSS framework.

  `reset.css` was written with Tailwind's `@apply`: seventeen rules that only
  compile inside a Tailwind build. That is the one CSS framework assumption
  SPEC §2.1 forbids, and it was in the engine.

  The declarations are the same ones Tailwind compiled to, written out by hand —
  `py-2` is half a rem, `text-[12px]` is twelve pixels, and
  `!bg-primary-500/10` is
  `color-mix(in oklab, var(--color-primary-500) 10%, transparent)`. A test now
  fails if a framework directive or a hardcoded colour comes back.

  The evidence that nothing moved: the documentation site's compiled stylesheet
  is byte-identical before and after the rewrite — 180,067 bytes either way. The
  comparison is between the two builds' CSS; no browser was involved.

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

- 727f796: `@bdocs/theme-neutral` ships native CSS, and the core no longer advertises a stylesheet it never built.

  ## The stylesheet is now plain CSS

  `neutral.css` was a Tailwind v4 `@theme` block. Two things were wrong with that, and the second is the one that mattered:
  - A `@theme` block only means anything inside Tailwind's own build. Read the file in a `<link>`, in webpack, or in a plain server and the tokens resolve to nothing.
  - **Nothing ever loaded it.** The docs site ran on its own Tailwind tokens, and the neutral theme's stylesheet was compiled, published, and never rendered anywhere. It was a theme whose styling had never been executed.

  It is replaced by `src/styles/`, plain CSS with an explicit `@import` chain:

  ```text
  styles/
  ├── index.css               entry: tokens → base → components
  ├── tokens.css              every colour, radius, font, shadow, dimension
  ├── base.css                element defaults, scoped to `.bdocs-root`
  └── components/*.css        one file per component
  ```

  Shipped as real files rather than a bundled asset, so the theme behaves the same in a plain `<link>` as in Vite. 7.9 kB total. Accessible at `@bdocs/theme-neutral/css`; `./css` now points there.

  Tokens are plain custom properties, with the split made explicit:
  - `--bdocs-*` — public. Override these. Never renamed without a major.
  - `--_bdocs-*` — private. What the theme's own rules are written against, free to change in any release.

  The private layer is what lets a public token be re-derived without asking every site to update. `--bdocs-bg` is what a site sets; `--_bdocs-surface` is what the rules consume. Retuning the theme's internal shades stops being a breaking change.

  Dark mode follows `[data-theme='dark']` and `.dark`, and `prefers-reduced-motion` now collapses the motion tokens — previously a site had to override every transition individually.

  ## Base styles are scoped, not global

  `base.css` hangs off `.bdocs-root` instead of styling `body` and `:root` directly. Boltdocs renders inside a host page as often as it is the whole page, and a theme that rewrites the host's body background because it was imported is a theme nobody can install twice or embed. A test asserts no rule targets `html` or `body`.

  ## Verification

  `pnpm --filter @bdocs/theme-neutral verify:styles` loads the **built** stylesheet into a bare page — no bundler, no Tailwind, no build step to read it — and asserts computed values in Chromium. 17 checks across four pages: light, dark, narrow, and reduced motion.

  It reads `getComputedStyle` rather than the stylesheet source, because a rule can be present and still lose the cascade, which is exactly the failure this check exists for. Two of the assertions are deliberately not token reads:
  - a card surface must **follow** `--bdocs-bg` into dark mode, so a rule that hardcodes its colour fails;
  - `--_bdocs-surface` must still **derive** from the public token after an override, so the private layer cannot quietly become a second source of truth.

  Both were confirmed to fail when broken, rather than assumed to work. Needs `pnpm exec playwright install chromium` once; it is not wired into CI, to keep a browser download off the default path.

  Two bugs surfaced while writing it, both in the check rather than the theme, and both recorded here because they are traps rather than typos:
  - reading computed styles straight after flipping `data-theme` returns the **pre-transition** colour, because the cards transition `background-color`. The check waits for `document.getAnimations()`. Without that, a working dark mode looks broken.
  - asserting on `<body>` instead of `.bdocs-root` fails by design: the theme deliberately does not restyle the host page.

  ## `@bdocs/primitives` is unchanged

  The primitives stay style-neutral by contract — they own structure, behaviour and state, and expose `data-*` for the theme to style. This change is entirely in the theme layer above them.

  ## Status of the conversion

  **1 of 46 components is converted** (`PageNav`). The rest still use Tailwind utility classes, and until they are converted the theme still needs a Tailwind build. Reporting that plainly rather than implying the port is done.

  `packages/boltdocs-theme-neutral/tests/native-styles.test.ts` holds the line in the meantime: a converted component that grows a utility class again fails the suite instead of quietly reintroducing the dependency. The converted list is explicit — globbing would pass on day one and mean nothing while every file still has classes in it.

  ## Removed
  - `boltdocs/theme/neutral.css` — core exported this path, but the file was never built and never existed in `dist`. A consumer importing it got a resolve failure against a subpath the package advertised. The `./theme/neutral.css` export is gone; `./theme/reset.css` is unchanged, since the reset is a common base rather than a theme opinion.
  - `packages/boltdocs-engine/src/client/base-theme.css` — 78 lines of `--bdocs-*` tokens that nothing imported. Its content now lives in `styles/tokens.css` and is actually shipped.

  The docs page on vanilla CSS claimed Boltdocs ships these variables in `base-theme.css`. It now points at `@bdocs/theme-neutral/css`, which is true.

- cc053a8: Converts the layout chrome to native CSS, with a visual harness that proves the UI did not change.

  ## What is converted

  The docs shell, the page header, and pagination and breadcrumbs — in both layers:
  - `primitives/docs-layout`, `primitives/page-nav`, `primitives/breadcrumbs` — now structure only: a landmark, `data-*` state, a semantic class.
  - `ui-base/page-nav`, `ui-base/breadcrumbs`, `docs-layout-default` — content and structure, no utility classes.

  The primitives were the reason the theme still needed Tailwind at all. A primitive emitting `flex items-center gap-4` is not style-neutral however carefully the layer above it is written, so converting only the theme components would have left the dependency in place.

  Direction travels as `data-direction`, and "this is the current crumb" as `data-active`. Those are state; the theme decides what state looks like.

  ## Tokens, transcribed rather than chosen

  `styles/tokens.css` is rebuilt as two layers: `--bdocs-*` public, `--_bdocs-*` private. The names are the vocabulary the components already used (`bg-surface`, `text-muted`, `border-subtle`), promoted from the consuming site's Tailwind config to tokens the theme owns — a theme that inherits its colours from whatever host installs it is not a theme.

  Three values exist because the better-looking number was wrong, and the harness caught it:
  - `--bdocs-line-height: 1.7`, not 1.65. Multiplied by every text size on the page; 1.65 moved every line of prose half a pixel.
  - `--bdocs-radius-2xl: 1rem`. `--bdocs-radius-lg` is 0.875rem and `--bdocs-radius-xl` is 1.125rem; Tailwind's `rounded-2xl` is 1rem. Reaching for either resized every card by 2px.
  - `--bdocs-ink-faint` / `--_bdocs-ink-faintest`. The alpha belongs to the colour, not to `opacity`: fading the element fades the chevron inside it too, and the two measure differently over the canvas.

  ## `:where()` wraps the root class too

  `base.css` had `.bdocs-root :where(a)`. That has specificity 0-1-0 — the `:where()` zeroes only the part it wraps — so it tied with `.text-muted` and won on source order, being imported after Tailwind. Every link in the theme turned brand-blue regardless of its class. Written `:where(.bdocs-root) :where(a)` it is 0-0-0, loses to any utility, and still applies when nothing else sets the property.

  `:hidden` keeps `!important` on purpose: the one rule that must not lose is the one that keeps a hidden panel from occupying space.

  ## Verification

  `scripts/visual/` drives the built docs site in Chromium and compares it against the build it replaced.
  - `snapshot.mjs` — screenshots, per viewport, per scroll position, per theme. 914 images across 36 pages.
  - `styles.mjs` — computed styles for structural selectors, diffed between two builds. Answers "which property, on which element" instead of "something changed by 2%".
  - `why.mjs` — walks the cascade including imported sheets and reports which rule wins and at what specificity.
  - `measure-pagenav.mjs` — the exact boxes and type metrics of one component.

  The measurements are findings, not decoration. The card came out 94px against the original's 78px because two `line-height` values were guessed; the caption wore the body colour because a component asked for `--_bdocs-ink-faint` while only `--bdocs-ink-faint` existed — an undefined `var()` invalidates its declaration without erroring, and the property silently inherits. The second one is now a unit test.

  ## Open, and stated plainly

  **Not pixel-identical yet.** Two differences remain against the original build:
  - `index.html` (an external page, not theme-rendered): 21.9% on one mobile scroll position.
  - `docs/guides/getting-started/configuration.html`: 2.7% on the first three desktop scroll positions — the sidebar shifts by about a pixel.

  Both are small and neither is understood. They are listed rather than absorbed into a green tick.

  **A pre-existing bug this conversion reproduces rather than fixes.** The docs' `@source` covers `node_modules/boltdocs/dist`, and the theme now lives in a workspace package that pnpm links outside `node_modules` — so Tailwind never scans it and utilities used only there are never emitted. `sm:text-sm` on the breadcrumbs and `hover:bg-surface` on the sidebar links were both absent from the built CSS, and the components rendered at their base styles. Adding the `@source` fixes it and changes the UI on ~900 screenshots, so it is deliberately **not** in this change; the breadcrumbs are pinned to the 12px that actually rendered rather than the 14px the markup asked for.

  **39 of 63 components remain on utility classes.** They still need a Tailwind build. `tests/native-styles.test.ts` fails a converted component that grows a utility again, and prints the remaining count on every run.

  Also found in passing, unrelated to CSS: the static output carries `<title>X</title>`. Titles are injected at runtime, so nothing prerenders them. That is an SEO problem, not a styling one, and it is not fixed here.

- 597897b: Ship 11.7 MB fewer installed packages by depending on the Shiki packages actually used.

  The core imported `shiki/core` and a few Shiki types, but declared the full `shiki` package, which carries `@shikijs/langs` (9.9 MB) and `@shikijs/themes` (1.8 MB) as ordinary dependencies. Of the 347 language grammars in `@shikijs/langs`, the highlighter could reach 39 — any other fence fell back to plain text — so roughly 8 MB of grammars was unreachable on every install.

  The reachable grammars are now vendored inside the package and `shiki` is replaced by `@shikijs/core` plus the two engine packages, imported at their real paths. Highlighting output is unchanged: a documentation build of 259 pages containing 956 code blocks across 17 languages produces byte-identical HTML.

- Updated dependencies [1413a37]
- Updated dependencies [5f7a09c]
- Updated dependencies [4fb6ed1]
- Updated dependencies [d80c6e1]
- Updated dependencies [cdd636a]
- Updated dependencies [ffb5e55]
- Updated dependencies [4fb6ed1]
- Updated dependencies [9a4c13b]
- Updated dependencies
- Updated dependencies [4fb6ed1]
- Updated dependencies [4fb6ed1]
- Updated dependencies [80b8bba]
- Updated dependencies [94aebbc]
- Updated dependencies [59b5f67]
- Updated dependencies [cf79338]
- Updated dependencies [5f7a09c]
- Updated dependencies [ffb5e55]
- Updated dependencies
  - @bdocs/contracts@0.2.0
  - @bdocs/unist-utils@0.3.0
  - @bdocs/processor-satteri@1.0.0
  - @bdocs/ssg@0.6.0
  - @bdocs/grammars@1.1.0
  - @bdocs/highlight@1.1.0
  - @bdocs/parser@1.2.1

## 3.4.1

### Patch Changes

- [`fc9d351`](https://github.com/bolt-docs/boltdocs/commit/fc9d351be3e18a4d804f5215b82dd3f565ec8f58) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix i18n locale switching for collection routes (blog posts)

  The locale switching logic in `useI18n` hook incorrectly hardcoded locale position for collection routes, causing 404s when switching languages on blog posts.

  **Fixed scenarios:**
  - `/es/blog/post` → English now correctly navigates to `/blog/post` (was staying at `/es/blog/post`)
  - `/blog/post` → Spanish now correctly navigates to `/es/blog/post` (was going to `/blog/es/post`)
  - Versioned collection routes preserve version: `/v2/es/blog/post` ↔ `/v2/blog/post`
  - Collection root pages (e.g., `/docs/blog`) no longer navigate away when switching locale

  The fix uses the same path parsing logic as the router (`getCollectionFromPath`) to correctly detect locale position relative to version prefixes and collection names.

## 3.4.0

### Minor Changes

- [`f0a7586`](https://github.com/bolt-docs/boltdocs/commit/f0a75864646c3752c4ea258e2890ecc31717aa9f) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Add viewport-triggered route prefetching so scrolling to a link warms it before the click.

  Prefetching only ran on `mouseenter`/`focus`, which misses how docs are actually read: a reader scrolls the sidebar, reads a heading, and clicks without ever hovering. Every plausible destination was on screen and untouched.

  `Link` now accepts `prefetch="viewport"`, which keeps hover behaviour and additionally warms the destination as the link approaches the viewport via a single shared `IntersectionObserver`. The sidebar links and the navbar's top-level items opt in. Prefetching downloads the route's lazy chunk and loader data, not the HTML, so it slots into the existing prefetch queue unchanged: two requests in flight, a shallow backlog, and dropped work when saturated. A 200px root margin starts the warm-up just before the link scrolls in.

  Opt-in per link rather than global, so themes and existing users do not silently start paying for extra bandwidth.

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

- [`f6235ac`](https://github.com/bolt-docs/boltdocs/commit/f6235ac3559a7bc0f05ab053b1b630e01d978986) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Render client-side redirects through the framework's own router

  `buildRedirectRoutes` rendered its redirect boundary with `useNavigate` from
  `react-router-dom`, but the framework ships its own context-based router
  (`packages/boltdocs-engine/src/client/router`) and never mounts a react-router provider.
  On a client navigation into a configured redirect the hook had no router to
  read from, so `redirects` threw instead of navigating. The boundary now uses the
  internal `useNavigate`, matching every other component, and core no longer
  imports `react-router-dom` — a package it stopped declaring when the dependency
  was dropped from the manifest, which also broke the redirect tests' module
  resolution.

- [`05d8ddc`](https://github.com/bolt-docs/boltdocs/commit/05d8ddc432f804b0fdc8f5c5db4ac8090c92a2d8) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix the favicon and logo preload URLs in the dev server

  The dev HTML middleware injected the head meta itself and then called
  `server.transformIndexHtml`, whose hook injected it again, so every injected
  `<link>`/`<meta>` was emitted twice. On top of that, `injectHtmlMeta` prefixed
  `config.base` onto the favicon and logo-preload URLs, and Vite's dev HTML
  transform prepends the base to root-absolute public URLs as well. Under a
  non-root base (`/docs`) the two produced `/docs/docs/light.svg`, so the favicon
  only failed in `boltdocs dev` while production stayed correct (Vite's build
  HTML transform is base-aware).

  The framework now emits those Vite-processed URLs without the base and lets Vite
  apply it exactly once, strips a base already written by the user so injection is
  idempotent, injects the head meta from the single `transformIndexHtml` hook, and
  serves the project's real `index.html` to browsers in dev instead of the neutral
  shell.

- [`d7f19fb`](https://github.com/bolt-docs/boltdocs/commit/d7f19fb48d280a760acf75d26f2bfa728e5e2a60) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Silence the dev server when a dependency is inlined by the optimizer

  `react-fast-compare` and `invariant` were listed in `optimizeDeps.include`, but
  they are transitive dependencies of `react-helmet-async` that pnpm does not
  hoist to the project root. Vite could not resolve them and logged
  "Failed to resolve dependency" on every cold start. Both are inlined into
  `react-helmet-async`'s own optimized bundle, so the explicit entries were
  unnecessary and are removed.

- [`c38766b`](https://github.com/bolt-docs/boltdocs/commit/c38766b3fb1fdd1e45578bd3cb3d31c699cf4a30) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Defer dependency prewarming until the optimizer settles

  `setupPrewarming` warmed the optimized dependencies synchronously in
  `configureServer`, racing Vite's dependency optimizer. On the first start after
  a version bump, or with `--force`, it requested chunks written by the previous
  run that the optimizer had already replaced, which surfaced as
  "Pre-transform error: The file does not exist at .../rolldown-runtime-\*.js".
  Warming now runs after the prewarm delay and skips any dependency whose shared
  chunks are missing.

- [`e203fcb`](https://github.com/bolt-docs/boltdocs/commit/e203fcbce495f96f66594e33ea21c2e430e9fde1) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix site-root external pages 404ing in `dev` when a `base` is configured, and fix link autocompletion dropping external and collection routes.

  Vite is configured with the same `base` as Boltdocs, and Vite's base middleware answers every request outside that base with `404 The server is configured with a public base URL of /docs`. External pages are real routes that live at the site root by design (`/`, `/about`, `/roadmap`, `/showcase`), and the SSG already emitted them at the dist root, so production always served them while `dev` could not. The dev server now rewrites the internal URL of a known external path to its base-prefixed form before Vite's base check runs; the browser URL is untouched and the rendered HTML keeps using absolute `/docs/...` asset URLs.

  The generated link tree and `types.d.ts` route list are now assembled by a single shared helper. Four call sites had each grown their own copy and a fifth in the dev server only passed the raw doc route paths, so `/roadmap`, `/showcase`, `/about` and `/docs` were missing from the generated tree and lost autocompletion. The shared helper also base-prefixes collection routes, whose metadata omits the base even though the SSG emits them under it, fixing entries like `/blog/post` being offered instead of `/docs/blog/post`. `generateProjectTypes` calls made during HMR no longer strip the `RoutePaths` augmentation, which previously wiped link autocompletion on any `mdx-components` edit or page addition until the next full run.

- [`24e3607`](https://github.com/bolt-docs/boltdocs/commit/24e36071381699e8112123935243e82e641c6728) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Give every focusable element a visible keyboard focus indicator.

  Components suppress the user-agent ring with `outline-none` and are expected to supply their own `focus-visible:` affordance, but many did not. The banner dismiss button, the navbar links, the language switcher and the code copy button were reachable by keyboard with no visible focus indicator at all, which fails WCAG 2.4.7 Focus Visible. `focus-visible:outline-2` alone was not sufficient either: it emits `outline-style: var(--tw-outline-style)`, a variable only defined by the all-in-one `outline` utility, so the declaration was invalid and nothing was painted.

  `reset.css` now declares a layer order and carries a baseline in a new `a11y` layer ordered after `utilities`, since cascade layers outrank selector specificity and a rule in `base` cannot beat the `outline-none` utility. The baseline is a floor rather than a design: components with a deliberate indicator still win, and a theme can replace it from its own stylesheet.

- [`147d39f`](https://github.com/bolt-docs/boltdocs/commit/147d39fb2e23c575b92cfa281869fffa50221a50) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Make server-rendered dates deterministic and fix theme-dependent assets

  Three classes of hydration mismatch, all caused by the server and the browser
  computing different markup for the same content.

  **Dates.** `toLocaleDateString` without a locale resolves against the runtime
  default, which is not the same in Node and in a browser: the server rendered
  "26 de septiembre de 2026" from an `es` system locale while the client produced
  "September 26, 2026". The time zone had to be pinned for the same reason, since
  a frontmatter date such as `2026-09-27` parses as UTC midnight and any zone
  behind UTC renders the previous day. All call sites now share one helper
  (`formatDate` / `formatDeterministicDate`, both exported) with an explicit
  locale and zone.

  **Logo.** `useNavbar` resolved `theme.logo` to a single source based on the
  resolved theme, which the server cannot know. That changed the `<img src>` and,
  with it, the `href` of the preload React hoists for `fetchPriority="high"`, so
  the client never claimed the node the server had emitted. The hook now returns
  both variants and CSS selects the visible one, keyed off the `dark` class that a
  blocking script sets on `<html>` before first paint. That also removes the
  wrong-logo flash.

  **Cover images.** `post.coverImage` from frontmatter is site-root-relative, and
  a site served under a sub-path needs the base prefixed. Skipping it produced a
  404 in the browser while the server-rendered markup still looked correct.

- [`7841b09`](https://github.com/bolt-docs/boltdocs/commit/7841b0979f4cd60d70829bd9d6c5feb332dc8e12) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Restore React Fast Refresh for sites configured with a non-root `base`, and stop forcing a full reload when a layout or external page is edited.

  `@vitejs/plugin-react` was skipped in dev for any base other than `/`, so the most common documentation setup — `base: '/docs'` — had no refresh runtime at all. Without it there is nothing to swap a module in place, so every edit to `layout.tsx`, `icons.tsx` or an external page fell back to a full document reload that discarded scroll position and re-ran every loader. The plugin handles a sub-path base correctly, so the restriction is removed; `BOLTDOCS_REACT_REFRESH=false` still opts out.

  The dev server also no longer answers a `pages-external` change with a full reload. Those files are plain React modules behind the user entry, so Vite's module graph and React Fast Refresh already handle them; the previous suppression made a one-line edit to a landing page the slowest possible kind of edit.

- [`e7b213c`](https://github.com/bolt-docs/boltdocs/commit/e7b213cfd4a0c3b6232a79e8861e2215f0b4bd09) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix two routing bugs that broke server-rendered pages

  **External pages under the default locale returned 404.** `getLocalizedPaths`
  looped over every configured locale to build the localized variants of an
  external page, including the default one. That minted a second URL for the same
  page, and on a site served under a base the SSG wrote `/docs/en/about` — a
  document the build itself generated and the client router never learned about,
  because the base is not part of the route. Visitors got a 404 on a page that
  existed. The default locale is now skipped; it is already the unprefixed path.

  **Collection posts failed hydration.** `MdxPage` decided between the collection
  layout and the documentation layout by inspecting the route's loader data. The
  generated client entry declares `hasLoaderData={false}`, so the first client
  render runs with no loader data at all, and the layout came out wrong: the
  server had sent the collection layout and the client rendered the documentation
  one. React compared two different first children and threw the whole page away
  (error [#418](https://github.com/bolt-docs/boltdocs/issues/418)), re-rendering every node.

  The layout is now decided from the route table, which is known synchronously,
  with the loader kept as a fallback for callers that render `MdxPage` directly.
  A project declaring a collection does not have to know about any of this.

- Updated dependencies [[`c00f9ff`](https://github.com/bolt-docs/boltdocs/commit/c00f9ffb422109918e246974c4172ba10b362554), [`8abe562`](https://github.com/bolt-docs/boltdocs/commit/8abe5625b80f4e588341d4488c774a323561256a), [`53be90d`](https://github.com/bolt-docs/boltdocs/commit/53be90d0edf5daabb207d87bd3e9f79160ffa4cc), [`147d39f`](https://github.com/bolt-docs/boltdocs/commit/147d39fb2e23c575b92cfa281869fffa50221a50), [`1d62dac`](https://github.com/bolt-docs/boltdocs/commit/1d62dac2bc237a919df6a89d5ebf7c94a94f742b)]:
  - @bdocs/processor-satteri@0.4.0
  - @bdocs/ssg@0.5.0
  - @bdocs/contracts@0.1.0

## 3.3.6

### Patch Changes

- [`4e8d80e`](https://github.com/bolt-docs/boltdocs/commit/4e8d80e5157ab637dde917f42d30878ab2a0347d) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Accessibility: axe-core clean across docs surfaces
  - Tabs: the list component accepts an overridable role so link-based
    navigation tabs can opt out of the ARIA `tablist` widget semantics (a
    tablist requires `tab` children and failed automated audits).
  - OnThisPage: the active-track indicator moved out of the list element
    (invalid list children), is hidden from assistive tech, and now measures
    against its actual positioning context; the nav landmark gained an
    accessible label.
  - Navbar: nav landmarks accept distinguishable labels; the site-title home
    link keeps an accessible name on viewports where the visible title is
    hidden; the mobile nav is labeled.
  - Sidebar and page navigation landmarks are labeled by default.
  - External (non-docs) pages render their content inside a `<main>` landmark.
  - Feedback prompt uses the correct heading level.
  - Search trigger exposes an accessible name and raises the visible hint
    text contrast to meet WCAG AA.
  - ErrorBoundary primitive accepts `resetKeys` (auto-reset on route change),
    matching what the shell already passed through.
  - Shiki adapter: new `codeHighlighting.options.colorReplacements` support so
    sites can raise theme token colors (e.g. github-dark comments) to AA
    contrast. Hex keys are matched case-insensitively, and the cached adapter
    identity now includes this option so configuration changes take effect.

- [`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Finish the Ask AI integration: restore public plugin metadata and floating client slots, harden provider routing and server errors, enforce request/input limits across every adapter, add a customizable accessible chat UI, and expand security and DOM regression coverage.

- [`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Avoid static default imports when generating plugin MDX components. Named plugin components such as `@bdocs/plugin-math/client` do not need a default export, and using `Reflect.get` prevents Vite/Rolldown from emitting `IMPORT_IS_UNDEFINED` warnings during client and SSR builds.

- [`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Align internal Vite development and build tooling on Vite 8.1, make the Boltdocs versus Docusaurus Faster benchmark cold-cache aware, and preserve route-level SSG render identity when a client build cannot emit a route-specific chunk.

- Updated dependencies [[`682d0c1`](https://github.com/bolt-docs/boltdocs/commit/682d0c1252097491faf3752e3337ea681271a3e0)]:
  - @bdocs/ssg@0.4.4
  - @bdocs/processor-satteri@0.3.4

## 3.3.5

### Patch Changes

- [`8cbd78e`](https://github.com/bolt-docs/boltdocs/commit/8cbd78ee2ee8dc28f4f0ca80711235ce019e5227) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Entry bundle diet: KaTeX baked at build time, FlexSearch loaded on demand
  - The math plugin's `transformSource` hook now renders TeX with KaTeX during
    the build and emits `<BlockMath html={...}>` / `<MathComponent html={...}>`
    carrying the pre-rendered HTML. Client math components render the baked
    `html` synchronously; direct MDX usage without the bake falls back to an
    on-demand `import('katex')` (raw TeX stays visible until it resolves, so
    SSR and the first client render agree). The ~250 KB of KaTeX no longer
    ships in the entry bundle of every page.
  - FlexSearch is imported dynamically when the search dialog opens instead of
    statically at startup (~49 KB out of the entry).
  - Measured on the docs site: entry chunk 1,023 KB → 718 KB raw (266 → 172 KB
    gzipped, −35%); KaTeX and FlexSearch now load as on-demand chunks.

- [`f05a7d2`](https://github.com/bolt-docs/boltdocs/commit/f05a7d20bd76ccf59eb79bdb98c630f1c610cf77) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Lazy external pages: marketing pages no longer ship inside the docs entry bundle
  - External pages registered through `pages-external` (landing, about, showcase,
    roadmap) can now be declared as dynamic `loader`s instead of static
    `component` imports. Both mechanisms wrap the page in `React.lazy` with the
    same `record.lazy` flow MDX pages already use: the SSG pre-renders the real
    HTML server-side and the client hydrates when the lazy chunk arrives, so
    there is no flash of empty content.
  - The generated entry now emits dynamic imports for file-routed external pages.
  - The docs site converts its `pages-external/index.tsx` map to loaders.
  - Measured on the docs site: entry chunk 1,239 KB → 1,023 KB raw (338 → 266 KB
    gz, −21%); the landing component tree now loads on demand as its own chunk.
  - Landing hero WebGL effect (LightRays) capped: dpr 1, 30 fps, paused while the
    tab is hidden, and disabled under `prefers-reduced-motion`.

- [`b8e272f`](https://github.com/bolt-docs/boltdocs/commit/b8e272f532c298606539dafb4fe10945a080bc42) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - OnThisPage always renders: stale critical CSS no longer survives client-side navigation, and collection posts resolve their route metadata
  - **Stale critters inline styles removed after hydration.** Each pre-rendered
    page inlines a `<style data-zig-critters>` block containing the utilities
    that page uses. After a client-side navigation the first page's block stayed
    in `<head>`, emitted after the external stylesheet, so its `.hidden` (and
    any other shared utility) beat the stylesheet for the rest of the session —
    pages reached via SPA silently lost styles the landing never used (the
    OnThisPage rail is hidden by default and revealed by `xl:flex`, so it
    vanished on every SPA path). The shell now removes these blocks on mount;
    the external stylesheet is always present before hydration, so removal
    cannot cause a flash.
  - **Collection posts resolve `currentRoute` on the client.** Collection post
    route records are registered without the docs base (and sometimes without a
    leading slash), while the browser URL carries both, so `useRoutes()` missed
    and every consumer of `currentRoute` (OnThisPage, navbar docs detection,
    edit links) received `undefined` on post pages. When the direct lookup
    misses, registered collection routes now fall back to the longest
    segment-tail match against the current pathname, restricted to
    `route.collection` so regular docs pages can never be shadowed.
  - **Client hash includes the site's `src/` directory.** Theme layouts,
    components and styles are bundled by Vite like framework code but were not
    hashed, so a theme-only edit skipped the client build and every cached page
    silently kept the previous layout. `src/` now participates in the client
    code hash.

- Updated dependencies [[`75863f2`](https://github.com/bolt-docs/boltdocs/commit/75863f226dab04ea25bb5686221918352a8ddef5), [`f05a7d2`](https://github.com/bolt-docs/boltdocs/commit/f05a7d20bd76ccf59eb79bdb98c630f1c610cf77), [`b8e272f`](https://github.com/bolt-docs/boltdocs/commit/b8e272f532c298606539dafb4fe10945a080bc42)]:
  - @bdocs/ssg@0.4.3

## 3.3.4

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

- Updated dependencies [[`f5f2a1d`](https://github.com/bolt-docs/boltdocs/commit/f5f2a1dd7fa90740ff7a4cd862bc0abc52deadb1)]:
  - @bdocs/processor-satteri@0.3.3

## 3.3.3

### Patch Changes

- [`f8b96e0`](https://github.com/bolt-docs/boltdocs/commit/f8b96e0c868592743b0de0604709731d98e0e73a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Make the critical-CSS inline budget configurable and raise the default so real sites actually get inline critical CSS.
  - **`ssg.criticalCssMaxSize`** (new config option, bytes): per-page budget for the `<style data-zig-critters>` block. Pages whose extracted critical CSS exceeds the budget skip inlining (with a build warning naming the page and sizes).
  - **Default raised from 8KB to 24KB**: the engine's inherited 8KB budget silently discarded the critical CSS of real docs sites — the boltdocs docs site measures 16–18KB per page, so every page shipped with no inline critical CSS. With the new default the docs build inlines critical CSS on all pages again (direct LCP/FCP win; render-blocking CSS no longer blocks first paint).
  - Zig-critters 0.2.x users outside boltdocs are unaffected; the WASM `maxSize` contract is unchanged, boltdocs now passes the budget explicitly.

- [`67e9a00`](https://github.com/bolt-docs/boltdocs/commit/67e9a00b410720bf21f5516c214c991d544b6e1e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Make code syntax highlighting engine-agnostic: the core now renders via a `CodeHighlighterAdapter` resolved from a registry instead of calling Shiki directly.
  - **`theme.codeHighlighting`**: new configuration surface (`engine`, `theme`, `options`) that replaces `theme.codeTheme`. Shiki remains the built-in default engine (`engine: 'shiki'`); any adapter instance or factory can be injected inline. A **string shorthand** is accepted — `codeHighlighting: 'shiki'` is equivalent to `{ engine: 'shiki' }`. `theme.codeTheme` still works as a deprecated alias resolving to `codeHighlighting.theme`. Single-string themes render single-theme output (no dual-mode CSS variables), and objects keep the dual light/dark `data-theme-mode="dual"` rendering.
  - **Highlighter registry** (`boltdocs/node/highlight`): `getCodeHighlighterAdapter()`, `registerHighlighter()` / `registerPluginHighlighter()`, and `prewarmHighlighter()`. Engines that are never selected cost nothing at runtime; the current engine is prewarmed during build and after the dev server starts. A broken or unresolvable engine falls back to Shiki with a warning instead of failing the build.
  - **Plugin field `codeHighlighter`**: plugins expose their engine under `plugin.name`, so `theme.codeHighlighting.engine` can select it by id.
  - **`options.regexEngine: 'oniguruma' | 'javascript'`** for the Shiki engine: the **JavaScript regex engine is now the default**, cutting highlighter startup from ~2.5s to ~200ms per compile-pool worker. Unsupported grammar regexes degrade approximately (`forgiving` mode) instead of failing. Pass `regexEngine: 'oniguruma'` for bit-exact TextMate fidelity on exotic grammars.
  - **Single grammar pass per code block**: the Sätteri rehype plugin serializes the highlighted HAST (`hast-util-to-html`) instead of re-running the grammar through `codeToHtml`, roughly halving highlighting CPU per block. `data-highlighted-html` output is byte-equivalent.
  - **Per-worker highlight cache**: identical `(lang, options, code)` blocks highlight once per long-lived compile-pool worker (LRU, 2000 entries) — repeated install commands and shared snippets across hundreds of pages are free.
  - **Grammar prewarm at pool start**: compile workers now prewarm with fenced blocks in every eager language, so grammar loading overlaps pool spin-up instead of running serially on the first pages.
  - The Sätteri rehype plugin is renamed to `satteriRehypeCodeHighlightPlugin` (`satteriRehypeShikiPlugin` kept as an alias) and emits engine-neutral `data-code-engine` / `data-theme-mode` attributes while keeping the `.shiki-*` classes for backwards compatibility.

- [`0302a58`](https://github.com/bolt-docs/boltdocs/commit/0302a581a9fce6be012b01ab52d67028ccb479b8) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Per-pack render granularity: text-only edits re-render only the edited page's chunk pack instead of the whole site
  - **Per-route render identity**: each route's identity is now the Sätteri chunk-pack hash (strategy 1.5 in `computeRouteClientAssetHash`), mixed with an SSR-bundle identity guard (entry/layouts/theme, page-body chunk and manifests excluded) and a stylesheet-identity guard. Layout/CSS edits still re-render everything — correctly; text edits don't.
  - **Cache-hit entry-script rewrite**: a cache hit that survives a client rebuild rewrites the stale `app-*.js` URL embedded in the cached HTML to the fresh bundle's URL, instead of re-rendering the page.
  - **Fixed an SSR/client race** in the virtual-module plugins: the client entry no longer reads the shared global resolved config (which the SSR build could overwrite last — client builds raced into the SSR branch, inlining `combined.mjs` and skipping the `search.json` asset). Per-call `ssr` resolution now uses `this.environment.config.consumer`.
  - **`_rawContent` out of the client bundle**: full MDX source text no longer ships inside `virtual:boltdocs-routes`/`app-*.js` (~1.1MB smaller shared chunk). It's served lazily via `page-source.json` (fetched by CopyMarkdown at copy time, one session-cached request).
  - Measured on the docs site: 1-page text edit re-renders 78/259 pages (was 259), no-op builds 0.5s, revert oscillation eliminated, ultra-warm fast path intact.

- [`4da1cae`](https://github.com/bolt-docs/boltdocs/commit/4da1cae105a0919c5280bd4f57c7a561fbfca5cd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Faster incremental builds: SSR module prewarm in parallel with bundle builds, higher finalize/render concurrency, and Node compile cache for the CLI
  - **SSG (`@bdocs/ssg`)**: when the SSR bundle is cached on disk, its ES module is imported in parallel with the bundle builds instead of serially after them (removes up to ~10s from the critical path on incremental builds).
  - **SSG (`@bdocs/ssg`)**: finalize queue concurrency raised to match the critters WASM pool size, and the default SSG render worker count scales with available cores (RAM-aware guard kept).
  - **Core (`boltdocs`)**: the CLI enables Node's `module.enableCompileCache()` when available, skipping repeated JS parse work on every command.

- Updated dependencies [[`f8b96e0`](https://github.com/bolt-docs/boltdocs/commit/f8b96e0c868592743b0de0604709731d98e0e73a), [`34f16ca`](https://github.com/bolt-docs/boltdocs/commit/34f16caa5e820538942471aeaa4611edf1de8ba2), [`67e9a00`](https://github.com/bolt-docs/boltdocs/commit/67e9a00b410720bf21f5516c214c991d544b6e1e), [`0302a58`](https://github.com/bolt-docs/boltdocs/commit/0302a581a9fce6be012b01ab52d67028ccb479b8), [`eed5613`](https://github.com/bolt-docs/boltdocs/commit/eed56139c20fac1b13a575acffdb1104480c6be2), [`a9189d6`](https://github.com/bolt-docs/boltdocs/commit/a9189d6be7e5adf56f3f43c60ecde97137b2714c), [`4da1cae`](https://github.com/bolt-docs/boltdocs/commit/4da1cae105a0919c5280bd4f57c7a561fbfca5cd), [`1a044a2`](https://github.com/bolt-docs/boltdocs/commit/1a044a209d03cf3d94528c1bc93cc14784518905)]:
  - @bdocs/ssg@0.4.2
  - @bdocs/processor-satteri@0.3.2
  - @bdocs/unist-utils@0.2.1

## 3.3.2

### Patch Changes

- Updated dependencies [[`fbd8502`](https://github.com/bolt-docs/boltdocs/commit/fbd850235fba791b65945fe14ff519cff9dedd25)]:
  - @bdocs/processor-satteri@0.3.1

## 3.3.1

### Patch Changes

- [`8b7a4f8`](https://github.com/bolt-docs/boltdocs/commit/8b7a4f8ef18f787735cca6c273f300e0dc2e9f30) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Faster critical CSS extraction (zig-critters): worker-threads pool, resident WASM CSS, single-pass injection
  - **Worker-threads pool**: each pool worker owns a private WASM instance (up to `min(availableParallelism, 8)`, capped by render concurrency), so pages extract in parallel instead of queuing on one process-global instance. The serial API remains as fallback.
  - **Resident CSS in WASM memory**: the stylesheet is encoded and copied into each instance once per build (cached by string reference) instead of once per page.
  - **Single-pass injection**: the SSG render path wraps the extraction result itself, removing the previous inject-then-regex-extract double scan of every page and fixing a `'\\n'` literal-join bug in multi-tag extraction.
  - **Cheaper cache keys**: the stylesheet is hashed once per build and the digest is passed to `createCriticalCssCacheKey` (internal), removing a repeated O(css) SHA-256 per page.
  - **Correctness fixes**: the legacy `turbo` option now actually enables zig-critters (it previously resolved to disabled); the critters pool is disposed at build end; and dropped extractions now warn instead of failing silently when critical CSS exceeds the default 8 KB `maxSize` budget.

  Measured on the docs site (259 pages, identical client bundle): critters p50 468ms → 210ms, p95 1644ms → 1064ms, render phase 82.9s → 34.0s, with byte-identical critical CSS output.

- Updated dependencies [[`8b7a4f8`](https://github.com/bolt-docs/boltdocs/commit/8b7a4f8ef18f787735cca6c273f300e0dc2e9f30)]:
  - @bdocs/ssg@0.4.1

## 3.3.0

### Minor Changes

- [`8a5c519`](https://github.com/bolt-docs/boltdocs/commit/8a5c5195907b77825f364a8195cd0ae8554a69d6) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Add locale support to `experimental.fileRouting`: a top-level `pages-external/{locale}/` directory matching a configured locale now provides the localized variant of a page (`es/roadmap.mdx` → `/es/roadmap`). Each locale URL is served by its localized file when it exists and falls back to the default-locale file otherwise, mirroring the docs i18n fallback routes. For React pages that translate internally with `useI18n()`, the fallback re-renders the default component with the active locale from the URL context.

- [`6472b84`](https://github.com/bolt-docs/boltdocs/commit/6472b841ef18aa92033a0b64d8fd70281ce954dc) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Add a first-class `aliases` configuration API for project-specific module aliases while preserving Boltdocs' internal aliases. User-defined aliases are merged into the generated Vite configuration, so configuring `vite.resolve` no longer removes framework aliases such as `boltdocs/entry` and `boltdocs/client`.

- [`dffb1d0`](https://github.com/bolt-docs/boltdocs/commit/dffb1d0c70b5da1ddf53484c1b43d0c141eacdad) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - **Sidebar primitives**: `Sidebar.Items` now accepts `classNames` (per-piece `SidebarSlots` merged over the defaults with `tailwind-merge`) plus `componentItem` and `componentGroup` render props for full structural replacement. `Sidebar.Link`, `Sidebar.Group` and `Sidebar.SubGroup` gained the corresponding slot props (`iconClassName`, `labelClassName`, `trailing`, `headerClassName`, `renderTitle`, `toggleClassName`, `renderToggle`, etc.). `Sidebar.Item` accepts `depth`, `renderItem` and `classNames`. `useSidebar` now exposes `merged`, `tree`, `isActive` and `isGroupActive`, alongside pure helpers `isRouteActive` and `hasChildren`. Fixed a latent bug where `SidebarItems` declared a `componentItem` prop that was never used.

  **CodeBlock primitives**: new `CodeBlock.Actions`, `CodeBlock.Pre` and `CodeBlock.Expand` parts. Feature-scoped hooks `useCopyButton`, `useExpandable` and `useCodeBlockFeedback` are exported from `boltdocs/client`; the historical `useCodeBlock` hook is now a deprecated composition of them and will be removed in a future major.

- [`36c959e`](https://github.com/bolt-docs/boltdocs/commit/36c959e922b491fa0e0de16f53be4dd6f894ba4b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Every CLI command now uses the brand terracotta palette (`#eb5828` / `#d34013`) — dev, preview, build, doctor, and audit outputs share the same wordmark gradient, borders, bullets, and badges instead of mixing generic cyan/sky/blue status colors. The `DEV`, `PREVIEW`, version, and `UPDATE` chips are brand-colored, the doctor header carries the branded wordmark with version badge and terracotta section titles (low-severity chips also match the brand; high/warning keep their semantic red/yellow), and the audit renders plugin names, low-risk tags, and the summary table borders in terracotta while staying dependency-free. The build summary was rewritten as a single compact block (header with version badge, per-phase timings, and a one-line metrics summary — pages, JS, CSS, output dir), replacing the previous steps + divider + total + table + box sequence and cutting the number of stdout writes during a build. The SSG worker-pool diagnostics log is now emitted only in benchmark mode so ordinary builds stay quiet.

  Two sidebar-related fixes land with it: `meta.json` resolution is now scoped per tab and per locale (so groups that share a directory name across tabs, like `(guides)/content` vs `(plugins)/content`, no longer clobber each other, and localized sites resolve their own translated meta instead of falling back to English titles), and an explicit `meta.json` `order` takes precedence over an index page's own `sidebarPosition` for group ordering. Collection pages (blog lists and posts) are also detected from any URL path segment rather than only the first one, which stops the docs sidebar from rendering on collection posts whose routes are registered without the docs base (e.g. `/blog/post` vs `/docs/blog/post`).

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Release 3.3.0: replace react-router-dom with a custom micro-router, make the core CSS-agnostic (Tailwind is no longer assumed), add the `definePlugin` API with typed lifecycle hooks, opt-in JSON-LD structured data, View Transitions, and `experimental.fileRouting` for literal `pages-external/` files. Collection posts now sort by descending publication date, and the plugin security audit (`boltdocs audit`) gained accurate plugin resolution, bounded scans, fail-closed summaries, and faster startup.

### Patch Changes

- [`a33d512`](https://github.com/bolt-docs/boltdocs/commit/a33d512b965bcc701ed76e98db632dcf45fd8bd9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix a dev-server race where a `server.restart()` could dispose the shared route-cache context while the new server's virtual modules still held a reference to it, surfacing as "Route cache context has been disposed" errors on reload. The route cache context is now re-created defensively when a disposed context is detected during route regeneration.

  Fix code highlighting when a single `codeTheme` string (e.g. `codeTheme: 'github-dark'`) is configured: the Sätteri rehype-shiki plugin now receives the resolved `codeTheme` and passes it to the Shiki adapter, instead of silently falling back to the default light/dark dual theme (which produced dual-theme CSS variables that broke single-theme color rendering).

  Fix stale compiled-MDX output after processor changes: the compiled-pages cache key now includes the `@bdocs/processor-satteri` package version and the manifest version is bumped, so any published change to the compiler pipeline (e.g. Shiki highlighting) invalidates previously cached pages instead of serving pre-fix output.

  Fix code-block syntax highlighting disappearing in dark mode: the theme's Shiki light/dark color rules were applied to every `.shiki` block via `color: var(--shiki-dark) !important`, which wiped single-theme inline token colors (e.g. `codeTheme: 'github-dark'`) because `--shiki-dark` is undefined on that output. Those rules are now scoped to dual-theme output (`.shiki.shiki-themes`) and cover both light and dark modes, leaving single-theme inline colors intact.

  Fix code blocks in languages outside the bundled grammar list (e.g. `nginx`, `apache`) silently rendering as unformatted plain text: the Sätteri rehype-shiki plugin now retries unknown languages as `plaintext` so the block keeps its Shiki styling instead of falling back to an unstyled pre, and the bundled language list is expanded with common documentation-site languages (`nginx`, `apache`, `dockerfile`, `docker`, `json5`, `scss`, `less`, `python`, `go`, `java`, `php`, `sql`, `graphql`, `http`, `xml`, `vue`, `svelte`, `ruby`, `kotlin`, `swift`, `powershell`, `c`, `cpp`, `elixir`).

- [`d07e49d`](https://github.com/bolt-docs/boltdocs/commit/d07e49d48ac2ab3f0ab289541b37610bd54247a8) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Rebrand the CLI output (dev/preview server boxes, build summary, doctor, update prompt) from the former terracotta brand color to an azure-blue accent (`#3d8bfa`), matching the updated primary palette. The `TERRACOTTA`/`TERRACOTTA_DEEP` exports in `ui-utils` are renamed to `BRAND`/`BRAND_DEEP`.

- [`33a4e4b`](https://github.com/bolt-docs/boltdocs/commit/33a4e4b6d7e95552e0f16228a045b41a02f82e33) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix locale selector becoming unresponsive after switching languages. An optimistic store write re-rendered the shell's route sync while the router location was still stale (navigation lands on a later task), reverting the locale preference mid-navigation; the next selector interaction compared against the rolled-back value and silently no-op'd. The store write is now propagated synchronously to the router's locale registry and route syncing matches against the live browser URL, also fixing EN↔ES switching from localized external pages (e.g. `/es` → `/`).

- [`8a5c519`](https://github.com/bolt-docs/boltdocs/commit/8a5c5195907b77825f364a8195cd0ae8554a69d6) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix dev server HMR for `pages-external/` files: explicitly watching `pages-external/index.*` raced with chokidar's initial recursive scan, so files such as `roadmap.mdx` and underscore-prefixed section components were never watched and edits had no effect. The watcher now only extends the watch to paths outside the Vite root, and Vite's default HMR is suppressed for `pages-external/` so changes trigger a single reload. Also wrap file-routed MDX pages in a proper page container (title + prose) inside the external layout.

- Updated dependencies [[`97af04d`](https://github.com/bolt-docs/boltdocs/commit/97af04da95657e1e72ecee548b1c1cc55c3d5f81), [`a33d512`](https://github.com/bolt-docs/boltdocs/commit/a33d512b965bcc701ed76e98db632dcf45fd8bd9), [`36c959e`](https://github.com/bolt-docs/boltdocs/commit/36c959e922b491fa0e0de16f53be4dd6f894ba4b), [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2), [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2), [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2), [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2)]:
  - @bdocs/processor-satteri@0.3.0
  - @bdocs/ssg@0.4.0
  - @bdocs/plugin-image-optimizer@0.2.2
  - @bdocs/parser@1.2.0

## 3.2.2

### Patch Changes

- Updated dependencies [[`9c570fe`](https://github.com/bolt-docs/boltdocs/commit/9c570fe616da29fde6591359e9543de79b9454e9)]:
  - @bdocs/ssg@0.3.1

## 3.2.1

### Patch Changes

- [`4a94958`](https://github.com/bolt-docs/boltdocs/commit/4a94958e480398346001a66d866ecce33d69c5e9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix SSR build errors by externalizing react-router-dom during server-side rendering. Framework aliases for react-router-dom, react-helmet-async, and @bdocs/ssg are now applied only to client builds, preventing duplicate router contexts when @bdocs/ssg provides the Router while BoltdocsShell consumes it.

## 3.2.0

### Minor Changes

- [`6904710`](https://github.com/bolt-docs/boltdocs/commit/6904710df233ff29193adcbb746c4d16011255d3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat(ask-ai): multi-provider support, dev-mode token chip, `useConfig`-driven client config.

  **Provider preset table** — 12 providers wired up via `provider: '<name>'` option:

  | `provider`   | Default `baseURL`                | Default model                    | Env var                |
  | ------------ | -------------------------------- | -------------------------------- | ---------------------- |
  | `openai`     | `https://api.openai.com/v1`      | `gpt-4o-mini`                    | `OPENAI_API_KEY`       |
  | `anthropic`¹ | _(unset, see note)_              | `claude-3-5-haiku-latest`        | `ANTHROPIC_API_KEY`    |
  | `gemini`¹    | _(unset, see note)_              | `gemini-2.0-flash-exp`           | `GEMINI_API_KEY`       |
  | `mistral`    | `https://api.mistral.ai/v1`      | `mistral-small-latest`           | `MISTRAL_API_KEY`      |
  | `cohere`     | `https://api.cohere.ai/v1`       | `command-r-plus`                 | `COHERE_API_KEY`       |
  | `deepseek`   | `https://api.deepseek.com/v1`    | `deepseek-chat`                  | `DEEPSEEK_API_KEY`     |
  | `groq`       | `https://api.groq.com/openai/v1` | `llama-3.1-8b-instant`           | `GROQ_API_KEY`         |
  | `openrouter` | `https://openrouter.ai/api/v1`   | `openai/gpt-4o-mini`             | `OPENROUTER_API_KEY`   |
  | `together`   | `https://api.together.xyz/v1`    | `meta-llama/Llama-3-70b-chat-hf` | `TOGETHER_API_KEY`     |
  | `ollama`     | `http://localhost:11434/v1`      | `llama3.2`                       | `OLLAMA_API_KEY`       |
  | `azure`¹     | _(required)_                     | `gpt-4o-mini`                    | `AZURE_OPENAI_API_KEY` |
  | `custom`¹    | _(required)_                     | `gpt-4o-mini`                    | `OPENAI_API_KEY`       |

  ¹ Anthropic, Gemini, Azure, and Custom providers require a user-supplied `baseURL` (e.g. OpenRouter, LiteLLM, Cloudflare AI Gateway as an OpenAI-compatible proxy). The plugin only speaks the OpenAI Chat Completions wire format.

  **New options:**
  - `provider` — provider preset name (default `'openai'`).
  - `systemPrompts` — per-provider system-prompt override map. Matching provider key wins over global `systemPrompt`.
  - `devMode` — when `true`, the chat UI renders a token-consumption chip (`provider/model`, prompt/completion/total tokens, elapsed ms) below each assistant response. Auto-enabled when `process.env.NODE_ENV !== 'production'`.

  **Client config refactor:** `useAskAi` now reads runtime options via the `useConfig()` hook and the new plugin `metadata` field, replacing the previous `virtual:boltdocs-config` import. The `metadata?: Record<string, unknown>` field was added to both `BoltdocsPlugin` and `SecureBoltdocsPlugin` in core to make this type-safe.

  **Security:** `SECURITY.md` rewritten to document all 12 providers, the dev-mode chip, and the new `metadata` exposure contract.

  **Other fixes:**
  - `handler.ts`: API key lookup now uses `providerEnvKey` instead of hardcoded `OPENAI_API_KEY`.
  - `ServerResponse` import moved from `vite` to `node:http`.
  - Adapter `eventToSse` switches now have a default case (TS2366).
  - Middleware narrows `question` to `string` via local `safeQuestion` (TS2322 fix).

- [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Reduce package weight for downstream consumers.

  `icons-dev.tsx` is split into `icons-prod.tsx` (eager social/nav icons) and `mdx/lang-icons.tsx` (lazy-loaded chunk for MDX code blocks) — pages without code blocks now ship zero bytes of language icons. `react-aria-components` was promoted from `dependencies` to a **required** peer; `sharp` and `svgo` are removed from core (already peers of `@bdocs/plugin-image-optimizer`).

  Public API surface is unchanged — all exports from `'boltdocs'`, `'boltdocs/client'`, `'boltdocs/server'`, `'boltdocs/primitives'`, and `'boltdocs/mdx'` resolve to the same symbols as 3.1.x.

  Sites without `@bdocs/plugin-image-optimizer` save ~35 MB of unpacked native binaries. Sites that use it are unaffected.

  **CI / lockfile-strict setup:** if your CI hard-fails on the `react-aria-components` peer advisory, use `either` `.npmrc` `or` `.pnpmrc` (not both) to whitelist the documented peer — never blanket-disable with `legacy-peer-deps=true`. Full recipes in the [upgrade guide](https://boltdocs.com/docs/guides/upgrading-3-2).

  The dependency contract is pinned by a new `packages/boltdocs-engine/tests/package-shape.test.ts` (8 assertions) so future PRs can't silently re-bloat.

- [`46e288d`](https://github.com/bolt-docs/boltdocs/commit/46e288d485bf50ae226a3b3c70c0a93040b8ae0c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Boltdocs 3.2.0 — Nitro Phase 1 performance optimizations

  ### Cache & Build Performance
  - **SSR output consolidated**: Moved from `.vite-react-ssg-temp/` to `.boltdocs/build/ssr/` — all build artifacts now live under a single `.boltdocs/` directory
  - **Server build skip preserved**: SSR output no longer deleted when client code hasn't changed, making warm builds skip the expensive SSR Vite bundle (~40s saved)
  - **Mtime cache in memory**: `getFileMtime()` now uses an in-memory TTL cache (2s) instead of `fs.statSync()` on every call — 5.9x faster for repeated stat calls
  - **Client hash single stat**: `computeClientCodeHash()` reduced from 3 stat calls per file to 1 — 66% fewer syscalls
  - **Hash meta persistence**: `hash-meta.json` stores file count + last mtime for fast cache validation without full directory scans
  - **Dev gzip skipped**: `TransformCache` no longer gzips cache shards in dev mode

  ### MDX & Routes
  - **MDX cache key for dev**: Uses file path + mtime instead of content hash in dev mode — cache survives restarts when files haven't changed
  - **Bounded route parsing**: `Promise.all` replaced with `runWithConcurrency(32)` to prevent memory pressure and I/O contention
  - **docCache loaded flag**: `docCache.load()` skips disk read when already in memory

  ### Dev Server & HMR
  - **HMR O(1) module graph lookup**: Pre-built lowercase index replaces brute-force O(N) scan for faster content edits
  - **Prewarming with route priority**: Index pages and getting-started are prewarmed first; 150ms delay to avoid CPU contention with first page request

  ### Pipeline & Syntax Highlighting
  - **Pipeline parallel steps**: SEO validation and type generation run concurrently via `addParallelSteps()`
  - **Pipeline timing logs**: Per-step timing reported after build completion
  - **Critical CSS concurrency**: Beasties processor runs at `concurrency: min(cpus, 4)` instead of 1
  - **Shiki WASM engine**: Oniguruma WASM engine replaces JavaScript regex — 13% faster syntax highlighting

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

- [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Phase 2 of the new plugin API: enrich `PluginContext` with four
  new APIs every lifecycle hook receives:

  | New ctx field    | Type                      | What it does                                                                                                                                     |
  | ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
  | `caches`         | `PluginCachesAPI`         | Functional wrappers around the core's `TransformCache`, `FileCache`, and a fresh per-namespace LRU. Never leaks implementation.                  |
  | `diagnostics`    | `PluginDiagnosticsAPI`    | Structured `report()` channel — drain via `list()` from reporters/dev-server overlay/CI.                                                         |
  | `paths`          | `PluginPathsAPI`          | `resolveDocs`, `resolveAsset`, `safeFileURL` — all reject paths that escape the workspace boundary.                                              |
  | `virtualModules` | `PluginVirtualModulesAPI` | Plugins declare `virtual:<plugin>/<id>` modules without authoring a full Vite plugin. The core Vite plugin loads them in a single dispatch path. |

  ### Migration for plugin authors

  ```ts
  // Cache something without reaching into core internals
  ctx.caches
    .transform('my-plugin-rewrites')
    .set('foo', 'bar')

  // Surface a structured warning the dev server can render in an overlay
  ctx.diagnostics.report(
    'warn',
    'MY_PLUGIN_CONFIG',
    'config.foo is missing — using the default',
    { filePath: ctx.docsDir + '/config.ts' },
  )

  // Avoid hand-rolled path joins
  const link = ctx.paths.resolveDocs('assets', 'banner.png')

  // Expose a custom virtual module to clients
  ctx.virtualModules.add(
    'virtual:@my-plugin/runtime-config',
    () => `export default ${JSON.stringify({ ... })};`,
  )
  ```

  Plugin authors do NOT need any extra dependency — `ctx.*` is enriched
  inside Boltdocs core.

  ### Internal changes (no public surface for users)
  - `packages/boltdocs-engine/src/node/plugins/plugin-context.ts` — new module
    implementing the four APIs.
  - `PluginLifecycleManager.createContext()` — extended to inject them.
  - `packages/boltdocs-engine/src/node/plugin/virtual-modules.ts` — `resolveId` and
    `load` branches for plugin-declared virtuals. Two public exports
    added: `invalidatePluginVirtualModules()` (re-export of
    `invalidateVirtualModulesCache`).
  - New `__resetPluginContextStateForTests()` test helper is exported
    from `plugin-context.ts` to clear diagnostic queue and
    plugin-virtual-map between test runs.

  ### Reserved namespace

  Plugin virtual modules registered under the `virtual:boltdocs-` prefix
  are rejected at registration time — the prefix is reserved for core.
  Plugin authors should prefix their ids with the plugin name
  (`virtual:@my-plugin/...` or `virtual:my-plugin-...`).

  ### Out of scope (called out, parked for a later phase)
  - The `eager` flag on `add()` is accepted but not yet wired into the
    generated `boltdocs-entry.tsx`. Phase 7 (MDX transformer API) or a
    later Phase will pick it up to auto-inject plugin virtual imports.
  - The diagnostics queue is process-local. For multi-instance
    deployments front it with a remote sink (file/process-tracker/
    OTEL). The interface stays stable across sinks.

- [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Phase 7 of the new plugin API: transform middleware pipeline and lazy slot
  loading.

  ### Transform Middleware API

  Plugins can now register standalone transform middleware via
  `BoltdocsPlugin.middleware` or programmatically via `ctx.middleware.add()`.

  Each middleware has its own `name` and optional `enforce` ordering (`pre` |
  `post`). Middleware transform functions receive the same enriched params as
  lifecycle hooks and support `__signal: 'skip'` / `__signal: 'break'`:

  ```ts
  const plugin: BoltdocsPlugin = {
    name: "my-plugin",
    middleware: [
      {
        name: "my-plugin:html",
        transformHtml: async (_ctx, { html, path }) => {
          return { html: html.replace(/foo/g, "bar") };
        },
      },
    ],
  };
  ```

  The `runMiddlewareChain()` method on `PluginLifecycleManager` collects
  both statically-declared and programmatically-registered middleware, sorts
  by `enforce`, and runs them in sequence. Each middleware gets a generic
  `PluginContext` with all standard APIs (caches, diagnostics, paths, slots,
  virtualModules).

  ### Slot Lazy Loading

  Slot declarations now accept `lazy?: boolean`. When `true`, the slot
  component is wrapped in `<Suspense>` with a pulse-animated fallback
  placeholder. The `slotLazyFlags` parallel map is emitted alongside
  `slotRegistry`, `slotConditions`, and `slotSsrFlags`:

  ```ts
  const plugin: BoltdocsPlugin = {
    name: "my-plugin",
    clientEntry: "@scope/plugin/client",
    slots: [{ id: "right-rail", export: "HeavyWidget", lazy: true }],
  };
  ```

  Lazy components are rendered inside `<Suspense fallback={<SlotFallback />}>`
  in the default layout. The `SlotWithSSR` interface now carries a `lazy`
  boolean field.

  ### Internal changes
  - `packages/boltdocs-engine/src/shared/types.ts` — `PluginTransformMiddleware`,
    `PluginMiddlewareAPI`, `lazy?: boolean` on `SlotDeclaration`,
    `middleware` field on `BoltdocsPlugin`, `middleware` field on
    `PluginContext`
  - `packages/boltdocs-engine/src/node/plugins/plugin-types.ts` — `middleware` on
    `SecureBoltdocsPlugin`
  - `packages/boltdocs-engine/src/node/plugins/plugin-context.ts` —
    `middlewareRegistry`, `createPluginMiddlewareAPI()`,
    `invalidateMiddlewareCache()`, reset helper updated
  - `packages/boltdocs-engine/src/node/plugins/plugin-lifecycle.ts` —
    `runMiddlewareChain()`, `createGenericContext()`, `middleware` wired
    into context factories
  - `packages/boltdocs-engine/src/node/plugin/layout-slots.ts` — `lazy` in
    `SlotDeclarationSchema`, emits `slotLazyFlags` parallel map
  - `packages/boltdocs-engine/src/node/schema/config.ts` — `lazy` and `middleware`
    added to config schemas
  - `packages/boltdocs-engine/src/client/hooks/use-slot-registry.ts` —
    `slotLazyFlags` import, `lazy` field on `SlotWithSSR`
  - `packages/boltdocs-engine/src/client/components/docs-layout-default.tsx` —
    `<Suspense>` wrapping for lazy slot items, `SlotFallback` component
  - `packages/boltdocs-engine/src/client/virtual.d.ts` — `slotLazyFlags` declaration
  - `packages/boltdocs-engine/tests/slots/layout-slots-generator.test.ts` — 3 new lazy
    flag tests

### Patch Changes

- [`64fe83a`](https://github.com/bolt-docs/boltdocs/commit/64fe83a2fc1b241f39ac7032bb38c7439041508c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix mermaid pages having extra scroll space at the bottom
  - Fix body scroll bug: changed `min-height: 100%` to `height: 100%; overflow: hidden` on html/body in reset.css to prevent the browser scrollbar from appearing on all pages
  - Mermaid SVG cleaning now uses DOMParser to only strip sizing attributes from the root `<svg>` element, preserving inner element styles (transforms, font-size) that mermaid uses for node positioning
  - Added `not-prose` class to mermaid wrapper to prevent Tailwind typography plugin from adding margins to the SVG
  - Added `margin: 0 !important` to mermaid SVG CSS as additional safety
  - Added `overflow: hidden` to the root SVG element via cleanSvg
  - Moved `<style>` tag inside the mermaid container div to avoid prose layout interference

- Updated dependencies [[`46e288d`](https://github.com/bolt-docs/boltdocs/commit/46e288d485bf50ae226a3b3c70c0a93040b8ae0c), [`2bc1045`](https://github.com/bolt-docs/boltdocs/commit/2bc104567acf2788465fdeb84f0e37d9ad18bd4a)]:
  - @bdocs/ssg@0.3.0
  - @bdocs/unist-utils@0.2.0

## 3.1.0

### Minor Changes

- [`ed84f8a`](https://github.com/bolt-docs/boltdocs/commit/ed84f8af1809ae7b33ad4e6cd6468786dd19a947) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Feature:
  - **`PluginContext.outDir`** — new readonly property exposing the build output directory (e.g., `'dist/'`) to plugin lifecycle hooks, eliminating the need for plugins to hardcode output paths
  - **`--turbo` mode** for `boltdocs build` — Sätteri-powered build pipeline with native WASM parsing, critical CSS extraction, and Shiki syntax highlighting
    - Available via CLI: `boltdocs build --turbo`
    - Native WASM MDX parser (satteri) replaces @mdx-js/rollup for faster compilation
    - Critical CSS extraction via zig-critters (WASM) removes unused CSS
    - Shiki syntax highlighting with dual light/dark themes
    - Remark/rehype plugin adapter layer supports standard unified plugins (e.g. mermaid)
    - Fallback to standard MDX compiler if satteri fails
  - **Collections hooks API** — simplified hooks for collection data access
    - `usePosts(collection?)` — defaults to `"blog"`, returns all filtered posts
    - `usePost()` — reads current post from context inside `post.tsx`
    - `useRecentPosts(collection?, count?)` — defaults to `"blog"` with count of 5
    - Removed `useCollectionList` (was redundant)
  - **Feature Flags & Drafts** — control page visibility per environment
    - `drafts` config: `{ visible?: boolean, environments?: string[] }` — control draft visibility
    - `featureFlags` config: `Record<string, boolean | string>` — define flags, pages declare required flags
    - Draft badge in navbar when viewing draft pages
    - `BOLTDOCS_DRAFTS=true` env var to force draft visibility
  - **PostHog integration** — built-in analytics support for [PostHog](https://posthog.com/)
    - Config: `integrations.analytics.posthog.apiKey` (required), `host` (optional, defaults to US cloud)
    - Session recording and autocapture off by default (opt-in via config)
    - EU cloud support: `host: 'https://eu.i.posthog.com'`
    - Injects PostHog JS snippet into `<head>` at build time (production only)
    - Client-side detection via `window.posthog` in `useAnalytics()` hook

  Fixed:
  - **Locale switching bug**: Switching languages on collection pages (e.g., `/blog`) now correctly navigates to the localized version (e.g., `/es/blog`) instead of redirecting to `/docs`
  - **Vercel analytics script fix**: `vercel.analytics` and `vercel.speedInsights` now default to `true` if not specified in config, preventing accidental omission of analytics scripts
  - Native parser binary path lookup now includes `bdocs-parser` as a local fallback
  - Removed `build:wrapper` script from `zig-critters` package.json (was broken)
  - Fixed `main` field in `zig-critters/package.json` to point to `wasm/index.mjs`
  - **Critical regex fix**: `__staticRouterHydrationData` script removal regex was crossing `</script>` boundaries, eating the entire HTML structure (missing `<body>`, `</head>`, `id="root"`). Added negative lookahead `(?!<\/script>)` to prevent matching across script tags.
  - **Locale bug fix**: `DefaultCollectionList` now uses `usePosts()` which filters by current locale/version instead of `useLoaderData()` which bypassed filtering
  - **Turbo mode fixes**: Shiki syntax highlighting now produces correct HTML with merged class attributes; CSS parser handles escape sequences and edge cases in selectors; WASM memory model uses arena allocation for reliability
  - **`--turbo` performance fixes**: Fixed 5 issues causing turbo+cache to be slower than default mode:
    - Server build now correctly skips when client code is unchanged (was always running)
    - `computeClientCodeHash` no longer scans monorepo directories (packages/, scripts/, etc.)
    - Beasties critical CSS engine now skipped in turbo mode (uses zig-critters only)
    - Config resolution no longer runs twice in build pipeline
    - Turbo flag now propagated through entire pipeline to `generateRoutes`
  - **`useLocalizedTo` home link fix**: `site:/` now resolves to `/${activeLocale}` instead of bare `/` when i18n is enabled, ensuring the navbar home button stays in the current locale
  - **`useI18n` collection locale switching fix**: Switching locale from a blog post page (`/blog/en/post`) now correctly produces `/blog/es/post` instead of `/en/blog/es/post`
  - **`useI18n` collection list locale switching fix**: Switching locale from a collection root page (e.g., `/blog`) no longer navigates away — collection root URLs are locale-independent
  - **SSG SEO meta tags fix**: Blog post pages and other content pages now correctly render per-page `<title>`, `og:title`, `og:description`, and `og:image` meta tags in the static HTML. Previously, react-helmet-async's `HelmetProvider` was not populating the helmet context because `isDocument` evaluated to `true` in the SSG context (jsdom active). Fixed by forcing `HelmetProvider.canUseDOM = false` and using synchronous `renderToString` to guarantee Helmet lifecycle methods complete before HTML is serialized.
  - **Duplicate meta tags cleanup**: Removed redundant generic `og:title`, `og:description`, `og:image`, `twitter:*`, `og:type`, `og:url`, `canonical`, and `<title>` from `injectHtmlMeta()`. These were duplicates of what Helmet renders per-page via `data-rh` attributes. Each page now has a single set of SEO meta tags managed by react-helmet-async.
  - **Beasties disabled**: Critical CSS inlining via Beasties is now disabled by default. HTML pages no longer contain ~37 KB of inlined `<style>` tags. CSS loads once via external `<link>` and is cached by the browser. Reduces total HTML output by ~7.3 MB across all pages.
  - **Duplicate `crossorigin` attribute fixed**: The regex that adds `crossorigin` to `<link rel="stylesheet">` now uses a negative lookahead to avoid duplicating the attribute when it's already present.
  - **Duplicate EN locale removed**: `generateI18nFallbacks()` now skips the default locale when generating fallback routes. Previously, English content was duplicated at both root level (`/docs/api/cli`) and locale-prefixed (`/docs/en/api/cli`), resulting in ~8 MB of identical HTML files.
  - **Inline code styling fix**: Added missing styles for inline `<code>` elements (backtick text). Previously, inline code rendered as plain unstyled text with no visual distinction. Now applies background, terracotta text color, padding, border-radius, and monospace font using the existing `--color-code-bg` and `--color-code-text` theme variables.
  - **`useLocalizedTo` default locale prefix fix**: Links like `/docs/guides` no longer incorrectly get prefixed with the default locale (e.g., `/docs/en/guides`). The hook now skips adding the locale prefix when `activeLocale === defaultLocale`, matching the behavior of the route generation system. Also fixes `site:/` root links for the default locale.
  - **Browser tab title fix**: The `<title>` tag now renders correctly in the browser tab. Previously, `helmet-compat.tsx` unconditionally set `HelmetProvider.canUseDOM = false`, preventing Helmet from updating `document.title`. Now the flag is only set during SSG rendering (via `__BOLTDOCS_SSG_RENDERING__` global), allowing Helmet to manage the title on client-side navigation.

### Patch Changes

- Updated dependencies [[`1e726e1`](https://github.com/bolt-docs/boltdocs/commit/1e726e1993d401120a4611d41baf95b247ac34da), [`efd4872`](https://github.com/bolt-docs/boltdocs/commit/efd4872b34502ed06e9c98b20f2e0577c754f683)]:
  - @bdocs/parser@1.1.0
  - @bdocs/ssg@0.2.0

## 3.0.2

### Patch Changes

- [`2b98bc8`](https://github.com/bolt-docs/boltdocs/commit/2b98bc8c0dc12fe37d8889c15c219cfdea84406a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: filter collections and search by locale/version with default fallback
  - Add `locale` and `version` fields to `CollectionPost` interface
  - Filter `usePosts` results by current locale and version, falling back to config defaults
  - Fix search to match routes against default locale/version when not explicitly set
  - Include locale and version in collection virtual module data

- [`e5225e5`](https://github.com/bolt-docs/boltdocs/commit/e5225e5678b8e046dadb745010becf9bf652973e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve SSG build and pnpm 10+ install failures
  - Remove `react-fast-compare` from SSR external list to fix `ERR_MODULE_NOT_FOUND` during SSG builds (it's a CJS-only transitive dep of `react-helmet-async` that can't be resolved from pnpm's strict node_modules)
  - Add `pnpm.onlyBuiltDependencies` to `create-boltdocs` templates (base + i18n) so `pnpm install` works out of the box with pnpm 10+ without requiring manual `pnpm approve-builds`

## 3.0.1

### Patch Changes

- Updated dependencies [[`3f21800`](https://github.com/bolt-docs/boltdocs/commit/3f21800f3738550e85b8b84155707c473abcd54c)]:
  - @bdocs/plugin-image-optimizer@0.2.1

## 3.0.0

### Major Changes

- [`3cc3b45`](https://github.com/bolt-docs/boltdocs/commit/3cc3b451e59f533910b11fe69452f6d2720a2f0d) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: Boltdocs v3.0.0 - Native Parser, Vercel Analytics, Giscus, and More

  ## Native Parser Acceleration (@bdocs/parser)
  - Zig-compiled binary for markdown parsing with WASM fallback
  - 5-6x faster than JS parser (10.5x on 75-file dataset)
  - Cold start reduced from 3.67s to 349ms (90.5% reduction)
  - Cross-platform binaries: Linux x64/ARM64, macOS x64/ARM64, Windows x64
  - Auto-download via postinstall script from GitHub Releases

  ## Vercel Analytics + Speed Insights
  - Zero-config integration via `integrations.vercel.analytics` and `integrations.vercel.speedInsights`
  - Scripts injected only in production builds
  - Full documentation in English and Spanish

  ## Giscus Comment System
  - Complete component with theme sync (dark/light)
  - Configurable via `integrations.feedback.giscus`
  - Support for repo, category, mapping, reactions, custom themes
  - Full documentation in English and Spanish

  ## Custom Feedback System
  - GitHub Discussions-powered feedback
  - Middleware for dev/preview environments
  - Adapters for Vercel, Netlify, AWS, and Web platforms
  - Full documentation in English and Spanish

  ## Ask AI Plugin Overhaul
  - Complete handler and adapter rewrite
  - New sidebar panel + floating bubble UI
  - Dedicated MarkdownRenderer component
  - Comprehensive test suite (adapters, handler, Ollama integration)
  - SSE streaming with batching and AbortSignal support

  ## UI/UX Improvements
  - Card component: mouse spotlight effect
  - Navbar: Ask AI button integration
  - Search: Cmd+J shortcut, result highlighting
  - Tabs: SVG icon sanitization
  - Theme context: dual-package hazard fix
  - Breadcrumbs: typed routing

  ## SEO/Meta Improvements
  - OG image resolution with siteUrl
  - Canonical URLs
  - Structured SEO tags
  - Google search engine verification tags
  - Twitter card dynamic selection

  ## Cache System Refactor
  - TransformCache with LRU + gzipped shards
  - BackgroundQueue for async persistence
  - Image optimizer cache with stale pruning

  ## Dev Server/HMR Improvements
  - Link tree regeneration on file events
  - boltdocs:config-update custom event
  - Case-insensitive module invalidation

  ## Node 26+ Compatibility
  - DEP0205 warning suppression in CLI

- [`bbd7954`](https://github.com/bolt-docs/boltdocs/commit/bbd79543b8a8dbe17695c68e1791a2e38607ab9c) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Restructure integrations config into sections (breaking change)

  The `integrations` configuration has been reorganized into logical sections:
  `analytics`, `search`, and `feedback` to improve clarity and extensibility.

  **Migration guide:**

  ```diff
   integrations: {
  -  ga4: { measurementId: 'G-XXXXX' },
  -  gtm: { tagId: 'GTM-XXXXX' },
  -  algolia: { appId: '...' },
  -  feedback: { custom: { ... }, giscus: { ... } },
  +  analytics: {
  +    ga4: { measurementId: 'G-XXXXX' },
  +    gtm: { tagId: 'GTM-XXXXX' },
  +    vercel: { analytics: true, speedInsights: true },
  +  },
  +  search: {
  +    algolia: { appId: '...' },
  +  },
  +  feedback: {
  +    custom: { ... },
  +    giscus: { ... },
  +  },
   }
  ```

  **New features included:**
  - Vercel Analytics & Speed Insights support (`integrations.analytics.vercel`)
  - Giscus comments component (`integrations.feedback.giscus`)
  - Google Search Console verification support (`seo.verification.google`, `bing`, `yandex`, `pinterest`, `facebook`)

  **Fixes included:**
  - External pages (e.g. `/showcase`, `/about`) are now included in
    `link-tree.json` and `types.d.ts` route path generation
  - Link primitive `href` props now use `BoltdocsRoutePathWithFallback`
    for TypeScript autocompletion of known routes

### Patch Changes

- Updated dependencies [[`3cc3b45`](https://github.com/bolt-docs/boltdocs/commit/3cc3b451e59f533910b11fe69452f6d2720a2f0d)]:
  - @bdocs/parser@1.0.0

## 2.9.3

### Patch Changes

- [`05d3cad`](https://github.com/bolt-docs/boltdocs/commit/05d3cad0d8ba4fbe3f5f0b18babfc0642b3aa082) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix(seo): inject `config.seo` tags into global HTML template and move `<Head>` to root shell

  The homepage `/` was missing SEO tags from `config.seo` (og:image, custom metatags, etc.) because:
  1. `injectHtmlMeta` only used `config.theme` values and ignored `config.seo` entirely — now it emits og:image, twitter:image, custom metatags, and robots meta from the seo config.
  2. The `<Head>` component (which produces page-specific SEO via react-helmet-async) was only rendered inside `<DocsLayout>`, which only wraps routes under `baseDocsPath` (e.g. `/docs`). Moved `<Head>` up to `BoltdocsShell` so it covers all routes including external pages, collection pages, and the catch-all route.

## 2.9.2

### Patch Changes

- [`8dec178`](https://github.com/bolt-docs/boltdocs/commit/8dec1783eb1c17f60e4cd3a2a69992b1745d2b6b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix React hydration mismatch by initializing resolvedTheme to 'light' on client initial mount, and add a dedicated isolated 'boltdocs/server' entrypoint to completely prevent serverless execution crashes due to heavy build dependencies.

## 2.9.1

### Patch Changes

- [`85cf6ba`](https://github.com/bolt-docs/boltdocs/commit/85cf6baf7dcfd2bee3952d44f250d309bb955fea) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Refactor main Node entrypoint imports to use dynamic imports for heavy build-time dependencies, preventing runtime crashes in Vercel serverless functions.

## 2.9.0

### Minor Changes

- [`b819f24`](https://github.com/bolt-docs/boltdocs/commit/b819f240fa420d873db0e0f3ff0443e6ff1a3e7b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **boltdocs (Minor)**:
  - Extracted the `@bdocs/dui` toolkit as a standalone terminal UI package.
  - Added native feedback integrations supporting Vercel, Netlify, and AWS Lambda adapters.
  - Supported the new `transformSource` plugin lifecycle hook for custom Remark/Rehype preprocessing.
  - Added new CLI dev server flags: `--port`, `--host`, and `--force`.
  - Implemented Phase 0 performance optimizations: deduplicated dev config resolution, instant dev server prewarming, pre-loaded Shiki highlighter during plugin configuration, and added debounced `TransformCache` index persistence.
  - Fixed collection routes provider wrapping at the global shell level, corrected `cover` frontmatter fallbacks, and updated outdated collections hook documentation examples.
  - **create-boltdocs (Minor)**:
    - Completed a full rewrite of the scaffolding CLI templates using the `@bdocs/dui` terminal package.
    - Added integration setup helpers and automated deployment adapters.
  - **@bdocs/plugin-image-optimizer (Minor)**:
    - Added the `@bdocs/plugin-image-optimizer` package to automatically optimize and cache WebP/SVG/PNG assets during static build compilation.
  - **@bdocs/plugin-mermaid (Patch)**:
    - Performance optimizations to prevent Mermaid scripts from blocking client rendering.

### Patch Changes

- Updated dependencies [[`b819f24`](https://github.com/bolt-docs/boltdocs/commit/b819f240fa420d873db0e0f3ff0443e6ff1a3e7b)]:
  - @bdocs/plugin-image-optimizer@0.2.0

## 2.8.4

### Patch Changes

- [`5fb0685`](https://github.com/bolt-docs/boltdocs/commit/5fb06852bfbd94e84cd502f5e874acd1e5f6d947) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: solve various bugs including theme flashing, i18n sidebar disappearing/duplication, upgrade check reliability, CLI port/host support, and create-boltdocs project name argument support.

  Specifically for i18n, sidebar, and fallback route routing:
  - Refactored `useSidebar` to perform hierarchical tree calculations cleanly without mutations.
  - Filtered out fallback redirect routes in `useSidebar` via the `fallback` route property to eliminate duplicate entries in the sidebar.
  - Preserved `filePath` properties on index/container route nodes so that client-side language switching and active link highlighting operate correctly.

## 2.8.3

### Patch Changes

- [`af3a19c`](https://github.com/bolt-docs/boltdocs/commit/af3a19c8836b0712ac186ba99d4987d828945612) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Revert base path configuration override in Vite plugin to restore correct asset routing and fix 404 errors in production.

## 2.8.2

### Patch Changes

- [`d55094d`](https://github.com/bolt-docs/boltdocs/commit/d55094db2b7afe4d7e00e2477d08483647ec1d8d) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix SSR rendering error with i18n configurations by safely guarding route path accesses on index/fallback routes. Correctly write performance metrics to build output directory.

- Updated dependencies [[`d55094d`](https://github.com/bolt-docs/boltdocs/commit/d55094db2b7afe4d7e00e2477d08483647ec1d8d)]:
  - @bdocs/ssg@0.1.1

## 2.8.1

### Patch Changes

- [`bbba61c`](https://github.com/bolt-docs/boltdocs/commit/bbba61c7351e56d138bd5957f236f0036e3bbe28) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared style of block-code

## 2.8.0

### Minor Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Route-level code splitting**: MDX pages are now lazy-loaded on demand client-side using dynamic imports, with background prefetching in idle time and parallelized compilation pre-warming.
  - **Diagnostic performance budgets**: Added checks for bundle and page HTML sizes, image/font counts, and build times under a new `checks.performance` configuration in `doctor.json`, run via `boltdocs doctor --budget`.
  - **Plugin system simplification & safety**: Removed complex dynamic sandboxes and the `permissions` configuration. Added chain-pattern MDX/HTML transformation hooks (`transformMdx` and `transformHtml`), simplified available lifecycle hooks, and automated file-system access containment warnings.
  - **Strict route path typing**: Introduced compiler-generated route path maps to support type-safe autocomplete for navigation navbar/sidebar definitions and custom Link components.
  - **Directory caches reorganised**: Re-structured `.boltdocs/` internal metadata caches into specific `build/`, `cache/`, `generated/`, and `reports/` subdirectories.
  - **Codeblock destructuring & plugin utils**: Refactored traversal helper functions to run across generic AST formats. Fixed React DOM warnings on code block node attributes.
  - **Bug Fix**: Fixed a config loader exception by correctly exporting `MDX_NODES` from the core entry point.
  - **Miscellaneous improvements**: Configured `react-router-dom` in server-side bundling to prevent SSR load exceptions, added horizontal overflow scrolling for tabs, and improved mobile layout padding.

### Patch Changes

- Updated dependencies [[`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32), [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32)]:
  - @bdocs/dui@0.1.2
  - @bdocs/ssg@0.1.0

## 2.7.11

### Patch Changes

- [`1182df9`](https://github.com/bolt-docs/boltdocs/commit/1182df9a1964409da9e0e4b7b1977f9ec887e4aa) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Exclude src/client from published files, point Tailwind @source to dist, disable minify for client build

## 2.7.10

### Patch Changes

- [`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat(dui): add `configure()`/`getConfig()` for runtime identity — log prefix, server box titles, and update command are now configurable at the CLI entry point instead of hardcoded. fix(dui): default `updateCommand` corrected from `@bdocs/dui` to `boltdocs`. fix(dui): `stripAnsi()` now handles OSC hyperlinks and CSI cursor sequences, not just SGR colors. refactor(dui): `devServer()`/`previewServer()` consolidated via shared `buildServerBox()` helper. chore(dui): `padLeft` renamed to `padRight` for clarity. chore(dui): comprehensive tests added for logger, config, confirm, and formatLog. fix(ssg): missing kolorist-to-dui migration in `build.ts` (`dim`, `cyan`, `green`, `gray`, `red` bare calls) resolved — fixes runtime `ReferenceError: gray is not defined`. fix(core): `dev-server.ts` `console.error('[boltdocs]')` → `dui.error()`; `cli-entry.ts` adds `configure()` call.

- [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Remove `ansiCodes` raw ANSI export from `@bdocs/dui`. Core CLI `ui.ts` now re-exports `dui.colors` (picocolors) directly — no more ANSI escape code usage anywhere. `formatLog` and `confirm` use picocolors functions.

- [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix picocolors usage across `@bdocs/dui` (use function calls instead of template literal interpolation). Add `ansiCodes` export for backward-compatible raw ANSI sequences. Migrate doctor output to use `@bdocs/dui` — replace raw ANSI with picocolors functions and use `dui.box.double()` for diagnosis summary.

- [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Complete migration from `ui.ts` wrapper to direct `@bdocs/dui` imports across core. Move `confirm`/`formatLog` into dui. Remove `ui.ts` entirely. Phase 3: migrate changelog generator output to dui logger/box.

- [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Create `@bdocs/dui` terminal UI package with boxes, logger, lists, and dividers. Wire into core CLI (`ui.ts`) and update-check (`update-check.ts`).

- Updated dependencies [[`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a), [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72), [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0), [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133), [`36a7d09`](https://github.com/bolt-docs/boltdocs/commit/36a7d093a0304620ddaed6c2ed8616edbaa62987), [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18)]:
  - @bdocs/dui@0.1.1
  - @bdocs/ssg@0.0.7

## 2.7.9

### Patch Changes

- [`d600cdf`](https://github.com/bolt-docs/boltdocs/commit/d600cdf1086009762409323802c9b7302bb327df) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix false positive "broken internal link" reports for URLs inside fenced code blocks and inline code in the `boltdocs doctor` command. The link checker now strips code block content before scanning for links, preventing demo/example code from being treated as actual broken links.

- [`ac10e5b`](https://github.com/bolt-docs/boltdocs/commit/ac10e5be26a93a5ca2403f72a670b806461cbc20) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix duplicate sidebar links caused by fallback metadata entries copying `filePath` and `slugParts` from the original route. The fallback entry now sets `filePath: ''` and `slugParts: []` so the sidebar code skips it.

- [`ae0d6ad`](https://github.com/bolt-docs/boltdocs/commit/ae0d6ad51ba81b83f6d9ef45e310133c7072d883) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Rewrite README with benchmark comparisons, tech stack showcase, detailed features with code examples, ecosystem table, roadmap, and improved structure. Add README to `packages/boltdocs-engine/` for npm package display.

- [`9e7094d`](https://github.com/bolt-docs/boltdocs/commit/9e7094d2e5ebc2e0b7f14cce0fb61ee9f69b5db3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Show update notification when a new version of boltdocs is available. The `dev`, `build`, and `doctor` commands now check the npm registry and display a colored box with the current and latest version when an upgrade is available.

- Updated dependencies [[`ee67a51`](https://github.com/bolt-docs/boltdocs/commit/ee67a5141282d4cbc9db0cf839c2073364f3f44a)]:
  - @bdocs/ssg@0.0.6

## 2.7.8

### Patch Changes

- [`09b3cbf`](https://github.com/bolt-docs/boltdocs/commit/09b3cbf21553cdcf24afbfd03fb6c9f8391a0b6a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix React 19 hydration mismatches and route duplication/double-rendering on subpage refreshes by configuring the router's basename, prepending the basename prefix during SSR query rendering, and extracting/inlining static router hydration data into the head.

- [`cbb1914`](https://github.com/bolt-docs/boltdocs/commit/cbb1914745217fe66e0c5854c2d592b521a1b26b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Switch to flat HTML output (`about.html` instead of `about/index.html`), generate own `__staticRouterHydrationData` script, sanitize hydration data, and fix fallback route index handling for docs base path. This resolves hydration mismatches and page duplication on subpage refresh across all deployment platforms.

- Updated dependencies [[`f0c9703`](https://github.com/bolt-docs/boltdocs/commit/f0c9703e9b568c03ddfe5061bb0faa1942c84b4f), [`09b3cbf`](https://github.com/bolt-docs/boltdocs/commit/09b3cbf21553cdcf24afbfd03fb6c9f8391a0b6a), [`cbb1914`](https://github.com/bolt-docs/boltdocs/commit/cbb1914745217fe66e0c5854c2d592b521a1b26b)]:
  - @bdocs/ssg@0.0.5

## 2.7.7

### Patch Changes

- [`b5e54f1`](https://github.com/bolt-docs/boltdocs/commit/b5e54f16e9b792f4c3616ad7a3ee368f4a1a8fda) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Fix empty page on docs base path redirects, breadcrumbs, TOC, and active sidebar link highlight.
  Fix hydration crash and caching bug for static loader data in production by adding cache-busting query parameters and safe JSON fetch handling.
- Updated dependencies [[`b5e54f1`](https://github.com/bolt-docs/boltdocs/commit/b5e54f16e9b792f4c3616ad7a3ee368f4a1a8fda)]:
  - @bdocs/ssg@0.0.4

## 2.7.6

### Patch Changes

- [`e5e5ebb`](https://github.com/bolt-docs/boltdocs/commit/e5e5ebbf370acdeb9eaab77a296f37493f7b5d0f) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve SSG route resolution causing home page content to leak into all routes

- Updated dependencies [[`e5e5ebb`](https://github.com/bolt-docs/boltdocs/commit/e5e5ebbf370acdeb9eaab77a296f37493f7b5d0f)]:
  - @bdocs/ssg@0.0.3

## 2.7.5

### Patch Changes

- [`b9af040`](https://github.com/bolt-docs/boltdocs/commit/b9af040f70158409ae563b2b6776efa6d3607707) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - perf: refine incremental build caching and fix loader hash stability
  fix: ensure docs layout wrapper is constrained to the base docs path to prevent hijacking external routes (like homepage/about) during client-side hydration.

## 2.7.4

### Patch Changes

- [`2ca7562`](https://github.com/bolt-docs/boltdocs/commit/2ca7562b7f6b95955426afdbf15b94b82b5d3e60) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve config syntax and ssr optimizeDeps interop

## 2.7.3

### Patch Changes

- [`ca0f95a`](https://github.com/bolt-docs/boltdocs/commit/ca0f95a1e34289c5f591497d513786fd2917ff4a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: resolve CJS/ESM interop issues for react-fast-compare and react-router-dom - Add react-fast-compare to optimizeDeps.include (browser) and ssr.optimizeDeps.include (SSR) to fix missing default export - Add react-router-dom to ssr.noExternal to fix 'module is not defined' in Vite 8 SSR module runner - Apply same fixes to plugin config hook for consumer-side usage

## 2.7.2

### Patch Changes

- [`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - perf(core): Improved performance in warm

- Updated dependencies [[`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75)]:
  - @bdocs/ssg@0.0.2

## 2.7.1

### Patch Changes

- [`044ce18`](https://github.com/bolt-docs/boltdocs/commit/044ce18cf54812e486f0af0befdf952e26ebb2f9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error of ssg

## 2.7.0

### Minor Changes

- [`b04fce4`](https://github.com/bolt-docs/boltdocs/commit/b04fce42678230b607adcde349e8bb95f6dca1f3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **feat**: Added support for `lastUpdated` property in documentation pages.
  - **feat**: Significant performance improvements in documentation parsing through a new caching parser.
  - **feat**: Doctor is now stable.
  - **feat**: Added banner on site home page.
  - **feat**: Added Google Analytics 4 support & Google Tag Manager support.
  - **feat**: Added Changelog Generator. he UI to have a better look.
  - **feat**: Updated File-Routing to support new features. - Support Deeper Nested routes - Support metadata file naming (meta.json & \_meta.json) - Support collapsible/collapsed directories - Support custom directory icons
  - **feat**: Added `base` support for base-url routing.
  - **feat**: Added custom-frontmatter & extended MDX frontmatter support.
  - **feat**: Search highlight now works with accents & Mark search works on dynamic content.
  - **fix**: Improved mobile support and responsive layout consistency across the site.
  - **fix**: Resolved styling issues and improved integration for Mermaid diagrams.
  - **fix**: Corrected locale labels in example projects.
  - **fix**: Optimized Tabs and Navbar components to reduce unnecessary re-renders.
  - **fix**: Removed config prop from CopyMarkdown component.
  - **fix**: Removed the need to define `homePage` in `boltdocs.config.ts` when using `pages-external/index.tsx` for a custom home page.
  - **fix**: Added export code-block support for Custom Components.

## 2.6.2

### Patch Changes

- [`2960c55`](https://github.com/bolt-docs/boltdocs/commit/2960c5523040723f2389568b5e72866875617789) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared bug collision pages & navigation
  fix: repared bug 404 when switch version in home
  feat: support types-generator for better autocomplete

## 2.6.1

### Patch Changes

- [`bdc7634`](https://github.com/bolt-docs/boltdocs/commit/bdc7634239ba5e220a4b1fe2792aaa66e6944e46) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: error in developer in build

## 2.6.0

### Minor Changes

- [`6a6d829`](https://github.com/bolt-docs/boltdocs/commit/6a6d82941328c1f2c016781d8d0f004d3a890237) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: new engine ssg
  feat: line-number & word-wrap in code-block
  feat: support languagues rust & toml
  fix: removed ogImage
  feat: support seo granular configuration in frontmatter & config
  fix: removed shadow image
  fix: support detect xml in sitemap
  fix: removed hover in field
  style: updated Admonition styles
  fix: removed style uppercase in sidebar & onthispage
  fix: repared warning each child of react key
  feat: support icons external

## 2.5.6

### Patch Changes

- [`5236e13`](https://github.com/bolt-docs/boltdocs/commit/5236e1379f94699bbbb176826b6eabb4dbb8faa7) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error in mode developer

## 2.5.5

### Patch Changes

- [`c31cfe3`](https://github.com/bolt-docs/boltdocs/commit/c31cfe3777e77b4ef0290aa726696b493f9c51db) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - repared error use-external

## 2.5.4

### Patch Changes

- [`7477d85`](https://github.com/bolt-docs/boltdocs/commit/7477d85ee486af85cdae0ca26aba67ae9071cce9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: added use-async-external-store with in optimizeDeps

## 2.5.3

### Patch Changes

- [`613b4b7`](https://github.com/bolt-docs/boltdocs/commit/613b4b7c256b2dec3af6d2aa7eb00f1b9a9beea1) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - removed integrations of config

## 2.5.2

### Patch Changes

- [`862634f`](https://github.com/bolt-docs/boltdocs/commit/862634fb0df4e10112877e05e31b12ce7a4f480e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - removed sandbox integrations

## 2.5.1

### Patch Changes

- [`6f47dae`](https://github.com/bolt-docs/boltdocs/commit/6f47dae6a572e1d2ec8c28e56c648ab2db7b96d5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - repared error show visible CodeBlock & repared error components Plugins

## 2.5.0

### Minor Changes

- [`de41957`](https://github.com/bolt-docs/boltdocs/commit/de4195754bbb6dea90cbcd91e1ae3ddc398a8fdb) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Updated imports to simples, support CPS, Support External-Page with file

### Patch Changes

- [`f54fc62`](https://github.com/bolt-docs/boltdocs/commit/f54fc62982411e893beeccb2ebcb20d7a4925bdd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - export types of plugins, Config & theme

## 2.4.2

### Patch Changes

- [`3073b74`](https://github.com/bolt-docs/boltdocs/commit/3073b747b9bd90e154c24758b5a502dfe51c043e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error in build with virtual-imports

## 2.4.1

### Patch Changes

- [`80de4bd`](https://github.com/bolt-docs/boltdocs/commit/80de4bd49c3de90ec234148c8077b479935db2cf) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - updated width with pathname

- [`c49cefa`](https://github.com/bolt-docs/boltdocs/commit/c49cefa292075606ae626826a890a93bda939ba5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - added name tabs in URLs & repared icons size

## 2.4.0

### Minor Changes

- [`0ee1f85`](https://github.com/bolt-docs/boltdocs/commit/0ee1f8525500ca6b6dc1eb78260fc257b3698fd4) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Support icons & title CodeBlock, Better Scroll, export Skeleton Component

## 2.3.0

### Minor Changes

- [`5d53fd0`](https://github.com/jesusalcaladev/boltdocs/commit/5d53fd0eddbcc0e22b092f52cea82df78063376b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: added new primitives `Skeleton`
  feat: added new loading with `Skeleton` primitives
  feat: added new command `boltdocs doctor` for diagnostic your project
  feat: support full-text search
  fix: better calc in page-nav

## 2.2.0

### Minor Changes

- [`766daf2`](https://github.com/jesusalcaladev/boltdocs/commit/766daf21becafaa173a65cc8bea4d31b32ce8640) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: support i18n in links & tabs
  feat: change component Loading
  feat: dectecttheme of system
  perf: better calc in the routes & navigation

## 2.1.1

### Patch Changes

- [`1ce39bb`](https://github.com/jesusalcaladev/boltdocs/commit/1ce39bbe07974f35f6a04c341c5578c337f37024) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error of deploy

## 2.1.0

### Minor Changes

- [`06650d4`](https://github.com/jesusalcaladev/boltdocs/commit/06650d458c26c7bbf4cc2da7ea6bec6352c0c530) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: extract vite.config.ts for used boltdocs.config.ts, support favicon, robots, ogImage

## 2.0.0

### Major Changes

- [`105352e`](https://github.com/jesusalcaladev/boltdocs/commit/105352efc13f081c5fdb6bbcad11891be78f87a7) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: secutity in build & production, repare error in build with virtual:boltdocs-layout
