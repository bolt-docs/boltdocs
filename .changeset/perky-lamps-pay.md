---
"@bdocs/parser": minor
---

- **Single-pass parser mode** (`--turbo` only)
  - New `parseDocSinglePass()` function in Zig parser
  - Generates headings, plain text, and HTML in a single pass through the document
  - Shared `ParseContext` buffer reduces memory allocations
  - `stripAndDecodeInto()` and `slugInto()` for in-place processing
