---
"boltdocs": patch
"@bdocs/ssg": patch
---

Fix SSR rendering error with i18n configurations by safely guarding route path accesses on index/fallback routes. Correctly write performance metrics to build output directory.
