---
'@bdocs/plugin-image-optimizer': patch
---

Fix ENOENT crash in `closeBundle` caused by race condition between background cache writes and `enforceSizeLimit`. Added `flush()` before pruning/size check, and made `stat()` resilient to TOCTOU file disappearance.
