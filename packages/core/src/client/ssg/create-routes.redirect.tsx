import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RouteRecord } from '../router'
import type { BoltdocsConfig, RedirectConfig } from '../types'

interface RedirectRouteOptions {
  config: BoltdocsConfig
}

function normalize(value: string): string {
  const [withoutHash] = value.split('#')
  const queryIndex = withoutHash.indexOf('?')
  const rawPath =
    queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : withoutHash.slice(queryIndex)
  const collapsed = `/${rawPath}`.replace(/\/{2,}/g, '/')
  const normalized = collapsed === '/' ? '/' : collapsed.replace(/\/+$/, '')
  return `${normalized}${query}`
}

function isExternalTarget(to: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(to) || to.startsWith('//')
}

function getLocales(config: BoltdocsConfig): string[] {
  const locales = config.i18n?.locales
  if (!locales) return []
  return Array.isArray(locales) ? locales : Object.keys(locales)
}

function withBase(pathname: string, base: string): string {
  if (base === '/' || !base) return pathname
  const normalizedBase = `/${base.replace(/^\/+|\/+$/g, '')}`
  if (pathname === '/') return normalizedBase
  return `${normalizedBase}${pathname}`
}

/**
 * Collapses redirect chains and rejects cycles in the browser as well, so a
 * misconfigured site fails visibly instead of trapping the visitor.
 */
function buildRedirectMap(config: BoltdocsConfig): Map<string, string> {
  const map = new Map<string, string>()
  const entries = config.redirects ?? []

  for (const entry of entries) {
    const from = normalize(entry.from)
    const sources = entry.locale
      ? getLocales(config).map((locale) =>
          from === `/${locale}` || from.startsWith(`/${locale}/`)
            ? from
            : from === '/'
              ? `/${locale}`
              : `/${locale}${from}`,
        )
      : [from]

    for (const source of sources) {
      const to = isExternalTarget(entry.to)
        ? entry.to
        : withBase(normalize(entry.to), config.base ?? '/')
      map.set(source, to)
    }
  }

  for (const [source, direct] of map) {
    let current = direct
    const seen = new Set([source])
    for (let depth = 0; depth < 10; depth++) {
      const nextPath = current.split('?')[0]
      const next = map.get(nextPath)
      if (!next || seen.has(nextPath)) break
      seen.add(nextPath)
      current = next
    }
    map.set(source, current)
  }

  return map
}

/**
 * Performs the redirect during render effects. A short delay lets the static
 * host serve the prerendered redirect document first on a cold load, while a
 * client-side navigation never flashes the destination page.
 */
function RedirectBoundary({ to }: { to: string }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (isExternalTarget(to)) {
      window.location.replace(to)
      return
    }
    navigate(to, { replace: true })
  }, [navigate, to])

  return (
    <main className="boltdocs-page w-full pt-4 pb-20 px-4 sm:px-8">
      <div className="mx-auto w-full max-w-3xl sm:max-w-4xl">
        <p className="text-paragraph">
          Redirecting to <a href={to}>{to}</a>…
        </p>
      </div>
    </main>
  )
}

/**
 * Builds client-side redirect routes from `config.redirects`.
 *
 * Redirect sources are appended after the real routes so an existing page always
 * wins, and before the catch-all so a redirect is never shadowed by the 404.
 */
export function buildRedirectRoutes({
  config,
}: RedirectRouteOptions): RouteRecord[] {
  const map = buildRedirectMap(config)
  if (map.size === 0) return []

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([from, to]) => ({
      path: from,
      element: <RedirectBoundary to={to} />,
    }))
}

export type { RedirectConfig }
