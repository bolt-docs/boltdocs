import fs from 'node:fs'
import path from 'node:path'
import type { BoltdocsConfig, ExternalFileRoute } from '../../shared/types'

const COMPONENT_EXTENSIONS = ['tsx', 'ts', 'jsx', 'js']
const FILE_ROUTE_EXTENSIONS = [...COMPONENT_EXTENSIONS, 'mdx', 'md']

function getLocales(config?: BoltdocsConfig): string[] {
  if (!config?.i18n) return []
  return Array.isArray(config.i18n.locales)
    ? config.i18n.locales
    : Object.keys(config.i18n.locales)
}

function withLocales(pathname: string, config?: BoltdocsConfig): string[] {
  const paths = [pathname]
  for (const locale of getLocales(config)) {
    const localized = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`
    if (!paths.includes(localized)) paths.push(localized)
  }
  return paths
}

function findLegacyIndex(externalDir: string): string | undefined {
  return COMPONENT_EXTENSIONS.map((ext) =>
    path.resolve(externalDir, `index.${ext}`),
  ).find((filePath) => fs.existsSync(filePath))
}

function walkFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return []
  const files: string[] = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith('_') || entry.name === 'layout.tsx') continue
    const filePath = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(filePath))
    else files.push(filePath)
  }
  return files
}

/**
 * Converts a filesystem segment into its router pattern.
 *
 * - `[slug]`      → `:slug`   (single dynamic segment)
 * - `[...slug]`   → `*`       (catch-all, greedy remainder)
 * - `[[...slug]]` → `*?`      (optional catch-all)
 *
 * A literal segment is returned unchanged, so static files keep working exactly
 * as before.
 */
function toRouterSegment(segment: string): string {
  if (segment.startsWith('[[...') && segment.endsWith(']]')) {
    return '*?'
  }
  if (segment.startsWith('[...') && segment.endsWith(']')) {
    return '*'
  }
  if (segment.startsWith('[') && segment.endsWith(']')) {
    return `:${segment.slice(1, -1)}`
  }
  return segment
}

/**
 * Maps a `pages-external` file to its route. A top-level directory whose name
 * matches a configured locale is consumed as the locale prefix (mirroring the
 * `docs/{locale}/…` i18n convention), so `es/roadmap.mdx` becomes the `/es/roadmap`
 * route for the `es` locale. Any other leading directory stays a literal URL
 * segment (e.g. `guides/start.mdx` → `/guides/start`).
 *
 * Directory and file names may declare dynamic segments using the familiar
 * bracket syntax, so `blog/[slug].mdx` becomes `/blog/:slug` and
 * `docs/[...parts].mdx` becomes `/docs/*`.
 */
function buildFileRoute(
  filePath: string,
  externalDir: string,
  config?: BoltdocsConfig,
): ExternalFileRoute {
  const relative = path.relative(externalDir, filePath).replace(/\\/g, '/')
  const extension = path.extname(relative)
  const withoutExtension = relative.slice(0, -extension.length)
  const segments = withoutExtension.split('/').filter(Boolean)

  // A leading directory matching a configured locale is consumed as the
  // locale prefix but stays part of the URL path (`es/roadmap.mdx` →
  // `/es/roadmap`). The locale is recorded on the route so downstream code
  // knows the file is a real localized variant.
  let locale: string | undefined
  if (segments.length > 1 && getLocales(config).includes(segments[0])) {
    locale = segments[0]
  }

  const last = segments.at(-1)
  if (last === 'index') segments.pop()

  const routeSegments = segments.map(toRouterSegment)
  const pathname = `/${routeSegments.join('/')}`
  const routePath = pathname === '/' ? '/' : pathname.replace(/\/$/, '')

  return {
    path: routePath,
    filePath,
    kind: ['md', 'mdx'].includes(path.extname(filePath).slice(1))
      ? ('mdx' as const)
      : ('component' as const),
    ...(locale ? { locale } : {}),
  }
}

/**
 * Discovers `pages-external` files when experimental file routing is enabled.
 *
 * Static files map one-to-one to URL segments. Bracket segments declare dynamic
 * routes: `[slug]` captures one segment and `[...parts]` captures the rest, so
 * a single MDX file can serve a whole route tree.
 */
export function getExternalFileRoutes(
  docsDir: string,
  config?: BoltdocsConfig,
): ExternalFileRoute[] {
  if (!config?.experimental?.fileRouting) return []

  const externalDir = path.resolve(docsDir, 'pages-external')
  const legacyIndex = findLegacyIndex(externalDir)
  return walkFiles(externalDir)
    .filter((filePath) =>
      FILE_ROUTE_EXTENSIONS.includes(path.extname(filePath).slice(1)),
    )
    .filter((filePath) => filePath !== legacyIndex)
    .filter((filePath) => {
      const basename = path.basename(filePath)
      return !/^(?:layout|icons|mdx-components)\.(?:tsx?|jsx?)$/.test(basename)
    })
    .map((filePath) => buildFileRoute(filePath, externalDir, config))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Reads the legacy pages-external/index.{tsx,ts,jsx,js} file and extracts
 * route keys from `export const pages = { ... }`.
 */
export function getExternalRoutePaths(
  docsDir: string,
  config?: BoltdocsConfig,
): string[] {
  const externalDir = path.resolve(docsDir, 'pages-external')
  const indexPath = findLegacyIndex(externalDir)
  const keys: string[] = []

  if (indexPath) {
    const content = fs.readFileSync(indexPath, 'utf-8')
    const pagesMatch = content.match(
      /export\s+const\s+pages\s*=\s*\{([\s\S]*?)\}\s*(?:;|$)/,
    )

    if (pagesMatch) {
      const keyRegex = /(['"])(.+?)\1\s*:/g
      let match: RegExpExecArray | null = keyRegex.exec(pagesMatch[1])
      while (match !== null) {
        const pathname = match[2].startsWith('/') ? match[2] : `/${match[2]}`
        for (const localized of withLocales(pathname, config)) {
          if (!keys.includes(localized)) keys.push(localized)
        }
        match = keyRegex.exec(pagesMatch[1])
      }
    }
  }

  for (const route of getExternalFileRoutes(docsDir, config)) {
    // Routes that already carry a locale (e.g. `es/roadmap.mdx`) are literal
    // localized paths; re-running `withLocales` would invent bogus variants
    // like `/en/es/roadmap`. Only default-locale routes get fallback variants.
    const variants = route.locale
      ? [route.path]
      : withLocales(route.path, config)
    for (const localized of variants) {
      if (!keys.includes(localized)) keys.push(localized)
    }
  }

  return keys
}
