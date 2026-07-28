import type { RouteMeta } from '../routes/types'

/**
 * Configuration options specifically for the Boltdocs Vite plugin.
 */
export interface BoltdocsPluginOptions {
  /** The root directory containing markdown files (default: 'docs') */
  docsDir?: string
  /** Project root directory (defaults to cwd) */
  root?: string
  /** Pre-computed routes. When provided, the plugin skips route generation in its config hook. */
  routes?: RouteMeta[]
}
