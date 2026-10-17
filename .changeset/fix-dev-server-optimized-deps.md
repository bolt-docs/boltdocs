---
'boltdocs': patch
---

Silence the dev server when a dependency is inlined by the optimizer

`react-fast-compare` and `invariant` were listed in `optimizeDeps.include`, but
they are transitive dependencies of `react-helmet-async` that pnpm does not
hoist to the project root. Vite could not resolve them and logged
"Failed to resolve dependency" on every cold start. Both are inlined into
`react-helmet-async`'s own optimized bundle, so the explicit entries were
unnecessary and are removed.
