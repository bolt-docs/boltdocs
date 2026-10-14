import type { MigrationFinding, Transform } from '../types'
import { findImports, insertAfterImports } from '../source'

const PLUGIN = '@bdocs/plugin-seo'
const IMPORT_LINE = `import seoPlugin from '${PLUGIN}'`

/** Config keys that only the SEO plugin acts on. */
const SEO_KEYS = ['siteUrl', 'robots', 'seo'] as const
const SEARCH_PLUGIN = '@bdocs/plugin-search'
const SEARCH_IMPORT = `import searchPlugin from '${SEARCH_PLUGIN}'`

/**
 * Sitemap, robots.txt and per-route SEO metadata moved out of the core.
 *
 * Until 4.0 the core wrote `sitemap.xml` and `robots.txt` itself, so every site
 * had them. The codemod adds the plugin where it can prove the site needs it —
 * `siteUrl`, `robots` or `seo` configured, or an existing `plugins` array it can
 * extend. It never edits a config it cannot parse, because a config file is the
 * one file in the project whose damage is not bounded by a single page.
 */
export const seoPluginTransform: Transform = {
  id: 'plugin-seo',

  appliesTo: (file) => /^boltdocs\.config\.(js|mjs|ts)$/.test(file),

  inspect(file, source) {
    // Two independent findings: a site can have SEO config without the SEO
    // plugin, a search index without the search plugin, or both.
    const findings: MigrationFinding[] = []
    findings.push(...inspectSeoPlugin(file, source))
    findings.push(...inspectSearchPlugin(file, source))
    return findings
  },

  apply(source) {
    // Same gate as `inspect`. Adding the import alone would leave an unused
    // binding and still no sitemap — half a fix that looks like a whole one.
    let out = source
    if (needsSeoPlugin(out) && canEdit(out)) {
      out = addToPluginsArray(
        insertAfterImports(out, IMPORT_LINE),
        'seoPlugin()',
      )
    }
    if (needsSearchPlugin(out) && canEdit(out)) {
      out = addToPluginsArray(
        insertAfterImports(out, SEARCH_IMPORT),
        'searchPlugin()',
      )
    }
    return out
  },
}

function hasSeoPlugin(source: string): boolean {
  if (findImports(source).some((hit) => hit.specifier === PLUGIN)) return true
  // A project can inline the plugin object instead of importing it.
  return /\bseoPlugin\s*\(\s*\)/.test(source)
}

function hasSearchPlugin(source: string): boolean {
  return (
    findImports(source).some((hit) => hit.specifier === SEARCH_PLUGIN) ||
    /\bsearchPlugin\s*\(\s*\)/.test(source)
  )
}

function needsSeoPlugin(source: string): boolean {
  if (hasSeoPlugin(source)) return false
  return SEO_KEYS.some((key) =>
    new RegExp(`(^|[^\\w.])${key}\\s*[:=]`).test(stripComments(source)),
  )
}

function needsSearchPlugin(source: string): boolean {
  return !hasSearchPlugin(source)
}

/**
 * SEO config without its plugin.
 *
 * Until 4.0 the core wrote `sitemap.xml` and `robots.txt` itself, so every site
 * had them. That work now lives in `@bdocs/plugin-seo`, which must be added
 * explicitly. The core warns during the build rather than failing, so this
 * shows up as a missing sitemap rather than an error — which is exactly the
 * kind of regression that reaches production unnoticed.
 */
function inspectSeoPlugin(file: string, source: string): MigrationFinding[] {
  if (!needsSeoPlugin(source)) return []
  const configured = SEO_KEYS.filter((key) =>
    new RegExp(`(^|[^\\w.])${key}\\s*[:=]`).test(stripComments(source)),
  )
  return [
    {
      id: 'seo/plugin-missing',
      severity: 'blocking',
      action: canEdit(source) ? 'fixable' : 'manual',
      title: `\`${configured.join('` and `')}\` configured without \`${PLUGIN}\``,
      detail:
        'The core used to write `sitemap.xml` and `robots.txt` itself, so ' +
        'every site had them. That work now lives in `@bdocs/plugin-seo`, ' +
        'which must be added explicitly.',
      file,
      remediation: canEdit(source)
        ? `Add \`${IMPORT_LINE}\` and \`seoPlugin()\` to \`plugins\`.`
        : `Add \`${IMPORT_LINE}\` and \`seoPlugin()\` to \`plugins\` by hand.`,
    },
  ]
}

/**
 * No search plugin at all.
 *
 * Unlike SEO there is no config key to key off — a site has no `siteUrl`
 * equivalent for search — so this fires for every site without the plugin. That
 * is correct rather than noisy: a search dialog that returns nothing is a
 * visible regression the moment someone types in it, and the fix is one line in
 * a file the user already has open. Sites that deliberately ship no search can
 * delete the line, and the build prints an informational note either way.
 *
 * `warning`, not `blocking`: the site builds and every page renders. Only search
 * is affected.
 */
function inspectSearchPlugin(file: string, source: string): MigrationFinding[] {
  if (!needsSearchPlugin(source)) return []
  return [
    {
      id: 'search/plugin-missing',
      severity: 'warning',
      action: canEdit(source) ? 'fixable' : 'manual',
      title: `No search plugin configured — add \`${SEARCH_PLUGIN}\``,
      detail:
        'The core used to generate `search.json` itself, so every site had ' +
        'one. The generator now lives in `@bdocs/plugin-search` and registers ' +
        'itself through the core, so the core does not depend on it. Without ' +
        'the plugin the build emits no `search.json` and the search dialog ' +
        'returns nothing. Every page still renders.',
      file,
      remediation: canEdit(source)
        ? `Add \`${SEARCH_IMPORT}\` and \`searchPlugin()\` to \`plugins\`.`
        : `Add \`${SEARCH_IMPORT}\` and \`searchPlugin()\` to \`plugins\` by hand.`,
    },
  ]
}

/**
 * Whether the plugins array can be edited without guessing.
 *
 * The codemod only appends to a `plugins: [` literal it can locate unambiguously.
 * A config that builds the array from a variable, spreads another value into
 * it, or defines the config through a helper is left alone and reported — a
 * codemod that appends to the wrong array produces a config that loads and
 * silently drops every plugin.
 */
function canEdit(source: string): boolean {
  const body = stripComments(source)
  const match = /plugins\s*:\s*\[/.exec(body)
  if (!match) return false
  // A shorthand property (`plugins,` or `plugins: someArray`) is a value the
  // codemod cannot see into. Editing it is not an option; appending to it is
  // not possible either, so this case is reported rather than guessed at.
  if (/plugins\s*(?::\s*(?!\[)[^\n,]+)?\s*,/.test(body)) return false
  // A single-line array is left alone: expanding it to one entry per line is a
  // larger diff than the migration justifies, and the array may be generated.
  const open = match.index + match[0].length
  const close = source.indexOf(']', open)
  if (close === -1) return false
  if (!source.slice(open, close).includes('\n')) return false
  return true
}

/**
 * Appends an entry to a `plugins: [ … ]` literal, preserving its layout.
 *
 * Three shapes, because a config written by a person has three shapes:
 *
 * ```ts
 * plugins: [                      plugins: [
 *   mermaidPlugin(),                mermaidPlugin(),
 * ],                                ],
 * ```
 * ```
 * ```
 *
 * An earlier version inserted at the closing bracket unconditionally, which
 * produced `mermaidPlugin()\n  ,\n    seoPlugin()],` — a comma on its own line
 * and the bracket glued to the last entry. Valid-looking in a diff, and a
 * syntax error in a parser.
 */
function addToPluginsArray(source: string, entry: string): string {
  const open = source.indexOf('plugins: [')
  if (open === -1) return source
  const start = open + 'plugins: ['.length
  const close = source.indexOf(']', start)
  if (close === -1) return source

  const body = source.slice(start, close)
  if (body.trim().length === 0) {
    const indent = /[ \t]*$/.exec(source.slice(0, open))?.[0] ?? '  '
    return `${source.slice(0, start)}\n${indent}  ${entry},\n${indent}${source.slice(close)}`
  }

  const indent = /([ \t]*)\S/.exec(body)?.[1] ?? '    '
  const trimmed = body.replace(/[ \t\n]+$/, '')

  // The array body ends here. A trailing comma belongs to the last entry;
  // anything before it belongs to an enclosing object.
  if (trimmed.endsWith(',')) {
    const lastComma = start + trimmed.length - 1
    return `${source.slice(0, lastComma + 1)}\n${indent}${entry},${source.slice(lastComma + 1)}`
  }

  // No trailing comma. Insert at the end of the last entry — not at `close`,
  // which is the bracket on the following line. Inserting before the bracket
  // puts the comma after a newline, and the array opens with
  // `mermaidPlugin()\n  ,\n    seoPlugin()`. Valid-looking, and wrong.
  const insertAt = start + trimmed.length
  return `${source.slice(0, insertAt)},\n${indent}${entry}${source.slice(insertAt)}`
}

/**
 * Blanks out comments while preserving every other character and offset.
 *
 * String literals are left intact: a `//` inside `'https://example.com'` is not
 * a comment, and blanking it would break the `siteUrl` detection this module
 * depends on.
 */
export function stripComments(source: string): string {
  let out = ''
  let i = 0
  while (i < source.length) {
    const two = source.slice(i, i + 2)
    if (two === '//') {
      const end = source.indexOf('\n', i)
      i = end === -1 ? source.length : end
      continue
    }
    if (two === '/*') {
      const end = source.indexOf('*/', i + 2)
      i = end === -1 ? source.length : end + 2
      continue
    }
    const ch = source[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      const close = findStringEnd(source, i, ch)
      out += source.slice(i, close)
      i = close
      continue
    }
    out += ch
    i++
  }
  return out
}

/** Index just past the closing quote of the string starting at `start`. */
function findStringEnd(source: string, start: number, quote: string): number {
  for (let i = start + 1; i < source.length; i++) {
    if (source[i] === '\\') {
      i++
      continue
    }
    if (source[i] === quote) return i + 1
    if (quote === '`' && source[i] === '$' && source[i + 1] === '{') {
      // Skip an interpolation; its contents are code, not string.
      let depth = 1
      i += 2
      while (i < source.length && depth > 0) {
        if (source[i] === '{') depth++
        else if (source[i] === '}') depth--
        i++
      }
    }
  }
  return source.length
}
