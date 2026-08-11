import type { ViteDevServer } from 'vite'
import type { BoltdocsConfig } from '../config'
import path from 'node:path'

const BATCH_SIZE = 32
const PREWARM_DELAY = 150

const activePrewarms = new WeakMap<ViteDevServer, Promise<void>>()

// Priority patterns: index pages and getting-started are prewarmed first
const PRIORITY_PATTERNS = [
  /\/index\./i,
  /\/getting-started/i,
  /\/intro/i,
  /\/readme/i,
]

function getRoutePriority(filePath: string): number {
  for (let i = 0; i < PRIORITY_PATTERNS.length; i++) {
    if (PRIORITY_PATTERNS[i].test(filePath)) return i
  }
  return PRIORITY_PATTERNS.length
}

export function setupPrewarming(
  server: ViteDevServer,
  docsDir: string,
  getConfig: () => BoltdocsConfig,
  routesPromise?: Promise<
    Awaited<ReturnType<typeof import('../routes')['generateRoutes']>>
  >,
): void {
  if (activePrewarms.has(server)) return

  const prewarm = new Promise<void>((resolve) => {
    setTimeout(async () => {
      try {
        const routes = routesPromise
          ? await routesPromise
          : await (await import('../routes')).generateRoutes(
              docsDir,
              getConfig(),
            )
        const files = routes
          .filter((r) => r.filePath)
          .map((r) => r.filePath)
          .sort((a, b) => getRoutePriority(a) - getRoutePriority(b))
          .slice(0, 20)

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
      } catch (error) {
        if (process.env.BOLTDOCS_DEBUG === 'true') {
          console.warn('[boltdocs] Prewarm failed:', error)
        }
      } finally {
        activePrewarms.delete(server)
        resolve()
      }
    }, PREWARM_DELAY)
  })

  activePrewarms.set(server, prewarm)
}
