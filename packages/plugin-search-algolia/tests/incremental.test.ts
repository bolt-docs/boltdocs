import { describe, expect, it } from 'vitest'
import {
  diffRecords,
  recordFingerprint,
  generateAlgoliaRecords,
} from '../src/node/records'
import type { AlgoliaRecord, SearchDocument } from '@bdocs/contracts'

const record = (
  id: string,
  overrides: Partial<AlgoliaRecord> = {},
): AlgoliaRecord => ({
  objectID: id,
  url: id,
  hierarchy: { lvl0: id },
  content: 'body',
  type: 'lvl0',
  ...overrides,
})

const asMap = (records: AlgoliaRecord[]) =>
  new Map(records.map((r) => [r.objectID, recordFingerprint(r)]))

describe('recordFingerprint', () => {
  it('is stable for identical records', () => {
    expect(recordFingerprint(record('/a'))).toBe(
      recordFingerprint(record('/a')),
    )
  })

  it('changes when any field changes', () => {
    // Including fields that are not searchable text: a moved page or a renamed
    // heading changes what a result looks like even when the matched words are
    // identical, and skipping it would leave a stale breadcrumb in the index.
    const base = record('/a')
    expect(recordFingerprint({ ...base, url: '/b' })).not.toBe(
      recordFingerprint(base),
    )
    expect(
      recordFingerprint({ ...base, hierarchy: { lvl0: 'Renamed' } }),
    ).not.toBe(recordFingerprint(base))
    expect(recordFingerprint({ ...base, content: 'edited' })).not.toBe(
      recordFingerprint(base),
    )
  })
})

describe('diffRecords', () => {
  it('treats every record as changed against an empty history', () => {
    // The one-shot build path: with no prior push, everything is new and
    // nothing is removed.
    const records = [record('/a'), record('/b')]
    const { changed, removed } = diffRecords(records, new Map())

    expect(changed).toHaveLength(2)
    expect(removed).toEqual([])
  })

  it('uploads nothing when nothing changed', () => {
    const records = [record('/a'), record('/b')]
    const { changed, removed } = diffRecords(records, asMap(records))

    expect(changed).toEqual([])
    expect(removed).toEqual([])
  })

  it('uploads only the edited record', () => {
    const before = [record('/a'), record('/b'), record('/c')]
    const after = [
      record('/a'),
      record('/b', { content: 'edited' }),
      record('/c'),
    ]

    const { changed, removed } = diffRecords(after, asMap(before))

    expect(changed.map((r) => r.objectID)).toEqual(['/b'])
    expect(removed).toEqual([])
  })

  it('uploads a new record', () => {
    const before = [record('/a')]
    const after = [record('/a'), record('/b')]

    const { changed, removed } = diffRecords(after, asMap(before))

    expect(changed.map((r) => r.objectID)).toEqual(['/b'])
    expect(removed).toEqual([])
  })

  it('reports a deleted page so its record leaves the index', () => {
    // The case that matters most: a record left behind keeps answering
    // searches, the reader follows the link, and the 404 is indistinguishable
    // from a broken search.
    const before = [record('/a'), record('/gone')]
    const after = [record('/a')]

    const { changed, removed } = diffRecords(after, asMap(before))

    expect(changed).toEqual([])
    expect(removed).toEqual(['/gone'])
  })

  it('handles a rename as one removal and one addition', () => {
    const before = [record('/old')]
    const after = [record('/new')]

    const { changed, removed } = diffRecords(after, asMap(before))

    expect(changed.map((r) => r.objectID)).toEqual(['/new'])
    expect(removed).toEqual(['/old'])
  })

  it('detects an edited heading record without touching its page', () => {
    const doc = (headings: SearchDocument['headings']): SearchDocument => ({
      id: '/page',
      path: '/page',
      title: 'Page',
      content: 'body',
      headings,
      frontmatter: {},
    })

    const before = generateAlgoliaRecords([
      doc([
        { level: 2, text: 'Install', id: 'install' },
        { level: 2, text: 'Linux', id: 'linux' },
      ]),
    ])
    const after = generateAlgoliaRecords([
      doc([
        { level: 2, text: 'Install', id: 'install' },
        { level: 2, text: 'Windows', id: 'windows' },
      ]),
    ])

    const { changed, removed } = diffRecords(after, asMap(before))

    // Only the record whose heading moved is re-sent; the page record is
    // untouched, which is the property that makes an incremental push cheap.
    expect(changed.map((r) => r.objectID)).toEqual(['/page#windows'])
    expect(removed).toEqual(['/page#linux'])
  })
})
