import { useConfig } from '../app/config-context'
import type { LinkProps as RouterLinkProps } from 'react-router-dom'
import type { BoltdocsRoutePathWithFallback } from '../types'
import { useRoutes } from './use-routes'

/**
 * Hook to automatically localize a path based on the current version and locale context.
 * It ensures that navigation preserves the active version and language across the entire site.
 */
export function useLocalizedTo(to: BoltdocsRoutePathWithFallback): string
export function useLocalizedTo(to: RouterLinkProps['to']): RouterLinkProps['to']
export function useLocalizedTo(
  to: RouterLinkProps['to'],
): RouterLinkProps['to'] {
  const config = useConfig()
  const {
    currentLocale: activeLocale,
    currentVersion: activeVersion,
    allRoutes,
  } = useRoutes()

  if (!config || typeof to !== 'string') return to

  // External, absolute, or anchor links don't need localization prefixing
  if (to.startsWith('http') || to.startsWith('//') || to.startsWith('#')) {
    return to
  }

  // Site protocol: strip prefix — only localize home root (site:/)
  if (to.startsWith('site:')) {
    to = to.replace('site:', '')
    if (to === '' || to === '/') {
      return config.i18n && activeLocale ? `/${activeLocale}` : '/'
    }
    return to
  }

  const [pathOnly, hashAndQuery] = to.split(/([?#].*)/s)
  const normalizedTo =
    pathOnly.endsWith('/') && pathOnly.length > 1
      ? pathOnly.slice(0, -1)
      : pathOnly

  const isKnownRoute = allRoutes?.some((r) => {
    const rp =
      r.path.endsWith('/') && r.path.length > 1 ? r.path.slice(0, -1) : r.path
    return rp === (normalizedTo || '/')
  })

  const i18n = config.i18n
  const versions = config.versions
  const base = (config.base || '/docs').replace(/\/$/, '')
  const baseSegment = base.startsWith('/') ? base.substring(1) : base

  const rawParts = pathOnly.split('/').filter(Boolean)

  // Classify: it's a Doc Path if it explicitly contains base segment,
  // OR if it's an 'unknown' path (backward compatible fallback assumes unknown = doc).
  const hasExplicitBase =
    baseSegment && rawParts.length > 0 && rawParts[0] === baseSegment
  const isDocsPath = hasExplicitBase || (!isKnownRoute && rawParts.length > 0)

  const parts = [...rawParts]
  let pIdx = 0

  // Strip base segment if present at start
  if (baseSegment && parts[pIdx] === baseSegment) pIdx++

  // Strip versions if present
  if (versions && parts.length > pIdx) {
    const vMatch = versions.versions.find((v) => v.path === parts[pIdx])
    if (vMatch) pIdx++
  }

  // Strip locales if present
  const isLocale =
    i18n &&
    parts.length > pIdx &&
    (Array.isArray(i18n.locales)
      ? i18n.locales.includes(parts[pIdx])
      : parts[pIdx] in i18n.locales)
  if (isLocale) pIdx++

  // The actual relative route remaining
  const routeContent = parts.slice(pIdx)

  // 4. Reconstruct dynamically based on context
  const resultParts: string[] = []

  if (isDocsPath) {
    // Reconstruct DOCS path: /base/version/locale/content
    if (baseSegment) resultParts.push(baseSegment)
    if (versions && activeVersion) resultParts.push(activeVersion)
    if (i18n && activeLocale) resultParts.push(activeLocale)
  } else {
    // Reconstruct EXTERNAL path: /locale/content
    if (i18n && activeLocale) resultParts.push(activeLocale)
  }

  resultParts.push(...routeContent)

  let finalPath = `/${resultParts.join('/')}`

  // Preserve trailing slash if present in input and output isn't just root
  if (
    pathOnly.endsWith('/') &&
    pathOnly.length > 1 &&
    !finalPath.endsWith('/')
  ) {
    finalPath += '/'
  }

  // Restore original query/hash
  const result = (finalPath || '/') + (hashAndQuery || '')
  return result
}
