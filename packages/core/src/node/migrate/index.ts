import fs from 'node:fs'
import path from 'node:path'
import type { MigrationFinding, MigrationPlan, Transform } from './types'
import { reactAriaTransform } from './transforms/react-aria'
import { seoPluginTransform } from './transforms/seo-plugin'
import { themeSubpathTransform } from './transforms/theme-subpath'
import { packageJsonTransform } from './transforms/package-json'
import { searchEngineTransform } from './transforms/search-engine'

export * from './types'

const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mts',
  '.cts',
  '.mjs',
  '.cjs',
  '.css',
])

const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.boltdocs',
  'dist',
  'build',
  '.next',
  '.turbo',
  '.cache',
  'coverage',
  '.vercel',
  '.output',
])

/**
 * Order matters only for reporting. `package-json` runs first so a project
 * whose manifest is already correct does not also get told about every import
 * it no longer needs.
 */
const TRANSFORMS: Transform[] = [
  packageJsonTransform,
  seoPluginTransform,
  searchEngineTransform,
  reactAriaTransform,
  themeSubpathTransform,
]

export interface MigrateOptions {
  root: string
  apply: boolean
}

/**
 * Walks the project and reports every 3.x pattern that 4.0 changed.
 *
 * `apply: false` is the default and touches nothing. The two modes run the same
 * inspection, so a dry run is a faithful preview rather than a separate code
 * path that can disagree with what `--apply` does.
 */
export function migrate({ root, apply }: MigrateOptions): MigrationPlan {
  const files = collectFiles(root)
  const findings: MigrationFinding[] = []
  const applied: MigrationFinding[] = []

  for (const file of files) {
    const relative = path.relative(root, file).split(path.sep).join('/')
    let source: string
    try {
      source = fs.readFileSync(file, 'utf-8')
    } catch {
      continue
    }
    const original = source
    let current = source

    for (const transform of TRANSFORMS) {
      if (!transform.appliesTo(relative)) continue
      const found = transform.inspect(relative, current, { root })
      findings.push(...found)

      if (apply && transform.apply) {
        const next = transform.apply(current, { root })
        if (next !== current) {
          current = next
          applied.push(...found.filter((f) => f.action === 'fixable'))
        }
      }
    }

    if (apply && current !== original) {
      try {
        fs.writeFileSync(file, current, 'utf-8')
      } catch (err) {
        findings.push({
          id: 'write/failed',
          severity: 'blocking',
          action: 'manual',
          title: `Could not write ${relative}`,
          detail:
            err instanceof Error
              ? `The file was found and its changes were computed, but writing it failed: ${err.message}`
              : 'The file was found and its changes were computed, but writing it failed with an unknown error. Check file permissions and re-run with --apply.',
          file: relative,
        })
      }
    }
  }

  return { findings: sortFindings(findings), applied }
}

const SEVERITY_ORDER: Record<MigrationFinding['severity'], number> = {
  blocking: 0,
  warning: 1,
  info: 2,
}

/**
 * Groups by file, then orders by severity inside each file.
 *
 * Severity-first would scatter one file's findings across the whole report,
 * because each transform scans files in its own order. Grouping by file means
 * one file is one block: you fix it, then move on. Files themselves are ordered
 * by their most severe finding, so the file that breaks the build is the first
 * one listed.
 */
export function sortFindings(findings: MigrationFinding[]): MigrationFinding[] {
  const worst = new Map<string, number>()
  for (const f of findings) {
    const rank = SEVERITY_ORDER[f.severity]
    const current = worst.get(f.file)
    if (current === undefined || rank < current) worst.set(f.file, rank)
  }
  return [...findings].sort(
    (a, b) =>
      (worst.get(a.file) ?? 0) - (worst.get(b.file) ?? 0) ||
      a.file.localeCompare(b.file) ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.id.localeCompare(b.id),
  )
}

function collectFiles(root: string): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue
        walk(full)
        continue
      }
      if (!entry.isFile()) continue
      if (
        entry.name === 'package.json' ||
        entry.name.startsWith('boltdocs.config.')
      ) {
        out.push(full)
        continue
      }
      if (SCAN_EXTENSIONS.has(path.extname(entry.name))) out.push(full)
    }
  }
  walk(root)
  return out
}
