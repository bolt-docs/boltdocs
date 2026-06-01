---
"@bdocs/dui": patch
---

- **Accurate Unicode width rendering**: Replaced naive length checks with `string-width` calculations to prevent box layout misalignment in CLI reporting when emoji or multi-byte characters are displayed.
