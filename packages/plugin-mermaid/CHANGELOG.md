# @bdocs/plugin-mermaid

## 0.3.1

### Patch Changes

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

## 0.3.0

### Minor Changes

- [`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **Dynamic lazy loading**: Refactored the core library import to load Mermaid dynamically only when a page contains diagrams, optimizing the client bundle size.
  - **Configuration serialization fix**: Fixed theme configurations not being correctly parsed and rendered on client components, and improved the initial loading placeholder.

### Patch Changes

- Updated dependencies [[`c4a48b1`](https://github.com/bolt-docs/boltdocs/commit/c4a48b13836f1b33746ab35a2a3bbc4d8536cb32)]:
  - @bdocs/dui@0.1.2

## 0.2.2

### Patch Changes

- [`9936474`](https://github.com/bolt-docs/boltdocs/commit/9936474d386795cc953574929c71cf8b448a7f83) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Replace node-side `console.warn` with `warn()` from `@bdocs/dui`. Client-side error logging in `Mermaid.tsx` left unchanged (browser context, dui is node-only).

- Updated dependencies [[`a780571`](https://github.com/bolt-docs/boltdocs/commit/a78057165a087b36793ceced3bf5799631b9261a), [`375264f`](https://github.com/bolt-docs/boltdocs/commit/375264fb24912fa51da39ccb9fbc78b3a4962b72), [`b736267`](https://github.com/bolt-docs/boltdocs/commit/b736267f8764ab92f9b4fb3ee1f9f0b0bd07e6e0), [`f478f53`](https://github.com/bolt-docs/boltdocs/commit/f478f539a6da7a32c9ecef44fda0013b7b478133), [`f0be317`](https://github.com/bolt-docs/boltdocs/commit/f0be317824d34e6827284a342af946de53396c18)]:
  - @bdocs/dui@0.1.1

## 0.2.1

### Patch Changes

- [`b04fce4`](https://github.com/bolt-docs/boltdocs/commit/b04fce42678230b607adcde349e8bb95f6dca1f3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **fix**: Updated variables-css

## 0.2.0

### Minor Changes

- [`6a6d829`](https://github.com/bolt-docs/boltdocs/commit/6a6d82941328c1f2c016781d8d0f004d3a890237) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Support theme dark/light
  Support error rendering

## 0.1.1

### Patch Changes

- [`516b92e`](https://github.com/bolt-docs/boltdocs/commit/516b92e98adf93828c4429e464c8baaacf8fcfec) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: reduce space packages

## 0.1.0

### Minor Changes

- [`fc08cc4`](https://github.com/bolt-docs/boltdocs/commit/fc08cc42a759a2e771fcdf5ab1f8d76ac5108245) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - support new API the Boltdocs plugins

### Patch Changes

- [`f54fc62`](https://github.com/bolt-docs/boltdocs/commit/f54fc62982411e893beeccb2ebcb20d7a4925bdd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - added types boltdocs

## 0.0.2

### Patch Changes

- [`0ee1f85`](https://github.com/bolt-docs/boltdocs/commit/0ee1f8525500ca6b6dc1eb78260fc257b3698fd4) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: updated name plugins and support error
