import type { Transform } from '../types'

const BRIDGE_IMPORT = "import 'virtual:boltdocs-site-bridge'"

/**
 * A hand-written `boltdocs-entry.*` must register the site's generated artifacts.
 *
 * In 4.0 the engine no longer registers site artifacts as a side effect of
 * importing the client route surface. The generated entry imports
 * `virtual:boltdocs-site-bridge` explicitly; a custom entry must do the same,
 * otherwise icons, layout, search data, page source and client registry are
 * missing at runtime.
 */
export const entrySiteBridgeTransform: Transform = {
  id: 'entry-site-bridge',

  appliesTo: (file) =>
    /(^|\/)boltdocs-entry\.(tsx|ts|jsx|js|mjs|cjs)$/.test(file) &&
    !file.includes('/node_modules/'),

  inspect(file, source) {
    if (source.includes('virtual:boltdocs-site-bridge')) return []
    const line = source.split('\n').findIndex((l) => l.trim().length > 0) + 1
    return [
      {
        id: 'entry/site-bridge',
        severity: 'blocking' as const,
        action: 'fixable' as const,
        title: 'Custom entry is missing `virtual:boltdocs-site-bridge`',
        detail:
          'The engine no longer registers generated site artifacts as a side ' +
          'effect of importing the client. A custom `boltdocs-entry` must ' +
          'import `virtual:boltdocs-site-bridge` so icons, layout, search, ' +
          'page source and client slots are registered at runtime.',
        file,
        line: line || 1,
        remediation: `Add \`${BRIDGE_IMPORT}\` near the top of the entry.`,
      },
    ]
  },

  apply(source) {
    if (source.includes('virtual:boltdocs-site-bridge')) return source
    // Insert after the last import statement when possible, otherwise at top.
    const lines = source.split('\n')
    let lastImport = -1
    let inImport = false
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim()
      if (/^import\b/.test(t)) {
        inImport = true
        if (!t.includes(' from ') || /[{(,]\s*$/.test(t)) {
          // multi-line import continues
        } else {
          lastImport = i
          inImport = false
        }
      } else if (
        inImport &&
        (t.includes(' from ') || /['"]\s*;?\s*$/.test(t))
      ) {
        lastImport = i
        inImport = false
      }
    }
    if (lastImport >= 0) {
      lines.splice(lastImport + 1, 0, BRIDGE_IMPORT)
      return lines.join('\n')
    }
    return `${BRIDGE_IMPORT}\n${source}`
  },
}
