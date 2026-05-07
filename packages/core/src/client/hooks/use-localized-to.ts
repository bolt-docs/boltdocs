import { useConfig } from '../app/config-context'
import type { LinkProps as RouterLinkProps } from 'react-router-dom'
import { useRoutes } from './use-routes'

/**
 * Hook to automatically localize a path based on the current version and locale context.
 * It ensures that navigation preserves the active version and language across the entire site.
 */
export function useLocalizedTo(to: string): string
export function useLocalizedTo(to: RouterLinkProps['to']): RouterLinkProps['to']
export function useLocalizedTo(to: RouterLinkProps['to']): RouterLinkProps['to'] {
  const config = useConfig()
  const {
    currentLocale: activeLocale,
    currentVersion: activeVersion,
    allRoutes,
  } = useRoutes()

  if (!config || typeof to !== 'string') return to

  // External, absolute, or anchor links don't need localization prefixing
  if (
    to.startsWith('http') ||
    to.startsWith('//') ||
    to.startsWith('#') ||
    to.startsWith('site:')
  ) {
    return to.replace('site:', '')
  }

  // 0. If it matches a known route exactly (ignoring trailing slashes and hash/query), use it as is.
  // This allows links to external pages (outside base) to work correctly.
  const [pathOnly] = to.split(/[?#]/)
  const normalizedTo =
    pathOnly.endsWith('/') && pathOnly.length > 1
      ? pathOnly.slice(0, -1)
      : pathOnly

  const isKnownRoute = allRoutes?.some((r) => {
    const rp =
      r.path.endsWith('/') && r.path.length > 1 ? r.path.slice(0, -1) : r.path
    return rp === normalizedTo
  })

  if (isKnownRoute) return to

  const i18n = config.i18n
  const versions = config.versions
  const base = (config.base || '/docs').replace(/\/$/, '')
  const baseSegment = base.startsWith('/') ? base.substring(1) : base

  // 3. Clean the 'to' path of ANY existing prefixes to avoid stacking
  const parts = to.split('/').filter(Boolean)
  let pIdx = 0

  // Strip base segment if present at start
  if (baseSegment && parts[pIdx] === baseSegment) pIdx++

  // Strip versions if present
  if (versions && parts.length > pIdx) {
    const vMatch = versions.versions.find((v) => v.path === parts[pIdx])
    if (vMatch) pIdx++
  }

  // Strip locales if present
  const isLocale = i18n && parts.length > pIdx && (
    Array.isArray(i18n.locales)
      ? i18n.locales.includes(parts[pIdx])
      : parts[pIdx] in i18n.locales
  )
  if (isLocale) pIdx++

  // The actual relative route remaining
  const routeContent = parts.slice(pIdx)

  // 4. Reconstruct strictly from base
  const resultParts: string[] = []

  if (baseSegment) {
    resultParts.push(baseSegment)
    if (versions && activeVersion) {
      resultParts.push(activeVersion)
    }
  }

  if (i18n && activeLocale) {
    resultParts.push(activeLocale)
  }

  resultParts.push(...routeContent)

  const finalPath = `/${resultParts.join('/')}`

  // Cleanup trailing slashes unless it's just root
  if (finalPath.length > 1 && finalPath.endsWith('/')) {
    return finalPath.slice(0, -1)
  }

  return finalPath || '/'
}
