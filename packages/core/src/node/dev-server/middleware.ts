import fs from 'node:fs'
import path from 'node:path'
import type { ViteDevServer } from 'vite'
import type { BoltdocsConfig } from '../config'
import { SECURITY_HEADERS } from '../security/headers'
import { getCSPHeader } from '../security/csp'
import { getHtmlTemplate } from '../plugin/html'
import { createStaticSsgOptions } from '../plugin/ssg-static-options'
import { createFeedbackMiddleware } from '../plugin/middlewares'

const ASSET_URL_RE =
  /\.(js|css|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|otf|mp4|webm|ogg|mp3|wav|flac|aac|pdf|zip|gz|map|json)$/i

export function setupMiddlewares(
  server: ViteDevServer,
  docsDir: string,
  getConfig: () => BoltdocsConfig,
): void {
  const isProd = process.env.NODE_ENV === 'production'

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
      const htmlEntry = createStaticSsgOptions(config).htmlEntry
      // Serve the project's real `index.html` so the dev server matches the
      // production template (custom head, theme seeding, preconnects, …).
      // Fall back to the neutral shell when the entry is missing.
      const templatePath = path.join(server.config.root, htmlEntry)
      const template = fs.existsSync(templatePath)
        ? fs.readFileSync(templatePath, 'utf-8')
        : getHtmlTemplate(config)
      // The `transformIndexHtml` hook injects the head meta (favicon,
      // preload, robots, …) exactly once — do not call `injectHtmlMeta` here
      // as well, that duplicated every injected tag. Pass the html entry
      // (never the request URL) so Vite's html proxy resolves a real file
      // instead of a content directory such as `docs/docs`.
      const html = await server.transformIndexHtml(
        `/${htmlEntry.replace(/^\/+/, '')}`,
        template,
        req.url || '/',
      )
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html')
      res.end(html)
      return
    }

    next()
  })
}
