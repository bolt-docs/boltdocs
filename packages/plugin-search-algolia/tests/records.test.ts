import { describe, expect, it } from 'vitest'
import {
  generateAlgoliaRecords,
  algoliaIndexSettings,
} from '../src/node/records'
import type { SearchDocument } from '@bdocs/contracts'

function doc(overrides: Partial<SearchDocument> = {}): SearchDocument {
  return {
    id: '/docs/intro',
    path: '/docs/intro',
    title: 'Intro',
    content: 'Body text about installing.',
    headings: [],
    frontmatter: {},
    ...overrides,
  }
}

describe('generateAlgoliaRecords', () => {
  it('produces one page record with the fields the client reads', () => {
    // The theme's `useSearch` reads `objectID`, `url`, `hierarchy`,
    // `content` and `anchor` off every hit. A record missing one of them
    // queries fine and renders as a blank row.
    const [record] = generateAlgoliaRecords([doc()])

    expect(record).toMatchObject({
      objectID: '/docs/intro',
      url: '/docs/intro',
      content: 'Body text about installing.',
    })
    expect(record.hierarchy).toEqual({ lvl0: 'Intro' })
    expect(record.type).toBe('lvl0')
  })

  it('adds a record per heading with an anchor', () => {
    const records = generateAlgoliaRecords([
      doc({
        headings: [
          { level: 2, text: 'Install', id: 'install' },
          { level: 3, text: 'Linux', id: 'linux' },
        ],
      }),
    ])

    // One page + two headings.
    expect(records).toHaveLength(3)

    const linux = records.find((r) => r.anchor === 'linux')
    expect(linux?.url).toBe('/docs/intro#linux')
    expect(linux?.objectID).toBe('/docs/intro#linux')
    expect(linux?.type).toBe('lvl2')
  })

  it('builds a readable breadcrumb from the headings above one', () => {
    const records = generateAlgoliaRecords([
      doc({
        headings: [
          { level: 2, text: 'Install', id: 'install' },
          { level: 3, text: 'Linux', id: 'linux' },
        ],
      }),
    ])

    // `Intro > Install > Linux`, not the bare heading text: the dialog renders
    // `hierarchy` joined as the breadcrumb.
    const linux = records.find((r) => r.anchor === 'linux')
    expect(linux?.hierarchy).toEqual({
      lvl0: 'Intro',
      lvl1: 'Install',
      lvl2: 'Linux',
    })
  })

  it('carries locale and version as facets the query filters on', () => {
    const [record] = generateAlgoliaRecords([
      doc({ locale: 'es', version: 'v2' }),
    ])

    expect(record.lang).toBe('es')
    expect(record.version).toBe('v2')
  })

  it('omits facet keys when the route has none', () => {
    const [record] = generateAlgoliaRecords([doc()])

    // Sending `lang: undefined` would index an empty facet that still matches
    // a `lang:` filter as a miss rather than as absent.
    expect('lang' in record).toBe(false)
    expect('version' in record).toBe(false)
  })

  it('clamps heading depth to the six levels the client reads', () => {
    const records = generateAlgoliaRecords([
      doc({
        headings: [
          { level: 2, text: 'A', id: 'a' },
          { level: 3, text: 'B', id: 'b' },
          { level: 4, text: 'C', id: 'c' },
          { level: 5, text: 'D', id: 'd' },
          { level: 6, text: 'E', id: 'e' },
          { level: 7, text: 'F', id: 'f' },
        ],
      }),
    ])

    for (const record of records) {
      for (const key of Object.keys(record.hierarchy)) {
        expect(key).toMatch(/^lvl[0-6]$/)
      }
    }
  })

  it('handles a level-1 heading without overwriting the page title', () => {
    const records = generateAlgoliaRecords([
      doc({
        title: 'Page',
        headings: [{ level: 1, text: 'Top', id: 'top' }],
      }),
    ])

    // lvl0 is the page title. A level-1 heading landing on lvl0 would replace it
    // and the breadcrumb would read `Top` for a page whose title is `Page`.
    const heading = records.find((r) => r.anchor === 'top')
    expect(heading?.hierarchy.lvl0).toBe('Page')
  })

  it('gives every record a unique objectID', () => {
    const records = generateAlgoliaRecords([
      doc({ headings: [{ level: 2, text: 'A', id: 'a' }] }),
      doc({ id: '/docs/other', path: '/docs/other', title: 'Other' }),
    ])

    expect(new Set(records.map((r) => r.objectID)).size).toBe(records.length)
  })
})

describe('algoliaIndexSettings', () => {
  it('ranks heading matches above body matches', () => {
    // Without `hierarchy` first, a query for "install linux" ranks a page whose
    // body mentions both words above the heading literally titled that.
    const settings = algoliaIndexSettings()
    expect(settings.searchableAttributes).toEqual([
      'unordered(hierarchy)',
      'content',
      'unordered(anchor)',
    ])
  })

  it('declares the facets the client filters by', () => {
    const settings = algoliaIndexSettings()
    expect(settings.attributesForFaceting).toEqual([
      'filterOnly(lang)',
      'filterOnly(version)',
    ])
  })

  it('asks for content snippets the dialog renders', () => {
    expect(algoliaIndexSettings().attributesToSnippet).toEqual(['content:20'])
  })
})
