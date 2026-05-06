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

  // Find the current route matching the pathname
  const currentRoute = allRoutes?.find?.(
    (r) => normalize(r.path) === currentPath,
  )

  // Derive current locale and version
  // Priority: URL (currentRoute) > Zustand Store (Persistence) > Config Default
  const currentLocale = config.i18n
    ? currentRoute?.locale ||
      (hasHydrated ? currentLocaleStore : undefined) ||
      config.i18n.defaultLocale
    : undefined

  const currentVersion = config.versions
    ? currentRoute?.version ||
      (hasHydrated ? currentVersionStore : undefined) ||
      config.versions.defaultVersion
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
    // We prefer the version that matches the current route's prefix style
    const i18n = config.i18n
    if (i18n) {
      const isCurrentRoutePrefixed = !!currentRoute?.locale
      const isRoutePrefixed = !!r.locale

      const hasAlternate = allRoutes?.some?.(
        (alt) =>
          alt !== r &&
          alt.filePath === r.filePath &&
          alt.version === r.version &&
          (alt.locale || i18n.defaultLocale) ===
            (r.locale || i18n.defaultLocale),
      )

      if (hasAlternate && isCurrentRoutePrefixed !== isRoutePrefixed) {
        return false
      }
    }

    return true
  })

  // Labels and lists for UI convenience
  const currentLocaleConfig =
    config.i18n?.localeConfigs?.[currentLocale as string]
  const currentLocaleLabel =
    currentLocaleConfig?.label ||
    config.i18n?.locales[currentLocale as string] ||
    currentLocale

  const currentVersionConfig = config.versions?.versions?.find?.(
    (v) => v.path === currentVersion,
  )
  const currentVersionLabel = currentVersionConfig?.label || currentVersion

  const availableLocales = config.i18n
    ? Object.entries(config.i18n.locales).map(([key, defaultLabel]) => {
        const localeConfig = config.i18n?.localeConfigs?.[key]
        return {
          key: key as import('../../shared/types').BoltdocsLocale,
          label: localeConfig?.label || defaultLabel,
          isCurrent: key === currentLocale,
        }
      })
    : []

  const availableVersions = config.versions
    ? config.versions.versions.map((v) => ({
        key: v.path as import('../../shared/types').BoltdocsVersion,
        label: v.label,
        isCurrent: v.path === currentVersion,
      }))
    : []

  return {
    routes,
    allRoutes,
    currentRoute,
    currentLocale: currentLocale as import('../../shared/types').BoltdocsLocale,
    currentLocaleLabel,
    availableLocales,
    currentVersion:
      currentVersion as import('../../shared/types').BoltdocsVersion,
    currentVersionLabel,
    availableVersions,
    config,
  }
}
