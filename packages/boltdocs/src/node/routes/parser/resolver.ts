import path from 'node:path'
import { stripNumberPrefix, fileToRoutePath } from '../../utils'
import type { BoltdocsConfig } from '../../config'

export interface PathResolution {
  relativePath: string
  finalPath: string
  remainingParts: string[]
  locale?: string
  version?: string
  inferredTab?: string
  subRouteGroup?: string
  collection?: string
}

function pathSegments(value: string | undefined): string[] {
  return (value || '').replace(/\\/g, '/').split('/').filter(Boolean)
}

function startsWithSegments(parts: string[], candidate: string[]): boolean {
  return (
    candidate.length > 0 &&
    candidate.every((part, index) => parts[index] === part)
  )
}

function resolveVersion(
  parts: string[],
  config?: BoltdocsConfig,
): { version?: string; publicSegments: string[]; consumed: number } {
  const versions = config?.versions
  if (!versions) return { publicSegments: [], consumed: 0 }

  const prefix = versions.prefix || ''
  const prefixParts = pathSegments(prefix)

  for (const versionConfig of versions.versions) {
    const versionParts = pathSegments(versionConfig.path)
    if (versionParts.length === 0) continue

    // Prefer the explicit version path so `prefix: 'v'` with `path: 'v1'`
    // remains compatible with the documented `docs/v1/` layout.
    if (startsWithSegments(parts, versionParts)) {
      return {
        version: versionConfig.path,
        publicSegments: versionParts,
        consumed: versionParts.length,
      }
    }

    // A slash-containing prefix is a real directory prefix, e.g.
    // `releases/v2`.
    const prefixedParts = [...prefixParts, ...versionParts]
    if (startsWithSegments(parts, prefixedParts)) {
      return {
        version: versionConfig.path,
        publicSegments: prefixedParts,
        consumed: prefixedParts.length,
      }
    }

    // Preserve the legacy textual-prefix form (`prefix: 'v', path: '1'` → v1).
    if (
      prefix &&
      !prefix.includes('/') &&
      parts[0] === `${prefix}${versionConfig.path}`
    ) {
      return {
        version: versionConfig.path,
        publicSegments: [`${prefix}${versionConfig.path}`],
        consumed: 1,
      }
    }
  }

  return { publicSegments: [], consumed: 0 }
}

export function resolveRoutePath(
  file: string,
  docsDir: string,
  basePath: string,
  config?: BoltdocsConfig,
  permalink?: string,
): PathResolution {
  const relativePath = path.relative(docsDir, file).replace(/\\/g, '/')
  let parts = relativePath.split('/').filter(Boolean)

  let locale: string | undefined
  let version: string | undefined
  let inferredTab: string | undefined
  let subRouteGroup: string | undefined
  let collection: string | undefined

  const versionResolution = resolveVersion(parts, config)
  version = versionResolution.version
  parts = parts.slice(versionResolution.consumed)

  if (config?.i18n && parts.length > 0) {
    const potentialLocale = parts[0]
    const isLocale = Array.isArray(config.i18n.locales)
      ? config.i18n.locales.includes(potentialLocale)
      : !!config.i18n.locales[potentialLocale]
    if (isLocale) {
      locale = potentialLocale
      parts = parts.slice(1)
    }
  }

  if (parts.length > 0) {
    const tabMatch = parts[0].match(/^\((.+)\)$/)
    if (tabMatch) {
      inferredTab = tabMatch[1].toLowerCase()
      parts = parts.slice(1)
    }
  }

  if (parts.length > 0) {
    const collectionMatch = parts[0].match(/^\[(.+)\]$/)
    if (collectionMatch) {
      collection = collectionMatch[1].toLowerCase()
      parts = parts.slice(1)
    }
  }

  const remainingParts = [...parts]
  const cleanParts = parts.map((part) => stripNumberPrefix(part))
  const cleanRelativePath = cleanParts.join('/')
  const routePath = permalink
    ? permalink.startsWith('/')
      ? permalink
      : `/${permalink}`
    : fileToRoutePath(cleanRelativePath || 'index.md')

  const normalizedBase = basePath.replace(/\\/g, '/').replace(/\/$/, '') || '/'
  const versionSegments = versionResolution.publicSegments
  const routeSegments = [
    ...versionSegments,
    locale,
    !permalink && !collection ? inferredTab : undefined,
  ].filter(Boolean)

  const segments = collection
    ? [...routeSegments, collection, routePath]
    : [normalizedBase, ...routeSegments, routePath]

  const finalPath =
    segments
      .join('/')
      .replace(/\\/g, '/')
      .replace(/\/+/g, '/')
      .replace(/\/$/, '') || '/'

  return {
    relativePath,
    finalPath: finalPath.startsWith('/') ? finalPath : `/${finalPath}`,
    remainingParts,
    locale,
    version,
    inferredTab,
    subRouteGroup,
    collection,
  }
}
