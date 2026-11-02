import React, {
  startTransition,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { RouteRecord, RouteRendererProps, LazyRouteResult } from './types'
import { LocationProvider, RouteDataContext } from './context'
import { Outlet, OutletContext } from './outlet'
import { useLocation } from './hooks'
import { hasBasename, normalizeBasename, stripBasename } from './utils'

export type { RouteRendererProps } from './types'

export function normalizePath(path: string): string {
  if (!path) return '/'
  const normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/')
  if (normalized.length > 1 && normalized.endsWith('/')) {
    return normalized.slice(0, -1)
  }
  return normalized
}

interface PathMatch {
  consumed: number
  exact: boolean
  wildcard: boolean
  params: Record<string, string>
}

export interface RouteBranchMatch {
  route: RouteRecord
  params: Record<string, string>
}

function splitRoutePath(path: string): string[] {
  return normalizePath(path)
    .replace(/^\//, '')
    .split('/')
    .filter((segment) => segment && segment !== '.')
}

interface PreparedRoute {
  route: RouteRecord
  segments: string[]
  score: number
  children?: PreparedRoute[]
}

// Matching runs during every render and navigation. Keep the expensive route
// path parsing/sorting outside that hot path while preserving invalidation when
// Vite replaces the route array during HMR.
const preparedRouteCache = new WeakMap<
  readonly RouteRecord[],
  PreparedRoute[]
>()
const routeMatchCache = new WeakMap<
  readonly RouteRecord[],
  Map<string, RouteBranchMatch[]>
>()
const routeSegmentsCache = new WeakMap<RouteRecord, string[]>()

function getRouteSegments(route: RouteRecord): string[] {
  let segments = routeSegmentsCache.get(route)
  if (!segments) {
    segments = route.path ? splitRoutePath(route.path) : []
    routeSegmentsCache.set(route, segments)
  }
  return segments
}

function getPreparedRoutes(routes: readonly RouteRecord[]): PreparedRoute[] {
  const cached = preparedRouteCache.get(routes)
  if (cached) return cached

  const prepared = routes
    .map((route, index) => ({
      route,
      index,
      segments: getRouteSegments(route),
      score: routeScore(route),
      children: route.children ? getPreparedRoutes(route.children) : undefined,
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ route, segments, score, children }) => ({
      route,
      segments,
      score,
      children,
    }))

  preparedRouteCache.set(routes, prepared)
  return prepared
}

function matchRoutePath(
  preparedRoute: PreparedRoute,
  target: string[],
): PathMatch | null {
  const route = preparedRoute.route
  if (route.index || route.path === '' || route.path === '.') {
    return target.length === 0
      ? { consumed: 0, exact: true, wildcard: false, params: {} }
      : null
  }

  if (!route.path) {
    return {
      consumed: 0,
      exact: !route.children?.length && target.length === 0,
      wildcard: false,
      params: {},
    }
  }

  const routeSegments = preparedRoute.segments
  if (routeSegments.length === 0) {
    return target.length === 0
      ? { consumed: 0, exact: true, wildcard: false, params: {} }
      : null
  }

  let consumed = 0
  const params: Record<string, string> = {}
  for (const segment of routeSegments) {
    if (segment === '*') {
      params['*'] = target.slice(consumed).join('/')
      return {
        consumed: target.length,
        exact: true,
        wildcard: true,
        params,
      }
    }

    const targetSegment = target[consumed]
    if (targetSegment === undefined) return null
    if (segment.startsWith(':')) {
      params[segment.slice(1)] = targetSegment
    } else if (segment !== targetSegment) {
      return null
    }
    consumed++
  }

  return {
    consumed,
    exact: consumed === target.length,
    wildcard: false,
    params,
  }
}

function routeScore(route: RouteRecord): number {
  if (route.index || route.path === '' || route.path === '.') return 1000
  if (route.path === '*') return -1000
  if (!route.path) return 0

  return splitRoutePath(route.path).reduce((score, segment) => {
    if (segment === '*') return score - 100
    if (segment.startsWith(':')) return score + 10
    return score + 100
  }, 0)
}

function matchRouteBranchInternal(
  routes: readonly PreparedRoute[],
  target: string[],
): RouteBranchMatch[] {
  for (const preparedRoute of routes) {
    const route = preparedRoute.route
    const match = matchRoutePath(preparedRoute, target)
    if (!match) continue

    const remaining = target.slice(match.consumed)
    if (preparedRoute.children?.length) {
      const childBranch = matchRouteBranchInternal(
        preparedRoute.children,
        remaining,
      )
      if (childBranch.length > 0) {
        return [
          { route, params: match.params },
          ...childBranch.map((child) => ({
            route: child.route,
            params: { ...match.params, ...child.params },
          })),
        ]
      }
      if (!match.exact) continue
    }

    if (match.exact || match.wildcard) {
      return [{ route, params: match.params }]
    }
  }

  return []
}

function getTargetSegments(pathname: string, basename?: string): string[][] {
  const normalizedPathname = normalizePath(pathname)
  const targets = [splitRoutePath(normalizedPathname)]
  const normalizedBasename = normalizeBasename(basename)

  if (
    normalizedBasename !== '/' &&
    hasBasename(normalizedPathname, normalizedBasename)
  ) {
    targets.push(
      splitRoutePath(stripBasename(normalizedPathname, normalizedBasename)),
    )
  }

  return targets
}

export function matchRouteBranchWithParams(
  routes: RouteRecord[],
  pathname: string,
  basename?: string,
): RouteBranchMatch[] {
  const cacheKey = `${normalizePath(pathname)}\u0000${normalizeBasename(basename)}`
  let matches = routeMatchCache.get(routes)
  if (!matches) {
    matches = new Map()
    routeMatchCache.set(routes, matches)
  }
  const cached = matches.get(cacheKey)
  if (cached) return cached

  const preparedRoutes = getPreparedRoutes(routes)
  for (const target of getTargetSegments(pathname, basename)) {
    const branch = matchRouteBranchInternal(preparedRoutes, target)
    if (branch.length > 0) {
      cacheRouteEntry(matches, cacheKey, branch)
      return branch
    }
  }

  cacheRouteEntry(matches, cacheKey, [])
  return []
}

export function matchRouteBranch(
  routes: RouteRecord[],
  pathname: string,
  basename?: string,
): RouteRecord[] {
  return matchRouteBranchWithParams(routes, pathname, basename).map(
    (match) => match.route,
  )
}

// Cache resolved lazy results per route object so we never run the same lazy()
// more than once, and so we don't have to mutate the original route tree.
const resolvedLazyCache = new WeakMap<RouteRecord, LazyRouteResult>()
const pendingLazyCache = new WeakMap<RouteRecord, Promise<LazyRouteResult>>()
const routeCacheScopes = new WeakMap<readonly RouteRecord[], number>()
let nextRouteCacheScope = 0
const prefetchCache = new Map<string, Promise<void>>()
const loaderDataCache = new Map<string, Promise<Record<string, unknown>>>()
const MAX_ROUTE_CACHE_ENTRIES = 128
const MAX_ACTIVE_PREFETCHES = 2
const MAX_PENDING_PREFETCHES = 16
const ROUTE_RESOLUTION_TIMEOUT_MS = 4500
const ROUTE_LOADER_TIMEOUT_MS = 4500
const PREFETCH_SKIPPED = Symbol('prefetch-skipped')

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

type PrefetchQueue = {
  enqueue: (run: () => Promise<void>) => Promise<void> | typeof PREFETCH_SKIPPED
  clear: () => void
}

function createPrefetchQueue(): PrefetchQueue {
  let activePrefetches = 0
  const pendingPrefetches: Array<{
    run: () => Promise<void>
    resolve: () => void
    reject: (error: unknown) => void
  }> = []

  const drain = () => {
    while (
      activePrefetches < MAX_ACTIVE_PREFETCHES &&
      pendingPrefetches.length > 0
    ) {
      const task = pendingPrefetches.shift()
      if (!task) break
      activePrefetches++
      task
        .run()
        .then(task.resolve, task.reject)
        .finally(() => {
          activePrefetches--
          drain()
        })
    }
  }

  return {
    enqueue(run) {
      // Hover is opportunistic work. Once the queue is full, skip the request
      // instead of retaining stale route closures. Navigation resolves routes.
      if (pendingPrefetches.length >= MAX_PENDING_PREFETCHES) {
        return PREFETCH_SKIPPED
      }

      return new Promise((resolve, reject) => {
        pendingPrefetches.push({ run, resolve, reject })
        drain()
      })
    },
    clear() {
      // Resolve queued work so callers do not retain rejected/unsettled
      // promises after this renderer is replaced by a navigation/HMR update.
      for (const task of pendingPrefetches.splice(0)) task.resolve()
    },
  }
}

function getRouteCacheScope(routes: readonly RouteRecord[]): number {
  let scope = routeCacheScopes.get(routes)
  if (scope === undefined) {
    scope = ++nextRouteCacheScope
    routeCacheScopes.set(routes, scope)
  }
  return scope
}

function cacheRouteEntry<T>(
  cache: Map<string, T>,
  key: string,
  value: T,
): void {
  if (cache.size >= MAX_ROUTE_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  cache.set(key, value)
}

export async function resolveRouteBranch(
  branch: RouteRecord[],
): Promise<RouteRecord[]> {
  const resolved: RouteRecord[] = []
  for (const route of branch) {
    if (!route.element && !route.Component && route.lazy) {
      try {
        let result = resolvedLazyCache.get(route)
        if (!result) {
          let pending = pendingLazyCache.get(route)
          if (!pending) {
            pending = route.lazy()
            pendingLazyCache.set(route, pending)
          }
          try {
            result = await withTimeout(
              pending,
              ROUTE_RESOLUTION_TIMEOUT_MS,
              'Timed out while loading a documentation route',
            )
          } finally {
            // A rejected lazy import must be retryable after a transient
            // chunk/network failure; never pin its rejected promise forever.
            pendingLazyCache.delete(route)
          }
          resolvedLazyCache.set(route, result)
        }
        resolved.push({ ...route, ...result })
        continue
      } catch (err) {
        console.error('[RouteRenderer] Error resolving lazy route:', err)
      }
    }
    resolved.push(route)
  }
  return resolved
}

function asLoaderData(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function getLoaderDataKey(
  routeScope: number,
  pathname: string,
  search = '',
): string {
  return `${routeScope}:${pathname}${search}`
}

function loadRouteData(
  key: string,
  matches: RouteBranchMatch[],
  resolvedBranch: RouteRecord[],
  request: Request,
): Promise<Record<string, unknown>> {
  const cached = loaderDataCache.get(key)
  if (cached) {
    return cached
  }

  const pending = withTimeout(
    Promise.all(
      resolvedBranch.map(async (route, index) => {
        if (!route?.loader) return null
        try {
          return asLoaderData(
            await route.loader({
              request,
              params: matches[index].params,
            }),
          )
        } catch (err) {
          console.error('[RouteRenderer] loader error:', err)
          throw err
        }
      }),
    ).then((values) => {
      const merged: Record<string, unknown> = {}
      for (const value of values) {
        if (value) Object.assign(merged, value)
      }
      return merged
    }),
    ROUTE_LOADER_TIMEOUT_MS,
    'Timed out while loading documentation data',
  )

  cacheRouteEntry(loaderDataCache, key, pending)
  pending.catch(() => loaderDataCache.delete(key))
  return pending
}

function RouteContent({
  routes,
  initialPathname,
  resolvedBranch: initialResolvedBranch,
  basename,
  hasLoaderData,
}: {
  routes: RouteRecord[]
  initialPathname?: string
  resolvedBranch?: RouteRecord[]
  basename?: string
  hasLoaderData?: boolean
}) {
  const location = useLocation()
  const currentPathname = location.pathname || initialPathname || '/'
  const currentSearch = location.search || ''
  const currentHash = location.hash || ''
  const routeMatches = useMemo(
    () => matchRouteBranchWithParams(routes, currentPathname, basename),
    [routes, currentPathname, basename],
  )
  const matchedBranch = useMemo(
    () => routeMatches.map((match) => match.route),
    [routeMatches],
  )
  const isFirstRenderRef = useRef(true)
  const isInitialNavigation =
    currentPathname === initialPathname && isFirstRenderRef.current
  const usesInitialResolvedBranch =
    !!initialResolvedBranch && isInitialNavigation
  const initialBranch = useMemo(
    () => (usesInitialResolvedBranch ? initialResolvedBranch : matchedBranch),
    [matchedBranch, usesInitialResolvedBranch, initialResolvedBranch],
  )
  const initialLoaderData = asLoaderData(use(RouteDataContext))
  // The provider's loader data belongs to the initial SSR URL only. Reusing it
  // for later navigations makes every route with a loader appear already ready,
  // which skips lazy MDX resolution and can leave the new page in a half-built
  // branch. Returning to the initial URL is intentionally treated as a normal
  // navigation after the first committed render.
  const initialDataAvailable = isInitialNavigation && hasLoaderData === true
  const needsAsyncWork = initialBranch.some(
    (route) =>
      (!usesInitialResolvedBranch &&
        !route.element &&
        !route.Component &&
        !!route.lazy) ||
      (!!route.loader && !initialDataAvailable),
  )
  const routeScope = getRouteCacheScope(routes)
  const navigationKey = `${routeScope}\u0000${currentPathname}\u0000${currentSearch}`

  const outerData = initialDataAvailable ? initialLoaderData : null
  const outerDataRef = useRef(outerData)
  outerDataRef.current = outerData
  const navigationIdRef = useRef(0)
  const committedNavigationRef = useRef('')

  const [resolved, setResolved] = useState<{
    branch: RouteRecord[]
    key: string
    pathname: string
    search: string
    loaderData: Record<string, unknown> | null
  } | null>(
    !needsAsyncWork
      ? {
          branch: initialBranch,
          key: navigationKey,
          pathname: currentPathname,
          search: currentSearch,
          loaderData: outerData,
        }
      : null,
  )

  // Async work is scoped to one URL. Without this explicit key, a resolved
  // branch can be mistaken for an unresolved branch during a subsequent
  // render, causing the loader/lazy effect to commit the same navigation over
  // and over again under React StrictMode and HMR.
  const routeNeedsAsyncWork = needsAsyncWork && resolved?.key !== navigationKey

  useEffect(() => {
    isFirstRenderRef.current = false
  }, [])

  useEffect(() => {
    if (!routeNeedsAsyncWork) return

    const navigationId = ++navigationIdRef.current
    let cancelled = false
    const matches = routeMatches
    const branch = matchedBranch
    const requestUrl =
      typeof window !== 'undefined'
        ? new URL(`${currentPathname}${currentSearch}`, window.location.origin)
            .href
        : `http://localhost${currentPathname}${currentSearch}`

    resolveRouteBranch(branch)
      .then(async (resolvedBranch) => {
        if (cancelled || navigationId !== navigationIdRef.current) return

        let loaderData: Record<string, unknown>
        try {
          loaderData = await loadRouteData(
            getLoaderDataKey(routeScope, currentPathname, currentSearch),
            matches,
            resolvedBranch,
            new Request(requestUrl),
          )
        } catch {
          loaderData = {
            ...(outerDataRef.current || {}),
            __loaderError: true,
          }
        }

        if (cancelled || navigationId !== navigationIdRef.current) return
        startTransition(() => {
          setResolved({
            branch: resolvedBranch,
            key: navigationKey,
            pathname: currentPathname,
            search: currentSearch,
            loaderData,
          })
        })
      })
      .catch((error) => {
        if (cancelled || navigationId !== navigationIdRef.current) return
        console.warn('[RouteRenderer] navigation error:', error)
        startTransition(() => {
          setResolved({
            branch,
            key: navigationKey,
            pathname: currentPathname,
            search: currentSearch,
            loaderData: {
              ...(outerDataRef.current || {}),
              __routeError: true,
            },
          })
        })
      })
    return () => {
      cancelled = true
    }
  }, [
    currentPathname,
    currentSearch,
    routeMatches,
    matchedBranch,
    routeNeedsAsyncWork,
    navigationKey,
    routeScope,
  ])

  const hasResolvedCurrentRoute = resolved?.key === navigationKey
  const hasRenderableBranch = useCallback(
    (candidate: RouteRecord[]) =>
      candidate.some((route) => route.element || route.Component),
    [],
  )
  const previousBranch = resolved?.branch
  // The last branch that actually produced DOM. Kept in a ref so a navigation
  // to a lazy route never flashes a blank page: while the new branch resolves
  // we keep rendering the previous page instead of falling back to the raw
  // matched (unresolved) branch.
  const lastRenderableBranchRef = useRef<RouteRecord[]>([])
  const branch = usesInitialResolvedBranch
    ? hasResolvedCurrentRoute
      ? resolved.branch
      : initialBranch
    : !routeNeedsAsyncWork || hasResolvedCurrentRoute
      ? hasResolvedCurrentRoute
        ? resolved.branch
        : initialBranch
      : hasRenderableBranch(previousBranch || [])
        ? previousBranch || []
        : hasRenderableBranch(lastRenderableBranchRef.current)
          ? lastRenderableBranchRef.current
          : matchedBranch

  // Persist the last renderable branch once the current route is committed.
  if (hasResolvedCurrentRoute && hasRenderableBranch(branch)) {
    lastRenderableBranchRef.current = branch
  }

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Commit only after the current branch is renderable. Navigation-start is
    // emitted by LocationProvider immediately; route-commit is deliberately
    // later so hash scrolling and analytics observe the destination DOM.
    const commitKey = `${currentPathname}${currentSearch}${currentHash}`
    if (committedNavigationRef.current === commitKey) return
    if (routeNeedsAsyncWork && !hasResolvedCurrentRoute) return
    if (!hasRenderableBranch(branch)) return

    committedNavigationRef.current = commitKey
    window.dispatchEvent(
      new CustomEvent('boltdocs:route-commit', {
        detail: {
          pathname: currentPathname,
          search: currentSearch,
          hash: currentHash,
        },
      }),
    )
  }, [
    branch,
    currentHash,
    currentPathname,
    currentSearch,
    hasRenderableBranch,
    hasResolvedCurrentRoute,
    routeNeedsAsyncWork,
  ])

  if (branch.length === 0) return null

  let currentElement: React.ReactNode = null

  for (let i = branch.length - 1; i >= 0; i--) {
    const route = branch[i]
    let element = route.element

    if (!element && route.Component) {
      const Comp = route.Component
      const componentKey =
        route.path ??
        `${route.index ? 'index' : 'route'}-${route.locale ?? 'none'}`
      element = <Comp key={componentKey} />
    }

    if (!element) continue

    if (currentElement === null) {
      currentElement = element
    } else {
      let wrappedElement = element
      if (React.isValidElement(element)) {
        const el = element as React.ReactElement<{
          children?: React.ReactNode
        }>
        const existingChildren = el.props.children
        wrappedElement = React.cloneElement(el, {
          children: existingChildren ?? <Outlet />,
        })
      }
      currentElement = (
        <OutletContext.Provider value={currentElement}>
          {wrappedElement}
        </OutletContext.Provider>
      )
    }
  }

  const finalData =
    hasResolvedCurrentRoute && resolved.loaderData
      ? resolved.loaderData
      : outerData

  return (
    <RouteDataContext.Provider value={finalData}>
      {currentElement}
    </RouteDataContext.Provider>
  )
}

export const RouteRenderer: React.FC<RouteRendererProps> = ({
  routes,
  pathname,
  loaderData,
  resolvedBranch,
  basename,
  defaultLocale,
  hasLoaderData = false,
  prefetch: prefetchProp,
  viewTransitions,
}) => {
  const prefetchQueueRef = useRef<PrefetchQueue | null>(null)
  if (!prefetchQueueRef.current) {
    prefetchQueueRef.current = createPrefetchQueue()
  }
  const prefetchQueue = prefetchQueueRef.current

  useEffect(() => {
    return () => prefetchQueue.clear()
  }, [prefetchQueue])

  const prefetch = useCallback(
    async (to: string) => {
      if (typeof window === 'undefined' || !to) return

      const target = new URL(to, window.location.href)
      if (target.origin !== window.location.origin || target.hash) return

      const key = `${getRouteCacheScope(routes)}:${target.pathname}${target.search}`
      const cached = prefetchCache.get(key)
      if (cached) return cached

      const pending = prefetchQueue.enqueue(async () => {
        const matches = matchRouteBranchWithParams(
          routes,
          target.pathname,
          basename,
        )
        if (matches.length === 0) return

        const branch = await resolveRouteBranch(
          matches.map((match) => match.route),
        )
        await loadRouteData(
          getLoaderDataKey(
            getRouteCacheScope(routes),
            target.pathname,
            target.search,
          ),
          matches,
          branch,
          new Request(target.href),
        )
      })

      if (pending === PREFETCH_SKIPPED) return
      cacheRouteEntry(prefetchCache, key, pending)
      try {
        await pending
      } catch (error) {
        prefetchCache.delete(key)
        throw error
      }
    },
    [routes, basename, prefetchQueue],
  )

  return (
    <LocationProvider
      pathname={pathname}
      loaderData={loaderData}
      basename={basename}
      defaultLocale={defaultLocale}
      prefetch={prefetchProp || prefetch}
      viewTransitions={viewTransitions}
    >
      <RouteContent
        routes={routes}
        initialPathname={pathname}
        resolvedBranch={resolvedBranch}
        basename={basename}
        hasLoaderData={hasLoaderData}
      />
    </LocationProvider>
  )
}
