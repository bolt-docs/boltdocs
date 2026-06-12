---
'boltdocs': patch
---

Refactor main Node entrypoint imports to use dynamic imports for heavy build-time dependencies, preventing runtime crashes in Vercel serverless functions.
