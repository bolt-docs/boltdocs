---
"create-boltdocs": patch
---

Replace direct `picocolors` usage with `@bdocs/dui`. All `console.log/error` calls migrated to `dui.logger.*` (info/warn/error/success). Colors now use `dui.colors` instead of direct picocolors. Removes `picocolors` from direct dependencies (transitive via dui).
