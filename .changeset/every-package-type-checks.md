---
'boltdocs': patch
'@bdocs/unist-utils': patch
'@bdocs/processor-satteri': patch
'@bdocs/plugin-ssg': patch
'@bdocs/plugin-tailwindcss': patch
'@bdocs/plugin-unocss': patch
'@bdocs/plugin-search-algolia': patch
'@bdocs/plugin-search-pagefind': patch
'@bdocs/plugin-ask-ai': patch
'@bdocs/plugin-image-optimizer': patch
---

Every package type checks.

`tsc --noEmit` is now clean in all twenty-three packages that have a
`tsconfig.json`. The core, the runtime, the contracts, the primitives, the
theme, the processor, the unist utils, the SSG and every official plugin.

### Most of the errors were configuration, not code

Eight packages extended the repository's root `tsconfig.json` — a solution
file with no compiler options. The type checker fell back to its defaults: no
`module`, no `target`, no `esModuleInterop`, no `jsx`. It reported 39 errors
that had nothing to do with the code, and hid the real ones behind them.

The base is now `tsconfig.base.json`, and the root solution file extends it so
that a package which extends the root gets the same options as one that
configures itself. The three plugins that had no `tsconfig` at all have one
now.

### Two copies of Vite

`@types/node` was a range in some packages and an exact version in others, and
the version is part of the peer variant a package resolves against. Three
copies of the same Vite were installed, and their `Plugin` types were not the
same type. Every package now pins the same version, and there is one copy.

### Four bugs the type checker had been reporting for months

- The Algolia plugin sent the batch action `delete`. Algolia's endpoint takes
  `deleteObject`; every stale-record removal would have failed.
- The Tailwind and UnoCSS plugins wrapped the plugin list in another array.
  Vite flattens nested lists, so it worked — and the engine received a list of
  lists.
- The Mermaid plugin passed an object to a class-name helper that only joins
  strings, which would have rendered `[object Object]` as a class.
- The theme's code block called a function that was renamed when its state
  module was split out.

### A flake, fixed

`@bdocs/plugin-ssg`'s critical-dependency test used `vi.doMock` with a dynamic
import, and the mock only applied when the module had not been loaded yet —
which depended on which test file ran first. The test resets the module
registry now, and it passes in any order.
