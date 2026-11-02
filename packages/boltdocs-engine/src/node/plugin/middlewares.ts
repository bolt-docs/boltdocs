import type { Connect, ResolvedConfig } from 'vite'
import type { BoltdocsConfig } from '../config'
import path from 'node:path'
import fs from 'node:fs'

export function createFeedbackMiddleware(
  getConfig: () => BoltdocsConfig,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    const config = getConfig()
    const feedback = config.integrations?.feedback?.custom
    const endpoint = feedback?.endpoint || '/api/feedback'

    if (
      !feedback?.enabled ||
      req.method !== 'POST' ||
      req.url?.split('?')[0] !== endpoint
    ) {
      return next()
    }

    const MAX_BODY_SIZE = 10 * 1024
    let body = ''
    let bodySize = 0
    req.on('data', (chunk) => {
      bodySize += chunk.length
      if (bodySize > MAX_BODY_SIZE) {
        res.statusCode = 413
        res.end(JSON.stringify({ error: 'Request body too large' }))
        req.destroy()
        return
      }
      body += chunk
    })
    req.on('end', async () => {
      res.setHeader('Content-Type', 'application/json')
      try {
        const { handleFeedback } = await import('../feedback/handler')
        const result = await handleFeedback(JSON.parse(body), process.env, {
          owner: feedback.owner,
          repo: feedback.repo,
          categorySlug: feedback.categorySlug,
        })

        res.statusCode = 200
        res.end(JSON.stringify(result))
      } catch (err) {
        res.statusCode = 500
        const message =
          err instanceof Error ? err.message : 'Failed to submit feedback'
        res.end(JSON.stringify({ error: message }))
      }
    })
  }
}

export function createStaticHtmlMiddleware(
  getViteConfig: () => ResolvedConfig,
): Connect.NextHandleFunction {
  return (req, _res, next) => {
    const rawUrl = req.url || '/'
    const pathname = rawUrl.split('?')[0].split('#')[0]
    if (path.extname(pathname)) return next()

    const viteConfig = getViteConfig()
    const outDir = path.resolve(
      viteConfig?.root || process.cwd(),
      viteConfig?.build?.outDir || 'dist',
    )
    const normalised = pathname.replace(/\/$/, '') || '/'
    const candidate = path.join(outDir, normalised, 'index.html')

    if (normalised !== '/' && fs.existsSync(candidate)) {
      const query = rawUrl.includes('?') ? `?${rawUrl.split('?')[1]}` : ''
      req.url = `${normalised}/index.html${query}`
    }
    next()
  }
}
