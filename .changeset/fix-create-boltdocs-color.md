---
'create-boltdocs': patch
---

Fix crash in `create-boltdocs` scaffolder caused by using non-existent `colors.orange` from `@bdocs/dui`. Replaced with `colorize()` using Cloudflare brand hex color.
