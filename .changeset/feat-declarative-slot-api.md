---
'boltdocs': minor
---

feat(core): declarative slot API via `virtual:boltdocs-layout-slots`. Plugins emit `slots: SlotDeclaration[]`; users override through `boltdocs.config.ts > slots` (`{ replace | append | disable }` actions or string shorthand). Adds `useSlotRegistry` hook, slot primitives (`FloatingBottom`, `RightRail`, `NavbarExtra`, `HeaderExtra`, `TocExtra`, `FooterExtra`, `BodyPortal`) on `DocsLayout`, and HMR-aware cache invalidation.

Also fixes `src/client/virtual.d.ts` ambient declarations — top-level `import type` statements were inlined as `import('./path').Type` so the file is now a true ambient script, which makes every `declare module 'virtual:boltdocs-*'` block apply globally. Resolves pre-existing TS2307 errors for `virtual:boltdocs-{routes,config,layout,icons,layout-slots,mdx-components,entry,collections}`.
