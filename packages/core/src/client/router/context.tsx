import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import type { RouteMatch } from './types'
import { normalizeBasename, hasBasename, addBasename } from './utils'

// Lightweight access to the active locale from the global Boltdocs instance.
// LocationProvider lives above BoltdocsProvider in the tree, so we read the
// synced global instance instead of using the context hook.
function getActiveLocale(): string | undefined {
  if (typeof globalThis === 'undefined') return undefined
  const instance = (globalThis as Record<PropertyKey, unknown>)[
    Symbol.for('__BDOCS_BOLTDOCS_INSTANCE__')
  ]
  if (
    instance &&
    typeof instance === 'object' &&
    'currentLocale' in instance &&
    typeof instance.currentLocale === 'string'
  ) {
    return instance.currentLocale
  }

  // Fallback: read the same persisted preference used by BoltdocsProvider
  // when the global instance has not been mounted yet.
  if (typeof window === 'undefined') return undefined
  try {
    const raw = window.localStorage.getItem('boltdocs-user-preferences')
    if (!raw) return undefined
    const preferences = JSON.parse(raw) as { locale?: unknown }
    return typeof preferences.locale === 'string'
      ? preferences.locale
      : undefined
  } catch {
    // ignore storage errors and malformed preferences
    return undefined
  }
}

export interface LocationState {
  pathname: string
  search: string
  hash: string
}

export type PrefetchFunction = (to: string) => Promise<void>

export type NavigateFunction = (
  to: string,
  options?: {
    replace?: boolean
    state?: unknown
    /** Disable the router transition when an outer transition owns the update. */
    viewTransition?: boolean
  },
) => void

export const defaultNavigate: NavigateFunction = () => {}

const defaultLocation: LocationState = {
  pathname: '/',
  search: '',
  hash: '',
}

// Hoisted to globalThis so multiple Vite/Rolldown chunks share the same context
const g: Record<PropertyKey, unknown> =
  typeof globalThis !== 'undefined' ? globalThis : {}

function getGlobalContext<T>(key: string, create: () => T): T {
  const existing = g[key] as T | undefined
  if (existing) return existing
  const context = create()
  g[key] = context
  return context
}

export const LocationContext = getGlobalContext(
  '__BOLTDOCS_LOCATION_CONTEXT__',
  () => createContext<LocationState>(defaultLocation),
)

export const NavigateContext = getGlobalContext(
  '__BOLTDOCS_NAVIGATE_CONTEXT__',
  () => createContext<NavigateFunction>(defaultNavigate),
)

export const PrefetchContext = getGlobalContext(
  '__BOLTDOCS_PREFETCH_CONTEXT__',
  () => createContext<PrefetchFunction>(async () => {}),
)

export const RouteDataContext = getGlobalContext(
  '__BOLTDOCS_ROUTE_DATA_CONTEXT__',
  () => createContext<Record<string, unknown> | null>(null),
)

export const MatchesContext = getGlobalContext(
  '__BOLTDOCS_MATCHES_CONTEXT__',
  () => createContext<RouteMatch[]>([]),
)

export interface LocationProviderProps {
  pathname?: string
  children: React.ReactNode
  loaderData?: Record<string, unknown> | null
  matches?: RouteMatch[]
  /** Base path of the application. Only links under this path are handled as SPA navigation. */
  basename?: string
  /** Default locale is omitted from external URLs. */
  defaultLocale?: string
  /** Optional route prefetcher used by Link hover/focus interactions. */
  prefetch?: PrefetchFunction
  /** Enables the native View Transition API for route updates. */
  viewTransitions?: boolean | { enabled?: boolean; types?: string[] }
}

function normalizeComparablePath(pathname: string): string {
  if (pathname.length <= 1) return pathname || '/'
  return pathname.replace(/\/$/, '') || '/'
}

function dispatchNavigationStart(location: LocationState): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(
    new CustomEvent('boltdocs:navigation-start', {
      detail: location,
    }),
  )
}

function scheduleLocationUpdate(
  setLocation: React.Dispatch<React.SetStateAction<LocationState>>,
  nextLocation: LocationState,
  viewTransitions?: LocationProviderProps['viewTransitions'],
): void {
  // Move the render work out of the native click/popstate task. A normal
  // update on the next task is intentional here: unlike a transition, it
  // cannot remain pending behind a suspended MDX branch, and unlike an inline
  // update it does not block the browser's input event.
  setTimeout(() => {
    const enabled =
      typeof viewTransitions === 'boolean'
        ? viewTransitions
        : viewTransitions?.enabled === true
    const startViewTransition = (
      document as Document & {
        startViewTransition?: (options?: {
          update: () => void
          types?: string[]
        }) => unknown
      }
    ).startViewTransition

    if (enabled && startViewTransition) {
      const types =
        typeof viewTransitions === 'object' ? viewTransitions.types : undefined
      startViewTransition.call(document, {
        update: () => setLocation(nextLocation),
        ...(types?.length ? { types } : {}),
      })
      return
    }

    setLocation(nextLocation)
  }, 0)
}

function getLocationFromWindow(): LocationState {
  if (typeof window === 'undefined') return defaultLocation
  return {
    pathname: window.location.pathname || '/',
    search: window.location.search || '',
    hash: window.location.hash || '',
  }
}

export const LocationProvider: React.FC<LocationProviderProps> = ({
  pathname: propPathname,
  children,
  loaderData = null,
  matches = [],
  basename,
  defaultLocale,
  prefetch: prefetchProp,
  viewTransitions,
}) => {
  const [location, setLocation] = useState<LocationState>(() => {
    if (typeof window !== 'undefined') {
      return getLocationFromWindow()
    }
    return propPathname
      ? { pathname: propPathname, search: '', hash: '' }
      : defaultLocation
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      const nextLocation = getLocationFromWindow()
      scheduleLocationUpdate(setLocation, nextLocation, viewTransitions)
      dispatchNavigationStart(nextLocation)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [viewTransitions])
  const prefetched = useRef(new Set<string>())

  const fallbackPrefetch: PrefetchFunction = useCallback(async (to) => {
    if (typeof window === 'undefined' || !to || prefetched.current.has(to)) {
      return
    }
    prefetched.current.add(to)
  }, [])
  const prefetch = prefetchProp ?? fallbackPrefetch

  const navigate: NavigateFunction = useCallback(
    (to, options) => {
      if (typeof window === 'undefined') return
      if (!to) return

      const normalizedBasename = normalizeBasename(basename)

      // Absolute external / protocol-relative URLs: let the browser handle it
      if (/^https?:\/\//i.test(to) || to.startsWith('//')) {
        window.location.href = to
        return
      }

      // Anchor-only navigation: just update hash in place
      if (to.startsWith('#')) {
        const newUrl = new URL(to, window.location.href)
        const nextLocation = {
          pathname: window.location.pathname,
          search: window.location.search,
          hash: newUrl.hash,
        }
        if (
          nextLocation.pathname === window.location.pathname &&
          nextLocation.search === window.location.search &&
          nextLocation.hash === window.location.hash
        ) {
          if (options?.state !== undefined) {
            if (options.replace) {
              window.history.replaceState(options.state, '', newUrl.href)
            } else {
              window.history.pushState(options.state, '', newUrl.href)
            }
          }
          return
        }
        if (options?.replace) {
          window.history.replaceState(options.state ?? null, '', newUrl.href)
        } else {
          window.history.pushState(options?.state ?? null, '', newUrl.href)
        }
        scheduleLocationUpdate(
          setLocation,
          nextLocation,
          options?.viewTransition === false ? false : viewTransitions,
        )
        dispatchNavigationStart(nextLocation)
        return
      }

      const resolvedUrl = new URL(to, window.location.href)

      // External URLs fall back to a full page navigation
      if (resolvedUrl.origin !== window.location.origin) {
        window.location.href = to
        return
      }

      let finalPath =
        resolvedUrl.pathname + resolvedUrl.search + resolvedUrl.hash

      // If the link is outside the configured basename (e.g. an external page
      // like /about), do not force the basename onto it. Instead, preserve the
      // active locale prefix so that navigating from /es/about to /about keeps
      // the Spanish locale.
      if (
        normalizedBasename !== '/' &&
        !hasBasename(resolvedUrl.pathname, normalizedBasename)
      ) {
        const activeLocale = getActiveLocale()
        if (
          activeLocale &&
          defaultLocale &&
          activeLocale !== defaultLocale &&
          !finalPath.startsWith(`/${activeLocale}/`) &&
          finalPath !== `/${activeLocale}`
        ) {
          finalPath = `/${activeLocale}${finalPath === '/' ? '' : finalPath}`
        }
      } else if (normalizedBasename !== '/') {
        // Fallback: ensure the path lives under the configured basename.
        finalPath = addBasename(finalPath, normalizedBasename)
      }

      const finalUrl = new URL(finalPath, window.location.href)

      // A same-document navigation is a no-op. In particular, do not push a
      // duplicate history entry or notify every location consumer when a
      // localized link resolves to the page that is already displayed.
      if (
        normalizeComparablePath(finalUrl.pathname) ===
          normalizeComparablePath(window.location.pathname) &&
        finalUrl.search === window.location.search &&
        finalUrl.hash === window.location.hash
      ) {
        if (options?.state !== undefined) {
          if (options.replace) {
            window.history.replaceState(options.state, '', finalPath)
          } else {
            window.history.pushState(options.state, '', finalPath)
          }
        }
        return
      }

      if (options?.replace) {
        window.history.replaceState(options?.state ?? null, '', finalPath)
      } else {
        window.history.pushState(options?.state ?? null, '', finalPath)
      }

      const nextLocation = {
        pathname: finalUrl.pathname,
        search: finalUrl.search,
        hash: finalUrl.hash,
      }
      scheduleLocationUpdate(
        setLocation,
        nextLocation,
        options?.viewTransition === false ? false : viewTransitions,
      )
      dispatchNavigationStart(nextLocation)
    },
    [basename, defaultLocale, viewTransitions],
  )

  // Intercept internal <a> clicks for SPA navigation
  useEffect(() => {
    if (typeof window === 'undefined') return
    const normalizedBasename = normalizeBasename(basename)

    const handleClick = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.altKey ||
        e.ctrlKey ||
        e.shiftKey
      )
        return

      let target = e.target as HTMLElement | null
      while (target && target.nodeName !== 'A') {
        target = target.parentElement
      }
      if (!target || target.nodeName !== 'A') return

      const anchor = target as HTMLAnchorElement
      const href = anchor.getAttribute('href')
      if (
        !href ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download') ||
        href.startsWith('#')
      )
        return
      if (/^https?:\/\//i.test(href) || href.startsWith('//')) return

      // Intercept same-origin links. Links under the configured basename are
      // always handled via SPA. Links outside the basename are only intercepted
      // when the current page is also outside the basename (i.e. external pages),
      // so that static assets or API routes served from the docs area are not
      // accidentally captured.
      let resolvedPathname: string
      try {
        const resolved = new URL(href, document.baseURI || window.location.href)
        if (resolved.origin !== window.location.origin) return
        resolvedPathname = resolved.pathname
      } catch {
        return
      }

      const isUnderBasename =
        normalizedBasename === '/' ||
        hasBasename(resolvedPathname, normalizedBasename)
      const currentIsUnderBasename =
        normalizedBasename === '/' ||
        hasBasename(window.location.pathname, normalizedBasename)
      if (!isUnderBasename && currentIsUnderBasename) return

      e.preventDefault()
      navigate(href)
    }

    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [navigate, basename])

  return (
    <LocationContext.Provider value={location}>
      <NavigateContext.Provider value={navigate}>
        <PrefetchContext.Provider value={prefetch}>
          <RouteDataContext.Provider value={loaderData}>
            <MatchesContext.Provider value={matches}>
              {children}
            </MatchesContext.Provider>
          </RouteDataContext.Provider>
        </PrefetchContext.Provider>
      </NavigateContext.Provider>
    </LocationContext.Provider>
  )
}
