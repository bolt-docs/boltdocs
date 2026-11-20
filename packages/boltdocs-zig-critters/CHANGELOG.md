# @bdocs/zig-critters

## 0.3.0

### Minor Changes

- The critical-CSS extractor asks the page before it walks the elements.
- The critical-CSS extractor parses the stylesheet once.

## 0.2.3

### Patch Changes

- Extractor binary identity now participates in render-cache and critical-CSS cache keys
- Fix mobile layout rendering on desktop: critical CSS no longer drops every desktop `@media` block Three extractor bugs shipped together produced an inline critical `<style>` with zero media queries.

## 0.2.2

### Patch Changes

- Faster critical CSS extraction (zig-critters): worker-threads pool, resident WASM CSS, single-pass injection Measured on the docs site (259 pages, identical client bundle): critters p50 468ms → 210ms, p95 1644ms → 1064ms, render phase 82.9s → 34.0s, with byte-identical critical CSS output.

## 0.2.1

### Patch Changes

- Update beasties and selector Zig sources with WASM types.

## 0.2.0

### Minor Changes

- - **Smart Selector Filtering & Size Budget**:
