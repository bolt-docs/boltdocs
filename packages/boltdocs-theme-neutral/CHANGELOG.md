# @bdocs/theme-neutral

## 2.0.0

### Major Changes

- The engine no longer ships the UI layer.

### Minor Changes

- Add `@bdocs/theme-neutral`: the neutral theme as an installable package.
- Make the core CSS-agnostic: remove Tailwind/Vite Tailwind coupling and CSS-framework assumptions from the engine and neutral theme, replace `cn` with framework-neutral `clsx` class joining (no Tailwind merge), ship the neutral theme as plain CSS only, and update scaffolding/templates to opt into Tailwind explicitly via `@bdocs/plugin-tailwindcss` when needed.
- Extract the reusable UI layer into `@bdocs/ui-base`.
- Complete the hand-written primitive set and let the theme delegate to it.
- The engine ships no stylesheet. The reset is the theme's.
- Three performance changes, and a grammar that was missing.
- Renames the theme's style-neutral layer from `primitives` to `composition`, removes two dead files, and collapses four package aliases into one boundary each.
- Native CSS for cards, tables, the banner, the 404 page, Giscus, the internal error boundary, and the table of contents.
- Removes the GitHub stars counter, and converts the theme toggle, the locale selector and the version selector.
- Removes four components from the theme and makes the page widgets opt-in.
- `@bdocs/theme-neutral` ships native CSS, and the core no longer advertises a stylesheet it never built.
- Converts the layout chrome to native CSS, with a visual harness that proves the UI did not change.

### Patch Changes

- Replace the built-in Shiki highlighter with `@bdocs/highlight`, a Prism-based, dependency-free (no Oniguruma/WASM) syntax highlighter.
- The type checker is clean, and the highlighting configuration has one type.
