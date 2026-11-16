/**
 * Internal link mapping for framework imports.
 *
 * Boltdocs links are canonical: locale and version prefixes are added at
 * render time by `useLocalizedTo`. A Docusaurus link such as
 * `/docs/next/guide` hard-codes the version and breaks after migration, so it
 * is rewritten to `/docs/guide`. Starlight links omit the `/docs` base, but
 * whether that base should be added depends on the target site's `base`; those
 * are reported for review instead of being rewritten.
 */
import path from 'node:path'
import type { MigrationFinding } from './types'
import {
  finding,
  parseFrontmatter,
  readText,
  serializeFrontmatter,
  walkFiles,
  writeText,
} from './framework-common'

interface LinkHit {
  from: string
  to: string
  line: number
  manual: boolean
}

const EXTERNAL = /^(?:https?:|mailto:|tel:|ftp:|#|site:|data:)/i

const LINK_PATTERNS: ReadonlyArray<{ re: RegExp; group: number }> = [
  {
    re: /(?<!!)\[[^\]\n]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'][^"']*["'])?\s*\)/g,
    group: 1,
  },
  {
    re: /^[ \t]*\[[^\]\n]+\]:[ \t]+<?(\S+?)>?(?:\s+["'][^"']*["'])?[ \t]*$/gm,
    group: 1,
  },
  { re: /\bhref\s*=\s*(["'])([^"']+)\1/g, group: 2 },
]

type LinkMapper = (
  destination: string,
) => { to: string; manual: boolean } | null

/** Rewrite link destinations in a Markdown/MDX body, leaving code spans alone. */
function mapLinkDestinations(
  body: string,
  mapper: LinkMapper,
): { body: string; hits: LinkHit[] } {
  const hits: LinkHit[] = []
  const edits: Array<{ start: number; end: number; to: string }> = []

  for (const { re, group } of LINK_PATTERNS) {
    for (const match of body.matchAll(re)) {
      const destination = match[group]
      if (!destination || EXTERNAL.test(destination)) continue
      const result = mapper(destination)
      if (!result || result.to === destination) {
        if (result) {
          hits.push({
            from: destination,
            to: destination,
            line: body.slice(0, match.index).split('\n').length,
            manual: true,
          })
        }
        continue
      }
      const start = match.index + match[0].indexOf(destination)
      edits.push({ start, end: start + destination.length, to: result.to })
      hits.push({
        from: destination,
        to: result.to,
        line: body.slice(0, start).split('\n').length,
        manual: result.manual,
      })
    }
  }

  let out = body
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    out = out.slice(0, edit.start) + edit.to + out.slice(edit.end)
  }
  return { body: out, hits }
}

function docusaurusMapper(versions: readonly string[]): LinkMapper {
  const prefixes = ['next', ...versions.filter((v) => v !== 'next')]
  return (destination) => {
    for (const prefix of prefixes) {
      const marker = `/docs/${prefix}/`
      if (destination.startsWith(marker)) {
        return {
          to: `/docs/${destination.slice(marker.length)}`,
          manual: false,
        }
      }
      if (destination === `/docs/${prefix}`) {
        return { to: '/docs/', manual: false }
      }
    }
    return null
  }
}

function starlightMapper(
  destination: string,
): { to: string; manual: boolean } | null {
  // Absolute, extensionless links are likely documentation routes. Assets and
  // links that already carry the /docs base are left alone.
  if (!destination.startsWith('/') || destination.startsWith('/docs/'))
    return null
  if (/\.[a-z0-9]+$/i.test(destination)) return null
  return { to: destination, manual: true }
}

interface LinkMigrationOptions {
  root: string
  docsDir: string
  framework: 'docusaurus' | 'starlight'
  versions?: readonly string[]
  apply: boolean
}

/** Find and optionally rewrite internal links that will not resolve after migration. */
export function migrateLinks(options: LinkMigrationOptions): {
  findings: MigrationFinding[]
  applied: MigrationFinding[]
} {
  const findings: MigrationFinding[] = []
  const applied: MigrationFinding[] = []
  const { root, docsDir, framework, versions = [], apply } = options
  const mapper =
    framework === 'docusaurus' ? docusaurusMapper(versions) : starlightMapper

  for (const file of walkFiles(
    path.join(root, docsDir),
    new Set(['.md', '.mdx']),
  )) {
    const source = readText(file)
    if (!source) continue

    const parsed = parseFrontmatter(source)
    const body = parsed?.body ?? source
    const { body: nextBody, hits } = mapLinkDestinations(body, mapper)
    // A manual-only hit does not change the body, but it still needs a report
    // entry so the author knows to review the link.
    if (hits.length === 0) continue

    const relative = path.relative(root, file).split(path.sep).join('/')
    const fixable = hits.filter((hit) => !hit.manual)
    const first = hits[0]

    findings.push(
      finding({
        id:
          framework === 'docusaurus'
            ? 'docusaurus/link-version-prefix'
            : 'starlight/link-base',
        severity: fixable.length > 0 ? 'warning' : 'info',
        action: fixable.length > 0 ? 'fixable' : 'manual',
        title:
          fixable.length > 0
            ? `Version-prefixed link found in ${relative}`
            : `Absolute link may need a docs base in ${relative}`,
        detail:
          fixable.length > 0
            ? `Boltdocs adds version prefixes at render time. ${fixable.length} link(s) such as '${first.from}' were made canonical ('${first.to}').`
            : `Starlight links omit the docs base. Review '${first.from}' once the site's base is configured.`,
        file: relative,
        line: first.line,
        snippet: first.from,
      }),
    )

    if (apply && fixable.length > 0 && nextBody !== body) {
      const final = parsed
        ? serializeFrontmatter(parsed.raw, nextBody, parsed.eol, parsed.bom)
        : nextBody
      if (final !== source) {
        writeText(file, final)
        applied.push(findings[findings.length - 1])
      }
    }
  }

  return { findings, applied }
}
