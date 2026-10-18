--- 
"boltdocs": patch
---

Fix i18n locale switching for collection routes (blog posts)

The locale switching logic in `useI18n` hook incorrectly hardcoded locale position for collection routes, causing 404s when switching languages on blog posts.

**Fixed scenarios:**

- `/es/blog/post` → English now correctly navigates to `/blog/post` (was staying at `/es/blog/post`)
- `/blog/post` → Spanish now correctly navigates to `/es/blog/post` (was going to `/blog/es/post`)
- Versioned collection routes preserve version: `/v2/es/blog/post` ↔ `/v2/blog/post`
- Collection root pages (e.g., `/docs/blog`) no longer navigate away when switching locale

The fix uses the same path parsing logic as the router (`getCollectionFromPath`) to correctly detect locale position relative to version prefixes and collection names.
