import { useMemo } from 'react'
import {
  getVersionPrefixSegments,
  normalizeUrlBase,
  useLocation,
} from '../router'
import { useConfig } from '../app/config-context'
import {
  createRouteIndex,
  useRoutesContext,
  type RouteIndex,
} from '../app/routes-context'
import { useBoltdocsContext } from '../store/boltdocs-context'
import { normalizePath } from '../utils/path'
import type { BoltdocsConfig, ComponentRoute } from '../types'

function stripBase(parts: string[], base?: string): string[] {
  const baseParts = normalizeUrlBase(base).split('/').filter(Boolean)
  if (baseParts.length === 0) return parts
  if (
    parts.length < baseParts.length ||
    !baseParts.every((part, index) => parts[index] === part)
  ) {
    return parts
  }
  return parts.slice(baseParts.length)
}

function consumeVersion(
  parts: string[],
  config: BoltdocsConfig,
): { version?: string; nextIndex: number } {
  const versions = config.versions
  if (!versions) return { nextIndex: 0 }

  const prefixParts = getVersionPrefixSegments(config)
  let index = 0
  if (
    prefixParts.length > 0 &&
    prefixParts.every((part, offset) => parts[offset] === part)
  ) {
    index = prefixParts.length
  } else if (prefixParts.length > 0) {
    // Textual prefixes such as `v` may be emitted in the same URL segment as
    // the configured version path (`v1`) or as a standalone segment (`v/1`).
    if (prefixParts.length === 1 && parts.length > 0) {
      const version = versions.versions.find(
        (item) => `${prefixParts[0]}${item.path}` === parts[0],
      )
      if (version) return { version: version.path, nextIndex: 1 }
    }
    return { nextIndex: 0 }
  }

  const candidate = parts[index]
  if (
    candidate &&
    versions.versions.some((version) => version.path === candidate)
  ) {
    return { version: candidate, nextIndex: index + 1 }
  }
  return { nextIndex: 0 }
}

function consumeLocale(
  parts: string[],
  index: number,
  locales: readonly string[],
): { locale?: string; nextIndex: number } {
  const candidate = parts[index]
  return candidate && locales.includes(candidate)
    ? { locale: candidate, nextIndex: index + 1 }
    : { nextIndex: index }
}

function effectiveVariantMatches(
  route: ComponentRoute,
  config: BoltdocsConfig,
  currentLocale: string | undefined,
  currentVersion: string | undefined,
): boolean {
  const localeMatches =
    !config.i18n ||
    (route.locale || config.i18n.defaultLocale) === currentLocale
  const versionMatches =
    !config.versions ||
    (route.version || config.versions.defaultVersion) === currentVersion
  return localeMatches && versionMatches
}

export function findCurrentCollectionRoute(
  routeIndex: RouteIndex,
  structuralPathKey: string,
  config: BoltdocsConfig,
  currentLocale: string | undefined,
  currentVersion: string | undefined,
): ComponentRoute | undefined {
  return routeIndex.byCollectionPath
    ?.get(structuralPathKey)
    ?.find((route) =>
      effectiveVariantMatches(route, config, currentLocale, currentVersion),
    )
}

interface RouteSelectionOptions {
  config: BoltdocsConfig
  currentLocale?: string
  currentVersion?: string
  isCurrentLocalePrefixed: boolean
  isCurrentVersionPrefixed: boolean
  countsByFilePath: ReadonlyMap<string, number>
}

/** Filter generated variants using the URL's active locale/version contract. */
export function selectRoutesForContext(
  routes: readonly ComponentRoute[],
  options: RouteSelectionOptions,
): ComponentRoute[] {
  const {
    config,
    currentLocale,
    currentVersion,
    isCurrentLocalePrefixed,
    isCurrentVersionPrefixed,
    countsByFilePath,
  } = options

  return routes.filter((route) => {
    const localeMatches = config.i18n
      ? (route.locale || config.i18n.defaultLocale) === currentLocale
      : true
    const versionMatches = config.versions
      ? (route.version || config.versions.defaultVersion) === currentVersion
      : true
    if (!(localeMatches && versionMatches)) return false

    if ((countsByFilePath.get(route.filePath) || 0) <= 1) return true

    const localeMismatch =
      config.i18n && isCurrentLocalePrefixed !== Boolean(route.locale)
    const versionMismatch =
      config.versions && isCurrentVersionPrefixed !== Boolean(route.version)
    return !(localeMismatch || versionMismatch)
  })
}

/**
 * Hook to access the framework's routing state.
 * Returns both the complete set of routes and a filtered list based on the current
 * version and locale.
 */
export function useRoutes() {
  const routeContext = useRoutesContext()
  const allRoutes = routeContext.routes
  const routeIndex = useMemo(
    () =>
      routeContext.index?.byCollectionPath
        ? routeContext.index
        : createRouteIndex(allRoutes),
    [allRoutes, routeContext.index],
  )
  const config = useConfig()
  const location = useLocation()
  const { pathname } = location

  const {
    currentLocale: currentLocaleStore,
    currentVersion: currentVersionStore,
  } = useBoltdocsContext()

  const currentPath = useMemo(() => normalizePath(pathname || '/'), [pathname])
  const pathParts = useMemo(
    () => currentPath.split('/').filter(Boolean),
    [currentPath],
  )
  const localeConfig = config.i18n?.locales
  const configuredLocales = useMemo(
    () =>
      localeConfig
        ? Array.isArray(localeConfig)
          ? localeConfig
          : Object.keys(localeConfig)
        : [],
    [localeConfig],
  )
  const configuredVersions = useMemo(
    () => config.versions?.versions || [],
    [config.versions],
  )

  const structuralPath = useMemo(() => {
    const contentParts = stripBase(pathParts, config.base)
    const versionMatch = consumeVersion(contentParts, config)
    const localeMatch = consumeLocale(
      contentParts,
      versionMatch.nextIndex,
      configuredLocales,
    )
    return {
      contentParts: contentParts.slice(localeMatch.nextIndex),
      locale: localeMatch.locale,
      version: versionMatch.version,
    }
  }, [config, configuredLocales, pathParts])

  const currentLocale = config.i18n
    ? structuralPath.locale ||
      (configuredLocales.includes(currentLocaleStore || '')
        ? currentLocaleStore
        : config.i18n.defaultLocale)
    : undefined
  const currentVersion = config.versions
    ? structuralPath.version ||
      (configuredVersions.some(
        (version) => version.path === currentVersionStore,
      )
        ? currentVersionStore
        : config.versions.defaultVersion)
    : undefined

  const structuralPathKey = useMemo(
    () => `/${structuralPath.contentParts.join('/')}`,
    [structuralPath.contentParts],
  )
  const currentRoute = useMemo(() => {
    const direct = routeIndex.byPath.get(currentPath)
    if (direct) return direct

    return findCurrentCollectionRoute(
      routeIndex,
      structuralPathKey,
      config,
      currentLocale,
      currentVersion,
    )
  }, [
    config,
    currentLocale,
    currentPath,
    currentVersion,
    routeIndex,
    structuralPathKey,
  ])

  const isCurrentLocalePrefixed = structuralPath.locale !== undefined
  const isCurrentVersionPrefixed = structuralPath.version !== undefined
  const countsByFilePath = useMemo(() => {
    if (routeIndex.countsByFilePath) return routeIndex.countsByFilePath
    const counts = new Map<string, number>()
    for (const route of allRoutes) {
      counts.set(route.filePath, (counts.get(route.filePath) || 0) + 1)
    }
    return counts
  }, [allRoutes, routeIndex.countsByFilePath])

  const routes = useMemo(
    () =>
      selectRoutesForContext(allRoutes, {
        config,
        currentLocale,
        currentVersion,
        isCurrentLocalePrefixed,
        isCurrentVersionPrefixed,
        countsByFilePath,
      }),
    [
      allRoutes,
      config,
      countsByFilePath,
      currentLocale,
      currentVersion,
      isCurrentLocalePrefixed,
      isCurrentVersionPrefixed,
    ],
  )

  const collections = useMemo(
    () => new Set(routeIndex.collectionNames.map((name) => name.toLowerCase())),
    [routeIndex.collectionNames],
  )
  const currentCollection = structuralPath.contentParts[0]?.toLowerCase()
  const isCollectionPage = collections.has(currentCollection || '')

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
