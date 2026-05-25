---
"@bdocs/dui": patch
"boltdocs": patch
---

Complete migration from `ui.ts` wrapper to direct `@bdocs/dui` imports across core. Move `confirm`/`formatLog` into dui. Remove `ui.ts` entirely. Phase 3: migrate changelog generator output to dui logger/box.
