import type { MigrationFinding, Transform } from '../types'
import { findImports } from '../source'
import {
  COMPOSITION_NAMES,
  RUNTIME_NAMES,
  THEME_NAMES,
} from './client-import-owners'

const THEME = '@bdocs/theme-neutral'
const COMPOSITION = `${THEME}/composition`
const RUNTIME = '@bdocs/runtime'

/**
 * The subpaths `boltdocs/client` had, and the package that owns them now.
 *
 * Each of these was one name for one thing. The 3.x entry points collected
 * the theme, the runtime and the router behind a single `boltdocs` prefix,
 * which is what made "the UI" and "the engine" indistinguishable from the
 * outside.
 */
const SUBPATH_TARGETS: Record<string, string> = {
  'boltdocs/primitives': `${THEME}/composition`,
  'boltdocs/mdx': THEME,
  'boltdocs/client/router': `${RUNTIME}/router`,
}

const themeNames = new Set(THEME_NAMES)
const compositionNames = new Set(COMPOSITION_NAMES)
const runtimeNames = new Set(RUNTIME_NAMES)

interface Binding {
  /** The binding exactly as written, e.g. `Card` or `type Card`. */
  text: string
  /** The name in the source module, e.g. `Card`. */
  imported: string
}

interface ParsedImport {
  /** Index of the `import` keyword. */
  start: number
  /** Index just past the closing quote of the specifier. */
  end: number
  /** The whole statement, for the report. */
  text: string
  typeOnly: boolean
  defaultName?: string
  namespaceName?: string
  named: Binding[]
}

/**
 * Parses the import statement that ends at `quoteStart`.
 *
 * Hand-written on purpose: the migration command cannot use TypeScript's
 * compiler, because the command has to work on a tree whose build is broken —
 * which is the state a 3.x site is in when it needs migrating.
 */
function parseImport(
  source: string,
  specifierStart: number,
  closingQuoteIndex: number,
): ParsedImport | null {
  // Walk back to the `import` keyword that starts this statement.
  const before = source.slice(0, specifierStart)
  const keyword = before.lastIndexOf('import')
  if (keyword === -1) return null
  // A word boundary before the keyword: `noimport` is not an import.
  if (keyword > 0 && /[\w$]/.test(before[keyword - 1])) return null

  const clause = source.slice(keyword + 'import'.length, specifierStart)
  // Just past the specifier's closing quote.
  const end = closingQuoteIndex + 1

  const text = source.slice(keyword, end)

  let typeOnly = false
  let rest = clause.trim()
  if (rest.startsWith('type ')) {
    typeOnly = true
    rest = rest.slice('type '.length).trim()
  }

  let defaultName: string | undefined
  let namespaceName: string | undefined
  const named: Binding[] = []

  const braces = rest.indexOf('{')
  if (braces !== -1) {
    const close = rest.indexOf('}', braces)
    if (close === -1) return null
    const inner = rest.slice(braces + 1, close)
    for (const raw of inner.split(',')) {
      const binding = raw.trim()
      if (!binding) continue
      const withoutType = binding.replace(/^type\s+/, '')
      const imported = withoutType.split(/\s+as\s+/)[0].trim()
      if (!imported) continue
      named.push({ text: binding, imported })
    }
    const head = rest.slice(0, braces).replace(/,\s*$/, '').trim()
    if (head) defaultName = head
  } else {
    const namespace = /^\*\s+as\s+([\w$]+)$/.exec(rest)
    if (namespace) {
      namespaceName = namespace[1]
    } else {
      const comma = rest.indexOf(',')
      if (comma === -1) {
        defaultName = rest.trim() || undefined
      } else {
        defaultName = rest.slice(0, comma).trim() || undefined
        const namedInner = rest.slice(comma + 1).trim()
        if (namedInner.startsWith('{') && namedInner.endsWith('}')) {
          for (const raw of namedInner.slice(1, -1).split(',')) {
            const binding = raw.trim()
            if (!binding) continue
            const withoutType = binding.replace(/^type\s+/, '')
            const imported = withoutType.split(/\s+as\s+/)[0].trim()
            if (!imported) continue
            named.push({ text: binding, imported })
          }
        }
      }
    }
  }

  return {
    start: keyword,
    end,
    text,
    typeOnly,
    defaultName,
    namespaceName,
    named,
  }
}

/** The package that owns a name, or undefined when no package has it. */
function ownerOf(name: string): string | undefined {
  if (themeNames.has(name)) return THEME
  if (compositionNames.has(name)) return COMPOSITION
  if (runtimeNames.has(name)) return RUNTIME
  return undefined
}

/**
 * The packages a source file reaches through `boltdocs/client`.
 *
 * Used by the manifest codemod: a site that imports a runtime-owned name has
 * to declare the runtime, and the only evidence available is the import it is
 * about to rewrite.
 */
export function clientImportOwners(source: string): string[] {
  const owners = new Set<string>()
  for (const hit of findImports(source)) {
    if (hit.specifier !== 'boltdocs/client') continue
    const parsed = parseImport(source, hit.start, hit.end)
    if (!parsed) continue
    for (const binding of parsed.named) {
      const owner = ownerOf(binding.imported)
      if (owner) owners.add(owner)
    }
  }
  return [...owners]
}

/**
 * `boltdocs/client` → the packages that own what it exported.
 *
 * The 3.x entry point was a barrel over the theme and the runtime, so an
 * import from it could name a component, a hook or a router primitive without
 * saying which. This codemod says it: every name goes to the package that
 * exports it, and the two import statements it leaves behind name their
 * sources.
 *
 * Markdown is included on purpose. A documentation page that shows
 * `import { useConfig } from 'boltdocs/client'` teaches a reader to write an
 * import that no longer resolves, and a reader who copies it finds out at
 * their own build time rather than at the page.
 *
 * A name neither package exports is reported and left alone. That is not a
 * gap in the table — it means the site imported something that no longer
 * exists, and a tool that guessed would be guessing about a missing API.
 */
export const clientImportsTransform: Transform = {
  id: 'client-imports',

  appliesTo: (file) =>
    /\.(tsx?|jsx?|mts|cts|mjs|cjs|mdx)$/.test(file) &&
    !file.includes('/node_modules/') &&
    !file.endsWith('.d.ts'),

  inspect(file, source) {
    const findings: MigrationFinding[] = []

    for (const hit of findImports(source)) {
      const target = SUBPATH_TARGETS[hit.specifier]
      if (target) {
        findings.push({
          id: 'client/subpath',
          severity: 'warning' as const,
          action: 'fixable' as const,
          title: `\`${hit.specifier}\` is now \`${target}\``,
          detail:
            'The engine used to publish the UI layer under its own name. ' +
            'Each of those entry points now belongs to the package that owns it.',
          file,
          line: hit.line,
          snippet: hit.specifier,
          remediation: `Rewrite the specifier to \`${target}\`.`,
        })
        continue
      }

      if (hit.specifier !== 'boltdocs/client') continue

      const parsed = parseImport(source, hit.start, hit.end)
      if (!parsed) {
        findings.push({
          id: 'client/unparsed',
          severity: 'warning' as const,
          action: 'manual' as const,
          title: `Could not read the import from \`${hit.specifier}\``,
          detail:
            'The import statement is shaped in a way the codemod does not ' +
            'recognise. It is reported rather than rewritten, because a ' +
            'rewrite it cannot understand is a rewrite it cannot check.',
          file,
          line: hit.line,
          snippet: hit.specifier,
          remediation:
            'Import the names from `@bdocs/theme-neutral` or `@bdocs/runtime` ' +
            'directly.',
        })
        continue
      }

      if (parsed.namespaceName || parsed.defaultName) {
        findings.push({
          id: 'client/namespace',
          severity: 'warning' as const,
          action: 'manual' as const,
          title: `A namespace or default import from \`${hit.specifier}\``,
          detail:
            'The 3.x entry point had no default export, and a namespace import ' +
            'spans two packages now. Neither can be split by a tool without ' +
            'knowing which names the reader meant.',
          file,
          line: hit.line,
          snippet: parsed.text,
          remediation:
            'Import the names you use from `@bdocs/theme-neutral` or ' +
            '`@bdocs/runtime` directly.',
        })
        continue
      }

      const unknown = parsed.named
        .map((binding) => binding.imported)
        .filter((name) => ownerOf(name) === undefined)

      if (unknown.length > 0) {
        findings.push({
          id: 'client/unknown-name',
          severity: 'blocking' as const,
          action: 'manual' as const,
          title: `\`${unknown.join('`, `')}\` is not exported by the theme or the runtime`,
          detail:
            'These names came from `boltdocs/client` and neither package ' +
            'exports them now. The import is left untouched: a codemod that ' +
            'dropped a name it could not place would turn a compile error ' +
            'into a runtime one.',
          file,
          line: hit.line,
          snippet: parsed.text,
          remediation:
            'Find the replacement for each name, then import it from ' +
            '`@bdocs/theme-neutral` or `@bdocs/runtime` directly.',
        })
        continue
      }

      findings.push({
        id: 'client/split',
        severity: 'warning' as const,
        action: 'fixable' as const,
        title: `\`${hit.specifier}\` is now two packages`,
        detail:
          'The 3.x entry point re-exported the theme and the runtime behind ' +
          'one name. Each imported symbol goes to the package that owns it: ' +
          'components, hooks and MDX components to `@bdocs/theme-neutral`, ' +
          'the router and the contexts to `@bdocs/runtime`.',
        file,
        line: hit.line,
        snippet: parsed.text,
        remediation: 'Run the codemod.',
      })
    }

    return findings
  },

  apply(source) {
    let out = source

    // The simple subpath rewrites first: they are whole-specifier changes
    // and do not interact with the split below.
    //
    // Back to front, because a rewrite changes the length of the text and
    // every position after it moves. Applying them in reading order would
    // rewrite the wrong characters — the second import's specifier would land
    // in the middle of the first import's.
    for (const hit of findImports(source).sort((a, b) => b.start - a.start)) {
      const target = SUBPATH_TARGETS[hit.specifier]
      if (!target) continue
      out = out.slice(0, hit.start) + target + out.slice(hit.end)
    }

    // Then the split, from the last import backwards so the positions of the
    // earlier ones stay valid.
    const hits = findImports(out).filter(
      (hit) => hit.specifier === 'boltdocs/client',
    )
    for (const hit of hits.sort((a, b) => b.start - a.start)) {
      const parsed = parseImport(out, hit.start, hit.end)
      if (!parsed) continue
      if (parsed.namespaceName || parsed.defaultName) continue
      if (parsed.named.length === 0) continue

      const groups = new Map<string, Binding[]>()
      for (const binding of parsed.named) {
        const owner = ownerOf(binding.imported)
        if (!owner) continue
        const group = groups.get(owner) ?? []
        group.push(binding)
        groups.set(owner, group)
      }
      if (groups.size === 0) continue

      const statements: string[] = []
      for (const [owner, bindings] of groups) {
        const typeWord = parsed.typeOnly ? 'type ' : ''
        const list = bindings.map((binding) => binding.text).join(', ')
        statements.push(`import ${typeWord}{ ${list} } from '${owner}'`)
      }

      out =
        out.slice(0, parsed.start) +
        statements.join('\n') +
        out.slice(parsed.end)
    }

    return out
  },
}
