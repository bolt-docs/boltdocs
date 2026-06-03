---
"boltdocs": patch
"create-boltdocs": patch
---

fix: solve various bugs including theme flashing, i18n sidebar disappearing/duplication, upgrade check reliability, CLI port/host support, and create-boltdocs project name argument support.

Specifically for i18n, sidebar, and fallback route routing:
- Refactored `useSidebar` to perform hierarchical tree calculations cleanly without mutations.
- Filtered out fallback redirect routes in `useSidebar` via the `fallback` route property to eliminate duplicate entries in the sidebar.
- Preserved `filePath` properties on index/container route nodes so that client-side language switching and active link highlighting operate correctly.
