import { preview } from 'vite'
import { build as ssgBuild } from '@bdocs/ssg/node'
import { createViteConfig } from '../index'
import * as ui from './ui'
import path from 'node:path'
import { generateRoutes } from '../routes/index'
import { resolveConfig } from '../config'
import { notifyUpdateAvailable } from '../update-check'

/**
 * Logic for the `boltdocs build` command.
 * Performs a production build with hydration support via @bdocs/ssg.
 *
 * @param root - The project root directory
 */
export async function buildAction(root: string = process.cwd()) {
  notifyUpdateAvailable()
  try {
    const viteConfig = await createViteConfig(root, 'production')

    // Parse the Boltdocs config to get sidebar groups, routing rules, etc.
    const config = await resolveConfig('docs', root)

    // Generate routes to map paths to source files
    const routes = await generateRoutes(
      path.resolve(root, 'docs'),
      config,
      viteConfig.base,
    )
    const routeToSourceFileMap: Record<string, string> = {}
    for (const route of routes) {
      if (route.path && route.componentPath) {
        routeToSourceFileMap[route.path] = route.componentPath
        // Also map without trailing slash to be extremely robust
        const normalized = route.path.replace(/\/$/, '')
        routeToSourceFileMap[normalized] = route.componentPath
      }
    }

    // We use virtual modules and internalized HTML injection,
    // so no physical files need to be written to the project root.
    await ssgBuild(
      {
        entry: 'boltdocs/entry',
        routeToSourceFileMap,
        cacheDir: path.resolve(root, '.boltdocs'),
      },
      viteConfig,
    )
    ui.success('SSG build completed successfully!')
    process.exit(0)
  } catch (e) {
    ui.error('Build failed:', e)
    process.exit(1)
  }
}

/**
 * Logic for the `boltdocs preview` command.
 * Serves the production build from the disk.
 *
 * @param root - The project root directory
 */
export async function previewAction(root: string = process.cwd()) {
  try {
    const viteConfig = await createViteConfig(root, 'production')
    const previewServer = await preview(viteConfig)
    previewServer.printUrls()
  } catch (e) {
    ui.error('Failed to start preview server:', e)
    process.exit(1)
  }
}
