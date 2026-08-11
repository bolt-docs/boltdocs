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

function filePathToRoute(filePath: string, externalDir: string): string {
  const relative = path.relative(externalDir, filePath).replace(/\\/g, '/')
  const extension = path.extname(relative)
  const withoutExtension = relative.slice(0, -extension.length)
  const segments = withoutExtension.split('/').filter(Boolean)
  const last = segments.at(-1)

  if (last === 'index') segments.pop()
  const pathname = `/${segments.join('/')}`
  return pathname === '/' ? '/' : pathname.replace(/\/$/, '')
}

/**
 * Discovers static `pages-external` files when experimental file routing is
 * enabled. Dynamic segments are intentionally not supported in this first
 * version; a filename is always one literal URL segment.
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
    .filter((filePath) => {
      const segments = path.relative(externalDir, filePath).split(path.sep)
      return !segments.some(
        (segment) => segment.startsWith('[') || segment.startsWith('('),
      )
    })
    .map((filePath) => ({
      path: filePathToRoute(filePath, externalDir),
      filePath,
      kind: ['md', 'mdx'].includes(path.extname(filePath).slice(1))
        ? ('mdx' as const)
        : ('component' as const),
    }))
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
      let match: RegExpExecArray | null
      while ((match = keyRegex.exec(pagesMatch[1])) !== null) {
        const pathname = match[2].startsWith('/') ? match[2] : `/${match[2]}`
        for (const localized of withLocales(pathname, config)) {
          if (!keys.includes(localized)) keys.push(localized)
        }
      }
    }
  }

  for (const route of getExternalFileRoutes(docsDir, config)) {
    for (const localized of withLocales(route.path, config)) {
      if (!keys.includes(localized)) keys.push(localized)
    }
  }

  return keys
}
