---
'@bdocs/contracts': minor
'@bdocs/runtime': minor
'boltdocs': major
---

Add `@bdocs/runtime`: the browser half of Boltdocs, split out of the core.

Routing, navigation, hydration and the client contexts now live in their own
package. None of it needs the filesystem, Vite, or any of the build-time
integrations, so none of it should have been sitting inside the engine that
produces the page. This is roadmap slice 5, and it is the prerequisite for slice
3 (`@bdocs/ui`), not its successor — the theme components render against these
contexts, so the contexts have to move first.

### What moved

- `client/router/` — the router, the URL contract, viewport prefetch
- six client contexts: config, doc route, MDX components, routes, theme, UI
- `client/types.ts`, `client/utils/path.ts`, `client/utils/i18n.ts`,
  `client/view-transitions.ts`

### What stayed, and why

Page composition — `doc-page`, `docs-layout`, `head`, `mdx-component` — stays in
the core for now. Those files import the docs components directly, and moving
them is slice 3's job.

### The contract types moved too, because they are read at runtime

`BoltdocsThemeConfig` and `BoltdocsSocialLink` moved from
`core/src/shared/types.ts` into `@bdocs/contracts`. They are not build-time
details: the navbar renders the theme title, the logo and the social entries, so
a runtime that cannot name them is a runtime that has to guess. `theme` is now
part of `BoltdocsConfigContract` for the same reason, and there is one definition
of each shape rather than one in the core and one in the runtime.

The `Boltdocs` global namespace — the one generated route types augment — moved
to `@bdocs/runtime` and is declared exactly once. TypeScript rejects two
`declare global` blocks for the same namespace, and both packages need it, so it
had to have one home.

### Nothing changed for a consumer

Every path still resolves. `boltdocs/client`, `boltdocs/client/router` and every
internal import go through thin re-export seams, so the public API is identical
and no site changes anything.

The seams are written as explicit name lists rather than `export *`, which
matters twice over. `client/index.ts` does `export type * from './types'`, so a
wildcard would republish whatever the runtime grows next as `boltdocs/client`
types. And `rolldown-plugin-dts` — which builds the `.d.ts` — crashes outright on
a cross-package `export *`, because the re-export it synthesises has a member
expression where Babel demands an identifier. `tests/runtime-seams.test.ts` pins
every seam so neither can happen quietly.

### Verified

No behaviour change, and no size change either: the documentation build is 259
pages at 853.7 kB of eager JS, byte-for-byte the same number as before the move,
which is what a package relocation should look like.

Beyond the unit and build checks, this is the first slice verified in a real
browser rather than only in jsdom. `tests/a11y` runs 54 Playwright specs against
Chromium, covering arrow-key menu navigation, dropdown semantics, Escape closing
a modal, visible focus rings, and focus moving to the new document after a
client-side navigation. Note that the suite is load-sensitive on this machine:
a full parallel run produces two or three failures that differ between runs and
between a baseline `HEAD` worktree and this branch, and every one of them passes
when run on its own in both trees. Treat a green full run as necessary and not
as sufficient.

`@bdocs/runtime` also ships its own 25 tests, which it did not before. Writing
them turned up that `theme-context` had never been unit-tested at all, because
jsdom does not implement `matchMedia` and every attempt to mount the provider
threw — the test setup now stubs it.
