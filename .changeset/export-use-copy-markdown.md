---
"boltdocs": patch
---

Export `useCopyMarkdown` from `boltdocs/client`. The hook writes text to the clipboard and exposes a `copied` flag that resets after two seconds, so custom copy buttons can reuse the same behavior as `CopyMarkdown`.
