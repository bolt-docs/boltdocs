---
'boltdocs': patch
---

Defer dependency prewarming until the optimizer settles

`setupPrewarming` warmed the optimized dependencies synchronously in
`configureServer`, racing Vite's dependency optimizer. On the first start after
a version bump, or with `--force`, it requested chunks written by the previous
run that the optimizer had already replaced, which surfaced as
"Pre-transform error: The file does not exist at .../rolldown-runtime-*.js".
Warming now runs after the prewarm delay and skips any dependency whose shared
chunks are missing.
