import { useMemo } from 'react'
import { useLocation } from '../router'
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
  const routeContext = useRoutesContext()
  const allRoutes = routeContext.routes
  const routeIndex = routeContext.index || {
    byPath: new Map(
      allRoutes.map((route) => [normalizePath(route.path), route]),
    ),
    hintsByPath: new Map(),
    collectionNames: [],
  }
  const config = useConfig()
  const location = useLocation()

  const {
    currentLocale: currentLocaleStore,
    currentVersion: currentVersionStore,
  } = useBoltdocsContext()

  const currentPath = normalizePath(location.pathname)

  const currentRoute = routeIndex.byPath.get(currentPath)

  const pathParts = location.pathname.split('/').filter(Boolean)
  const urlLocale = config.i18n
    ? pathParts.find((part) =>
        Array.isArray(config.i18n?.locales)
          ? config.i18n?.locales.includes(part)
          : part in (config.i18n?.locales || {}),
      )
    : undefined

  const currentLocale = config.i18n
    ? urlLocale || currentLocaleStore || config.i18n.defaultLocale
    : undefined

  const configuredVersions = config.versions?.versions || []
  const currentVersion = config.versions
    ? configuredVersions.some((version) => version.path === currentVersionStore)
      ? currentVersionStore
      : config.versions.defaultVersion
    : undefined

  const routes = useMemo(() => {
    if (!allRoutes) return []

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

      const pathParts = location.pathname.split('/').filter(Boolean)
      const isCurrentLocalePrefixed = !!(
        config.i18n &&
        pathParts.includes(currentLocaleStore || config.i18n.defaultLocale)
      )
      const isCurrentVersionPrefixed = !!(
        config.versions &&
        !!currentVersion &&
        pathParts.includes(currentVersion)
      )

      const isRouteLocalePrefixed = !!r.locale
      const isRouteVersionPrefixed = !!r.version

      const locale = r.locale || defaultLocale
      const version = r.version || defaultVersion
      const key = `${r.filePath}::${locale}::${version}`
      const hasAlternate = (alternateCounts.get(key) || 0) > 1

      if (hasAlternate) {
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
  }, [
    allRoutes,
    config,
    routeIndex,
    currentLocale,
    currentVersion,
    location.pathname,
    currentLocaleStore,
    currentVersionStore,
  ])

  const collections = useMemo(
    () => new Set(routeIndex.collectionNames),
    [routeIndex.collectionNames],
  )

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
