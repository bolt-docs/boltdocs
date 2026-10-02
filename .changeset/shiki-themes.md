---
"boltdocs": patch
---

Support every documented Shiki code theme, and drop 1.8 MB from the install.

Setting `theme.codeTheme` to `dracula`, `tokyo-night`, `nord`, `one-dark-pro` or `one-light` failed the build with `Theme 'dracula' not found`, even though `CodeTheme` accepts any string and the theme module's own comment listed all seven as supported. Only `github-light` and `github-dark` were ever registered.

All seven are now registered, so the five that were broken work. Verified end to end: a documentation build of 259 pages with `theme: 'dracula'` emits the canonical dracula palette (`#FF79C6`, `#50FA7B`, `#6272A4`, `#F8F8F2`) rather than falling back.

The themes are vendored rather than imported from `@shikijs/themes`, which ships 66 themes for 1.8 MB; the seven registered cost 196 KB. Default rendering is unchanged — the 259 pages are byte-identical to the previous output.
