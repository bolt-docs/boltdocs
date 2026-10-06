---
'@bdocs/theme-neutral': minor
'boltdocs': major
---

Renames the theme's style-neutral layer from `primitives` to `composition`, removes two dead files, and collapses four package aliases into one boundary each.

## Renamed

`@bdocs/theme-neutral/components/primitives` is now `@bdocs/theme-neutral/composition`.

The word `primitives` had come to mean the `@bdocs/primitives` package — behaviour, zero CSS — and the theme was shipping a directory called `primitives` whose files *import* that package. Two unrelated things, one word, and a public export.

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

The comparison harness had a bug of its own: a selector matching nothing in *both* trees was reported as "appeared in B", which reads as a regression that does not exist. It now distinguishes no-data-in-both from a component that stopped rendering.

`theme-neutral` 10/10, `core` 962/962, `tsc` clean.
