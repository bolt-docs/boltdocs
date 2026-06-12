---
'boltdocs': patch
---

Fix React hydration mismatch by initializing resolvedTheme to 'light' on client initial mount, and add a dedicated isolated 'boltdocs/server' entrypoint to completely prevent serverless execution crashes due to heavy build dependencies.
