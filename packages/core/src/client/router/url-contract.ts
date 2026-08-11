import type {
  BoltdocsCollectionsConfig,
  BoltdocsI18nConfig,
  BoltdocsVersionsConfig,
} from '../../shared/types'

export type UrlRouteKind = 'doc' | 'external' | 'collection'

export interface UrlContractConfig {
  base?: string
  i18n?: Pick<BoltdocsI18nConfig, 'defaultLocale' | 'locales'>
  versions?: Pick<
    BoltdocsVersionsConfig,
    'defaultVersion' | 'prefix' | 'versions'
  >
  collections?: readonly string[] | BoltdocsCollectionsConfig
}

export interface UrlRouteHint {
  path: string
  kind?: UrlRouteKind
  collection?: string
}

export interface ParsedUrl {
  /** The normalized pathname, without query string or hash. */
  pathname: string
  /** The normalized route content after removing structural prefixes. */
  routePath: string
  /** Query string including `?`, when present. */
  search: string
  /** Hash including `#`, when present. */
  hash: string
  kind: UrlRouteKind
  locale?: string
  version?: string
  collection?: string
  /** Whether the input used the explicit `site:` protocol. */
  siteProtocol: boolean
  /** Whether the input pathname contained the configured documentation base. */
  hadBase: boolean
}

export interface BuildUrlOptions {
  kind: UrlRouteKind
  /** Route content, e.g. `/guides/start`, `/about`, or `/my-post`. */
  path?: string
  locale?: string
  version?: string
  collection?: string
  search?: string
  hash?: string
}

export interface ResolveUrlOptions {
  /** Explicitly choose the route family when the path is ambiguous. */
  kind?: UrlRouteKind
  /** Known route metadata used to classify paths outside `base`. */
  routes?: readonly UrlRouteHint[]
  /** Locale/version to apply when building a canonical target. */
  locale?: string
  version?: string
}

export function normalizeUrlBase(base?: string): string {
  if (!base || base === '/') return '/'
  const withLeadingSlash = base.startsWith('/') ? base : `/${base}`
  const normalized = withLeadingSlash.replace(/\/+/g, '/')
  return normalized.replace(/\/$/, '') || '/'
}

export function normalizeUrlPath(path: string): string {
  if (!path) return '/'
  const normalized = `/${path}`.replace(/\/+/g, '/')
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1)
  }
  return normalized
}

export function hasUrlBase(pathname: string, base?: string): boolean {
  const normalizedPath = normalizeUrlPath(pathname)
  const normalizedBase = normalizeUrlBase(base)
  if (normalizedBase === '/') return true
  return (
    normalizedPath === normalizedBase ||
    normalizedPath.startsWith(`${normalizedBase}/`)
  )
}

export function stripUrlBase(pathname: string, base?: string): string {
  const normalizedPath = normalizeUrlPath(pathname)
  const normalizedBase = normalizeUrlBase(base)
  if (normalizedBase === '/') return normalizedPath
  if (!hasUrlBase(normalizedPath, normalizedBase)) return normalizedPath
  const remainder = normalizedPath.slice(normalizedBase.length)
  return normalizeUrlPath(remainder || '/')
}

export function addUrlBase(pathname: string, base?: string): string {
  const normalizedPath = normalizeUrlPath(pathname)
  const normalizedBase = normalizeUrlBase(base)
  if (normalizedBase === '/' || hasUrlBase(normalizedPath, normalizedBase)) {
    return normalizedPath
  }
  return normalizeUrlPath(`${normalizedBase}/${normalizedPath}`)
}

export function getConfiguredLocales(config: UrlContractConfig): string[] {
  if (!config.i18n) return []
  return Array.isArray(config.i18n.locales)
    ? [...config.i18n.locales]
    : Object.keys(config.i18n.locales)
}

export function getConfiguredVersions(config: UrlContractConfig): string[] {
  return config.versions?.versions.map((version) => version.path) || []
}

export function getVersionPrefixSegments(config: UrlContractConfig): string[] {
  const prefix = config.versions?.prefix
  if (!prefix) return []
  return normalizeUrlPath(prefix).split('/').filter(Boolean)
}

export function getVersionSegments(
  version: string | undefined,
  config: UrlContractConfig,
): string[] {
  // A persisted preference or a stale caller must never introduce a version
  // segment when versioning is disabled (or when that version is unknown).
  if (!version || !config.versions || !isConfiguredVersion(version, config)) {
    return []
  }
  return [...getVersionPrefixSegments(config), version]
}

export function isConfiguredLocale(
  value: string | undefined,
  config: UrlContractConfig,
): value is string {
  return !!value && getConfiguredLocales(config).includes(value)
}

export function isConfiguredVersion(
  value: string | undefined,
  config: UrlContractConfig,
): value is string {
  return !!value && getConfiguredVersions(config).includes(value)
}

function matchConfiguredVersion(
  parts: string[],
  start: number,
  config: UrlContractConfig,
): { version?: string; nextIndex: number } {
  const prefix = getVersionPrefixSegments(config)
  const versionIndex = start + prefix.length
  const hasPrefix = prefix.every(
    (segment, index) => parts[start + index] === segment,
  )

  if (!hasPrefix || !isConfiguredVersion(parts[versionIndex], config)) {
    return { nextIndex: start }
  }

  return {
    version: parts[versionIndex],
    nextIndex: versionIndex + 1,
  }
}

export function splitUrlReference(to: string): {
  pathname: string
  search: string
  hash: string
} {
  const firstDelimiter = to.search(/[?#]/)
  if (firstDelimiter < 0) {
    return { pathname: to, search: '', hash: '' }
  }

  const pathname = to.slice(0, firstDelimiter)
  const suffix = to.slice(firstDelimiter)
  const hashIndex = suffix.indexOf('#')

  if (hashIndex < 0) {
    return { pathname, search: suffix, hash: '' }
  }

  return {
    pathname,
    search: suffix.slice(0, hashIndex),
    hash: suffix.slice(hashIndex),
  }
}

export function stripSiteProtocol(to: string): {
  value: string
  siteProtocol: boolean
} {
  if (!to.startsWith('site:')) return { value: to, siteProtocol: false }
  const value = to.slice('site:'.length)
  return { value: value || '/', siteProtocol: true }
}

/** Returns true for URI schemes such as `mailto:`, `tel:`, or `data:`. */
export function hasUriScheme(value: string): boolean {
  return /^[a-z][a-z\d+.-]*:/i.test(value)
}

function normalizeSuffix(value: string | undefined, prefix: '?' | '#'): string {
  if (!value) return ''
  return value.startsWith(prefix) ? value : `${prefix}${value}`
}

function getRouteHint(
  pathname: string,
  routes: readonly UrlRouteHint[] | undefined,
): UrlRouteHint | undefined {
  if (!routes) return undefined
  const normalized = normalizeUrlPath(pathname)
  return routes.find((route) => normalizeUrlPath(route.path) === normalized)
}

function getCollectionFromPath(
  pathname: string,
  config: UrlContractConfig,
): {
  collection?: string
  remainder: string[]
  locale?: string
  version?: string
} {
  const parts = normalizeUrlPath(pathname).split('/').filter(Boolean)
  const locales = getConfiguredLocales(config)
  const collectionNames = Array.isArray(config.collections)
    ? config.collections
    : Object.keys(
        (config.collections as BoltdocsCollectionsConfig | undefined)?.labels ||
          {},
      )
  const collections = new Set(collectionNames)
  let index = 0

  const versionMatch = matchConfiguredVersion(parts, index, config)
  const version = versionMatch.version
  index = versionMatch.nextIndex

  let locale: string | undefined
  if (locales.includes(parts[index] || '')) {
    locale = parts[index]
    index++
  }

  const collection = parts[index]
  if (!collection || !collections.has(collection)) {
    return { remainder: parts }
  }

  return {
    collection,
    locale,
    version,
    remainder: parts.slice(index + 1),
  }
}

export function classifyUrlPath(
  pathname: string,
  config: UrlContractConfig,
  options: Pick<ResolveUrlOptions, 'kind' | 'routes'> = {},
): UrlRouteKind {
  if (options.kind) return options.kind

  const normalizedPath = normalizeUrlPath(pathname)
  const hint = getRouteHint(normalizedPath, options.routes)
  if (hint?.kind) return hint.kind
  if (hint?.collection) return 'collection'
  const collection = getCollectionFromPath(normalizedPath, config)
  if (collection.collection) return 'collection'

  if (hasUrlBase(normalizedPath, config.base)) return 'doc'

  return 'external'
}

export function parseUrlReference(
  to: string,
  config: UrlContractConfig,
  options: Pick<ResolveUrlOptions, 'kind' | 'routes'> = {},
): ParsedUrl {
  const { value, siteProtocol } = stripSiteProtocol(to)
  const split = splitUrlReference(value)
  const pathname = normalizeUrlPath(split.pathname || '/')
  const hadBase = hasUrlBase(pathname, config.base)
  const kind = classifyUrlPath(pathname, config, options)

  if (kind === 'doc') {
    const withoutBase = stripUrlBase(pathname, config.base)
    const parts = withoutBase.split('/').filter(Boolean)
    let index = 0
    const versionMatch = matchConfiguredVersion(parts, index, config)
    const version = versionMatch.version
    index = versionMatch.nextIndex
    const locale = isConfiguredLocale(parts[index], config)
      ? parts[index]
      : undefined
    if (locale) index++

    return {
      pathname,
      routePath: normalizeUrlPath(parts.slice(index).join('/')),
      search: split.search,
      hash: split.hash,
      kind,
      locale,
      version,
      siteProtocol,
      hadBase,
    }
  }

  if (kind === 'collection') {
    const collection = getCollectionFromPath(pathname, config)
    return {
      pathname,
      routePath: normalizeUrlPath(collection.remainder.join('/')),
      search: split.search,
      hash: split.hash,
      kind,
      locale: collection.locale,
      version: collection.version,
      collection: collection.collection,
      siteProtocol,
      hadBase,
    }
  }

  const parts = pathname.split('/').filter(Boolean)
  const locale = isConfiguredLocale(parts[0], config) ? parts[0] : undefined
  const routeParts = locale ? parts.slice(1) : parts

  return {
    pathname,
    routePath: normalizeUrlPath(routeParts.join('/')),
    search: split.search,
    hash: split.hash,
    kind,
    locale,
    siteProtocol,
    hadBase,
  }
}

export function buildUrl(
  options: BuildUrlOptions,
  config: UrlContractConfig,
): string {
  const routePath = normalizeUrlPath(options.path || '/')
  const locale =
    options.locale && options.locale !== config.i18n?.defaultLocale
      ? options.locale
      : undefined
  const search = normalizeSuffix(options.search, '?')
  const hash = normalizeSuffix(options.hash, '#')
  let pathname: string

  if (options.kind === 'doc') {
    const parts = [
      normalizeUrlBase(config.base) === '/'
        ? undefined
        : normalizeUrlBase(config.base).slice(1),
      ...getVersionSegments(options.version, config),
      locale,
      routePath === '/' ? undefined : routePath.slice(1),
    ].filter(Boolean)
    pathname = normalizeUrlPath(parts.join('/'))
  } else if (options.kind === 'collection') {
    if (!options.collection) {
      throw new Error('A collection route requires a collection name')
    }
    const parts = [
      ...getVersionSegments(options.version, config),
      locale,
      options.collection,
      routePath === '/' ? undefined : routePath.slice(1),
    ].filter(Boolean)
    pathname = normalizeUrlPath(parts.join('/'))
  } else {
    const parts = [
      locale,
      routePath === '/' ? undefined : routePath.slice(1),
    ].filter(Boolean)
    pathname = normalizeUrlPath(parts.join('/'))
  }

  return `${pathname}${search}${hash}`
}

export function resolveUrlReference(
  to: string,
  config: UrlContractConfig,
  options: ResolveUrlOptions = {},
): string {
  const { value, siteProtocol } = stripSiteProtocol(to)
  if (hasUriScheme(value) || /^(?:https?:)?\/\//i.test(value)) return to
  if (value.startsWith('#') || value.startsWith('?')) {
    return siteProtocol ? value : to
  }

  const parsed = parseUrlReference(value, config, options)
  const kind = options.kind || parsed.kind
  const locale = options.locale ?? parsed.locale
  const version = options.version ?? parsed.version

  return buildUrl(
    {
      kind,
      path: parsed.routePath,
      locale,
      version,
      collection: parsed.collection,
      search: parsed.search,
      hash: parsed.hash,
    },
    config,
  )
}
