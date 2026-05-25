---
'boltdocs': patch
---

Fix duplicate sidebar links caused by fallback metadata entries copying `filePath` and `slugParts` from the original route. The fallback entry now sets `filePath: ''` and `slugParts: []` so the sidebar code skips it.
