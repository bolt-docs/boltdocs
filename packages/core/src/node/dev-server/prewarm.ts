import type { ViteDevServer } from 'vite'
import type { BoltdocsConfig } from '../config'
import path from 'node:path'

const BATCH_SIZE = 8
/**
 * Delay before prewarming starts. The browser fetches ~150-250 modules for
 * the first page load right after the server becomes ready; transforming
 * every docs page at t=0 would starve the event loop exactly then and slow
 * down first paint. Waiting lets the initial request win the race.
 */
const PREWARM_DELAY = 1500

const activePrewarms = new WeakMap<ViteDevServer, Promise<void>>()

// Priority patterns: index pages and getting-started are prewarmed first
const PRIORITY_PATTERNS = [
  /\/index\./i,
  /\/getting-started/i,
  /\/intro/i,
  /\/readme/i,
]

// Common Vite dependencies that should be warmed early to avoid
// cold-start penalties on first page navigation.
const DEPENDENCY_ENTRIES = [
  'react',
  'react-dom',
  'react-dom/client',
  'react-router-dom',
  'react-helmet-async',
]

function getRoutePriority(filePath: string): number {
  for (let i = 0; i < PRIORITY_PATTERNS.length; i++) {
    if (PRIORITY_PATTERNS[i].test(filePath)) return i
  }
  return PRIORITY_PATTERNS.length
}

/**
 * Warm Vite's optimizeDeps pre-bundling by requesting transforms for
 * common framework dependencies.  This runs in the background and
 * completes before the user's first navigation, eliminating the cold-start
 * "optimizing dependencies" delay.
 */
function warmDependencies(server: ViteDevServer): void {
  for (const dep of DEPENDENCY_ENTRIES) {
    // transformRequest on a bare module ID forces Vite to resolve and
    // pre-bundle it.  Errors are silently ignored — this is best-effort.
    server.transformRequest(`/${dep}`).catch(() => {})
  }
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

  // Kick off dependency warming immediately — no delay.
  warmDependencies(server)

  const prewarm = new Promise<void>((resolve) => {
    setTimeout(async () => {
      try {
        const routes = routesPromise
          ? await routesPromise
          : await (await import('../routes')).generateRoutes(
              docsDir,
              getConfig(),
            )
        // Warm EVERY route (priority order) so client-side navigation always
        // hits an already-compiled module instead of compiling on demand.
        const files = routes
          .filter((r) => r.filePath)
          .map((r) => r.filePath as string)
          .sort((a, b) => getRoutePriority(a) - getRoutePriority(b))

        const prewarmStart = performance.now()
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
        if (
          process.env.BOLTDOCS_DEBUG === 'true' ||
          process.env.BOLTDOCS_BENCHMARK === 'true'
        ) {
          // eslint-disable-next-line no-console
          console.log(
            `[boltdocs] prewarm done (${files.length} files) in ${Math.round(performance.now() - prewarmStart)}ms`,
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
