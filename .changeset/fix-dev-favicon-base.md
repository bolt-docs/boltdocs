---
'boltdocs': patch
---

Fix the favicon and logo preload URLs in the dev server

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
