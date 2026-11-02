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
    // `tailwindVite()` returns the plugin list itself; wrapping it in another
    // array produced a nested list that Vite happened to flatten.
    vitePlugins: tailwindVite({ optimize: options.optimize }),
  })
}

export default tailwindcssPlugin
