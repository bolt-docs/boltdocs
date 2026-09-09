---
'boltdocs': minor
---

Add locale support to `experimental.fileRouting`: a top-level `pages-external/{locale}/` directory matching a configured locale now provides the localized variant of a page (`es/roadmap.mdx` → `/es/roadmap`). Each locale URL is served by its localized file when it exists and falls back to the default-locale file otherwise, mirroring the docs i18n fallback routes. For React pages that translate internally with `useI18n()`, the fallback re-renders the default component with the active locale from the URL context.
