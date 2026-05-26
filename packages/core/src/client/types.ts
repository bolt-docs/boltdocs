import type * as React from 'react'
export type {
  BoltdocsConfig,
  BoltdocsRoutePath,
  BoltdocsRoutePathWithFallback,
} from '../shared/types'

/**
 * Metadata provided by the server for a specific route.
 * Maps closely to the `RouteMeta` type in the Node environment.
 */
export interface ComponentRoute {
  /** The final URL path */
  path: string
  /** The absolute filesystem path of the source file */
  componentPath: string
  /** The page title */
  title: string
  /** Explicit order in the sidebar */
  sidebarPosition?: number
  /** The relative path from the docs directory */
  filePath: string
  /** The group directory name */
  group?: string
  /** The display title of the group */
  groupTitle?: string
  /** Explicit order of the group in the sidebar */
  groupPosition?: number
  /** Extracted markdown headings for search indexing */
  headings?: { level: number; text: string; id: string }[]
  /** The page summary or description */
  description?: string
  /** The locale this route belongs to, if i18n is configured */
  locale?: string
  /** The version this route belongs to, if versioning is configured */
  version?: string
  /** Optional icon to display (Lucide icon name or raw SVG) */
  icon?: string
  /** The tab this route belongs to, if tabs are configured */
  tab?: string
  /** Optional badge to display next to the sidebar item */
  badge?: string | { text: 'updated' | 'new' | 'deprecated'; expires?: string }
  /** Optional icon for the route's group */
  groupIcon?: string
  /** The sub-route group this route belongs to (from folders starting with _) */
  subRouteGroup?: string
  /** The nested sub-routes if this route acts as the parent of a subRouteGroup */
  subRoutes?: ComponentRoute[]
  /** The extracted plain-text content of the page for search indexing */
  _content?: string
  /** The raw markdown content of the page */
  _rawContent?: string
  /** The publication date */
  date?: string | Date
  /** The last updated timestamp or date */
  lastUpdated?: string | number | Date
  /** Raw extensible frontmatter data for custom components and formatters */
  frontmatter?: Record<string, any>
  /** Clean URL segments stripped of locale/version prefixes */
  slugParts?: string[]
}

/**
 * Site configuration provided by the server.
 */
export type SiteConfig = BoltdocsConfig

/**
 * Tab configuration for the documentation site.
 */
export interface BoltdocsTab {
  id: string
  /** Text to display (can be a string or a map of translations) */
  text: string | Record<string, string>
  icon?: string
}

/**
 * Props for the Sidebar component.
 */
export interface SidebarProps {
  routes: ComponentRoute[]
  config: BoltdocsConfig
}

/**
 * Props for the OnThisPage (TOC) component.
 */
export interface OnThisPageProps {
  headings?: { level: number; text: string; id: string }[]
  editLink?: string
  communityHelp?: string
  filePath?: string
}

/**
 * Props for the Tabs component.
 */
export interface TabsProps {
  tabs: BoltdocsTab[]
  routes: ComponentRoute[]
}

/**
 * Props for user-defined layout components (layout.tsx).
 */
export interface LayoutProps {
  children: React.ReactNode
}

/**
 * Unified type for navbar links.
 */
export interface NavbarLink {
  label: string | Record<string, string>
  href: BoltdocsRoutePathWithFallback
  active: boolean
  to?: string
  items?: NavbarLink[]
}
