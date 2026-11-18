# @bdocs/theme-neutral

## 2.0.0

### Major Changes

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

### Minor Changes

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

- f7464bf: Make the core CSS-agnostic: remove Tailwind/Vite Tailwind coupling and CSS-framework assumptions from the engine and neutral theme, replace `cn` with framework-neutral `clsx` class joining (no Tailwind merge), ship the neutral theme as plain CSS only, and update scaffolding/templates to opt into Tailwind explicitly via `@bdocs/plugin-tailwindcss` when needed.
- Extract the reusable UI layer into `@bdocs/ui-base`. The composition wrappers,
  the assembled UI components (navbar, sidebar, TOC, search dialog, …), their
  hooks, utilities and native stylesheet now live in their own package.
  `@bdocs/theme-neutral` depends on it and re-exports the whole public surface,
  so existing `@bdocs/theme-neutral` and `@bdocs/theme-neutral/composition`
  imports keep working. This completes the §6 split of `ui-base` out of the theme.
- Complete the hand-written primitive set and let the theme delegate to it.

  The primitives are now fully style-neutral: no Tailwind utility classes remain
  in the source. Layout hooks are `data-bdocs-*` attributes consumed by the
  theme's native CSS, and a test prevents utility classes from coming back.
  `OnThisPage`'s scroll-spy moved into `@bdocs/primitives` as a headless
  `ScrollSpyProvider` with `useActiveAnchor(s)`, `useActiveIndicator`,
  `useAnchorScroll` and `useAnchorNavigation`; the theme component is now a thin
  styling layer. That removes `scroll-into-view-if-needed` from the theme's
  dependencies. A gzip budget test guards the single ESM entry.

  `@bdocs/primitives` (still React-only, no `react-aria`) gains `Tabs` /
  `TabList` / `Tab` / `TabPanel` with roving tabindex, arrow and Home/End
  navigation and full `aria-controls` / `aria-labelledby` wiring, and
  `Disclosure` / `DisclosureTrigger` / `DisclosurePanel` with controlled and
  uncontrolled state. It also fixes per-option focus in `ListBoxItem`, derives
  option ids for `aria-activedescendant`, wires `Menu` Escape back into its
  `MenuTrigger`, restores the consumer's `onKeyDown` on anchor buttons, adds
  `inert` to `hideSiblings`, and keeps `Autocomplete`'s ARIA wiring from being
  overridden by spread props.

  `ModalOverlay` now portals to `document.body` (or a `portalContainer`), so
  `hideSiblings` covers the whole page instead of only the overlay's local
  siblings. Theme icons are decorative by default, avoiding doubled accessible
  names on labelled buttons; heading anchors, feedback alerts and button groups
  also got proper ARIA. The status message no longer depends on a Tailwind
  `sr-only` class.

  The error-boundary mechanics moved to `@bdocs/primitives` as a headless class
  with a render-prop fallback. The framework diagnostic screen now lives in
  `@bdocs/runtime` as `FrameworkErrorBoundary` (system colors, no theme CSS), and
  `theme-neutral`'s `internal/` folder plus `error-debug.css` are gone. The theme
  keeps only its styled user-facing fallback. The remaining plain buttons in the
  theme (feedback submit, navbar dropdown) now use the primitive `Button`; the
  dropdown no longer closes on the click that follows a hover-open.

  Closed the framework debts: all seven documented UI slots now have real mount
  points in the default theme (navbar, sidebar, page and search dialog), and
  `BoltdocsUiSlot` names the two previously implicit slots. Collection ordering
  uses one shared comparator from `@bdocs/contracts` instead of four copies, and
  `collections.sortBy`, `dateFormat`, `defaultCollection` and `positions` are now
  actually read by engine/runtime rather than just documented.

  Added a headless `Group` primitive and moved the last three hand-written
  `role="group"` wrappers out of the theme (button group, feedback ratings and
  the light/dark switch).

  Framework behavior that was still in the theme moved to its owning layer:
  slot rendering (eager filtering, `lazy`/`Suspense`, live bridge reads) is now
  `@bdocs/runtime`'s `PluginSlot` / `FloatingSlots`, and the collection list gets
  posts, pagination and page URLs from the runtime's `useCollectionList()` hook
  instead of re-deriving them from `location.pathname`. The theme's slot hosts and
  its pagination/URL math are gone.

  The accessibility suite is green: three stale Playwright expectations were
  updated to the native-CSS class names and current tab labels, and a duplicate
  `Exit codes (CI contract)` heading in the CLI guide was renamed.

  Visual review fixed three pre-existing UI bugs found in the browser: the theme
  menu opened above the viewport, `SearchDialog.Overlay` dropped its children and
  its `Modal` surface started closed, and the search dialog rendered two inputs
  (the combobox plus a nested search field). There is now one styled combobox
  input, and keyboard focus stays visible on the navbar and banner controls.

  `MenuTrigger` now finds items with any of the three menu item roles when it
  moves focus on open, and `ListBoxItem` accepts an explicit `index` for
  hand-written option lists. Added tests for `Separator`, `cn`/`filterDOMProps`
  and the press/clear/focus paths.

  Also fixes: `Button` press state now clears on pointer-up (and fires
  `onPressChange(false)`), `SearchField`/`Autocomplete` clear buttons actually
  clear an uncontrolled value, `Modal` no longer forwards overlay props to the
  DOM, `Dialog autoFocus` focuses the dialog, `SubmenuTrigger` handles focus and
  Escape, `MenuTrigger` closes on outside press, and dead `CONSUMED` entries and
  tsconfig aliases are removed. `cn` is now one hand-written implementation
  shared by both packages (the `clsx` dependency is gone).

  `@bdocs/theme-neutral` now uses those primitives for tabs, the navbar
  dropdown, sidebar disclosures, menus, the theme switcher, the feedback
  ratings, the banner dismiss button and breadcrumb separators instead of
  reimplementing the behaviour in the theme. A `Menu.Popover` that defaulted to
  closed and made every theme menu invisible is gone. All `bdocs-*` classes and
  `data-*` state attributes are unchanged.

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

- 48e67a4: Native CSS for cards, tables, the banner, the 404 page, Giscus, the internal error boundary, and the table of contents.

  ## Verified neutral

  Zero visual regressions on the documentation pages. All 30 differing screenshots
  belong to `index.html` and `about.html`, which are the site's own external pages
  with their own bento effects and already differed before this batch.

  ## What changed in the components

  `Cards` states its column count as `data-cols` instead of four conditional utility
  strings. The responsive staircase was in JSX, where a theme cannot restyle it and a
  fifth column would need another branch.

  The table keeps its zebra striping and last-row rule in CSS as `nth-child` rather
  than as `even:` and `last:` variants, so both are restyleable. Its wrapper is the
  scroll container: a table inside an `overflow: auto` parent widens the parent and
  takes the whole page sideways.

  The banner is a tinted brand fill, and its text colour is now a token derived from
  the brand pushed towards the light end. The original used the brand itself on a 10%
  brand tint, which is roughly 3:1 — under the AA threshold for body text.

  ## One bug worth recording

  The table of contents lost 40 pixels, and the harness blamed the wrong component
  twice before it was found.

  The fade element carried `-mt-10` and `h-10` together, which cancel: the element
  occupies exactly the space it pushes up. Transcribing that pair faithfully as
  `margin-block-start: -40px` and `height: 40px` instead subtracted a real 40 pixels
  from the rail, and every heading in it moved.

  The margin is gone. The element is sticky and 40px tall, and the gradient itself
  comes from the caller's class so it keeps tracking whatever surface is behind it.

  ## Progress

  23 of 59 files on plain CSS. 19 still need a Tailwind build: the navbar and
  sidebar in both layers, `search-dialog`, `copy-markdown`, `theme-toggle`,
  `code-block`, and the remaining MDX components.

- 00fa574: Removes the GitHub stars counter, and converts the theme toggle, the locale selector and the version selector.

  ## Removed

  `GithubStars` is gone, along with `getStarsRepo` and the `github` field on the navbar hook.

  Nothing else used any of the three. `useNavbar` exposed `github` only for this
  widget, and `getStarsRepo` had no caller once the widget went — leaving either in
  place would have meant an exported API that nothing can change because nothing
  calls it.

  ## Converted

  The theme toggle, the language selector and the version selector share one
  stylesheet, because they are one control: a bordered pill with a label and a
  chevron that opens a menu. They were three class lists that had already drifted —
  the version selector's option had lost the `transition-colors` the other two still
  had, and the language selector's chevron was a different colour from the theme
  menu's. One stylesheet cannot drift.

  The current option is `data-selected` rather than a class per option, so a theme
  can restyle "the one you are on" without knowing how many options there are.

  The light/dark switch slides one indicator with `translate` rather than
  cross-fading two absolutely-positioned states, and `data-value` on the track
  decides which way it goes. Written per-option as `isDark && 'translate-x-full'`,
  the same positioning decision lived in two places that had to agree.

  ## Verified

  The only pixel difference on the page that hosts all three is the navbar's right
  side shifting, which is the stars counter disappearing. No styling regression.

  ## Progress

  28 of 58 files on plain CSS; 17 remain.

- 861eb6c: Removes four components from the theme and makes the page widgets opt-in.

  ## Deleted

  `Skeleton` and `Timeline` are gone.

  `Timeline` was built for release notes and changelogs, which is a job a
  documentation site rarely has, and it carried its own badge and variant vocabulary
  that had to be maintained alongside everything else. It had no consumer inside the
  repository: it was reachable only as a public export and from the docs page
  documenting it.

  `Skeleton` had one export and no consumer. The loading states it was written for
  are covered by the skeleton the navbar already renders while the repository
  stars resolve.

  Their documentation pages are removed in both locales, along with the rows in the
  component index. The 3.2.0 release post used `<Timeline>` to demonstrate the
  component it announced; that section is now a note saying it was removed in 4.0,
  because leaving a post rendering an unknown component would break the build.

  ## Made optional

  `Feedback` and `LastUpdated` are no longer part of the default theme.

  Neither has a right answer for a site that has not configured one. A feedback
  widget needs a destination — Vercel, Netlify, AWS Lambda, or an endpoint of the
  site's own — and the theme cannot pick it. A "last updated" line needs a policy:
  the frontmatter's `lastUpdated` may be a date, a commit time, or absent, and
  whether it appears at all is the site's call. Shipping them by default meant every
  site either configured integrations to silence them or rendered a widget pointing
  at nothing.

  `DocPage` now renders `LastUpdated` only when one is present, so a site or plugin
  supplies it through `mdx-components.tsx`. The previous code destructured it
  unconditionally, which would have thrown for every site that opts out.

  `useFeedback` stays. It is exported from `boltdocs/client` and is the hook a
  site's own widget is built on; only the theme's default UI is removed. The
  server-side adapters were already in the core and are untouched.

  ## Not in this change

  The plugins that own these widgets are not written yet. The theme no longer
  depends on them, which is the half that had to happen first, but
  `@bdocs/plugin-feedback` does not exist. Until it does, a site that wants either
  widget provides the component itself.

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

### Patch Changes

- 9a4c13b: Replace the built-in Shiki highlighter with `@bdocs/highlight`, a Prism-based, dependency-free (no Oniguruma/WASM) syntax highlighter.
  - The default `theme.codeHighlighting.engine` is now `highlight` (alias `light`). Code is tokenized with Prism grammars, emitted with line wrappers and `bd-token-*` classes themed via `--bdocs-code-*` CSS variables, and also keeps Prism `token` classes for theme flexibility.
  - `boltdocs` no longer ships the Shiki adapter/transformers; Shiki packages move out of the core dependency graph. Custom engines remain supported through the engine-agnostic adapter/registry contract (`engine` as id, instance, or factory).
  - `@bdocs/processor-satteri` resolves and pre-renders highlighting through the pluggable adapter/runtime.

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
- Updated dependencies [7628363]
- Updated dependencies [4a2de60]
- Updated dependencies [4fb6ed1]
- Updated dependencies
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
  - @bdocs/runtime@1.1.0
  - @bdocs/ui-base@1.1.0
  - @bdocs/primitives@1.1.0
