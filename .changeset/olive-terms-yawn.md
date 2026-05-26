---
"@bdocs/ssg": minor
---

feat: add `collectPerformanceMetrics` and `writePerformanceMetrics` helpers. Hook metrics collection (JS/CSS bundle size, HTML per-page size, image assets, font count, build time) into the end of the build pipeline. Writes `.boltdocs/performance-metrics.json` for consumption by `boltdocs doctor --budget`.
