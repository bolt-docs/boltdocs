import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useConfig } from '../app/config-context'
import { useRoutesContext } from '../app/routes-context'
import { useBoltdocsContext } from '../store/boltdocs-context'
import { normalizePath } from '../utils/path'

/**
 * Hook to access the framework's routing state.
 * Returns both the complete set of routes and a filtered list based on the current
 * version and locale.
 */
export function useRoutes() {
  const { routes: allRoutes } = useRoutesContext()
  const config = useConfig()
  const location = useLocation()

  // Use Zustand store for active state
  const {
    hasHydrated,
    currentLocale: currentLocaleStore,
    currentVersion: currentVersionStore,
  } = useBoltdocsContext()

  const currentPath = normalizePath(location.pathname)

  // Find the current active route matching the pathname
  const currentRoute = allRoutes?.find?.(
    (r) => normalizePath(r.path) === currentPath,
  )

  // 2. STRICT SOURCE OF TRUTH:
  // Derive the active states exclusively from the hydrated Context Store.
  // This ensures that user preference (LocalStorage) takes precedence over ambiguous URL fallbacks.
  const currentLocale = config.i18n
    ? currentLocaleStore || config.i18n.defaultLocale
    : undefined

  const currentVersion = config.versions
    ? currentVersionStore || config.versions.defaultVersion
    : undefined

  // Filter routes to those matching the current version and locale
  const routes = useMemo(() => {
    if (!allRoutes) return []

    // Pre-calculate alternate presence using a Map of maps or a composite key
    // Key: filePath | (locale || defaultLocale) | (version || defaultVersion)
    const alternateCounts = new Map<string, number>()
    const defaultLocale = config.i18n?.defaultLocale || ''
    const defaultVersion = config.versions?.defaultVersion || ''

    for (const r of allRoutes) {
      const locale = r.locale || defaultLocale
      const version = r.version || defaultVersion
      const key = `${r.filePath}::${locale}::${version}`
      alternateCounts.set(key, (alternateCounts.get(key) || 0) + 1)
    }

    return allRoutes.filter((r) => {
      const localeMatch = config.i18n
        ? (r.locale || config.i18n.defaultLocale) === currentLocale
        : true
      const versionMatch = config.versions
        ? (r.version || config.versions.defaultVersion) === currentVersion
        : true

      if (!(localeMatch && versionMatch)) return false

      // Resolve duplicate paths (aliases) like /docs vs /docs/en
      // 3. Resolve duplicate route aliases (e.g., /docs/page vs /docs/latest/page or /docs/es/page)
      // If duplicates exist, we only show the style (prefixed or unprefixed) that matches the user's current page style.
      const isCurrentLocalePrefixed = !!currentRoute?.locale
      const isCurrentVersionPrefixed = !!currentRoute?.version

      const isRouteLocalePrefixed = !!r.locale
      const isRouteVersionPrefixed = !!r.version

      const locale = r.locale || defaultLocale
      const version = r.version || defaultVersion
      const key = `${r.filePath}::${locale}::${version}`
      const hasAlternate = (alternateCounts.get(key) || 0) > 1

      if (hasAlternate) {
        // Style mismatch checks
        const localeMismatch =
          config.i18n && isCurrentLocalePrefixed !== isRouteLocalePrefixed
        const versionMismatch =
          config.versions && isCurrentVersionPrefixed !== isRouteVersionPrefixed

        if (localeMismatch || versionMismatch) {
          return false
        }
      }

      return true
    })
  }, [allRoutes, config, currentLocale, currentVersion, currentRoute])

  const collections = useMemo(() => {
    return new Set(
      (allRoutes || []).map((r) => r.collection).filter(Boolean) as string[],
    )
  }, [allRoutes])

  const currentSegment = location.pathname
    .split('/')
    .filter(Boolean)[0]
    ?.toLowerCase()
  const isCollectionPage =
    !!currentRoute?.collection ||
    (currentSegment ? collections.has(currentSegment) : false)

  return {
    routes,
    allRoutes,
    currentRoute,
    isCollectionPage,
    currentLocale: currentLocale as import('../../shared/types').BoltdocsLocale,
    currentVersion:
      currentVersion as import('../../shared/types').BoltdocsVersion,
  }
}
