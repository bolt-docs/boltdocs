import type { ViteDevServer } from 'vite'
import type { BoltdocsConfig } from '../config'
import { SECURITY_HEADERS } from '../security/headers'
import { getCSPHeader } from '../security/csp'
import { getHtmlTemplate, injectHtmlMeta } from '../plugin/html'

const ASSET_URL_RE =
  /\.(js|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|otf|mp4|webm|ogg|mp3|wav|flac|aac|pdf|zip|gz|map|json)$/i

export function setupMiddlewares(
  server: ViteDevServer,
  getConfig: () => BoltdocsConfig,
): void {
  const isProd = process.env.NODE_ENV === 'production'

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

  server.middlewares.use((req, res, next) => {
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
      let html = getHtmlTemplate(config)
      html = injectHtmlMeta(html, config)
      html = await server.transformIndexHtml(req.url || '/', html)
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.end(html)
      return
    }

    next()
  })
}
