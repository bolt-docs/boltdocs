import { createServer } from '@bdocs/ssg/node'
import { createViteConfig } from '../index'
import { error } from '@bdocs/dui'
import { devServer } from '../ui-utils'
import { notifyUpdateAvailable } from '../update-check'
import { resolveConfig } from '../config'
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
  let devRoutes: any
  try {
    config = await resolveConfig(path.resolve(root, 'docs'), root)
    inspectPluginsSecurity(config, root)
  } catch (e) {
    // Ignore config parsing errors; they will be handled by createViteConfig
  }

  try {
    lock = acquireDevServerLock(root)
    const viteConfig = await createViteConfig(root, 'development', config, {
      routes: devRoutes,
      skipTypes: true,
      skipLinkTree: true,
    })
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

    server = await createServer(viteConfig)

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
    try {
      await server.listen()
    } catch (listenError) {
      removeSignalHandlers()
      throw listenError
    }
    server.httpServer?.once('close', () => {
      removeSignalHandlers()
      devServerStarted = false
      lock?.release()
    })

    // Start generating routes in the background
    generateRoutes(config?.docsDir || path.resolve(root, 'docs'), config).catch(
      (err) => {
        error('Background route generation failed:', err)
      },
    )

    const urls = server.resolvedUrls
    console.log(
      devServer(
        urls?.local?.[0] ?? `http://localhost:${options.port ?? 5173}`,
        urls?.network?.[0] ?? null,
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
