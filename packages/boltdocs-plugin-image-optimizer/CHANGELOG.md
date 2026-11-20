# @bdocs/plugin-image-optimizer

## 0.3.0

### Minor Changes

- Vite 8.3.5, and only Vite 8.3.

### Patch Changes

- Every package type checks.

## 0.2.2

### Patch Changes

- Refresh build configs and package metadata.

## 0.2.1

### Patch Changes

- Fix ENOENT crash in `closeBundle` caused by race condition between background cache writes and `enforceSizeLimit`. Added `flush()` before pruning/size check, and made `stat()` resilient to TOCTOU file disappearance.

## 0.2.0

### Minor Changes

- - **boltdocs (Minor)**:
