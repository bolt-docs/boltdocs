# @bdocs/primitives

## 1.1.0

### Minor Changes

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

- e1fe3cb: Shrink `@bdocs/primitives` by 23%, and fix an initial-focus bug in `Dialog`.

  The JSDoc in this package explains _why_ each decision was made. That belongs in
  `dist/index.d.mts` and in the source, which is where a reader and an editor will
  find it. Shipping it a third time inside `index.mjs` cost ~10 kB of install for
  text no bundler reads and no runtime uses. `tsdown` now drops `jsdoc` comments
  from the emitted module while leaving `legal` ones alone — this is a published
  MIT package, and `comments: false` would silently strip a licence header the day
  someone adds one.

  |                    |   before |    after |
  | ------------------ | -------: | -------: |
  | `dist/index.mjs`   | 45,166 B | 34,722 B |
  | gzipped            | 12,320 B |  7,918 B |
  | `dist/index.d.mts` | 26,765 B | 26,766 B |

  **This does not shrink anyone's page weight**, and it is worth being plain about
  why: importing a single export from the built module already tree-shakes to
  nothing. A bundle that imports only `Button` measures 79 bytes. The win is
  `node_modules` on disk, and it is the same 10 kB for every consumer regardless
  of which components they use.

  The package also has zero runtime dependencies — `React` is a peer and nothing
  else is imported — so there was no `tailwind-merge` or class-name library to
  strip out.

  ### Bug fixed

  `Dialog` carried its own inline copy of the focusable-element selector, and it
  had drifted from the shared one in `focus.ts`. The copy did not exclude
  `input[type="hidden"]`, did not match `[contenteditable]`, and applied none of
  the `hidden` / `aria-hidden` / `display` / `visibility` filtering. So `Dialog`
  could move focus onto something the `ModalOverlay` directly above it had already
  decided was not focusable — two components in one package disagreeing about what
  "focusable" means, with the dialog as the one that was wrong.

  It now delegates to `focusFirstIn`, the same helper the modal overlay uses. Three
  tests pin the behaviour, two of which fail against the old code.
