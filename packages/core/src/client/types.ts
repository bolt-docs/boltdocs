import type * as React from 'react'
import type { BadgeValue } from '../shared/types'
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
  badge?: BadgeValue
  /** Optional icon for the route's group */
  groupIcon?: string
  /** The sub-route group this route belongs to (from folders starting with _) */
  subRouteGroup?: string
  /** The nested sub-routes if this route acts as the parent of a subRouteGroup */
  subRoutes?: ComponentRoute[]
  /** Internal helper map for nesting routes during sidebar construction */
  _subMap?: Map<string, ComponentRoute>
  /** The extracted plain-text content of the page for search indexing */
  _content?: string
  /** The raw markdown content of the page */
  _rawContent?: string
  /** The publication date */
  date?: string | Date
  /** The last updated timestamp or date */
  lastUpdated?: string | number | Date
  /** The collection this route belongs to (from [name] directories) */
  collection?: string
  /** Tags for blog posts */
  tags?: string[]
  /** Author identifier for blog posts */
  author?:
    | string
    | {
        name: string
        avatar?: string
        url?: string
        image?: string
      }
  /** Draft flag */
  draft?: boolean
  /** Feature flags required for this page to be visible */
  featureFlags?: string[]
  /** Short excerpt for list displays */
  excerpt?: string
  /** Cover image for blog posts */
  coverImage?: string
  /** Raw extensible frontmatter data for custom components and formatters */
  frontmatter?: Record<string, any>
  /** Clean URL segments stripped of locale/version prefixes */
  slugParts?: string[]
  /** SEO metadata for page headers */
  seo?: Record<string, any>
  /** Flag to indicate if this is a fallback redirect route */
  fallback?: boolean
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

// ---------------------------------------------------------------------------
// Loader data types — shapes returned by React Router loaders
// ---------------------------------------------------------------------------

/**
 * Shape of the data returned by a collection post route loader.
 * Consumed by `BlogPost` via `useLoaderData<CollectionPostLoaderData>()`.
 */
export interface CollectionPostLoaderData {
  /** Full route metadata for this post (title, date, author, tags, etc.) */
  route: ComponentRoute
  /** The name of the collection this post belongs to (e.g. 'blog') */
  collection: string
  /** Extracted page headings for the Table of Contents */
  headings: { level: number; text: string; id: string }[]
}

/**
 * Shape of the data returned by a collection listing route loader.
 * Consumed by `BlogList` via `useLoaderData<CollectionListLoaderData>()`.
 */
export interface CollectionListLoaderData {
  /** Paginated subset of posts to display on this page */
  posts: Array<{
    path: string
    title: string
    date?: string | Date
    excerpt?: string
    tags?: string[]
    author?: string
    coverImage?: string
    filePath: string
  }>
  /** Total number of pages available */
  totalPages: number
  /** Current page index (1-based) */
  currentPage: number
  /** Collection name used to build pagination URLs (e.g. 'blog' → '/blog/page/2') */
  collection: string
}
