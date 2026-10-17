---
'boltdocs': patch
---

Render client-side redirects through the framework's own router

`buildRedirectRoutes` rendered its redirect boundary with `useNavigate` from
`react-router-dom`, but the framework ships its own context-based router
(`packages/core/src/client/router`) and never mounts a react-router provider.
On a client navigation into a configured redirect the hook had no router to
read from, so `redirects` threw instead of navigating. The boundary now uses the
internal `useNavigate`, matching every other component, and core no longer
imports `react-router-dom` — a package it stopped declaring when the dependency
was dropped from the manifest, which also broke the redirect tests' module
resolution.
