import { useConfig } from '../app/config-context'
import type { LinkProps as RouterLinkProps } from 'react-router-dom'
import { useRoutes } from './use-routes'

/**
 * Hook to automatically localize a path based on the current version and locale context.
 * It ensures that navigation preserves the active version and language across the entire site.
 */
export function useLocalizedTo(to: RouterLinkProps['to']) {
  const config = useConfig()
  const { currentLocale: activeLocale, currentVersion: activeVersion } =
    useRoutes()

  if (!config || typeof to !== 'string') return to

  // External, absolute, or anchor links don't need localization prefixing
  if (to.startsWith('http') || to.startsWith('//') || to.startsWith('#'))
    return to

  const i18n = config.i18n
  const versions = config.versions

  if (!i18n && !versions) return to

  // 1. Identify the input intent
  const isDocLink = to.startsWith('/docs')

  // 3. Clean the 'to' path of ANY existing prefixes to avoid stacking
  const parts = to.split('/').filter(Boolean)
  let pIdx = 0

  // Strip '/docs' if present at start
  if (parts[pIdx] === 'docs') pIdx++

  // Strip versions if present
  if (versions && parts.length > pIdx) {
    const vMatch = versions.versions.find((v) => v.path === parts[pIdx])
    if (vMatch) pIdx++
  }

  // Strip locales if present
  if (i18n && parts.length > pIdx && i18n.locales[parts[pIdx]]) pIdx++

  // The actual relative route remaining
  const routeContent = parts.slice(pIdx)

  // 4. Reconstruct strictly from base
  const resultParts: string[] = []

  if (isDocLink) {
    resultParts.push('docs')
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
