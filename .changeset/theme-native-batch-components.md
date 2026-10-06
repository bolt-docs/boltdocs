---
'@bdocs/theme-neutral': minor
---

Native CSS for cards, tables, the banner, the 404 page, Giscus, the internal error boundary, and the table of contents.

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
