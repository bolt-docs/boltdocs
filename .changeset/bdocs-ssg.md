---
"@bdocs/ssg": minor
---

- **Route-level code splitting support**: Enabled eager compilation of MDX files on SSR builds for static rendering while supporting client-side lazy chunks.
- **Build performance metrics compilation**: Added automatic tracking of size budgets and timings at the end of the SSG build process, generating metrics for diagnostic auditing.
- **Console build output sanitization**: Restructured build reports to suppress verbose Vite asset lists, replaced individual page compiler outputs with a clean running counter, and polished phase separators.
- **Directory cache path updates**: Realigned SSG compiler logic with the new `.boltdocs/build/` and `.boltdocs/cache/` structure.
- **Performance optimizations**: Refactored recursive file traversal and file hash caching to execute non-blockingly.
