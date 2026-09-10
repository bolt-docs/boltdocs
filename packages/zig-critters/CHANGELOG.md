# @bdocs/zig-critters

## 0.2.1

### Patch Changes

- [`9c5251c`](https://github.com/bolt-docs/boltdocs/commit/9c5251c4fba6efee8d9d1920495be9c731bab8b2) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Update beasties and selector Zig sources with WASM types.

## 0.2.0

### Minor Changes

- [`491cf14`](https://github.com/bolt-docs/boltdocs/commit/491cf14de05bb06757047b301c88448a25880406) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Smart Selector Filtering & Size Budget**:
  - Exclude layout-related classes (sidebar, navbar, toc, etc.) from critical CSS inlining.
  - Exclude complex selectors (> 2 parts) natively in Zig.
  - Implement an 8 KB size budget in JS to discard critical CSS if the payload is too large.
