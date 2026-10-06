---
'@bdocs/theme-neutral': minor
'boltdocs': patch
---

Converts the layout chrome to native CSS, with a visual harness that proves the UI did not change.

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
