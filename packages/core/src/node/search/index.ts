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

/**
 * Search is a runtime asset, not the initial application bundle. These
 * limits preserve deep-page coverage without allowing one unusually large
 * page to produce an unbounded response.
 */
export const SEARCH_PAGE_CONTENT_LIMIT = 2_000
export const SEARCH_SECTION_CONTENT_LIMIT = 1_200
export const SEARCH_PAGE_SECTION_BUDGET = 6_000
export const SEARCH_HEADING_LIMIT = 100

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

function bounded(value: string, limit: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit
    ? normalized.slice(0, limit).trim()
    : normalized
}

interface SectionSnippet {
  heading: NonNullable<RouteMeta['headings']>[number]
  start?: number
  body: string
}

/**
 * Plain-text parser output retains heading labels, so section boundaries can be
 * recovered from the bounded runtime asset. Searching from the previous match
 * handles repeated headings without changing the existing SearchDocument shape.
 */
function getSectionSnippets(
  content: string,
  headings: NonNullable<RouteMeta['headings']>,
): SectionSnippet[] {
  const snippets: SectionSnippet[] = []
  const lowerContent = content.toLocaleLowerCase()
  let cursor = 0

  for (const heading of headings.slice(0, SEARCH_HEADING_LIMIT)) {
    const headingText = heading.text.trim()
    if (!headingText) continue
    const start = lowerContent.indexOf(headingText.toLocaleLowerCase(), cursor)
    if (start < 0) {
      snippets.push({ heading, body: '' })
      continue
    }

    const bodyStart = start + headingText.length
    snippets.push({ heading, start: bodyStart, body: '' })
    cursor = bodyStart
  }

  return snippets.map((snippet, index) => {
    if (snippet.start === undefined) return snippet
    const nextStart = snippets[index + 1]?.start
    const end = nextStart ?? content.length
    return {
      heading: snippet.heading,
      body: bounded(
        content.slice(snippet.start, end),
        Math.max(
          0,
          SEARCH_SECTION_CONTENT_LIMIT -
            snippet.heading.text.length -
            ' in '.length,
        ),
      ),
    }
  })
}

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

    const pageContent = route._content || ''
    const finalContent = bounded(
      extraSearchText ? `${pageContent} ${extraSearchText}` : pageContent,
      SEARCH_PAGE_CONTENT_LIMIT,
    )
    const sectionSnippets = route.headings
      ? getSectionSnippets(pageContent, route.headings)
      : []

    // 1. Index the page. This remains larger than the former 500-character
    // prefix, while section documents below provide bounded deep-page hits.
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

    // 2. Attach bounded body context to heading documents for deep linking.
    if (route.headings) {
      let remainingSectionBudget = SEARCH_PAGE_SECTION_BUDGET
      for (const snippet of sectionSnippets) {
        const { heading } = snippet
        const headingContext = `${heading.text} in ${route.title}`
        const sectionContent = bounded(
          snippet.body ? `${headingContext} ${snippet.body}` : headingContext,
          Math.min(SEARCH_SECTION_CONTENT_LIMIT, remainingSectionBudget),
        )
        if (sectionContent) {
          documents.push({
            id: `${route.path}#${heading.id}`,
            title: heading.text,
            content: sectionContent,
            url: `${route.path}#${heading.id}`,
            display: `${route.title} > ${heading.text}`,
            locale: route.locale,
            version: route.version,
          })
          remainingSectionBudget = Math.max(
            0,
            remainingSectionBudget - sectionContent.length,
          )
        }
        if (remainingSectionBudget === 0) break
      }
    }
  }

  return documents
}
