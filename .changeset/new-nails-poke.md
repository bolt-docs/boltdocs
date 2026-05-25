---
"@bdocs/dui": patch
"boltdocs": patch
---

Fix picocolors usage across `@bdocs/dui` (use function calls instead of template literal interpolation). Add `ansiCodes` export for backward-compatible raw ANSI sequences. Migrate doctor output to use `@bdocs/dui` — replace raw ANSI with picocolors functions and use `dui.box.double()` for diagnosis summary.
