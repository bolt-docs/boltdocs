import { preview } from 'vite'
import { success, error } from '@bdocs/dui'
import { notifyUpdateAvailable } from '../update-check'
import { createBuildPipeline } from '../pipeline/index'

/**
 * Logic for the `boltdocs build` command.
 * Performs a production build with hydration support via @bdocs/ssg.
 *
 * @param root - The project root directory
 */
export async function buildAction(root: string = process.cwd()) {
  notifyUpdateAvailable()
  try {
    const pipeline = createBuildPipeline()
    const result = await pipeline.run({ root, timing: {} })

    if (!result.success) {
      error(`Build failed at step "${result.failedStep}":`, result.error)
      process.exit(1)
    }

    success(`SSG build completed successfully in ${Math.round(result.timing.total)}ms!`)
    process.exit(0)
  } catch (e) {
    error('Build failed:', e)
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
    viteConfig.logLevel = 'warn'
    viteConfig.clearScreen = false
    const previewServer = await preview(viteConfig)
    const urls = previewServer.resolvedUrls
    console.log(
      previewServer(
        urls?.local?.[0] ?? 'http://localhost:4173',
        urls?.network?.[0] ?? null,
      ),
    )
  } catch (e) {
    error('Failed to start preview server:', e)
    process.exit(1)
  }
}
