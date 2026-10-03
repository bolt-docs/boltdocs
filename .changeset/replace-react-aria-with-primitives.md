---
'@bdocs/primitives': minor
'boltdocs': major
'create-boltdocs': major
---

Replace `react-aria-components` with `@bdocs/primitives`.

The client primitives now come from a package in this repository instead of from
`react-aria-components`. That tree was 23.4 MB across 113 packages and was a
**required peer** of `boltdocs`, so every site paid for it whether or not it used
a single interactive component.

### Measured effect

Per-visit JS on the documentation site, measured on the same machine against a
build of `4.0` at `fc13afeb`:

| | eager JS, raw | eager JS, gzip |
| --- | --- | --- |
| `react-aria-components` | 1014.3 kB | 271.9 kB |
| `@bdocs/primitives` | 853.8 kB | 221.3 kB |
| **delta** | **−160.5 kB (−15.8%)** | **−50.6 kB (−18.6%)** |

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

- `packages/core` type-checks clean. The 46 errors it carried were all
  `TS7016` implicit-`any` imports of the vendored Shiki grammars and themes,
  introduced when those assets were vendored; each vendored `.mjs` now has a
  sibling `.d.mts`.
