import { useConfig } from '../app/config-context'
import {
  hasUriScheme,
  hasUrlBase,
  parseUrlReference,
  resolveUrlReference,
  type UrlRouteHint,
} from '../router'
import type { BoltdocsRoutePathWithFallback } from '../types'
import { useRoutesContext } from '../app/routes-context'
import { useBoltdocsContext } from '../store/boltdocs-context'

/**
 * Hook to automatically localize a path based on the current version and locale context.
 * It ensures that navigation preserves the active version and language across the entire site.
 */
export function useLocalizedTo(to: BoltdocsRoutePathWithFallback): string
export function useLocalizedTo(to: string): string
export function useLocalizedTo(to: string): string {
  const config = useConfig()
  const routeContext = useRoutesContext()
  const routeIndex = routeContext.index || {
    byPath: new Map(routeContext.routes.map((route) => [route.path, route])),
    hintsByPath: new Map(),
    collectionNames: [],
  }
  const { currentLocale: activeLocale, currentVersion: activeVersion } =
    useBoltdocsContext()

  const configuredVersions = config.versions?.versions || []
  const configuredVersion = configuredVersions.some(
    (version) => version.path === activeVersion,
  )
    ? activeVersion
    : undefined
  const configuredLocales = config.i18n
    ? Array.isArray(config.i18n.locales)
      ? config.i18n.locales
      : Object.keys(config.i18n.locales)
    : []
  const configuredLocale = configuredLocales.includes(activeLocale)
    ? activeLocale
    : undefined

  if (!config || typeof to !== 'string') return to
  if (
    to.startsWith('http://') ||
    to.startsWith('https://') ||
    to.startsWith('//') ||
    to.startsWith('#') ||
    to.startsWith('?') ||
    hasUriScheme(to.replace(/^site:/, ''))
  ) {
    return to.startsWith('site:') ? to.slice('site:'.length) || '/' : to
  }

  const siteProtocol = to.startsWith('site:')
  const siteValue = siteProtocol ? to.slice('site:'.length) || '/' : to
  const collectionNames = routeIndex.collectionNames
  const targetPath = siteValue.split(/[?#]/, 1)[0]
  const normalizedTarget =
    targetPath.endsWith('/') && targetPath.length > 1
      ? targetPath.slice(0, -1)
      : targetPath
  const knownRoute = routeIndex.hintsByPath.get(normalizedTarget)
  const knownRouteMeta = routeIndex.byPath.get(normalizedTarget)
  const knownRouteKind = knownRoute
    ? knownRoute.kind ||
      (hasUrlBase(normalizedTarget, config.base) ? 'doc' : 'external')
    : undefined
  const routeHints: UrlRouteHint[] = knownRoute
    ? [{ ...knownRoute, kind: knownRouteKind }]
    : []

  // Unknown slash-prefixed references retain the historical docs-link
  // behavior. Known external/collection routes use their explicit family.
  const kind = knownRouteKind || (siteProtocol ? 'external' : 'doc')
  const contractConfig = {
    base: config.base,
    i18n: config.i18n
      ? {
          defaultLocale: config.i18n.defaultLocale,
          locales: config.i18n.locales,
        }
      : undefined,
    versions: config.versions
      ? {
          defaultVersion: config.versions.defaultVersion,
          prefix: config.versions.prefix,
          versions: config.versions.versions,
        }
      : undefined,
    collections: collectionNames,
  }

  const parsedTarget = parseUrlReference(siteValue, contractConfig, {
    kind,
    routes: routeHints,
  })
  const resolved = resolveUrlReference(siteValue, contractConfig, {
    kind,
    routes: routeHints,
    locale: configuredLocale,
    // An explicit version in the target wins over the active preference.
    version:
      kind === 'collection' || kind === 'external'
        ? knownRouteMeta?.version
        : parsedTarget.version || configuredVersion,
  })

  if (
    siteValue.endsWith('/') &&
    siteValue.length > 1 &&
    !resolved.split(/[?#]/, 1)[0].endsWith('/')
  ) {
    const suffixIndex = resolved.search(/[?#]/)
    const pathname = suffixIndex < 0 ? resolved : resolved.slice(0, suffixIndex)
    const suffix = suffixIndex < 0 ? '' : resolved.slice(suffixIndex)
    return `${pathname}/${suffix}`
  }

  return resolved
}
