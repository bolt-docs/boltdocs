import type {
  RouteRecord,
  RouterOptions,
  ViteReactSSGClientOptions,
  ViteReactSSGContext,
} from '../types'
import * as _helmet from 'react-helmet-async'
const { HelmetProvider } = _helmet
import {
  createBrowserRouter,
  matchRoutes,
  RouterProvider,
} from 'react-router-dom'
import { hydrate, render } from '../pollfill/react-helper'
import { documentReady } from '../utils/document-ready'
import { joinUrlSegments, withLeadingSlash } from '../utils/path'
import { convertRoutesToDataRoutes } from '../utils/remix-router'
import { deserializeState } from '../utils/state'

export * from '../types'

const sessionTimestamp = Date.now()

/**
 * Ensures the hydration data is a plain object before passing it to
 * createBrowserRouter. If the server-side serialisation produced garbage
 * (e.g. a string instead of an object due to double-JSON.stringify bugs),
 * we return undefined rather than letting React Router choke on invalid data.
 * An undefined hydrationData is safer than a malformed one — the router will
 * still run its loaders, but at least it won't crash or misbehave silently.
 */
function sanitizeHydrationData(
  data: unknown,
): { loaderData?: Record<string, unknown>; actionData?: unknown; errors?: unknown } | undefined {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined
  return data as { loaderData?: Record<string, unknown>; actionData?: unknown; errors?: unknown }
}

export function ViteReactSSG(
  routerOptions: RouterOptions,
  fn?: (context: ViteReactSSGContext<true>) => Promise<void> | void,
  options: ViteReactSSGClientOptions = {},
) {
  const {
    transformState,
    rootContainer = '#root',
    ssrWhenDev,
    getStyleCollector = null,
  } = options

  if (process.env.NODE_ENV === 'development' && ssrWhenDev !== undefined) {
    console.warn(
      '[vite-react-ssg] `ssrWhenDev` option is no longer needed. If you want to use csr, just replace `vite-react-ssg dev` with `vite`.',
    )
  }

  const isClient = typeof window !== 'undefined'

  const BASE_URL = routerOptions.basename ?? '/'
  const { v7_startTransition = true, ...routerFeature } =
    routerOptions.future ?? {}

  async function createRoot(client = false, routePath?: string) {
    const createRouter = routerOptions.customCreateRouter ?? createBrowserRouter
    const browserRouter = client
      ? createRouter(
          convertRoutesToDataRoutes(
            routerOptions.routes,
            transformStaticLoaderRoute,
          ),
          {
            basename: BASE_URL === '/' ? undefined : BASE_URL,
            future: routerFeature,
            // Pre-populate the router's loader-data cache with what the server
            // already rendered. Without this, React Router starts empty and runs
            // all loaders asynchronously before the first paint, producing a
            // client vDOM that differs from the SSR HTML → hydration mismatch
            // → React 19 renders both trees simultaneously → visual duplication.
            hydrationData: sanitizeHydrationData(
              window.__staticRouterHydrationData,
            ),
          },
        )
      : undefined

    const appRenderCallbacks: Function[] = []
    const onSSRAppRendered = client
      ? () => {}
      : (cb: Function) => appRenderCallbacks.push(cb)
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map((cb) => cb()))
    }
    const context: ViteReactSSGContext<true> = {
      isClient,
      routes: routerOptions.routes,
      router: browserRouter,
      routerOptions,
      onSSRAppRendered,
      triggerOnSSRAppRendered,
      initialState: {},
      transformState,
      routePath,
      base: BASE_URL,
      getStyleCollector,
      routerType: 'remix',
    }

    if (client) {
      await documentReady()
      // @ts-expect-error global variable
      context.initialState =
        transformState?.(window.__INITIAL_STATE__ || {}) ||
        deserializeState(window.__INITIAL_STATE__)
    }

    await fn?.(context)

    if (!client) {
      // const route = context.routePath ?? '/'
      // context.initialState = {} // TODO:
    }

    const initialState = context.initialState

    return {
      ...context,
      initialState,
    } as ViteReactSSGContext<true>
  }

  if (isClient) {
    ;(async () => {
      const container =
        typeof rootContainer === 'string'
          ? document.querySelector(rootContainer)
          : rootContainer

      if (!container) {
        // @ts-expect-error global variable
        if (typeof $jsdom === 'undefined')
          console.warn('[vite-react-ssg] Root container not found.')
        return
      }

      const lazeMatches = matchRoutes(
        routerOptions.routes,
        window.location,
      )?.filter((m) => m.route.lazy)

      // Load the lazy matches and update the routes before creating your router
      // so we can hydrate the SSR-rendered content synchronously
      if (lazeMatches && lazeMatches?.length > 0) {
        await Promise.all(
          lazeMatches.map(async (m) => {
            const routeModule = await m.route.lazy!()
            Object.assign(m.route, { ...routeModule, lazy: undefined })
          }),
        )
      }

      const context = await createRoot(true)
      window.__VITE_REACT_SSG_CONTEXT__ = context

      const { router } = context

      const app = (
        <HelmetProvider>
          <RouterProvider router={router!} />
        </HelmetProvider>
      )
      const isSSR =
        document.querySelector('[data-server-rendered=true]') !== null
      if (!isSSR && process.env.NODE_ENV === 'development') {
        render(app, container, options)
      } else {
        hydrate(app, container, options)
      }
    })()
  }

  return createRoot

  function transformStaticLoaderRoute(route: RouteRecord) {
    const isSSR = document.querySelector('[data-server-rendered=true]') !== null
    if (!isSSR) {
      return route
    }

    // CRITICAL: Only wrap routes that already have a loader defined.
    //
    // React Router v7 initializes with `hydrationData` and marks the router as
    // `initialized = true`. However, if any matched route has a loader but its
    // route ID is absent from `hydrationData.loaderData`, React Router detects
    // "loader without pre-fetched data" and re-runs the full navigation cycle.
    //
    // Before this guard, `transformStaticLoaderRoute` was adding a static-data
    // fetcher to EVERY route — including layout routes like BoltdocsShell and
    // DocsLayout that have no original loader. Those newly-added loaders had no
    // corresponding entries in `hydrationData`, so React Router re-navigated on
    // every hydration. The resulting asynchronous re-render produced a client
    // vDOM that differed from the server-rendered HTML, causing React 19 to
    // render both trees simultaneously → visual page duplication on refresh.
    if (!route.loader) {
      return route
    }

    const originalLoader = route.loader

    route.loader = async (args) => {
      const { request } = args
      if (process.env.NODE_ENV === 'development') {
        const routeId = encodeURIComponent(route.id!)
        const dataQuery = `_data=${routeId}`
        const url = request.url.includes('?')
          ? `${request.url}&${dataQuery}`
          : `${request.url}?${dataQuery}`
        return fetch(url)
      } else {
        const { url } = request
        let { pathname } = new URL(url)
        if (pathname !== '/' && pathname.endsWith('/')) {
          pathname = pathname.slice(0, -1)
        }

        if (!window.__VITE_REACT_SSG_STATIC_LOADER_DATA__) {
          window.__VITE_REACT_SSG_STATIC_LOADER_DATA__ = {}
        }

        if (window.__VITE_REACT_SSG_STATIC_LOADER_DATA__[pathname]) {
          const routeData =
            window.__VITE_REACT_SSG_STATIC_LOADER_DATA__[pathname]?.[route.id!]
          return routeData ?? originalLoader(args)
        }

        if (!window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__) {
          const manifestUrl = joinUrlSegments(
            BASE_URL,
            `static-loader-data-manifest-${window.__VITE_REACT_SSG_HASH__}.json`,
          )
          try {
            const response = await fetch(
              `${withLeadingSlash(manifestUrl)}?t=${sessionTimestamp}`,
            )
            if (response.ok) {
              window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__ = await response.json()
            } else {
              console.error(
                `[vite-react-ssg] Failed to fetch static loader manifest: ${response.status} ${response.statusText}`,
              )
              window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__ = {}
            }
          } catch (error) {
            console.error(
              '[vite-react-ssg] Error loading static loader manifest:',
              error,
            )
            window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__ = {}
          }
        }

        const manifest = window.__VITE_REACT_SSG_STATIC_LOADER_MANIFEST__
        const dataFilePath = manifest?.[pathname]

        if (!dataFilePath) {
          return originalLoader(args)
        }

        if (!window.__VITE_REACT_SSG_STATIC_LOADER_DATA__[pathname]) {
          const dataUrl = joinUrlSegments(BASE_URL, dataFilePath)
          try {
            const response = await fetch(
              `${withLeadingSlash(dataUrl)}?t=${sessionTimestamp}`,
            )
            if (response.ok) {
              window.__VITE_REACT_SSG_STATIC_LOADER_DATA__[pathname] = await response.json()
            } else {
              console.error(
                `[vite-react-ssg] Failed to fetch loader data for ${pathname}: ${response.status} ${response.statusText}`,
              )
              window.__VITE_REACT_SSG_STATIC_LOADER_DATA__[pathname] = {}
            }
          } catch (error) {
            console.error(
              '[vite-react-ssg] Error loading loader data for',
              pathname,
              error,
            )
            window.__VITE_REACT_SSG_STATIC_LOADER_DATA__[pathname] = {}
          }
        }

        const routeData =
          window.__VITE_REACT_SSG_STATIC_LOADER_DATA__[pathname]?.[route.id!]
        return routeData ?? originalLoader(args)
      }
    }
    return route
  }
}

declare global {
  interface Window {
    /** Manifest index: route path -> data file path */
    __VITE_REACT_SSG_STATIC_LOADER_MANIFEST__: Record<string, string>
    /** Cached loader data: route path -> loader data */
    __VITE_REACT_SSG_STATIC_LOADER_DATA__: Record<
      string,
      Record<string, unknown>
    >
    __VITE_REACT_SSG_HASH__: string
    __VITE_REACT_SSG_CONTEXT__: ViteReactSSGContext<true>
    /**
     * Injected by the SSG build into every page's <head>.
     * Contains the React Router static handler context (loaderData, actionData,
     * errors) produced during server-side rendering of that page.
     * Passed as `hydrationData` to createBrowserRouter so the client router
     * starts with the correct loader data without re-fetching anything.
     */
    __staticRouterHydrationData?: {
      loaderData?: Record<string, unknown>
      actionData?: Record<string, unknown> | null
      errors?: Record<string, unknown> | null
    }
  }
}

export { default as ClientOnly } from './components/client-only'
export { default as Head } from './components/head'
