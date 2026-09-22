---
'@bdocs/processor-satteri': patch
'boltdocs': patch
---

Finer Sätteri chunk packs and a single-scan public-asset URL rewrite

- **Sätteri chunk packs are smaller**: 15 pages/pack for sites of 200–500
  pages (was 50), 20 for 50–200 (was 30). Pack size is also the incremental
  render granularity, so a one-page text edit on the docs site re-renders the
  edited pack (15 pages) instead of 50 — measured 43 new / 216 cached vs
  78/181 before.
- **`rewriteHtmlPublicAssetUrls` runs one fused scan instead of two**
  full-document passes, with pre-compiled module-level regexes instead of
  per-call `new RegExp`. Output is byte-identical with the old two-pass
  behavior (including `data-srcset` list handling); ~7% cheaper per page over
  real rendered docs HTML.
- Resolvers built by `createPublicAssetResolver` now expose a `mightRewrite`
  gate; pages that cannot reference a public asset skip the rewrite scan
  entirely.

🤖 Generated with Codebuff
