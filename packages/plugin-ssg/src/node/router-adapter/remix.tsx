import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FilledContext } from 'react-helmet-async'
import type { LoaderFunction, LoaderFunctionArgs } from 'react-router-dom'
import type { StaticHandlerContext } from 'react-router-dom'
import type { Connect } from 'vite'
import type { IRouterAdapter } from './interface'
import type { ViteReactSSGContext } from '~/types'
// Use the HelmetProvider from helmet-compat.tsx's globalThis bridge to ensure
// the same React context as the bundled ESM react-helmet-async instance.
// Without this, require('react-helmet-async') loads a separate CJS module with
// its own React.createContext(), and Helmet can't find the provider context.
// We read at render time (not module load time) because the entry module body
// sets the globalThis bridge AFTER externalized modules have loaded.
let _cachedHelmetProvider: any = null
function getHelmetProvider() {
  if (_cachedHelmetProvider) return _cachedHelmetProvider
  _cachedHelmetProvider =
    (globalThis as any).__BOLTDOCS_HELMET_PROVIDER__ ||
    (() => {
      const { createRequire } =
        require('node:module') as typeof import('node:module')
      const _require = createRequire(import.meta.url)
      return _require('react-helmet-async').HelmetProvider
    })()
  return _cachedHelmetProvider
}
import {
  fromNodeRequest,
  stripDataParam,
  toNodeRequest,
} from '~/polyfill/node-adapter'
import { withLeadingSlash } from '~/utils/path'
import { convertRoutesToDataRoutes } from '~/utils/remix-router'
import { renderStaticApp } from '../serverRenderer'
import { extractHelmet } from './utils'

// Hoist react-router-dom imports to module scope (avoid per-page dynamic import)
let _reactRouterDom: typeof import('react-router-dom') | null = null

async function getReactRouterDom() {
  if (!_reactRouterDom) {
    _reactRouterDom = await import('react-router-dom')
  }
  return _reactRouterDom
}

export class RemixAdapter implements IRouterAdapter<ViteReactSSGContext> {
  context: ViteReactSSGContext<true>
  private _dataRoutes: ReturnType<typeof convertRoutesToDataRoutes> | null =
    null
  private _staticHandler: {
    query: (request: Request) => Promise<unknown>
  } | null = null
  constructor(context: ViteReactSSGContext) {
    this.context = context
  }

  async render(path: string) {
    const { base, routes, getStyleCollector, routerOptions } = this.context
    const leading = withLeadingSlash(path)
    let fullPath = leading
    if (base !== '/') {
      const prefix = withLeadingSlash(base).replace(/\/$/, '')
      if (!leading.startsWith(prefix + '/') && leading !== prefix) {
        fullPath = `${prefix}${leading}`
      }
    }
    const fetchUrl = `http://localhost${fullPath}`
    const request = new Request(fetchUrl)
    const styleCollector = getStyleCollector ? await getStyleCollector() : null
    const helmetContext = {} as FilledContext
    let routerContext: StaticHandlerContext | null = null
    const { StaticRouterProvider, createStaticHandler, createStaticRouter } =
      await getReactRouterDom()
    const dataRoutes = (this._dataRoutes ??= convertRoutesToDataRoutes(
      [...routes],
      (route) => route,
    ))
    this._staticHandler ??= createStaticHandler(dataRoutes, { basename: base })
    const { query } = this._staticHandler
    let _context = await query(request)

    // Follow redirects (e.g., /docs -> /docs/guides) during SSR
    let redirectCount = 0
    const maxRedirects = 10
    while (_context instanceof Response && redirectCount < maxRedirects) {
      const location = _context.headers.get('Location')
      if (!location) break

      let nextUrl: string
      if (/^https?:\/\//i.test(location)) {
        try {
          const parsedLoc = new URL(location)
          if (parsedLoc.hostname === 'localhost' || parsedLoc.hostname === '') {
            nextUrl = `http://localhost${withLeadingSlash(parsedLoc.pathname + parsedLoc.search + parsedLoc.hash)}`
          } else {
            break
          }
        } catch {
          break
        }
      } else {
        nextUrl = `http://localhost${withLeadingSlash(location)}`
      }

      _context = await query(new Request(nextUrl))
      redirectCount++
    }

    if (_context instanceof Response) throw _context

    routerContext = _context
    const router = createStaticRouter(dataRoutes, routerContext, {
      future: routerOptions.future,
    })
    const HP = getHelmetProvider()

    // Force canUseDOM = false on HelmetProvider so react-helmet-async uses
    // server-side state mapping and populates helmetContext.helmet. Without
    // this, HelmetData skips server-side extraction and htmlAttributes/bodyAttributes
    // come back as null. We set it directly here instead of relying on
    // helmet-compat.tsx's __BOLTDOCS_SSG_RENDERING__ check because that check
    // runs at module load time (before the flag is set).
    const hpAny = HP as any
    if (hpAny && typeof hpAny === 'function') {
      hpAny.canUseDOM = false
    }

    let app = (
      <HP context={helmetContext}>
        <StaticRouterProvider router={router} context={routerContext} />
      </HP>
    )

    if (styleCollector) app = styleCollector.collect(app)

    const appHTML = await renderStaticApp(app)

    const { htmlAttributes, bodyAttributes, metaAttributes, styleTag } =
      extractHelmet(appHTML, helmetContext, styleCollector)

    return {
      appHTML,
      htmlAttributes,
      bodyAttributes,
      metaAttributes,
      styleTag,
      routerContext,
    }
  }

  handleLoader: (
    req: Connect.IncomingMessage,
    res: ServerResponse<IncomingMessage>,
  ) => void = async (req, res) => {
    const { routes, base } = this.context
    const { matchRoutes } = await getReactRouterDom()
    const request = fromNodeRequest(req)
    const url = new URL(request.url)
    const routeId = decodeURIComponent(url.searchParams.get('_data')!)
    const matches = matchRoutes(
      convertRoutesToDataRoutes([...routes], (route) => route),
      {
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        state: null,
        key: 'default',
      },
      base,
    )
    if (!matches) {
      res.statusCode = 404
      res.end(`Route not found: ${routeId}`)
      return
    }
    const match = matches.find((m) => m.route.id === routeId)
    if (!match) {
      res.statusCode = 404
      res.end(`Route not found: ${routeId}`)
      return
    }
    const loader =
      match.route.loader ?? (await match.route.lazy?.().then((m) => m.loader))
    if (!loader) {
      res.statusCode = 200
      res.end(`There is no loader for the route: ${routeId}`)
      return
    }
    const response = await callRouteLoader({
      loader: loader as LoaderFunction,
      params: match.params,
      request,
      routeId,
    })
    await toNodeRequest(response, res)
  }
}

export async function callRouteLoader({
  // loadContext,
  loader,
  params,
  request,
  routeId,
}: {
  request: Request
  loader: LoaderFunction
  params: LoaderFunctionArgs['params']
  routeId: string
}) {
  const { json } = await getReactRouterDom()
  const result = await loader({
    request: stripDataParam(stripIndexParam(request)),
    params,
  })

  if (result === undefined) {
    throw new Error(
      `You defined a loader for route "${routeId}" but didn't return ` +
        `anything from your \`loader\` function. Please return a value or \`null\`.`,
    )
  }

  return isResponse(result) ? result : json(result)
}

function isResponse(value: any): value is Response {
  return (
    value != null &&
    typeof value.status === 'number' &&
    typeof value.statusText === 'string' &&
    typeof value.headers === 'object' &&
    typeof value.body !== 'undefined'
  )
}

function stripIndexParam(request: Request) {
  const url = new URL(request.url)
  const indexValues = url.searchParams.getAll('index')
  url.searchParams.delete('index')
  const indexValuesToKeep = []
  for (const indexValue of indexValues) {
    if (indexValue) {
      indexValuesToKeep.push(indexValue)
    }
  }
  for (const toKeep of indexValuesToKeep) {
    url.searchParams.append('index', toKeep)
  }

  const init: RequestInit = {
    method: request.method,
    body: request.body,
    headers: request.headers,
    signal: request.signal,
  }

  if (init.body) {
    ;(init as { duplex: 'half' }).duplex = 'half'
  }

  return new Request(url.href, init)
}
