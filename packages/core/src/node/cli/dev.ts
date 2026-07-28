import { createServer } from '@bdocs/ssg/node'
import { createViteConfig } from '../index'
import { error } from '@bdocs/dui'
import { devServer } from '../ui-utils'
import { notifyUpdateAvailable } from '../update-check'
import { resolveConfig } from '../config'
import { inspectPluginsSecurity } from '../security/inspect'
import { generateRoutes } from '../routes'
import path from 'node:path'

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

  notifyUpdateAvailable()
  let config: any = undefined
  let devRoutes: any = undefined
  try {
    config = await resolveConfig(path.resolve(root, 'docs'), root)
    inspectPluginsSecurity(config, root)
  } catch (e) {
    // Ignore config parsing errors; they will be handled by createViteConfig
  }

  try {
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

    const server = await createServer(viteConfig)
    await server.listen()

    // Start generating routes in the background
    generateRoutes('docs', config).catch((err) => {
      error('Background route generation failed:', err)
    })

    const urls = server.resolvedUrls
    console.log(
      devServer(
        urls?.local?.[0] ?? `http://localhost:${options.port ?? 5173}`,
        urls?.network?.[0] ?? null,
      ),
    )
    server.bindCLIShortcuts({ print: false })
  } catch (e) {
    error('Failed to start dev server:', e)
    process.exit(1)
  }
}
