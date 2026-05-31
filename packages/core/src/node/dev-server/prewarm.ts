import type { ViteDevServer } from 'vite'
import type { BoltdocsConfig } from '../config'
import path from 'node:path'

const BATCH_SIZE = 8
const PREWARM_DELAY = 1_000

export function setupPrewarming(
  server: ViteDevServer,
  docsDir: string,
  getConfig: () => BoltdocsConfig,
): void {
  setTimeout(async () => {
    try {
      const { generateRoutes } = await import('../routes')
      const routes = await generateRoutes(docsDir, getConfig())
      const files = routes.filter((r) => r.filePath).map((r) => r.filePath)
      for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE)
        await Promise.allSettled(
          batch.map((file) => {
            const rel = path.relative(process.cwd(), file).replace(/\\/g, '/')
            const viteUrl = rel.startsWith('/') ? rel : `/${rel}`
            return server.transformRequest(viteUrl)
          }),
        )
      }
    } catch {
      // Fall back silently on any background failures
    }
  }, PREWARM_DELAY)
}
