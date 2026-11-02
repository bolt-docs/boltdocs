import { createHash } from 'node:crypto'
import type { SearchDocument } from '@bdocs/contracts'

/**
 * Algolia record shape.
 *
 * This is not speculative: it is what `useSearch` in `@bdocs/theme-neutral`
 * already reads off a hit — `url`, `hierarchy.lvl0..lvl6`, `anchor`,
 * `_snippetResult.content.value`, `objectID`, and a `lang` / `version` facet.
 * The client half of Algolia support shipped before the build half did, which
 * is why a configured site got an empty index and nothing else: the query path
 * was complete and the upload path did not exist.
 *
 * Generating records that differ from those field names would produce an index
 * that queries successfully and renders nothing.
 */
export interface AlgoliaRecord {
  /** Algolia requires a stable, unique id per record. */
  objectID: string
  /** Deep link. The client rewrites absolute URLs back to a path. */
  url: string
  /** Docsearch-style breadcrumb levels; the client reads up to `lvl6`. */
  hierarchy: Record<string, string>
  /** Text the query falls back to when a hierarchy is empty. */
  content: string
  /** Present when the record is a heading rather than a page. */
  anchor?: string
  /** Facet filters, matched against `facetFilters` in the query. */
  lang?: string
  version?: string
  type?:
    | 'lvl0'
    | 'lvl1'
    | 'lvl2'
    | 'lvl3'
    | 'lvl4'
    | 'lvl5'
    | 'lvl6'
    | 'content'
}

const LEVELS = ['lvl0', 'lvl1', 'lvl2', 'lvl3', 'lvl4', 'lvl5', 'lvl6'] as const

/**
 * Turn a page into the records Algolia will hold.
 *
 * One record per page plus one per heading, matching how the runtime
 * `search.json` is shaped. Heading records carry `anchor` so the client can mark
 * a result as a heading (`isHeading`), and the query's `lang` / `version` facet
 * filters line up with the page's locale and version.
 *
 * The `hierarchy` for a heading record is the path from the page title down to
 * that heading, which is what produces a readable breadcrumb in the dialog:
 * `Intro > Install > Linux` rather than the bare heading text.
 */
export function generateAlgoliaRecords(
  documents: SearchDocument[],
): AlgoliaRecord[] {
  const records: AlgoliaRecord[] = []

  for (const doc of documents) {
    const hierarchy: Record<string, string> = { lvl0: doc.title }
    records.push({
      objectID: doc.id,
      url: doc.path,
      hierarchy,
      content: doc.content,
      type: 'lvl0',
      ...(doc.locale ? { lang: doc.locale } : {}),
      ...(doc.version ? { version: doc.version } : {}),
    })

    for (const heading of doc.headings ?? []) {
      // Stop at lvl6: the client reads no deeper, and a seventh level would be
      // dropped from the breadcrumb anyway. A level-1 heading lands on lvl0,
      // which is already the page title.
      const level = Math.min(Math.max(heading.level, 2), LEVELS.length)

      // The breadcrumb is the chain of headings above this one, so a result
      // reads `Intro > Install > Linux` rather than the bare heading text.
      const anchorHierarchy: Record<string, string> = { lvl0: doc.title }
      for (let depth = 2; depth < level; depth++) {
        const ancestor = (doc.headings ?? []).find((h) => h.level === depth)
        if (!ancestor) break
        anchorHierarchy[LEVELS[depth - 1]] = ancestor.text
      }
      anchorHierarchy[LEVELS[level - 1]] = heading.text

      records.push({
        objectID: `${doc.id}#${heading.id}`,
        url: `${doc.path}#${heading.id}`,
        hierarchy: anchorHierarchy,
        content: heading.text,
        anchor: heading.id,
        type: LEVELS[level - 1],
        ...(doc.locale ? { lang: doc.locale } : {}),
        ...(doc.version ? { version: doc.version } : {}),
      })
    }
  }

  return records
}

/**
 * The index settings Algolia needs for this record shape.
 *
 * `searchableAttributes` is ordered by weight, and it is the single most
 * important setting for result quality: without a heading match, a query for
 * "install linux" ranks a page whose body happens to mention both words far
 * below the heading that is literally titled that.
 */
export function algoliaIndexSettings(): Record<string, unknown> {
  return {
    searchableAttributes: [
      'unordered(hierarchy)',
      'content',
      'unordered(anchor)',
    ],
    attributesForFaceting: ['filterOnly(lang)', 'filterOnly(version)'],
    attributesToSnippet: ['content:20'],
    customRanking: ['asc(anchor)'],
    // A heading record shares its page's URL without the fragment, and Algolia
    // dedupes by objectID, so no unique attribute is declared here.
    distinct: false,
  }
}

/**
 * The fingerprint a record is compared by across pushes.
 *
 * Covers the whole record rather than its searchable text: a change to `url` or
 * to a `hierarchy` level changes what a result looks like even when the text a
 * query matches on is identical, and skipping it would leave the index showing
 * a stale breadcrumb.
 */
export function recordFingerprint(record: AlgoliaRecord): string {
  return createHash('sha1').update(JSON.stringify(record)).digest('hex')
}

/**
 * Split records into those that changed and ids that went away.
 *
 * A deleted page is the case that matters most: leaving its record in the index
 * means a search returns it, the reader follows the link, and the 404 is
 * indistinguishable from a broken search.
 */
export function diffRecords(
  records: AlgoliaRecord[],
  previous: Map<string, string>,
): { changed: AlgoliaRecord[]; removed: string[] } {
  const changed: AlgoliaRecord[] = []
  const seen = new Set<string>()

  for (const record of records) {
    const fingerprint = recordFingerprint(record)
    seen.add(record.objectID)
    if (previous.get(record.objectID) !== fingerprint) changed.push(record)
  }

  return {
    changed,
    removed: [...previous.keys()].filter((id) => !seen.has(id)),
  }
}
