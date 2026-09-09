---
'boltdocs': minor
---

**Sidebar primitives**: `Sidebar.Items` now accepts `classNames` (per-piece `SidebarSlots` merged over the defaults with `tailwind-merge`) plus `componentItem` and `componentGroup` render props for full structural replacement. `Sidebar.Link`, `Sidebar.Group` and `Sidebar.SubGroup` gained the corresponding slot props (`iconClassName`, `labelClassName`, `trailing`, `headerClassName`, `renderTitle`, `toggleClassName`, `renderToggle`, etc.). `Sidebar.Item` accepts `depth`, `renderItem` and `classNames`. `useSidebar` now exposes `merged`, `tree`, `isActive` and `isGroupActive`, alongside pure helpers `isRouteActive` and `hasChildren`. Fixed a latent bug where `SidebarItems` declared a `componentItem` prop that was never used.

**CodeBlock primitives**: new `CodeBlock.Actions`, `CodeBlock.Pre` and `CodeBlock.Expand` parts. Feature-scoped hooks `useCopyButton`, `useExpandable` and `useCodeBlockFeedback` are exported from `boltdocs/client`; the historical `useCodeBlock` hook is now a deprecated composition of them and will be removed in a future major.
