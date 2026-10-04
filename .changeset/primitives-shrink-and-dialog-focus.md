---
'@bdocs/primitives': patch
---

Shrink `@bdocs/primitives` by 23%, and fix an initial-focus bug in `Dialog`.

The JSDoc in this package explains *why* each decision was made. That belongs in
`dist/index.d.mts` and in the source, which is where a reader and an editor will
find it. Shipping it a third time inside `index.mjs` cost ~10 kB of install for
text no bundler reads and no runtime uses. `tsdown` now drops `jsdoc` comments
from the emitted module while leaving `legal` ones alone — this is a published
MIT package, and `comments: false` would silently strip a licence header the day
someone adds one.

| | before | after |
| --- | ---: | ---: |
| `dist/index.mjs` | 45,166 B | 34,722 B |
| gzipped | 12,320 B | 7,918 B |
| `dist/index.d.mts` | 26,765 B | 26,766 B |

**This does not shrink anyone's page weight**, and it is worth being plain about
why: importing a single export from the built module already tree-shakes to
nothing. A bundle that imports only `Button` measures 79 bytes. The win is
`node_modules` on disk, and it is the same 10 kB for every consumer regardless
of which components they use.

The package also has zero runtime dependencies — `React` is a peer and nothing
else is imported — so there was no `tailwind-merge` or class-name library to
strip out.

### Bug fixed

`Dialog` carried its own inline copy of the focusable-element selector, and it
had drifted from the shared one in `focus.ts`. The copy did not exclude
`input[type="hidden"]`, did not match `[contenteditable]`, and applied none of
the `hidden` / `aria-hidden` / `display` / `visibility` filtering. So `Dialog`
could move focus onto something the `ModalOverlay` directly above it had already
decided was not focusable — two components in one package disagreeing about what
"focusable" means, with the dialog as the one that was wrong.

It now delegates to `focusFirstIn`, the same helper the modal overlay uses. Three
tests pin the behaviour, two of which fail against the old code.
