---
'boltdocs': patch
'@bdocs/plugin-ask-ai': patch
---

Close the remaining documentation and dependency gaps.

- Give every docs page a single H1 by demoting 36 in-content headings to H2.
- Add the missing Spanish release notes, release index and redirects guide, so
  `boltdocs doctor` reports no i18n warnings.
- Shorten 12 blog titles that exceeded the metadata limit.
- Align `@bdocs/plugin-ask-ai` with zod 4 (its only v3-specific call site is
  replaced with the version-neutral `'custom'` issue code).
