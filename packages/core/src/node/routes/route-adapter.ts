import type { RouteMeta } from './types'

/**
 * Serializable route data for the client-side @bdocs/ssg loader.
 * This maps closely to ComponentRoute in the client types.
 */
export interface SSGRouteData {
  path: string
  filePath: string
  title: string
  description?: string
  sidebarPosition?: number
  badge?: string | { text: string; expires?: string }
  icon?: string
  headings: Array<{ level: number; text: string; id: string }>
  _content: string
  _rawContent?: string
  locale?: string
  version?: string
  tab?: string
  collection?: string
  tags?: string[]
  author?: string
  draft?: boolean
  excerpt?: string
  coverImage?: string
  group?: string
  groupTitle?: string
  groupPosition?: number
  groupIcon?: string
  subRouteGroup?: string
  seo?: Record<string, any>
  date?: string | Date
  lastUpdated?: string | number | Date
  category?: string
  order?: number
  sidebarLabel?: string
  sidebarHidden?: boolean
  frontmatter?: Record<string, any>
  slugParts?: string[]
}

/**
 * Adapter layer between Boltdocs route parser and @bdocs/ssg.
 *
 * Transforms internal RouteMeta objects into the serializable format
 * expected by the client-side createRoutes() helper.
 */
export function adaptRoutesForSSG(routes: RouteMeta[]): SSGRouteData[] {
  return routes.map((route) => ({
    path: route.path,
    filePath: route.filePath,
    title: route.title,
    description: route.description || '',
    sidebarPosition: route.sidebarPosition,
    badge: route.badge,
    icon: route.icon,
    headings: route.headings || [],
    _content: route._content || '',
    _rawContent: route._rawContent || '',
    locale: route.locale,
    version: route.version,
    tab: route.tab,
    collection: route.collection,
    tags: route.tags,
    author: route.author,
    draft: route.draft,
    excerpt: route.excerpt,
    coverImage: route.coverImage,
    group: route.group,
    groupTitle: route.groupTitle,
    groupPosition: route.groupPosition,
    groupIcon: route.groupIcon,
    subRouteGroup: route.subRouteGroup,
    seo: route.seo,
    date: route.date,
    lastUpdated: route.lastUpdated,
    category: route.category,
    order: route.order,
    sidebarLabel: route.sidebarLabel,
    sidebarHidden: route.sidebarHidden,
    frontmatter: route.frontmatter,
    slugParts: route.slugParts,
  }))
}
