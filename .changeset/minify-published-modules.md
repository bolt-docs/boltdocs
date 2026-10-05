---
'@bdocs/primitives': patch
'@bdocs/runtime': patch
---

Minify the published modules of `@bdocs/primitives` and `@bdocs/runtime`.

| | raw | gzip |
| --- | ---: | ---: |
| both packages, comments only stripped | 90,138 B | 21,945 B |
| both packages, minified | 45,640 B | 16,781 B |

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
