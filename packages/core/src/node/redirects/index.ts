import type {
  BoltdocsConfig,
  RedirectConfig,
  RedirectStatus,
} from '../../shared/types'

export interface ResolvedRedirect {
  /** Normalized source path, always starting with `/`. */
  from: string
  /** Destination path or absolute URL, with the base already applied. */
  to: string
  /** `true` when `to` points outside this site. */
  external: boolean
  status: RedirectStatus
  permanent: boolean
}

export interface ResolveRedirectsOptions {
  config?: BoltdocsConfig
  /** Route paths that already exist and therefore cannot be redirected. */
  knownPaths?: Iterable<string>
}

const MAX_CHAIN_DEPTH = 10

function isExternalTarget(to: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(to) || to.startsWith('//')
}

/**
 * Normalizes a user-authored path into the canonical form used by the router:
 * a single leading slash, no duplicated separators, and no trailing slash
 * except for the root path.
 *
 * The query string is preserved because a redirect target is allowed to carry
 * one (`/new?utm=legacy`). The hash is dropped because it never reaches the
 * server and cannot be validated as a route.
 */
export function normalizeRedirectPath(value: string): string {
  const [withoutHash] = value.split('#')
  const queryIndex = withoutHash.indexOf('?')
  const rawPath =
    queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : withoutHash.slice(queryIndex)

  const collapsed = `/${rawPath}`.replace(/\/{2,}/g, '/')
  const normalized = collapsed === '/' ? '/' : collapsed.replace(/\/+$/, '')
  return `${normalized}${query}`
}

function getLocales(config?: BoltdocsConfig): string[] {
  const locales = config?.i18n?.locales
  if (!locales) return []
  return Array.isArray(locales) ? locales : Object.keys(locales)
}

function stripBase(pathname: string, base: string): string {
  if (base === '/' || !base) return pathname
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, '')}`
  if (pathname === normalizedBase) return '/'
  if (pathname.startsWith(`${normalizedBase}/`)) {
    return pathname.slice(normalizedBase.length) || '/'
  }
  return pathname
}

function withBase(pathname: string, base: string): string {
  if (base === '/' || !base) return pathname
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, '')}`
  if (pathname === '/') return normalizedBase
  return `${normalizedBase}${pathname}`
}

function expandLocales(from: string, config?: BoltdocsConfig): string[] {
  const locales = getLocales(config)
  if (locales.length === 0) return [from]
  return locales.map((locale) => {
    if (from === `/${locale}` || from.startsWith(`/${locale}/`)) return from
    return from === '/' ? `/${locale}` : `/${locale}${from}`
  })
}

/**
 * Resolves the configured redirects into a validated, loop-free list.
 *
 * Chains are collapsed (`/a -> /b -> /c` becomes `/a -> /c`) so the browser
 * never performs more than one hop, and a cycle is reported as a configuration
 * error instead of producing an unreachable page.
 */
export function resolveRedirects({
  config,
  knownPaths = [],
}: ResolveRedirectsOptions): ResolvedRedirect[] {
  const entries = config?.redirects
  if (!entries || entries.length === 0) return []

  const base = config?.base ?? '/'
  const occupied = new Set<string>()
  for (const path of knownPaths) occupied.add(normalizeRedirectPath(path))

  const bySource = new Map<string, RedirectConfig>()
  const expanded: RedirectConfig[] = []

  for (const entry of entries) {
    const from = normalizeRedirectPath(entry.from)
    const sources = entry.locale ? expandLocales(from, config) : [from]

    for (const source of sources) {
      if (bySource.has(source)) {
        throw new Error(
          `Duplicate redirect source "${source}". Every redirect must declare a unique "from" path.`,
        )
      }
      if (occupied.has(source)) {
        throw new Error(
          `Redirect source "${source}" conflicts with an existing route. Remove the route or change the redirect source.`,
        )
      }
      bySource.set(source, { ...entry, from: source })
      expanded.push({ ...entry, from: source })
    }
  }

  const resolved = new Map<string, ResolvedRedirect>()

  for (const entry of expanded) {
    const external = isExternalTarget(entry.to)
    const target = external
      ? entry.to
      : withBase(normalizeRedirectPath(entry.to), base)
    const status = entry.status ?? 301

    resolved.set(entry.from, {
      from: entry.from,
      to: target,
      external,
      status,
      permanent: status === 301 || status === 308,
    })
  }

  // Collapse chains and reject cycles. Chain hops are matched on the pathname
  // only, so a query string on the target never hides the next hop.
  for (const [source, redirect] of resolved) {
    if (redirect.external) continue

    const seen = new Set<string>([source])
    let current = redirect

    for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
      const nextPath = current.to.split('?')[0]
      const next = resolved.get(nextPath)
      if (!next) break
      if (seen.has(nextPath)) {
        throw new Error(
          `Redirect loop detected: "${[...seen, nextPath].join(' -> ')}". Break the cycle before building.`,
        )
      }
      seen.add(nextPath)
      current = next
    }

    if (current !== redirect) {
      resolved.set(source, {
        ...redirect,
        to: current.to,
        external: current.external,
      })
    }
  }

  return [...resolved.values()].sort((a, b) => a.from.localeCompare(b.from))
}

/**
 * Maps a public path back to the configured (base-free) path so the client
 * router can decide whether the current location must be redirected.
 */
export function toConfigPath(pathname: string, base: string): string {
  return stripBase(normalizeRedirectPath(pathname).split('?')[0], base)
}

/**
 * Builds the lookup used by the client router and the SSG redirect pages.
 */
export function createRedirectMap(
  redirects: ResolvedRedirect[],
): Map<string, ResolvedRedirect> {
  return new Map(redirects.map((redirect) => [redirect.from, redirect]))
}
