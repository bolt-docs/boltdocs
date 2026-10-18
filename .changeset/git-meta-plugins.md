---
"@bdocs/plugin-git-meta": minor
"boltdocs": patch
"@bdocs/contracts": patch
---

Add first-party git metadata plugins and wire the documented `routes:resolved` hook.

`@bdocs/plugin-git-meta` exports `lastUpdatedPlugin()` and `contributorsPlugin()`, both backed by a single HEAD-cached `git log` scan. Route metadata gains `contributors`, and a new `page:footer:start` client slot lets plugins render content in the default page footer. The plugin's client entry exports customizable `Contributors`, `LastUpdated`, and `GitMetaFooter` components.

The official docs now use both plugins to show git-backed last-updated dates and contributor avatars.
