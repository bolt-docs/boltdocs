import { createServer } from '@bdocs/ssg/node'
import { createViteConfig } from '../index'
import * as ui from './ui'
import { notifyUpdateAvailable } from '../update-check'

/**
 * Logic for the `boltdocs dev` command.
 * Starts a Vite development server and sets up HMR.
 *
 * @param root - The project root directory
 */
export async function devAction(root: string = process.cwd()) {
  notifyUpdateAvailable()
  try {
    const viteConfig = await createViteConfig(root, 'development')
    const server = await createServer(viteConfig)
    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
  } catch (e) {
    ui.error('Failed to start dev server:', e)
    process.exit(1)
  }
}
