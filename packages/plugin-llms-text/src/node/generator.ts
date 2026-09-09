import type { RouteMeta } from 'boltdocs'
import type { LlmsTextSection } from './schema'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Resolved configuration for a single llms.txt generation run.
 */
export interface LlmsTextConfig {
  title: string
  description: string
  bodyText?: string
  siteUrl: string
  sections: LlmsTextSection[]
  sortBy: 'path' | 'title' | 'sidebarPosition'
  maxLinksPerSection?: number
  includeDrafts: boolean
  includePaths?: string[]
  excludePaths?: string[]
  locales?: string[]
  defaultLocale?: string
}

/**
 * Sort routes within a section according to the configured sort order.
 */
function sortRoutes(
  routes: RouteMeta[],
  sortBy: 'path' | 'title' | 'sidebarPosition',
): RouteMeta[] {
  const sorted = [...routes]
  switch (sortBy) {
    case 'path':
      sorted.sort((a, b) => a.path.localeCompare(b.path))
      break
    case 'title':
      sorted.sort((a, b) => a.title.localeCompare(b.title))
      break
    case 'sidebarPosition':
      sorted.sort((a, b) => {
        const aPos = a.sidebarPosition ?? 999
        const bPos = b.sidebarPosition ?? 999
        if (aPos !== bPos) return aPos - bPos
        return a.title.localeCompare(b.title)
      })
      break
  }
  return sorted
}

/**
 * Format a single link line following the llms.txt spec:
 * `- [Page Title](https://site.com/docs/page): Brief description`
 */
function formatLink(route: RouteMeta, siteUrl: string): string {
  const url = `${siteUrl.replace(/\/+$/, '')}${route.path}`
  const description = route.excerpt ?? route.description ?? ''
  const label = description
    ? `: ${description.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()}`
    : ''
  return `- [${escapeLinkText(route.title)}](${url})${label}`
}

/**
 * Escape special characters in plain-text Markdown link text.
 * Square brackets would break the `[text]` syntax, and parentheses
 * would break the `(url)` syntax.
 */
function escapeLinkText(text: string): string {
  return text
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * Check a single route against include/exclude path filters.
 * Returns `true` when the route passes all filters.
 */
function routePassesPathFilter(
  route: RouteMeta,
  config: LlmsTextConfig,
): boolean {
  if (config.locales && config.locales.length > 0) {
    const routeLocale = route.locale ?? config.defaultLocale
    if (routeLocale && !config.locales.includes(routeLocale)) return false
  }

  if (config.includePaths && config.includePaths.length > 0) {
    const included = config.includePaths.some((p) => route.path.startsWith(p))
    if (!included) return false
  }
  if (config.excludePaths && config.excludePaths.length > 0) {
    const excluded = config.excludePaths.some((p) => route.path.startsWith(p))
    if (excluded) return false
  }
  return true
}

/**
 * Group routes into a single section based on path prefix matching.
 */
function routesForSection(
  routes: RouteMeta[],
  section: LlmsTextSection,
  config: LlmsTextConfig,
  skipSort = false,
): RouteMeta[] {
  const filtered = routes.filter((r) => {
    if (!config.includeDrafts && r.draft) return false
    if (!routePassesPathFilter(r, config)) return false
    return r.path.startsWith(section.pathPrefix)
  })

  // When skipSort is true, the caller will sort the combined result later.
  // This avoids redundant per-section sorting when collecting optional sections.
  const result = skipSort ? filtered : sortRoutes(filtered, config.sortBy)

  // Use per-section maxLinks first, fall back to global
  const maxLinks = section.maxLinks ?? config.maxLinksPerSection
  if (maxLinks && result.length > maxLinks) {
    return result.slice(0, maxLinks)
  }
  return result
}

/**
 * Generate the full llms.txt Markdown content.
 *
 * Follows the llms.txt specification:
 * 1. H1 - Project title
 * 2. Blockquote - Summary/short description
 * 3. Optional body text
 * 4. H2 sections with curated links
 * 5. Optional sections under `## Optional`
 */
export function generateLlmsText(
  routes: RouteMeta[],
  config: LlmsTextConfig,
): string {
  const lines: string[] = []

  // ── 1. H1 Title ──────────────────────────────────────────────────
  lines.push(`# ${config.title}`)
  lines.push('')

  // ── 2. Blockquote description ────────────────────────────────────
  lines.push(`> ${config.description}`)
  lines.push('')

  // ── 3. Optional body text ────────────────────────────────────────
  if (config.bodyText) {
    lines.push(config.bodyText.trim())
    lines.push('')
  }

  // ── 4. Separate optional from required sections ──────────────────
  const requiredSections = config.sections.filter((s) => !s.optional)
  const optionalSections = config.sections.filter((s) => s.optional)

  for (const section of requiredSections) {
    const sectionRoutes = routesForSection(routes, section, config)
    if (sectionRoutes.length === 0) continue

    lines.push(`## ${section.title}`)
    if (section.description) {
      lines.push('')
      lines.push(section.description)
    }
    lines.push('')
    for (const route of sectionRoutes) {
      lines.push(formatLink(route, config.siteUrl))
    }
    lines.push('')
  }

  // ── 5. Optional section ──────────────────────────────────────────
  if (optionalSections.length > 0) {
    const allOptionalRoutes: RouteMeta[] = []
    // Use skipSort=true to avoid redundant per-section sorting;
    // the combined array is sorted once below.
    for (const section of optionalSections) {
      const sectionRoutes = routesForSection(routes, section, config, true)
      allOptionalRoutes.push(...sectionRoutes)
    }

    if (allOptionalRoutes.length > 0) {
      const sorted = sortRoutes(allOptionalRoutes, config.sortBy)
      lines.push('## Optional')
      lines.push('')
      for (const route of sorted) {
        lines.push(formatLink(route, config.siteUrl))
      }
      lines.push('')
    }
  }

  return lines.join('\n').trim() + '\n'
}

/**
 * Build the default sections from available routes when the user
 * has not provided custom sections.
 */
export function buildDefaultSections(routes: RouteMeta[]): LlmsTextSection[] {
  const sections: LlmsTextSection[] = []

  // Collect unique top-level directory prefixes from non-root non-draft routes
  const collectionPrefixes = new Set<string>()

  for (const route of routes) {
    if (route.draft) continue
    const parts = route.path.split('/').filter(Boolean)
    if (parts.length > 1) {
      const prefix = '/' + parts[0] + '/'
      // Prefixes like /blog/, /changelog/, /news/ are collections
      if (
        ['/blog/', '/changelog/', '/news/', '/release-notes/'].some((p) =>
          prefix.startsWith(p),
        )
      ) {
        collectionPrefixes.add(prefix)
      }
    }
  }

  // Main Documentation section — routes NOT covered by a collection prefix
  const docRoutes = routes.filter((r) => {
    if (r.draft) return false
    // Root-level pages (e.g. /index) always stay in Documentation
    const parts = r.path.split('/').filter(Boolean)
    if (parts.length <= 1) return true
    // Exclude routes that belong to a collection prefix
    for (const cp of collectionPrefixes) {
      if (r.path.startsWith(cp)) return false
    }
    return true
  })

  if (docRoutes.length > 0) {
    sections.push({
      title: 'Documentation',
      pathPrefix: '/',
      description:
        'Core documentation pages covering installation, usage, API reference, and guides.',
      optional: false,
    })
  }

  // Optional sections for collection/blog routes
  for (const prefix of collectionPrefixes) {
    const label = prefix
      .replace(/^\//, '')
      .replace(/\/$/, '')
      .split(/[-_]/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    sections.push({
      title: label,
      pathPrefix: prefix,
      description: `${label} articles and posts.`,
      optional: true,
    })
  }

  return sections
}

/**
 * Write the generated llms.txt to disk.
 */
export function writeLlmsText(
  content: string,
  outDir: string,
  logger: (message: string) => void,
): void {
  const outputPath = path.join(outDir, 'llms.txt')
  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, content, 'utf-8')
  logger(
    `llms.txt generated: llms.txt (${Buffer.byteLength(content, 'utf-8')} bytes)`,
  )
}

/**
 * Format the site URL — strip trailing slash for consistency.
 */
export function formatSiteUrl(raw: string): string {
  return raw.replace(/\/+$/, '')
}
