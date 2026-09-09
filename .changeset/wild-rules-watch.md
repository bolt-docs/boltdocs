---
'boltdocs': patch
---

Fix dev server HMR for `pages-external/` files: explicitly watching `pages-external/index.*` raced with chokidar's initial recursive scan, so files such as `roadmap.mdx` and underscore-prefixed section components were never watched and edits had no effect. The watcher now only extends the watch to paths outside the Vite root, and Vite's default HMR is suppressed for `pages-external/` so changes trigger a single reload. Also wrap file-routed MDX pages in a proper page container (title + prose) inside the external layout.
