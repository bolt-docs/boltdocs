import { describe, expect, it } from 'vitest'
import {
  generateSearchData,
  SEARCH_PAGE_CONTENT_LIMIT,
  SEARCH_PAGE_SECTION_BUDGET,
  SEARCH_HEADING_LIMIT,
  type SearchDocument,
} from '../src/node/generate'
import type { RouteMeta } from '@bdocs/contracts'

function route(overrides: Partial<RouteMeta> = {}): RouteMeta {
  return {
    path: '/docs/intro',
    componentPath: '/project/docs/intro.mdx',
    title: 'Intro',
    filePath: 'intro.mdx',
    ...overrides,
  } as RouteMeta
}

describe('generateSearchData', () => {
  it('indexes a page as one document', () => {
    const docs = generateSearchData([
      route({ _content: 'The quick brown fox jumps over the lazy dog' }),
    ])

    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      id: '/docs/intro',
      title: 'Intro',
      url: '/docs/intro',
      display: 'Intro',
    })
    expect(docs[0].content).toContain('quick brown fox')
  })

  it('qualifies the display breadcrumb when a route has a group', () => {
    const docs = generateSearchData([
      route({ groupTitle: 'Getting Started', title: 'Installation' }),
    ])

    expect(docs[0].display).toBe('Getting Started > Installation')
  })

  it('adds a deep-linkable document per heading', () => {
    const docs = generateSearchData([
      route({
        _content: 'Install it. Configure it. Deploy it.',
        headings: [
          { level: 2, text: 'Install it', id: 'install' },
          { level: 2, text: 'Configure it', id: 'configure' },
        ],
      }),
    ])

    // One page document plus one per heading.
    expect(docs).toHaveLength(3)
    const section = docs.find((d) => d.id === '/docs/intro#install')
    expect(section).toBeDefined()
    expect(section?.url).toBe('/docs/intro#install')
    expect(section?.display).toBe('Intro > Install it')
    expect(section?.content).toContain('Configure it')
  })

  it('bounds page content so one large page cannot dominate the asset', () => {
    const docs = generateSearchData([route({ _content: 'x'.repeat(50_000) })])

    expect(docs[0].content.length).toBeLessThanOrEqual(
      SEARCH_PAGE_CONTENT_LIMIT,
    )
  })

  it('bounds the total section budget per page', () => {
    const headings = Array.from({ length: 40 }, (_, i) => ({
      level: 2,
      text: `Section ${i}`,
      id: `section-${i}`,
    }))
    const docs = generateSearchData([
      route({
        _content: headings.map((h) => h.text).join('. ') + '.',
        headings,
      }),
    ])

    const sections = docs.filter((d) => d.id.includes('#'))
    const total = sections.reduce((sum, d) => sum + d.content.length, 0)

    // The budget bounds the whole page, not each section: without the
    // remaining-budget tracking this grows linearly with heading count.
    expect(total).toBeLessThanOrEqual(
      SEARCH_PAGE_SECTION_BUDGET + SEARCH_PAGE_CONTENT_LIMIT,
    )
  })

  it('caps how many headings become documents', () => {
    const headings = Array.from(
      { length: SEARCH_HEADING_LIMIT + 50 },
      (_, i) => ({
        level: 2,
        text: `Heading ${i}`,
        id: `h-${i}`,
      }),
    )
    const docs = generateSearchData([
      route({
        _content: headings.map((h) => h.text).join('. ') + '.',
        headings,
      }),
    ])

    expect(docs.length).toBeLessThanOrEqual(SEARCH_HEADING_LIMIT + 1)
  })

  it('appends custom frontmatter and skips standard keys', () => {
    const docs = generateSearchData([
      route({
        _content: 'Body text',
        frontmatter: {
          title: 'should not double',
          description: 'should not appear',
          category: 'also standard, not indexed',
          tags: 'installation guide',
          customField: 'kept in the index',
        } as RouteMeta['frontmatter'],
      }),
    ])

    // Only non-standard keys reach the index. `title` is already the document
    // title and repeating it makes text matches noisier, not richer — and
    // `category` is on the standard list for the same reason.
    expect(docs[0].content).toContain('installation guide')
    expect(docs[0].content).toContain('kept in the index')
    expect(docs[0].content).not.toContain('should not double')
    expect(docs[0].content).not.toContain('should not appear')
    expect(docs[0].content).not.toContain('also standard')
  })

  it('carries locale and version through to the document', () => {
    const docs = generateSearchData([route({ locale: 'es', version: 'v2' })])

    expect(docs[0].locale).toBe('es')
    expect(docs[0].version).toBe('v2')
  })

  it('handles a heading with no matching body text', () => {
    // The parser output and the heading list can disagree when a heading is
    // rendered from a component rather than typed as text.
    const docs = generateSearchData([
      route({
        _content: 'no headings here',
        headings: [{ level: 2, text: 'Absent', id: 'absent' }],
      }),
    ])

    const section = docs.find((d) => d.id === '/docs/intro#absent')
    expect(section).toBeDefined()
    expect(section?.content).toContain('Absent in Intro')
  })

  it('returns an empty list for no routes', () => {
    expect(generateSearchData([])).toEqual([])
  })

  it('produces the same documents regardless of route order', () => {
    const a = route({ path: '/a', title: 'A', _content: 'alpha' })
    const b = route({ path: '/b', title: 'B', _content: 'beta' })
    const forward = generateSearchData([a, b])
    const reverse = generateSearchData([b, a])

    expect(forward.map((d: SearchDocument) => d.id).sort()).toEqual(
      reverse.map((d: SearchDocument) => d.id).sort(),
    )
  })
})
