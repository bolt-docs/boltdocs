---
'boltdocs': patch
---

Restore React Fast Refresh for sites configured with a non-root `base`, and stop forcing a full reload when a layout or external page is edited.

`@vitejs/plugin-react` was skipped in dev for any base other than `/`, so the most common documentation setup — `base: '/docs'` — had no refresh runtime at all. Without it there is nothing to swap a module in place, so every edit to `layout.tsx`, `icons.tsx` or an external page fell back to a full document reload that discarded scroll position and re-ran every loader. The plugin handles a sub-path base correctly, so the restriction is removed; `BOLTDOCS_REACT_REFRESH=false` still opts out.

The dev server also no longer answers a `pages-external` change with a full reload. Those files are plain React modules behind the user entry, so Vite's module graph and React Fast Refresh already handle them; the previous suppression made a one-line edit to a landing page the slowest possible kind of edit.
