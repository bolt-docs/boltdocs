---
'@bdocs/ssg': patch
'boltdocs': patch
---

Switch to flat HTML output (`about.html` instead of `about/index.html`), generate own `__staticRouterHydrationData` script, sanitize hydration data, and fix fallback route index handling for docs base path. This resolves hydration mismatches and page duplication on subpage refresh across all deployment platforms.
