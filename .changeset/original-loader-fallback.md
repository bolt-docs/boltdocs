---
'@bdocs/ssg': patch
---

Fall back to the original route loader when the static data manifest or data file is unavailable, instead of returning null. This prevents 'Cannot read properties of null' crashes on navigation when the loader data fetch fails.
