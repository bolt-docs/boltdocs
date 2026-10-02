import type { ViteDevServer } from 'vite'
import type { BoltdocsConfig } from '../config'
import { SECURITY_HEADERS } from '../security/headers'
import { getCSPHeader } from '../security/csp'
import { getHtmlTemplate, injectHtmlMeta } from '../plugin/html'
import { createFeedbackMiddleware } from '../plugin/middlewares'
import { beginServedRequest, endServedRequest } from './busy-gate'
import { startClientGraphWarmup } from './warm-client-graph'

const ASSET_URL_RE =
  /\.(js|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|otf|mp4|webm|ogg|mp3|wav|flac|aac|pdf|zip|gz|map|json)$/i

export function setupMiddlewares(
  server: ViteDevServer,
  docsDir: string,
  getConfig: () => BoltdocsConfig,
): void {
  const isProd = process.env.NODE_ENV === 'production'

  // The client graph is warmed once, after the first page render, rather than
  // at startup. Two reasons:
  //
  // - Warming at startup deadlocks: `transformRequest` on the virtual entry
  //   inside `configureServer` waits on a plugin container that does not exist
  //   yet, and the server never prints its ready banner.
  // - Warming eagerly alongside the first render competes with it for one event
  //   loop. The warmup stands aside whenever a request is in flight.
  //
  // Triggering it from here also keeps the crawl out of the test suite, where
  // no HTML request is ever served — which is what it had to be, since warming
  // during tests starved the HMR regression test past its 5s timeout.
  let graphWarmupStarted = false

  // Custom feedback integration middleware for local dev server
  server.middlewares.use(createFeedbackMiddleware(getConfig))

  server.middlewares.use((_req, res, next) => {
    if (isProd) {
      Object.entries(SECURITY_HEADERS).forEach(([header, value]) => {
        res.setHeader(header, value)
      })
    }
    const config = getConfig()
    if (config.security?.enableCSP) {
      res.setHeader('Content-Security-Policy', getCSPHeader(config))
    }
    next()
  })

  server.middlewares.use((req, _res, next) => {
    if (req.url === '/robots.txt') {
      next()
      return
    }
    next()
  })

  server.middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0] || '/'
    const accept = req.headers.accept || ''
    const config = getConfig()

    if (accept.includes('text/html') && !ASSET_URL_RE.test(url)) {
      // Signal the client graph warmup to stand down: this is the server-side
      // render, the single most expensive thing the dev server does.
      beginServedRequest()
      try {
        let html = getHtmlTemplate(config)
        html = injectHtmlMeta(html, config)
        html = await server.transformIndexHtml(req.url || '/', html)
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html')
        res.end(html)
      } finally {
        endServedRequest()
      }
      if (!graphWarmupStarted) {
        graphWarmupStarted = true
        startClientGraphWarmup(server)
      }
      return
    }

    next()
  })
}
