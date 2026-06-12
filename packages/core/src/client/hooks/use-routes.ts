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

  const {
    currentLocale: currentLocaleStore,
    currentVersion: currentVersionStore,
  } = useBoltdocsContext()

  const currentPath = normalizePath(location.pathname)

  const currentRoute = allRoutes?.find?.(
    (r) => normalizePath(r.path) === currentPath,
  )

  const currentLocale = config.i18n
    ? currentLocaleStore || config.i18n.defaultLocale
    : undefined

  const currentVersion = config.versions
    ? currentVersionStore || config.versions.defaultVersion
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
        pathParts.includes(
          currentVersionStore || config.versions.defaultVersion,
        )
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
    currentLocale,
    currentVersion,
    location.pathname,
    currentLocaleStore,
    currentVersionStore,
  ])

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
