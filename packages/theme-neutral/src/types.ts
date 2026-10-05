/**
 * The theme's own type surface.
 *
 * The definitions live in `@bdocs/runtime`; this exists so the package has one
 * module a consumer can import types from without knowing that. Kept as a named
 * list rather than `export *` because `boltdocs/client` does
 * `export type * from './types'`, and a wildcard here would widen the published
 * client type surface to whatever the runtime grows next.
 */
export type {
  BoltdocsConfig,
  BoltdocsLocale,
  BoltdocsMdxComponents,
  BoltdocsRoutePath,
  BoltdocsRoutePathWithFallback,
  BoltdocsTab,
  BoltdocsTypes,
  BoltdocsVersion,
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
