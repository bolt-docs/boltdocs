import path from 'node:path'
import type { MigrationSource } from './types'
import {
  exists,
  hasDependency,
  hasDependencyMatching,
  readJsonRecord,
  readText,
  type JsonRecord,
} from './framework-common'

export const BOLT_CONFIG_FILES = [
  'boltdocs.config.ts',
  'boltdocs.config.js',
  'boltdocs.config.mjs',
  'boltdocs.config.mts',
  'boltdocs.config.cts',
  'boltdocs.config.cjs',
] as const

export const DOCUSAURUS_CONFIG_FILES = [
  'docusaurus.config.ts',
  'docusaurus.config.js',
  'docusaurus.config.mjs',
  'docusaurus.config.cjs',
  'docusaurus.config.mts',
  'docusaurus.config.cts',
] as const

export const ASTRO_CONFIG_FILES = [
  'astro.config.ts',
  'astro.config.mjs',
  'astro.config.js',
  'astro.config.cjs',
  'astro.config.mts',
  'astro.config.cts',
] as const

function hasFile(root: string, names: readonly string[]): boolean {
  return names.some((name) => exists(path.join(root, name)))
}

function isDocusaurus(root: string, pkg: JsonRecord | null): boolean {
  return (
    hasFile(root, DOCUSAURUS_CONFIG_FILES) ||
    hasDependencyMatching(pkg, (name) => name.startsWith('@docusaurus/')) ||
    hasFile(root, ['sidebars.js', 'sidebars.ts'])
  )
}

function isStarlight(root: string, pkg: JsonRecord | null): boolean {
  const hasStarlight = hasDependency(pkg, '@astrojs/starlight')
  const hasAstro = hasDependency(pkg, 'astro')
  const hasContent = exists(path.join(root, 'src', 'content', 'docs'))
  if (hasStarlight) return true

  const astroConfig = ASTRO_CONFIG_FILES.find((name) =>
    exists(path.join(root, name)),
  )
  if (astroConfig) {
    const text = readText(path.join(root, astroConfig))
    if (text && /starlight/i.test(text)) return true
  }
  // An Astro site with Starlight-style content but no explicit dependency is
  // still a candidate; a plain Astro site without content is not.
  return hasContent && hasAstro
}

function isBoltdocs(root: string, pkg: JsonRecord | null): boolean {
  return hasFile(root, BOLT_CONFIG_FILES) || hasDependency(pkg, 'boltdocs')
}

/**
 * Detect the migration source for a project.
 *
 * Explicit `from` wins. For `auto`, foreign frameworks are detected before
 * Boltdocs so `boltdocs migrate` can convert a Docusaurus/Starlight repo into
 * Boltdocs; if none match, fall back to the Boltdocs 3.x → 4.0 path.
 */
export function detectMigrationSource(
  root: string,
  from: MigrationSource = 'auto',
): Exclude<MigrationSource, 'auto'> {
  if (from === 'docusaurus' || from === 'starlight' || from === 'boltdocs') {
    return from
  }

  const pkg = readJsonRecord(path.join(root, 'package.json'))
  if (isDocusaurus(root, pkg)) return 'docusaurus'
  if (isStarlight(root, pkg)) return 'starlight'
  if (isBoltdocs(root, pkg)) return 'boltdocs'
  return 'boltdocs'
}
