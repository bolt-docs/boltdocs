# create-boltdocs

## 0.4.0

### Minor Changes

- 060d609: - **boltdocs (Minor)**:
  - Extracted the `@bdocs/dui` toolkit as a standalone terminal UI package.
  - Added native feedback integrations supporting Vercel, Netlify, and AWS Lambda adapters.
  - Supported the new `transformSource` plugin lifecycle hook for custom Remark/Rehype preprocessing.
  - Added new CLI dev server flags: `--port`, `--host`, and `--force`.
  - Implemented Phase 0 performance optimizations: deduplicated dev config resolution, instant dev server prewarming, pre-loaded Shiki highlighter during plugin configuration, and added debounced `TransformCache` index persistence.
  - Fixed collection routes provider wrapping at the global shell level, corrected `cover` frontmatter fallbacks, and updated outdated collections hook documentation examples.
  - **create-boltdocs (Minor)**:
    - Completed a full rewrite of the scaffolding CLI templates using the `@bdocs/dui` terminal package.
    - Added integration setup helpers and automated deployment adapters.
  - **@bdocs/plugin-image-optimizer (Minor)**:
    - Added the `@bdocs/plugin-image-optimizer` package to automatically optimize and cache WebP/SVG/PNG assets during static build compilation.
  - **@bdocs/plugin-mermaid (Patch)**:
    - Performance optimizations to prevent Mermaid scripts from blocking client rendering.

## 0.3.2

### Patch Changes

- [`5fb0685`](https://github.com/bolt-docs/boltdocs/commit/5fb06852bfbd94e84cd502f5e874acd1e5f6d947) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: solve various bugs including theme flashing, i18n sidebar disappearing/duplication, upgrade check reliability, CLI port/host support, and create-boltdocs project name argument support.

  Specifically for i18n, sidebar, and fallback route routing:
  - Refactored `useSidebar` to perform hierarchical tree calculations cleanly without mutations.
  - Filtered out fallback redirect routes in `useSidebar` via the `fallback` route property to eliminate duplicate entries in the sidebar.
  - Preserved `filePath` properties on index/container route nodes so that client-side language switching and active link highlighting operate correctly.

## 0.3.1

### Patch Changes

- [`ad137a6`](https://github.com/bolt-docs/boltdocs/commit/ad137a62d377e2c8ed403f56965315e1b7e0d1dc) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: ReferenceError - magenta is not defined in create-boltdocs template prompt

## 0.3.0

### Minor Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Directory structure update**: Updated templates and default structures to align with the new `.boltdocs/` subdirectory layout.

### Patch Changes

- Updated dependencies [[`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32)]:
  - @bdocs/dui@0.1.2

## 0.2.5

### Patch Changes

- [`36a7d09`](https://github.com/bolt-docs/boltdocs/commit/36a7d093a0304620ddaed6c2ed8616edbaa62987) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Replace direct `picocolors` usage with `@bdocs/dui`. All `console.log/error` calls migrated to `dui.logger.*` (info/warn/error/success). Colors now use `dui.colors` instead of direct picocolors. Removes `picocolors` from direct dependencies (transitive via dui).

- Updated dependencies [[`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a), [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72), [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0), [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133), [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18)]:
  - @bdocs/dui@0.1.1

## 0.2.4

### Patch Changes

- [`2ca7562`](https://github.com/bolt-docs/boltdocs/commit/2ca7562b7f6b95955426afdbf15b94b82b5d3e60) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - update create-boltdocs templates

## 0.2.3

### Patch Changes

- [`3410ffa`](https://github.com/bolt-docs/boltdocs/commit/3410ffadcb03ec61d41429c9c36e2104123a6568) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: added home page into of pages-external

## 0.2.2

### Patch Changes

- [`b04fce4`](https://github.com/bolt-docs/boltdocs/commit/b04fce42678230b607adcde349e8bb95f6dca1f3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **fix**: Updated theme colors
  - **fix**: Updated templates

## 0.2.1

### Patch Changes

- [`b1eb43c`](https://github.com/bolt-docs/boltdocs/commit/b1eb43c8ece876f5e0e01b0c8d2db5a7ae4c4f7a) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: - types - updated package.json - updated file structure

## 0.2.0

### Minor Changes

- [`6706448`](https://github.com/bolt-docs/boltdocs/commit/6706448b285db9de0f5aad3025d8f16a2c783532) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - updated packages & support new folder-structure

## 0.1.0

### Minor Changes

- [`1395179`](https://github.com/bolt-docs/boltdocs/commit/1395179b25ec58401b809745eb1bdc998f3dffab) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - support external-page and updated packages and APIS
