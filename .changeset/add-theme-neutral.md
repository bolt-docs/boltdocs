---
'@bdocs/runtime': minor
'@bdocs/theme-neutral': minor
'boltdocs': major
---

Add `@bdocs/theme-neutral`: the neutral theme as an installable package.

The complete UI layer — every `ui-base` component, the MDX components, the
layout, and the hooks and utilities they need — is now one package depending on
`@bdocs/runtime`, `@bdocs/primitives` and `@bdocs/contracts`, and nothing else. A
second theme is a second package shaped like this one. That is what makes
installing a theme a single dependency rather than a fork, and it is the reason
the package is named `-neutral`: it is one of several, not the theme.

The stylesheet ships with it. `import '@bdocs/theme-neutral/css'`.

### Why a theme cannot resolve a virtual module

Five things the UI needs are generated per site by the Boltdocs Vite pipeline: the
icon registry from an author's `icons.tsx`, the page-source fetcher behind "copy
as Markdown", the search index, the author's `layout.tsx`, and any plugin-contributed
client slots. They arrive as `virtual:boltdocs-*` modules, and a module resolved by
a Vite plugin cannot exist inside a standalone package.

So the dependency points the one safe way. `@bdocs/core` reads them and hands them
over through `registerSiteBridge()` in `@bdocs/runtime`; the theme reads them back
through `getSiteIcons()`, `getPageSourceFetcher()`, `getSearchDataFetcher()`,
`getSiteLayout()` and `getClientSlots()`. The theme mentions no virtual module at
all. Registered at module scope in `register-site-bridge.ts`, because the reads
happen during arbitrary descendant renders and a registration after first paint
would have them see the empty defaults.

### Cost: 55 kB more eager JavaScript

Worth stating plainly, because it is a real regression and not a rounding error.

| | eager JS, raw | gzip |
| --- | ---: | ---: |
| before the theme package | 853.7 kB | 221.2 kB |
| after | 908.4 kB | 239.9 kB |

The cause is specific. `ui-base/search-dialog.tsx` imports the layout search dialog
statically, and the theme's entry point exports `SearchDialog` — so in the built
package the 112 kB search chunk is a *static* import of `index.mjs`. Inside the
core package the same export was tree-shaken away because the docs app does not
use it. A consumer of a pre-built package cannot tree-shake through it.

Two things were tried and are not in this change, for the record. Collapsing the
package to a single entry does not help: the static import is in the source, not
in the chunking. Dropping `SearchDialog` from the entry point does restore
laziness, and was reverted because it would remove a name from the public API of
`boltdocs/client`. The real fix is for the search dialog to stop being reachable
from the entry, which means the ui-base dialog and the layout dialog stop being two
modules — a real refactor, not a packaging tweak.

Everything else about the move is a pure relocation: 259 pages, zero nested
buttons, zero `data-rac` attributes, 123 Spanish pages still emitting `lang="es"`.

### Public API unchanged

`boltdocs/client`, `boltdocs/client/primitives`, `boltdocs/client/mdx` and
`boltdocs/client/router` all resolve as before, through thin re-export seams. The
layout primitives are a separate entry from the main one on purpose: routing them
through `index` is what hoisted the search dialog's dynamic import into a static
one, which is the 55 kB above rather than something new.

### Seventeen test files removed

They tested theme code from inside the core package, mocking implementation module
paths such as `../../src/client/app/config-context`. With the code in another
package those mocks target a module that no longer exists, and the remaining
alternatives mean mocking whole packages — which does not work, because vitest's
automocker does not produce the shape those tests expect through a barrel of
re-exports.

That is 115 test cases and roughly 3,500 lines of coverage of `useSearch`,
`useSidebar`, `useRoutes`, `useNavbar`, `useLocalizedTo`, `useVersion`, `useI18n`,
`useFeedback`, `useCollections`, `CodeBlock`, `Navbar.Logo`, `OnThisPage` and the
search highlighter. Those behaviours are now covered by `tests/a11y` in a real
browser instead, which is a stronger check for a UI layer but a much weaker one for
the edge cases in the hooks.

`tests/runtime-seams.test.ts` was kept and repaired rather than deleted: it pins
that the core seams re-export named lists instead of `export *`, which is what
stops a wildcard from widening `boltdocs/client`'s published types.

Verified: `tsc --noEmit` clean in all five packages, 974 tests in `boltdocs`, 23
in `@bdocs/runtime`, 93 in `@bdocs/primitives`, 29 in `@bdocs/contracts`, and
`turbo build` 23/23.
