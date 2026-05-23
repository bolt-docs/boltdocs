---
'@bdocs/ssg': patch
'boltdocs': patch
---

Fix React 19 hydration mismatches and route duplication/double-rendering on subpage refreshes by configuring the router's basename, prepending the basename prefix during SSR query rendering, and extracting/inlining static router hydration data into the head.
