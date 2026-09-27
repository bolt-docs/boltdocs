export type BadgeValue = string | { text: string; expires?: string }

export interface RouteHeading {
  level: number
  text: string
  id: string
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
  category?: string
  order?: number
  sidebarLabel?: string
  sidebarHidden?: boolean
  frontmatter?: Record<string, unknown>
  subRoutes?: RouteMeta[]
  slugParts?: string[]
}
