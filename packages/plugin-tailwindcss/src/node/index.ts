import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import tailwindVite from '@tailwindcss/vite'

export interface TailwindPluginOptions {
  optimize?: boolean | { minify?: boolean }
}

export function tailwindcssPlugin(
  options: TailwindPluginOptions = {},
): BoltdocsPlugin {
  return createPlugin({
    name: 'plugin-tailwindcss',
    version: '1.0.0',
    vitePlugins: [tailwindVite({ optimize: options.optimize })],
  })
}

export default tailwindcssPlugin
