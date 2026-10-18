# @bdocs/plugin-git-meta

## 0.2.0

### Minor Changes

- [`cdd636a`](https://github.com/bolt-docs/boltdocs/commit/cdd636a8e949bb56284f389c35128b76c094b5bd) Thanks [@jesusalcaladev](https://github.com/jesusalcaladev)! - Add first-party git metadata plugins and wire the documented `routes:resolved` hook.

  `@bdocs/plugin-git-meta` exports `lastUpdatedPlugin()` and `contributorsPlugin()`, both backed by a single HEAD-cached `git log` scan. Route metadata gains `contributors`, and a new `page:footer:start` client slot lets plugins render content in the default page footer. The plugin's client entry exports customizable `Contributors`, `LastUpdated`, and `GitMetaFooter` components.

  The official docs now use both plugins to show git-backed last-updated dates and contributor avatars.

### Patch Changes

- Updated dependencies [[`cdd636a`](https://github.com/bolt-docs/boltdocs/commit/cdd636a8e949bb56284f389c35128b76c094b5bd)]:
  - boltdocs@3.4.2
