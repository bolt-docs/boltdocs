import type { Connect, ModuleNode, PluginOption, ViteDevServer } from 'vite'
import type { ViteReactSSGContext, ViteReactSSGOptions } from '../../types'
import type { CreateRootFactory } from '../build'
import { error } from '@bdocs/dui'
import { send } from 'vite'
import { joinUrlSegments, stripBase } from '../../utils/path'
import { createLink, renderHTML } from '../html'
import { getAdapter } from '../router-adapter'

export interface Options<Context = ViteReactSSGContext>
  extends ViteReactSSGOptions<Context> {
  template: string
  ssrEntry: string
  entry: string
  rootContainerId: string
}

/**
 * URL-normalization middleware for the SSG dev server.
 *
 * The browser sends paths with percent-encoded UTF-8 chars (e.g.
 * `/blog/Jes%C3%BAs%20Alcal%C3%A1`). Vite's HTML-proxy module
 * resolver looks the module id up against the raw UTF-8 string that
 * the React Router `path` field carries, so encoded URLs miss and
 * produce:
 *   [vite] (client) Pre-transform error: No matching HTML proxy
 *   module found from /blog/...?html-proxy&index=0.js
 *
 * We decode the path component with `decodeURI` (preserves `%2F`
 * reserved slash so segment boundaries stay intact) and leave the
 * query string verbatim. Mirrors the `decodeURIComponent` pattern
 * from `packages/core/src/node/dev-server/hmr-handler.ts:45`.
 *
 * Exported so the unit test in `tests/url-normalize.test.ts` can
 * import this same implementation rather than re-implementing — that
 * way a future change to the canonicalisation logic cannot drift
 * away from what the test covers.
 */
export function normalizeUrl(
  req: { url?: string; originalUrl?: string },
  _res: unknown,
  next: () => void,
): void {
  if (req.url) {
    try {
      const url = req.url
      const qIdx = url.indexOf('?')
      const pathPart = qIdx >= 0 ? url.slice(0, qIdx) : url
      const queryPart = qIdx >= 0 ? url.slice(qIdx) : ''
      if (/%[0-9A-Fa-f]{2}/.test(pathPart)) {
        const decoded = decodeURI(pathPart)
        if (decoded !== pathPart) {
          const newUrl = decoded + queryPart
          req.url = newUrl
          if (req.originalUrl) req.originalUrl = newUrl
        }
      }
    } catch {
      // Malformed URI sequence — leave unchanged.
    }
  }
  next()
}

export interface HandlerCreaterOptions<Context> extends Options<Context> {
  server: ViteDevServer
  ssgContext: Context
}

export function ssrServerPlugin({
  template,
  ssrEntry,
  onBeforePageRender,
  entry,
  rootContainerId,
  onPageRendered,
}: Options): PluginOption {
  return {
    name: 'vite-react-ssg:dev-server',
    configureServer(server) {
      const renderMiddleware: Connect.NextHandleFunction = async (req, res) => {
        try {
          const url = req.originalUrl ?? req.url ?? '/'
          const serverEntryModule = await server.ssrLoadModule(ssrEntry)
          const createRoot: CreateRootFactory = serverEntryModule.createRoot
          const appCtx = (await createRoot(
            false,
            url,
          )) as ViteReactSSGContext<true>
          const adapter = getAdapter(appCtx, serverEntryModule)
          const { app, base } = appCtx
          const [pathname = '/', search = ''] = url.split('?')
          const searchParams = new URLSearchParams(search)

          if (!app && searchParams.has('_data')) {
            return adapter.handleLoader(req, res)
          }

          const indexHTML = await server.transformIndexHtml(url, template)
          const transformedIndexHTML =
            (await onBeforePageRender?.(url, indexHTML, appCtx)) || indexHTML

          const {
            appHTML,
            bodyAttributes,
            htmlAttributes,
            metaAttributes,
            styleTag,
          } = await adapter.render(stripBase(pathname, base))

          metaAttributes.push(styleTag)
          const mods = await Promise.all(
            [ssrEntry, entry].map(
              async (entry) => await server.moduleGraph.getModuleByUrl(entry),
            ),
          )

          const assetsUrls = new Set<string>()
          const collectedMods = new Set<ModuleNode>()

          const collectAssets = async (mod: ModuleNode | undefined) => {
            if (!mod?.ssrTransformResult || collectedMods.has(mod)) return
            collectedMods.add(mod)
            const { deps = [], dynamicDeps = [] } = mod.ssrTransformResult
            const allDeps = [...deps, ...dynamicDeps]
            for (const dep of allDeps) {
              if (
                dep.endsWith('.css') ||
                dep.endsWith('.scss') ||
                dep.endsWith('.sass') ||
                dep.endsWith('.less')
              ) {
                assetsUrls.add(dep)
              } else if (dep.endsWith('.ts') || dep.endsWith('.tsx')) {
                const depModule = await server.moduleGraph.getModuleByUrl(dep)
                depModule && (await collectAssets(depModule))
              }
            }
          }
          await Promise.all(mods.map(async (mod) => collectAssets(mod)))
          const preloadLink = [...assetsUrls].map((item) =>
            createLink(joinUrlSegments(server.config.base, item)),
          )
          metaAttributes.push(...preloadLink)

          const renderedHTML = await renderHTML({
            rootContainerId,
            appHTML,
            indexHTML: transformedIndexHTML,
            metaAttributes,
            bodyAttributes,
            htmlAttributes,
            initialState: null,
          })

          const transformed =
            (await onPageRendered?.(url, renderedHTML, appCtx)) || renderedHTML

          res.statusCode = 200
          res.setHeader('Content-Type', 'text/html')
          const isDev: boolean = 'pluginContainer' in server
          const headers = isDev
            ? server.config.server.headers
            : server.config.preview.headers
          send(req, res, transformed, 'html', { headers })
        } catch (caught) {
          const renderError =
            caught instanceof Error ? caught : new Error(String(caught))
          server.ssrFixStacktrace(renderError)
          error('SSR render error', renderError)
          res.statusCode = 500
          res.end(renderError.stack ?? renderError.message)
        }
      }

      // Prepend a URL-normalization middleware BEFORE Vite's internal
      // `htmlFallbackMiddleware` + HTML-proxy module resolver. The browser
      // sends paths with percent-encoded UTF-8 chars (e.g.
      // `/blog/Jes%C3%BAs%20Alcal%C3%A1`). Vite's HTML-proxy looks the
      // module id up against the raw UTF-8 string that the React Router
      // `path` field carries, so encoded URLs miss and produce:
      //   [vite] (client) Pre-transform error: No matching HTML proxy
      //   module found from /blog/...?html-proxy&index=0.js
      // Decoding here (synchronously, before Vite finalizes its
      // middleware stack) makes every downstream handler — Vite's
      // transform layer, our `renderMiddleware`, React Router SSR
      // resolution — see the canonical UTF-8 form, mirroring the
      // decodeURIComponent pattern from `hmr-handler.ts:45`.
      server.middlewares.use(normalizeUrl)

      return () => {
        server.middlewares.use(renderMiddleware)
      }
    },
  }
}
