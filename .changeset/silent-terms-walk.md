---
"boltdocs": minor
---

Add strict route path typing with autocompletion for navbar, sidebar, and Link component hrefs.

- Move BoltdocsRoutePaths to global namespace for reliable augmentation across tsconfigs
- Add BoltdocsRoutePathWithFallback type (resolves to route union when augmentation active, string otherwise)
- Include base path fallback routes (e.g. /docs) in generated route types
- Generate global namespace augmentation instead of module augmentation for broader VS Code compatibility
