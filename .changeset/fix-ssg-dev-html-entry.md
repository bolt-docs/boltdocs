---
'@bdocs/ssg': patch
---

Transform the HTML entry instead of the request URL in dev

The SSG dev middleware called `server.transformIndexHtml(url, template)` with
the request URL. Vite derives the html-proxy filename by joining that argument
with the project root, so a route such as `/docs` resolved to a real directory
(a `docs/docs` content folder under a `/docs` base) and emitted a sourcemap
pointing at a directory: `Sourcemap for "/docs" points to missing source
files`. The entry HTML is now transformed with the configured HTML entry path.
