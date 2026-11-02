export type BadgeValue = string | { text: string; expires?: string }

export interface RouteHeading {
  level: number
  text: string
  id: string
}

export interface RouteContributor {
  /** Display name of the contributor. */
  name: string
  /** Author email, only present when the source plugin is configured to expose it. */
  email?: string
  /** Avatar URL, derived from the git identity or configured explicitly. */
  avatar?: string
  /** Profile URL, derived from a GitHub noreply identity or configured explicitly. */
  url?: string
  /** Number of commits authored by this contributor on the page. */
  commits: number
  /** ISO timestamp of this contributor's most recent commit on the page. */
  lastCommit?: string
}

export interface RouteMeta {
  path: string
  componentPath: string
  title: string
  filePath: string
  description?: string
  sidebarPosition?: number
  group?: string
  groupTitle?: string
  groupPosition?: number
  groupIcon?: string
  subRouteGroup?: string
  headings?: RouteHeading[]
  locale?: string
  version?: string
  badge?: BadgeValue
  icon?: string
  tab?: string
  collection?: string
  tags?: string[]
  author?: string
  draft?: boolean
  featureFlags?: string[]
  excerpt?: string
  coverImage?: string
  _content?: string
  _rawContent?: string
  seo?: Record<string, unknown>
  date?: string | Date
  lastUpdated?: string | number | Date
  /**
   * Page contributors derived from version control history.
   * Populated by the `@bdocs/plugin-git-meta` contributors plugin.
   */
  contributors?: RouteContributor[]
  category?: string
  order?: number
  sidebarLabel?: string
  sidebarHidden?: boolean
  frontmatter?: Record<string, unknown>
  subRoutes?: RouteMeta[]
  slugParts?: string[]
}
