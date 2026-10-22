---
'@bdocs/unist-utils': patch
---

The `unist` dependency is gone.

It pinned `unist@^3.0.0`, and no such version exists — the package's last
release is 0.0.1. The dependency was only ever used for its types, and the
package that carries them, `@types/unist`, was already a dependency. The
code imports the types from `@types/unist` now.

The pin made `pnpm install` fail for the whole workspace: the resolver
stopped at `unist@^3.0.0` and never got to the rest of the tree.
