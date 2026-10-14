---
'boltdocs': minor
---

Add viewport-triggered route prefetching so scrolling to a link warms it before the click.

Prefetching only ran on `mouseenter`/`focus`, which misses how docs are actually read: a reader scrolls the sidebar, reads a heading, and clicks without ever hovering. Every plausible destination was on screen and untouched.

`Link` now accepts `prefetch="viewport"`, which keeps hover behaviour and additionally warms the destination as the link approaches the viewport via a single shared `IntersectionObserver`. The sidebar links and the navbar's top-level items opt in. Prefetching downloads the route's lazy chunk and loader data, not the HTML, so it slots into the existing prefetch queue unchanged: two requests in flight, a shallow backlog, and dropped work when saturated. A 200px root margin starts the warm-up just before the link scrolls in.

Opt-in per link rather than global, so themes and existing users do not silently start paying for extra bandwidth.
