/**
 * Metadata representing a single documentation route.
 * This information is used to build the client-side router and the sidebar navigation.
 */
export interface RouteMeta {
  /** The final URL path for the route (e.g., '/docs/guide/start') */
  path: string
  /** The absolute filesystem path to the source markdown/mdx file */
  componentPath: string
  /** The title of the page, usually extracted from frontmatter or the filename */
  title: string
  /** The relative path from the docs directory, used for edit links */
  filePath: string
  /** Optional description of the page (for SEO/meta tags) */
  description?: string
  /** Optional explicit position for ordering in the sidebar */
  sidebarPosition?: number
  /** The group (directory) this route belongs to */
  group?: string
  /** The display title for the route's group */
  groupTitle?: string
  /** Optional explicit position for ordering the group itself */
  groupPosition?: number
  /** Optional icon for the route's group */
  groupIcon?: string
  /** The sub-route group this route belongs to (from folders starting with _) */
  subRouteGroup?: string
  /** Extracted markdown headings for search indexing */
  headings?: { level: number; text: string; id: string }[]
  /** The locale this route belongs to, if i18n is configured */
  locale?: string
  /** The version this route belongs to, if versioning is configured */
  version?: string
  /** Optional badge to display next to the sidebar item (e.g., 'New', 'Experimental') */
  badge?: string | { text: string; expires?: string }
  /** Optional icon to display (Lucide icon name or raw SVG) */
  icon?: string
  /** The tab this route belongs to, if tabs are configured */
  tab?: string
  /** The extracted plain-text content of the page for search indexing */
  _content?: string
  /** The raw markdown content of the page */
  _rawContent?: string
  /** Extracted SEO and Open Graph metadata from frontmatter */
  seo?: Record<string, any>
  /** The publication date */
  date?: string | Date
  /** The last updated timestamp or date */
  lastUpdated?: string | number | Date
  /** Optional category for the page */
  category?: string
  /** Optional explicit order (alternative to sidebarPosition) */
  order?: number
  /** Optional explicit label for the sidebar */
  sidebarLabel?: string
  /** Whether the page is hidden from the sidebar */
  sidebarHidden?: boolean
  /** Raw extensible frontmatter data for custom components and formatters */
  frontmatter?: Record<string, any>
  /** Optional recursive child routes for deep sidebar hierarchies */
  subRoutes?: RouteMeta[]
  /** Clean URL segments stripped of locale/version prefixes */
  slugParts?: string[]
}

/**
 * Internal representation of a parsed documentation file before finalizing groups.
 * Stored in the file cache to avoid re-parsing unchanged files.
 */
export interface ParsedDocFile {
  /** The core route metadata without group-level details (inferred later) */
  route: Omit<RouteMeta, 'group' | 'groupTitle' | 'groupPosition'>
  /** The base directory of the file (used to group files together) */
  relativeDir?: string
  /** Whether this file is the index file for its directory group */
  isGroupIndex: boolean
  /** If this is a group index, any specific frontmatter metadata dictating the group's title and position */
  groupMeta?: { title: string; position?: number; icon?: string }
  /** Extracted group position from the directory name if it has a numeric prefix */
  inferredGroupPosition?: number
  /** Extracted tab name from the directory name if it follows the (tab-name) syntax */
  inferredTab?: string
}
