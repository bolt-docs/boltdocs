---
'boltdocs': minor
---

Reduce package weight for downstream consumers.

`icons-dev.tsx` is split into `icons-prod.tsx` (eager social/nav icons) and `mdx/lang-icons.tsx` (lazy-loaded chunk for MDX code blocks) — pages without code blocks now ship zero bytes of language icons. `react-aria-components` was promoted from `dependencies` to a **required** peer; `sharp` and `svgo` are removed from core (already peers of `@bdocs/plugin-image-optimizer`).

Public API surface is unchanged — all exports from `'boltdocs'`, `'boltdocs/client'`, `'boltdocs/server'`, `'boltdocs/primitives'`, and `'boltdocs/mdx'` resolve to the same symbols as 3.1.x.

Sites without `@bdocs/plugin-image-optimizer` save ~35 MB of unpacked native binaries. Sites that use it are unaffected.

**CI / lockfile-strict setup:** if your CI hard-fails on the `react-aria-components` peer advisory, use `either` `.npmrc` `or` `.pnpmrc` (not both) to whitelist the documented peer — never blanket-disable with `legacy-peer-deps=true`. Full recipes in the [upgrade guide](https://boltdocs.com/docs/guides/upgrading-3-2).

The dependency contract is pinned by a new `packages/core/tests/package-shape.test.ts` (8 assertions) so future PRs can't silently re-bloat.
