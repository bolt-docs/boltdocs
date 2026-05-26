---
"@bdocs/dui": patch
---

fix: replace `visibleLength` naive `.length` with `string-width` for accurate Unicode display width. Fixes box alignment when titles contain emoji (e.g. `✨`, `📄`, `✔`).
