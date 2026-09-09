import { createServer } from '@bdocs/ssg/node'
import { createViteConfig } from '../index'
import { error } from '@bdocs/dui'
import { devServer } from '../ui-utils'
import { notifyUpdateAvailable } from '../update-check'
import { inspectPluginsSecurity } from '../security/inspect'
import { generateRoutes } from '../routes'
import path from 'node:path'
import { createDevShutdownController } from './dev-lifecycle'
import { acquireDevServerLock, type DevServerLock } from './dev-lock'

let devServerStarted = false

/**
 * Logic for the `boltdocs dev` command.
 * Starts a Vite development server and sets up HMR.
 *
 * @param root - The project root directory
 */
export async function devAction(
  root: string = process.cwd(),
  options: { port?: number; host?: string | boolean; force?: boolean } = {},
) {
  if (devServerStarted) return
  devServerStarted = true

  let lock: DevServerLock | null = null
  let server: Awaited<ReturnType<typeof createServer>> | null = null
  let removeSignalHandlers = () => {}
  notifyUpdateAvailable()
  let config: any
  const debugTimings = process.env.BOLTDOCS_DEBUG === 'true'

  // Defer security inspect to after server start — it reads each plugin's
  // package.json and is not needed before the server is up.
  const t1 = performance.now()
  try {
    lock = acquireDevServerLock(root)
    if (debugTimings) {
      console.log(
        `[boltdocs-dev] acquireLock: ${Math.round(performance.now() - t1)}ms`,
      )
    }
    const startedAt = performance.now()
    const t2 = performance.now()
    // createViteConfig resolves the config itself, in parallel with its
    // heavy module imports. Resolving it here first would serialize ~100-300ms
    // (jiti + Zod) in front of the imports, so we let createViteConfig own it.
    const viteConfig = await createViteConfig(root, 'development', undefined, {
      skipTypes: true,
      skipLinkTree: true,
      skipRoutes: true,
    })
    // Exposed by createViteConfig so callers don't resolve the config twice.
    config = (viteConfig as { __boltdocsConfig?: unknown }).__boltdocsConfig
    if (debugTimings) {
      console.log(
        `[boltdocs-dev] createViteConfig: ${Math.round(performance.now() - t2)}ms`,
      )
    }
    viteConfig.logLevel = 'warn'
    viteConfig.clearScreen = false

    if (options.port !== undefined) {
      viteConfig.server = viteConfig.server || {}
      viteConfig.server.port = Number(options.port)
    }
    if (options.host !== undefined) {
      viteConfig.server = viteConfig.server || {}
      viteConfig.server.host = options.host
    }
    if (options.force) {
      viteConfig.optimizeDeps = viteConfig.optimizeDeps || {}
      viteConfig.optimizeDeps.force = true
    }

    const t3 = performance.now()
    server = await createServer(viteConfig, { skipResolveConfig: true })
    if (debugTimings) {
      console.log(
        `[boltdocs-dev] createServer: ${Math.round(performance.now() - t3)}ms`,
      )
    }

    removeSignalHandlers = () => {
      process.off('SIGINT', handleSigint)
      process.off('SIGTERM', handleSigterm)
    }
    const shutdown = createDevShutdownController(
      () => server!.close(),
      () => {
        devServerStarted = false
        lock?.release()
        removeSignalHandlers()
      },
    )
    const handleSigint = () => {
      void shutdown.shutdown(0)
    }
    const handleSigterm = () => {
      void shutdown.shutdown(143)
    }
    process.once('SIGINT', handleSigint)
    process.once('SIGTERM', handleSigterm)
    const t4 = performance.now()
    try {
      await server.listen()
    } catch (listenError) {
      removeSignalHandlers()
      throw listenError
    }
    if (debugTimings) {
      console.log(
        `[boltdocs-dev] server.listen: ${Math.round(performance.now() - t4)}ms`,
      )
    }
    server.httpServer?.once('close', () => {
      removeSignalHandlers()
      devServerStarted = false
      lock?.release()
    })

    // Defer security inspect to after server is listening — not on the critical path
    inspectPluginsSecurity(config, root)

    // Start generating routes in the background (lazy — virtual modules trigger on first request)
    generateRoutes(config?.docsDir || path.resolve(root, 'docs'), config).catch(
      (err) => {
        error('Background route generation failed:', err)
      },
    )

    const totalMs = performance.now() - startedAt
    if (debugTimings) {
      console.log(`[boltdocs-dev] total startup: ${Math.round(totalMs)}ms`)
    }
    const urls = server.resolvedUrls
    console.log(
      devServer(
        urls?.local?.[0] ?? `http://localhost:${options.port ?? 5173}`,
        urls?.network?.[0] ?? null,
        { readyIn: totalMs },
      ),
    )
    server.bindCLIShortcuts({ print: false })
  } catch (e) {
    removeSignalHandlers()
    if (server) {
      try {
        await server.close()
      } catch {
        // Preserve the original startup error; shutdown is best effort.
      }
    }
    devServerStarted = false
    lock?.release()
    error('Failed to start dev server:', e)
    process.exit(1)
  }
}
