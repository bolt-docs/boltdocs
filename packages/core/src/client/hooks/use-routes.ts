import { useLocation } from 'react-router-dom'
import { useConfig } from '../app/config-context'
import { useRoutesContext } from '../app/routes-context'
import { useBoltdocsContext } from '../store/boltdocs-context'

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

  const normalize = (p: string) =>
    p.endsWith('/') && p.length > 1 ? p.slice(0, -1) : p
  const currentPath = normalize(location.pathname)

  // Find the current active route matching the pathname
  const currentRoute = allRoutes?.find?.(
    (r) => normalize(r.path) === currentPath,
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
  const routes = allRoutes?.filter?.((r) => {
    const localeMatch = config.i18n
      ? (r.locale || config.i18n.defaultLocale) === currentLocale
      : true
    const versionMatch = config.versions
      ? (r.version || config.versions.defaultVersion) === currentVersion
      : true

    if (!(localeMatch && versionMatch)) return false

    // Resolve duplicate paths (aliases) like /docs vs /docs/en
    const i18n = config.i18n
    // 3. Resolve duplicate route aliases (e.g., /docs/page vs /docs/latest/page or /docs/es/page)
    // If duplicates exist, we only show the style (prefixed or unprefixed) that matches the user's current page style.
    const isCurrentLocalePrefixed = !!currentRoute?.locale
    const isCurrentVersionPrefixed = !!currentRoute?.version

    const isRouteLocalePrefixed = !!r.locale
    const isRouteVersionPrefixed = !!r.version

    const hasAlternate = allRoutes?.some?.(
      (alt) =>
        alt !== r &&
        alt.filePath === r.filePath &&
        (alt.locale || config.i18n?.defaultLocale || '') ===
          (r.locale || config.i18n?.defaultLocale || '') &&
        (alt.version || config.versions?.defaultVersion || '') ===
          (r.version || config.versions?.defaultVersion || ''),
    )

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

  return {
    routes,
    allRoutes,
    currentRoute,
    currentLocale: currentLocale as import('../../shared/types').BoltdocsLocale,
    currentVersion:
      currentVersion as import('../../shared/types').BoltdocsVersion,
  }
}
