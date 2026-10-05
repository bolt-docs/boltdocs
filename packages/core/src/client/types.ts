/**
 * The public client types, kept so `boltdocs/client` keeps exporting them.
 *
 * The definitions moved to `@bdocs/runtime`, which is also where the `Boltdocs`
 * global namespace now lives — it can only have one home, and the package a
 * consumer imports through is the right one.
 *
 * `client/index.ts` does `export type * from './types'`, so this seam decides
 * what `boltdocs/client` exports as types: fourteen names, the nine declared
 * here before the move plus the five this module used to re-export from the
 * shared types. It is written out name by name rather than as `export *` from
 * the runtime, because a wildcard would also publish the router's and the
 * contexts' types through a path that never exported them.
 *
 * `tests/client-type-surface.test.ts` pins this list, so widening it has to be a
 * deliberate edit rather than a side effect of what the runtime grows next.
 */
export type {
  BoltdocsConfig,
  BoltdocsRoutePath,
  BoltdocsRoutePathWithFallback,
  BoltdocsTab,
  CollectionListLoaderData,
  CollectionPostLoaderData,
  ComponentRoute,
  LayoutProps,
  NavbarLink,
  OnThisPageProps,
  RedirectConfig,
  RedirectStatus,
  SidebarProps,
  SiteConfig,
  TabsProps,
} from '@bdocs/runtime'
