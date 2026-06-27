/**
 * Configuration options specifically for the Boltdocs Vite plugin.
 */
export interface BoltdocsPluginOptions {
  /** The root directory containing markdown files (default: 'docs') */
  docsDir?: string
  /** Enable turbo mode (Sätteri MDX compiler) */
  turbo?: boolean
}
