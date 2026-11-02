import type { MigrationFinding, Transform } from '../types'
import { findImports, replaceSpecifier } from '../source'

const PKG = '@bdocs/theme-neutral'

/**
 * Subpaths that existed in 3.x and what they became.
 *
 * `.`, `./client`, `./composition` and `./mdx` all resolved to the same
 * `dist/index.mjs`. Four names for one barrel is how a site ended up importing
 * the wrong one and getting unstyled slots with no way to tell. The aliases are
 * collapsed to `.`, `./composition` and `./css`, one boundary each.
 */
const SUBDPATHS: Record<string, string> = {
  [`${PKG}/components/primitives`]: `${PKG}/composition`,
  [`${PKG}/client`]: PKG,
  [`${PKG}/mdx`]: PKG,
}

/**
 * `theme-neutral` subpath aliases → the three real entry points.
 *
 * Only the removed names are rewritten. A specifier that already resolves is
 * left alone, so re-running the command is a no-op rather than a rewrite loop.
 */
export const themeSubpathTransform: Transform = {
  id: 'theme-subpath',

  appliesTo: (file) =>
    /\.(tsx?|jsx?|mts|cts|mjs|cjs|css)$/.test(file) &&
    !file.includes('/node_modules/') &&
    !file.endsWith('.d.ts'),

  inspect(file, source) {
    const findings: MigrationFinding[] = []
    for (const hit of findImports(source)) {
      const next = SUBDPATHS[hit.specifier]
      if (!next) continue
      findings.push({
        id: 'theme/subpath',
        severity: 'warning' as const,
        action: 'fixable' as const,
        title: `\`${hit.specifier}\` is now \`${next}\``,
        detail:
          'The package exported four subpaths that all resolved to the same ' +
          'barrel, and two of them exported a different `Navbar` and ' +
          '`Sidebar` under the same name. A site that reached for the wrong ' +
          'one got style-neutral slots where it expected styled components. ' +
          'The aliases are now one boundary each.',
        file,
        line: hit.line,
        snippet: hit.specifier,
        remediation: `Rewrite the specifier to \`${next}\`.`,
      })
    }
    return findings
  },

  apply(source) {
    let out = source
    const hits = findImports(source)
      .filter((hit) => SUBDPATHS[hit.specifier])
      .sort((a, b) => b.start - a.start)
    for (const hit of hits) {
      out = replaceSpecifier(out, hit, SUBDPATHS[hit.specifier])
    }
    return out
  },
}
