# boltdocs

## 2.7.2

### Patch Changes

- [`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - perf(core): Improved performance in warm

- Updated dependencies [[`31cdab2`](https://github.com/bolt-docs/boltdocs/commit/31cdab269e64b59a12cc55349352b393fe5f6f75)]:
  - @bdocs/ssg@0.0.2

## 2.7.1

### Patch Changes

- [`044ce18`](https://github.com/bolt-docs/boltdocs/commit/044ce18cf54812e486f0af0befdf952e26ebb2f9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error of ssg

## 2.7.0

### Minor Changes

- [`b04fce4`](https://github.com/bolt-docs/boltdocs/commit/b04fce42678230b607adcde349e8bb95f6dca1f3) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - - **feat**: Added support for `lastUpdated` property in documentation pages.
  - **feat**: Significant performance improvements in documentation parsing through a new caching parser.
  - **feat**: Doctor is now stable.
  - **feat**: Added banner on site home page.
  - **feat**: Added Google Analytics 4 support & Google Tag Manager support.
  - **feat**: Added Changelog Generator. he UI to have a better look.
  - **feat**: Updated File-Routing to support new features. - Support Deeper Nested routes - Support metadata file naming (meta.json & \_meta.json) - Support collapsible/collapsed directories - Support custom directory icons
  - **feat**: Added `base` support for base-url routing.
  - **feat**: Added custom-frontmatter & extended MDX frontmatter support.
  - **feat**: Search highlight now works with accents & Mark search works on dynamic content.
  - **fix**: Improved mobile support and responsive layout consistency across the site.
  - **fix**: Resolved styling issues and improved integration for Mermaid diagrams.
  - **fix**: Corrected locale labels in example projects.
  - **fix**: Optimized Tabs and Navbar components to reduce unnecessary re-renders.
  - **fix**: Removed config prop from CopyMarkdown component.
  - **fix**: Removed the need to define `homePage` in `boltdocs.config.ts` when using `pages-external/index.tsx` for a custom home page.
  - **fix**: Added export code-block support for Custom Components.

## 2.6.2

### Patch Changes

- [`2960c55`](https://github.com/bolt-docs/boltdocs/commit/2960c5523040723f2389568b5e72866875617789) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared bug collision pages & navigation
  fix: repared bug 404 when switch version in home
  feat: support types-generator for better autocomplete

## 2.6.1

### Patch Changes

- [`bdc7634`](https://github.com/bolt-docs/boltdocs/commit/bdc7634239ba5e220a4b1fe2792aaa66e6944e46) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: error in developer in build

## 2.6.0

### Minor Changes

- [`6a6d829`](https://github.com/bolt-docs/boltdocs/commit/6a6d82941328c1f2c016781d8d0f004d3a890237) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: new engine ssg
  feat: line-number & word-wrap in code-block
  feat: support languagues rust & toml
  fix: removed ogImage
  feat: support seo granular configuration in frontmatter & config
  fix: removed shadow image
  fix: support detect xml in sitemap
  fix: removed hover in field
  style: updated Admonition styles
  fix: removed style uppercase in sidebar & onthispage
  fix: repared warning each child of react key
  feat: support icons external

## 2.5.6

### Patch Changes

- [`5236e13`](https://github.com/bolt-docs/boltdocs/commit/5236e1379f94699bbbb176826b6eabb4dbb8faa7) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error in mode developer

## 2.5.5

### Patch Changes

- [`c31cfe3`](https://github.com/bolt-docs/boltdocs/commit/c31cfe3777e77b4ef0290aa726696b493f9c51db) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - repared error use-external

## 2.5.4

### Patch Changes

- [`7477d85`](https://github.com/bolt-docs/boltdocs/commit/7477d85ee486af85cdae0ca26aba67ae9071cce9) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: added use-async-external-store with in optimizeDeps

## 2.5.3

### Patch Changes

- [`613b4b7`](https://github.com/bolt-docs/boltdocs/commit/613b4b7c256b2dec3af6d2aa7eb00f1b9a9beea1) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - removed integrations of config

## 2.5.2

### Patch Changes

- [`862634f`](https://github.com/bolt-docs/boltdocs/commit/862634fb0df4e10112877e05e31b12ce7a4f480e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - removed sandbox integrations

## 2.5.1

### Patch Changes

- [`6f47dae`](https://github.com/bolt-docs/boltdocs/commit/6f47dae6a572e1d2ec8c28e56c648ab2db7b96d5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - repared error show visible CodeBlock & repared error components Plugins

## 2.5.0

### Minor Changes

- [`de41957`](https://github.com/bolt-docs/boltdocs/commit/de4195754bbb6dea90cbcd91e1ae3ddc398a8fdb) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Updated imports to simples, support CPS, Support External-Page with file

### Patch Changes

- [`f54fc62`](https://github.com/bolt-docs/boltdocs/commit/f54fc62982411e893beeccb2ebcb20d7a4925bdd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - export types of plugins, Config & theme

## 2.4.2

### Patch Changes

- [`3073b74`](https://github.com/bolt-docs/boltdocs/commit/3073b747b9bd90e154c24758b5a502dfe51c043e) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error in build with virtual-imports

## 2.4.1

### Patch Changes

- [`80de4bd`](https://github.com/bolt-docs/boltdocs/commit/80de4bd49c3de90ec234148c8077b479935db2cf) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - updated width with pathname

- [`c49cefa`](https://github.com/bolt-docs/boltdocs/commit/c49cefa292075606ae626826a890a93bda939ba5) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - added name tabs in URLs & repared icons size

## 2.4.0

### Minor Changes

- [`0ee1f85`](https://github.com/bolt-docs/boltdocs/commit/0ee1f8525500ca6b6dc1eb78260fc257b3698fd4) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Support icons & title CodeBlock, Better Scroll, export Skeleton Component

## 2.3.0

### Minor Changes

- [`5d53fd0`](https://github.com/jesusalcaladev/boltdocs/commit/5d53fd0eddbcc0e22b092f52cea82df78063376b) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: added new primitives `Skeleton`
  feat: added new loading with `Skeleton` primitives
  feat: added new command `boltdocs doctor` for diagnostic your project
  feat: support full-text search
  fix: better calc in page-nav

## 2.2.0

### Minor Changes

- [`766daf2`](https://github.com/jesusalcaladev/boltdocs/commit/766daf21becafaa173a65cc8bea4d31b32ce8640) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: support i18n in links & tabs
  feat: change component Loading
  feat: dectecttheme of system
  perf: better calc in the routes & navigation

## 2.1.1

### Patch Changes

- [`1ce39bb`](https://github.com/jesusalcaladev/boltdocs/commit/1ce39bbe07974f35f6a04c341c5578c337f37024) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: repared error of deploy

## 2.1.0

### Minor Changes

- [`06650d4`](https://github.com/jesusalcaladev/boltdocs/commit/06650d458c26c7bbf4cc2da7ea6bec6352c0c530) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - feat: extract vite.config.ts for used boltdocs.config.ts, support favicon, robots, ogImage

## 2.0.0

### Major Changes

- [`105352e`](https://github.com/jesusalcaladev/boltdocs/commit/105352efc13f081c5fdb6bbcad11891be78f87a7) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - fix: secutity in build & production, repare error in build with virtual:boltdocs-layout
