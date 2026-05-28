import type { RouteMeta } from '../routes/types'

export interface SearchDocument {
  id: string
  title: string
  content: string
  url: string
  display: string
  locale?: string
  version?: string
}

// Defined once at module scope instead of being re-created on every
// loop iteration (which was the previous behaviour — one new function
// object per route, O(N) unnecessary allocations).
function extractStrings(obj: unknown): string[] {
  if (typeof obj === 'string') return [obj]
  if (Array.isArray(obj)) return obj.flatMap(extractStrings)
  if (obj && typeof obj === 'object')
    return Object.values(obj).flatMap(extractStrings)
  return []
}

const STANDARD_FRONTMATTER_KEYS = new Set([
  'title',
  'description',
  'permalink',
  'sidebarPosition',
  'sidebarLabel',
  'sidebarHidden',
  'hidden',
  'category',
  'order',
  'badge',
  'icon',
  'date',
  'lastUpdated',
  'groupTitle',
  'groupPosition',
  'seo',
])

/**
 * Generates a flat list of searchable documents from the route metadata.
 * Each page is indexed as a primary document, and its sections (headings)
 * are indexed as secondary documents to provide granular search results.
 */
export function generateSearchData(routes: RouteMeta[]): SearchDocument[] {
  const documents: SearchDocument[] = []

  for (const route of routes) {
    let extraSearchText = ''
    if (route.frontmatter) {
      const customValues = Object.entries(route.frontmatter)
        .filter(([key]) => !STANDARD_FRONTMATTER_KEYS.has(key))
        .map(([_, value]) => value)

      extraSearchText = extractStrings(customValues).join(' ')
    }

    const finalContent = extraSearchText
      ? `${route._content || ''} ${extraSearchText}`
      : route._content || ''

    // 1. Index the main page
    documents.push({
      id: route.path,
      title: route.title,
      content: finalContent,
      url: route.path,
      display: route.groupTitle
        ? `${route.groupTitle} > ${route.title}`
        : route.title,
      locale: route.locale,
      version: route.version,
    })

    // 2. Index headings as sub-documents for deep linking
    if (route.headings) {
      for (const heading of route.headings) {
        // We find the content belonging to this heading?
        // For now, indexing just the heading text and a bit of context is standard.
        // Deep full-text mapping to specific headings is more complex.
        documents.push({
          id: `${route.path}#${heading.id}`,
          title: heading.text,
          content: `${heading.text} in ${route.title}`,
          url: `${route.path}#${heading.id}`,
          display: `${route.title} > ${heading.text}`,
          locale: route.locale,
          version: route.version,
        })
      }
    }
  }

  return documents
}
