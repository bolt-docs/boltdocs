import type { MigrationFinding, Transform } from '../types'
import { findImports } from '../source'

/**
 * Reports engines configured for the client but missing on the build side.
 *
 * Algolia's client half shipped before its build half: `useSearch` reads
 * `integrations.search.algolia` and queries an index, but nothing ever uploaded
 * anything. A site that configured it got an empty result set with no error
 * anywhere — the worst combination, because every part reports success.
 *
 * This reports the asymmetry. The site works; search silently returns nothing;
 * and the only way to find out is to notice that it does.
 */
export const searchEngineTransform: Transform = {
  id: 'search-engine',

  appliesTo: (file) => /^boltdocs\.config\.(js|mjs|ts)$/.test(file),

  inspect(file, source) {
    if (!/\balgolia\b/.test(source)) return []

    // Already wired on the build side: nothing to report.
    if (
      findImports(source).some((hit) =>
        hit.specifier.includes('search-algolia'),
      )
    ) {
      return []
    }

    const findings: MigrationFinding[] = []
    // `algolia` present without the plugin means the client will query an index
    // nobody writes.
    if (/\balgolia\s*:/.test(source)) {
      findings.push({
        id: 'search/algolia-uploader-missing',
        severity: 'warning',
        action: 'manual',
        title: 'Algolia is configured for the client but nothing uploads to it',
        detail:
          '`integrations.search.algolia` tells the search dialog which index to ' +
          'query. The build half is a separate plugin: without it the index is ' +
          'never written and every search returns an empty result — silently, ' +
          'because both halves report success.',
        file,
        remediation:
          'Add `@bdocs/plugin-search-algolia` to `plugins` with an admin API key.',
      })
    }

    return findings
  },

  apply(source) {
    // Manual: an Algolia upload needs an admin key, and a codemod that
    // invents one produces a build that fails on the first request.
    return source
  },
}
