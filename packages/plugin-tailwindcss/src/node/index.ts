import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import tailwindVite from '@tailwindcss/vite'

export interface TailwindPluginOptions {
  /** Optional custom configuration file or flags */
  config?: string
}

export function tailwindcssPlugin(
  _options: TailwindPluginOptions = {},
): BoltdocsPlugin {
  return createPlugin({
    name: 'plugin-tailwindcss',
    version: '1.0.0',
    vitePlugins: [tailwindVite()],
    css: {
      headStyles: [],
    },
  })
}

export default tailwindcssPlugin
