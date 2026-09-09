import type { IncomingMessage, ServerResponse } from 'node:http'
import type { FilledContext } from 'react-helmet-async'
import type {
  LoaderFunction,
  LoaderFunctionArgs,
  RequiredRouterEntryModule,
} from '../../router-contract'
import type { Connect } from 'vite'
import type {
  IRouterAdapter,
  RouterEntryModule,
  RouterRenderResult,
  RouterRouteMatch,
  RouterRouteRecord,
} from './interface'
import { requireRouterEntryModule, withRouteIds } from '../../router-contract'
import type { ViteReactSSGContext } from '../../types'
// Use the HelmetProvider from helmet-compat.tsx's globalThis bridge to ensure
// the same React context as the bundled ESM react-helmet-async instance.
// Without this, require('react-helmet-async') loads a separate CJS module with
// its own React.createContext(), and Helmet can't find the provider context.
// We read at render time (not module load time) because the entry module body
// sets the globalThis bridge AFTER externalized modules have loaded.
let _cachedHelmetProvider: any = null
function getHelmetProvider() {
  if (_cachedHelmetProvider) return _cachedHelmetProvider
  const fromGlobal = (globalThis as any).__BOLTDOCS_HELMET_PROVIDER__
  if (fromGlobal) {
    _cachedHelmetProvider =
      fromGlobal.HelmetProvider ||
      fromGlobal.default?.HelmetProvider ||
      fromGlobal
  } else {
    try {
      const { createRequire } =
        require('node:module') as typeof import('node:module')
      const _require = createRequire(import.meta.url)
      const pkg = _require('react-helmet-async')
      _cachedHelmetProvider =
        pkg.HelmetProvider || pkg.default?.HelmetProvider || pkg.default || pkg
    } catch {
      _cachedHelmetProvider = ({ children }: any) => <>{children}</>
    }
  }
  if (typeof _cachedHelmetProvider !== 'function') {
    _cachedHelmetProvider = ({ children }: any) => <>{children}</>
  }
  return _cachedHelmetProvider
}
import {
  fromNodeRequest,
  stripDataParam,
  toNodeRequest,
} from '../../polyfill/node-adapter'
import { withLeadingSlash } from '../../utils/path'
import { renderStaticApp } from '../serverRenderer'
import { extractHelmet } from './utils'

export class RemixAdapter implements IRouterAdapter<ViteReactSSGContext> {
  context: ViteReactSSGContext<true>
  entryMod?: RouterEntryModule
  private readonly routerApi: RequiredRouterEntryModule
  private readonly base: string
  private readonly coreRoutes: RouterRouteRecord[]
  private readonly getStyleCollector: ViteReactSSGContext['getStyleCollector']
  private readonly RouteRenderer: RequiredRouterEntryModule['RouteRenderer']
  private readonly matchRouteBranchWithParams: RequiredRouterEntryModule['matchRouteBranchWithParams']
  private readonly resolveRouteBranch: RequiredRouterEntryModule['resolveRouteBranch']
  private readonly matchedBranches = new Map<string, RouterRouteMatch[]>()
  private readonly resolvedBranches = new Map<
    string,
    Promise<RouterRouteRecord[]>
  >()

  constructor(context: ViteReactSSGContext, entryMod?: RouterEntryModule) {
    this.context = context
    this.entryMod = entryMod
    this.routerApi = requireRouterEntryModule(entryMod)
    this.base = context.base
    this.getStyleCollector = context.getStyleCollector

    const app = context.app as any
    this.coreRoutes = ((app?.routes ||
      (Array.isArray(app) ? app : context.routes)) ??
      []) as RouterRouteRecord[]
    this.RouteRenderer = this.routerApi.RouteRenderer
    this.matchRouteBranchWithParams = this.routerApi.matchRouteBranchWithParams
    this.resolveRouteBranch = this.routerApi.resolveRouteBranch
  }

  private getMatchedBranch(routePath: string): RouterRouteMatch[] {
    const cacheKey = `${this.base}\0${routePath}`
    const cached = this.matchedBranches.get(cacheKey)
    if (cached) return cached

    const matched = this.matchRouteBranchWithParams(
      this.coreRoutes,
      routePath,
      this.base,
    )
    this.matchedBranches.set(cacheKey, matched)
    return matched
  }

  private async getResolvedBranch(
    cacheKey: string,
    branch: RouterRouteRecord[],
  ): Promise<RouterRouteRecord[]> {
    const cached = this.resolvedBranches.get(cacheKey)
    if (cached) return cached

    const pending = this.resolveRouteBranch(branch).catch((error) => {
      this.resolvedBranches.delete(cacheKey)
      throw error
    })
    this.resolvedBranches.set(cacheKey, pending)
    return pending
  }

  async render(path: string): Promise<RouterRenderResult> {
    const renderStart = performance.now()
    const leading = withLeadingSlash(path)
    const fullPath =
      this.base === '/' ||
      leading.startsWith(
        `${withLeadingSlash(this.base).replace(/\/$/, '')}/`,
      ) ||
      leading === withLeadingSlash(this.base).replace(/\/$/, '')
        ? leading
        : `${withLeadingSlash(this.base).replace(/\/$/, '')}${leading}`
    const fetchUrl = `http://localhost${fullPath}`
    const request = new Request(fetchUrl)
    const styleCollector = this.getStyleCollector
      ? await this.getStyleCollector()
      : null
    const helmetContext = {} as FilledContext
    const routePath = new URL(request.url).pathname

    const matchStart = performance.now()
    const matchedBranch = this.getMatchedBranch(routePath)
    const matchMs = performance.now() - matchStart
    const branch = matchedBranch.map((match) => match.route)

    let loaderData: Record<string, unknown> = {}
    let hasLoaderData = false
    let resolvedBranch: RouterRouteRecord[] = []
    let resolveMs = 0
    let loadersMs = 0

    if (branch.length > 0) {
      const resolveStart = performance.now()
      resolvedBranch = await this.getResolvedBranch(
        `${this.base}\0${routePath}`,
        branch,
      )
      resolveMs = performance.now() - resolveStart

      const loadersStart = performance.now()
      const loaderValues: Record<string, unknown>[] = []
      for (const [index, match] of matchedBranch.entries()) {
        const route = resolvedBranch[index]
        if (!route || typeof route.loader !== 'function') continue
        try {
          const result = await route.loader({
            request,
            // Keep loader params isolated even though the static match is cached.
            params: { ...match.params },
          })
          if (result && typeof result === 'object' && 'data' in result) {
            hasLoaderData = true
            loaderValues.push(
              (result as { data: Record<string, unknown> }).data,
            )
          } else if (result && typeof result === 'object') {
            hasLoaderData = true
            loaderValues.push(result as Record<string, unknown>)
          }
        } catch {
          // Keep rendering with data from the other matched loaders.
        }
      }

      loaderData = loaderValues.reduce<Record<string, unknown>>(
        (merged, value) => ({ ...merged, ...value }),
        {},
      )
      loadersMs = performance.now() - loadersStart
    }

    const HP = getHelmetProvider()
    const hpAny = HP as any
    if (hpAny && typeof hpAny === 'function') hpAny.canUseDOM = false
    const RouteRenderer = this.RouteRenderer
    const helmetRenderStart = performance.now()
    let app = (
      <HP context={helmetContext}>
        <RouteRenderer
          routes={this.coreRoutes}
          pathname={routePath}
          loaderData={loaderData}
          hasLoaderData={hasLoaderData}
          resolvedBranch={resolvedBranch}
          basename={this.base}
        />
      </HP>
    )
    if (styleCollector) app = styleCollector.collect(app)

    let appHTML = ''
    try {
      appHTML = await renderStaticApp(app)
    } catch (err: any) {
      console.error(
        `[SSG Render Error] routePath="${routePath}":`,
        err?.stack || err,
      )
      throw err
    }
    const renderMs = performance.now() - helmetRenderStart

    const helmetExtractStart = performance.now()
    const { htmlAttributes, bodyAttributes, metaAttributes, styleTag } =
      extractHelmet(appHTML, helmetContext, styleCollector)
    const helmetMs = performance.now() - helmetExtractStart

    return {
      appHTML,
      htmlAttributes,
      bodyAttributes,
      metaAttributes,
      styleTag,
      timings: {
        matchMs,
        resolveMs,
        loadersMs,
        renderMs,
        helmetMs,
        totalMs: performance.now() - renderStart,
      },
      routerContext: { loaderData: { root: loaderData } },
    }
  }

  async handleLoader(
    req: Connect.IncomingMessage,
    res: ServerResponse<IncomingMessage>,
  ) {
    const { routes, base } = this.context
    const { matchRouteBranchWithParams, resolveRouteBranch } = this.routerApi
    const request = fromNodeRequest(req)
    const url = new URL(request.url)
    const routeId = decodeURIComponent(url.searchParams.get('_data') || '')
    const routesWithIds = withRouteIds([...routes] as RouterRouteRecord[])
    const matches = matchRouteBranchWithParams(
      routesWithIds,
      url.pathname,
      base,
    )
    if (matches.length === 0) {
      res.statusCode = 404
      res.end(`Route not found: ${routeId}`)
      return
    }
    const match = matches.find((m, index) => {
      const id = m.route.id || String(index)
      return id === routeId
    })
    if (!match) {
      res.statusCode = 404
      res.end(`Route not found: ${routeId}`)
      return
    }
    const branch = matches.map((item) => item.route)
    const resolvedBranch = await resolveRouteBranch(branch)
    const matchIndex = matches.indexOf(match)
    const resolvedRoute = resolvedBranch[matchIndex] || match.route
    const loader = resolvedRoute.loader
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
  const result = await loader({
    request: stripDataParam(stripIndexParam(request)),
    params,
  } as LoaderFunctionArgs)

  if (result === undefined) {
    throw new Error(
      `You defined a loader for route "${routeId}" but didn't return ` +
        `anything from your \`loader\` function. Please return a value or \`null\`.`,
    )
  }

  if (isResponse(result)) return result

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
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
