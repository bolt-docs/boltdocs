---
"boltdocs": patch
---

Fix locale switching on posts whose translations use different slugs.

The language switcher now resolves translated routes through the optional `translationKey` frontmatter field (and falls back to the collection index instead of a 404 when the slug-preserving path is missing). Collection route targets also keep the configured base when navigating.
