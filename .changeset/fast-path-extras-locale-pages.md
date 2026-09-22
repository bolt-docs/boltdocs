---
'@bdocs/ssg': patch
---

Ultra-warm fast path restored; locale pages no longer destroyed by post-build mirroring

- The SSG output state gained an `extraFiles` list: files present in the
  output directory that post-build tooling (deployment mirror scripts)
  produced instead of the pipeline. The reuse check requires registered
  extras to still exist and no unregistered file to appear; the state
  self-heals within one build when tooling changes its footprint.
- The ultra-warm fast path no longer demands an empty `auxiliaryFiles` list.
  Deterministic SEO/llms/RSS output is accepted when every file still exists
  (routes + config are already covered by the client-hash gate); anything
  unexpected still forces the full pipeline. Measured on a 259-page site:
  no-op builds are back to ~0.5s with the dist directory left untouched.
- `readSsgOutputState` now round-trips the `extraFiles` field instead of
  silently dropping it on load.
