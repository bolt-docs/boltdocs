---
"boltdocs": major
"@bdocs/ssg": major
"@bdocs/create-boltdocs": major
---

Reorganise `.boltdocs/` directory structure for clarity:

- **SSG build cache** → `.boltdocs/build/` (was root `.boltdocs/`)
- **Core processing caches** → `.boltdocs/cache/` (was root `.boltdocs/`)
- **Generated type definitions** → `.boltdocs/generated/` (was root `.boltdocs/`)
- **Diagnostic reports** → `.boltdocs/reports/` (was root `.boltdocs/`)

Update all internal paths, test expectations, config references, templates, and documentation accordingly.
