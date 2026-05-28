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
}

export function resolveRoutePath(
  file: string,
  docsDir: string,
  basePath: string,
  config?: BoltdocsConfig,
  permalink?: string,
): PathResolution {
  const relativePath = path.relative(docsDir, file).replace(/\\/g, '/')
  let parts = relativePath.split('/')

  let locale: string | undefined
  let version: string | undefined
  let inferredTab: string | undefined
  let subRouteGroup: string | undefined
  let collection: string | undefined

  if (config?.versions && parts.length > 0) {
    const potentialVersion = parts[0]
    const prefix = config.versions.prefix || ''
    const versionMatch = config.versions.versions.find(
      (v) =>
        potentialVersion === prefix + v.path || potentialVersion === v.path,
    )
    if (versionMatch) {
      version = versionMatch.path
      parts = parts.slice(1)
    }
  }

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

  const cleanParts = parts.map((p) => {
    const noNum = stripNumberPrefix(p)
    return noNum
  })

  const cleanRelativePath = cleanParts.join('/')
  const routePath = permalink
    ? permalink.startsWith('/')
      ? permalink
      : `/${permalink}`
    : fileToRoutePath(cleanRelativePath || 'index.md')

  // Build Final Path
  const base = collection ? `/${collection}` : basePath
  const segments = [
    base,
    version,
    locale,
    !permalink && !collection ? inferredTab : undefined,
    routePath,
  ].filter(Boolean)

  const finalPath =
    segments.join('/').replace(/\/+/g, '/').replace(/\/$/, '') || '/'

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
