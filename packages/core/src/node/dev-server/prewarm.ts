import type { ViteDevServer } from 'vite'
import type { BoltdocsConfig } from '../config'
import path from 'node:path'
import fs from 'node:fs'

const BATCH_SIZE = 8
const PREWARM_LIMIT = (() => {
  const configured = Number.parseInt(
    process.env.BOLTDOCS_PREWARM_LIMIT || '',
    10,
  )
  return Number.isFinite(configured) && configured > 0 ? configured : 200
})()
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

function getOptimizedDependencyUrl(
  server: ViteDevServer,
  entry: { file: string },
): string {
  const root = server.config.root
  const dependencyPath = path.join(server.config.cacheDir, 'deps', entry.file)
  const relativePath = path
    .relative(root, dependencyPath)
    .split(path.sep)
    .join('/')
  return `/${relativePath}`
}

/**
 * Collect the local chunk imports of an optimized dependency file
 * (`./rolldown-runtime-XXXX.js`, `./chunk-XXXX.js`, ...). Vite's optimizer
 * names its shared chunks with a content hash, so a file written by a previous
 * run can reference a chunk that a re-optimization has already replaced.
 */
function referencedLocalChunks(depsDir: string, file: string): string[] {
  try {
    const code = fs.readFileSync(path.join(depsDir, file), 'utf-8')
    const chunks: string[] = []
    const importRe = /(?:from\s*|import\s*)["'](\.\/[^"']+\.js)["']/g
    for (const match of code.matchAll(importRe)) chunks.push(match[1])
    return chunks
  } catch {
    return []
  }
}

/**
 * An optimized dependency is only safe to warm when it exists *and* every
 * sibling chunk it imports is present. Warming a file whose shared runtime
 * chunk was just deleted by the optimizer is what produced the
 * "Pre-transform error: The file does not exist at .../rolldown-runtime-*.js"
 * seen on the first start after a version bump or `--force`.
 */
function isWarmable(depsDir: string, file: string): boolean {
  if (!fs.existsSync(path.join(depsDir, file))) return false
  for (const chunk of referencedLocalChunks(depsDir, file)) {
    if (!fs.existsSync(path.join(depsDir, chunk))) return false
  }
  return true
}

/**
 * Warm Vite's optimizeDeps output through Vite's public warmup API. Calling
 * transformRequest('/react') is not equivalent: it asks Vite to resolve a
 * filesystem URL and silently does not warm the browser dependency bundle.
 */
function warmDependencies(server: ViteDevServer): void {
  const config = server.config
  if (!config?.cacheDir) return

  const depsDir = path.join(config.cacheDir, 'deps')
  const entries = DEPENDENCY_ENTRIES.map((dep) => ({
    file: `${dep.replaceAll('/', '_')}.js`,
  })).filter(({ file }) => isWarmable(depsDir, file))

  void Promise.allSettled(
    entries.map((entry) =>
      server.warmupRequest(getOptimizedDependencyUrl(server, entry)),
    ),
  )
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
        // Warm the optimized dependencies only once the server has settled.
        // Doing this synchronously in `configureServer` raced a running
        // re-optimization (fresh install, version bump, `--force`): it
        // requested chunks from the previous run that the optimizer had
        // already replaced, which Vite surfaced as a pre-transform error on
        // an otherwise healthy start.
        warmDependencies(server)

        const routes = routesPromise
          ? await routesPromise
          : await (await import('../routes')).generateRoutes(
              docsDir,
              getConfig(),
            )
        // Warm high-priority routes in the background so client-side
        // navigation usually hits an already-compiled module. The limit keeps
        // a large site from monopolising the transform event loop; set
        // BOLTDOCS_PREWARM_ALL=true when a complete warm-up is preferred.
        const files = routes
          .filter((r) => r.filePath)
          .map((r) => r.filePath as string)
          .sort((a, b) => getRoutePriority(a) - getRoutePriority(b))

        const prewarmStart = performance.now()
        const shouldWarmAll = process.env.BOLTDOCS_PREWARM_ALL === 'true'
        const selectedFiles = shouldWarmAll
          ? files
          : files.slice(0, PREWARM_LIMIT)
        for (let i = 0; i < selectedFiles.length; i += BATCH_SIZE) {
          const pendingRequests = (
            server as ViteDevServer & { _pendingRequests?: number }
          )._pendingRequests
          if ((pendingRequests || 0) > 0) {
            await new Promise<void>((resolve) => setTimeout(resolve, 50))
          }

          const batch = selectedFiles.slice(i, i + BATCH_SIZE)
          await Promise.allSettled(
            batch.map((file) => {
              const absoluteFile = path.isAbsolute(file)
                ? file
                : path.resolve(server.config.root, file)
              if (!fs.existsSync(absoluteFile)) return Promise.resolve()
              const normalizedFile = absoluteFile.replace(/\\/g, '/')
              return server.warmupRequest(`/@fs/${normalizedFile}`)
            }),
          )
          // Leave a turn to the browser between batches. This keeps the
          // background prewarmer from monopolising the transform event loop.
          await new Promise<void>((resolve) => setTimeout(resolve, 0))
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
