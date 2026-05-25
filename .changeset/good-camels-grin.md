---
"@bdocs/dui": patch
"boltdocs": patch
---

Remove `ansiCodes` raw ANSI export from `@bdocs/dui`. Core CLI `ui.ts` now re-exports `dui.colors` (picocolors) directly — no more ANSI escape code usage anywhere. `formatLog` and `confirm` use picocolors functions.
