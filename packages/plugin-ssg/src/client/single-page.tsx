import type { ReactElement, ReactNode } from 'react'
import type { ViteReactSSGClientOptions, ViteReactSSGContext } from '../types'
import type { RouterEntryModule } from '../router-contract'
import * as _helmet from 'react-helmet-async'
const { HelmetProvider } = _helmet
import { hydrate, render } from '../polyfill/react-helper'
import { documentReady } from '../utils/document-ready'
import { deserializeState } from '../utils/state'
export * from '../types'

export function ViteReactSSG(
  App: ReactNode,
  fn?: (context: ViteReactSSGContext<false>) => Promise<void> | void,
  options: ViteReactSSGClientOptions = {},
) {
  const {
    transformState,
    rootContainer = '#root',
    ssrWhenDev,
    getStyleCollector = null,
  } = options

  if (process.env.NODE_ENV === 'development' && ssrWhenDev !== undefined)
    console.warn(
      '[vite-react-ssg] `ssrWhenDev` option is no longer needed. If you want to use csr, just replace `vite-react-ssg dev` with `vite`.',
    )

  const isClient = typeof window !== 'undefined'

  async function createRoot(client = false, routePath?: string) {
    const appRenderCallbacks: Function[] = []
    const onSSRAppRendered = client
      ? () => {}
      : (cb: Function) => appRenderCallbacks.push(cb)
    const triggerOnSSRAppRendered = () => {
      return Promise.all(appRenderCallbacks.map((cb) => cb()))
    }
    const context: ViteReactSSGContext<false> = {
      isClient,
      onSSRAppRendered,
      triggerOnSSRAppRendered,
      initialState: {},
      transformState,
      routePath,
      getStyleCollector,
      routes: Array.isArray(App) ? App : (App as any)?.routes || [],
      routerOptions: undefined,
      base: '/',
      app: App,
      routerType: 'single-page',
    }
    ;(context as any).RouteRenderer = (App as any)?.RouteRenderer
    ;(context as any).matchRouteBranch = (App as any)?.matchRouteBranch
    ;(context as any).matchRouteBranchWithParams = (
      App as any
    )?.matchRouteBranchWithParams
    ;(context as any).resolveRouteBranch = (App as any)?.resolveRouteBranch

    if (client) {
      await documentReady()
      // @ts-expect-error global variable
      context.initialState =
        transformState?.(window.__INITIAL_STATE__ || {}) ||
        deserializeState(window.__INITIAL_STATE__)
    }

    await fn?.(context)

    const initialState = context.initialState

    return {
      ...context,
      initialState,
    } as ViteReactSSGContext<false>
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

      const context = await createRoot(true)
      window.__VITE_REACT_SSG_CONTEXT__ = context as any
      const routeApi = App as unknown as RouterEntryModule
      const RouteRenderer = routeApi.RouteRenderer
      const matchRouteBranch = routeApi.matchRouteBranch
      const resolveRouteBranch = routeApi.resolveRouteBranch
      const routesToRender =
        (App as any)?.routes || (Array.isArray(App) ? App : [])

      let app: ReactElement
      if (RouteRenderer && matchRouteBranch && resolveRouteBranch) {
        const initialBranch = matchRouteBranch(
          routesToRender,
          window.location.pathname,
        )
        // `resolveRouteBranch` returns cloned route records with their lazy
        // components attached. Keep that result for the first render: using
        // the original branch here makes RouteRenderer render an empty tree
        // during hydration while the SSR HTML is still on the page.
        const resolvedBranch = await resolveRouteBranch(initialBranch)

        app = (
          <HelmetProvider>
            <RouteRenderer
              routes={routesToRender}
              pathname={window.location.pathname}
              hasLoaderData={false}
              resolvedBranch={resolvedBranch}
            />
          </HelmetProvider>
        ) as ReactElement
      } else if (Array.isArray(App)) {
        throw new Error(
          'An array of routes requires RouteRenderer, matchRouteBranch, and resolveRouteBranch on the application entry',
        )
      } else {
        // Keep the generic @bdocs/ssg API usable with a normal ReactNode.
        // Boltdocs entries provide the route contract above; other apps can
        // still use ViteReactSSG as a plain SSR/hydration wrapper.
        app = <HelmetProvider>{App}</HelmetProvider>
      }
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
}

export { default as ClientOnly } from './components/client-only'
export { default as Head } from './components/head'
