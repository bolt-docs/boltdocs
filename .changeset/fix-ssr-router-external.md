---
'boltdocs': patch
---

Fix SSR build errors by externalizing react-router-dom during server-side rendering. Framework aliases for react-router-dom, react-helmet-async, and @bdocs/ssg are now applied only to client builds, preventing duplicate router contexts when @bdocs/ssg provides the Router while BoltdocsShell consumes it.