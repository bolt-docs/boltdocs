---
"boltdocs": patch
---

fix: filter collections and search by locale/version with default fallback

- Add `locale` and `version` fields to `CollectionPost` interface
- Filter `usePosts` results by current locale and version, falling back to config defaults
- Fix search to match routes against default locale/version when not explicitly set
- Include locale and version in collection virtual module data
