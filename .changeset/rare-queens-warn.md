---
"boltdocs": patch
"create-boltdocs": patch
---

fix: resolve SSG build and pnpm 10+ install failures

- Remove `react-fast-compare` from SSR external list to fix `ERR_MODULE_NOT_FOUND` during SSG builds (it's a CJS-only transitive dep of `react-helmet-async` that can't be resolved from pnpm's strict node_modules)
- Add `pnpm.onlyBuiltDependencies` to `create-boltdocs` templates (base + i18n) so `pnpm install` works out of the box with pnpm 10+ without requiring manual `pnpm approve-builds`
