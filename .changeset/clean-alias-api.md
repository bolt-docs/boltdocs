---
'boltdocs': minor
---

Add a first-class `aliases` configuration API for project-specific module aliases while preserving Boltdocs' internal aliases. User-defined aliases are merged into the generated Vite configuration, so configuring `vite.resolve` no longer removes framework aliases such as `boltdocs/entry` and `boltdocs/client`.
