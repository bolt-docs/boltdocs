import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import UnoCSS from 'unocss/vite'

export interface UnoCSSPluginOptions {
  configFile?: string | false
  mode?: 'global' | 'per-module' | 'vue-scoped' | 'shadow-dom'
}

export function unocssPlugin(
  options: UnoCSSPluginOptions = {},
): BoltdocsPlugin {
  return createPlugin({
    name: 'plugin-unocss',
    version: '1.0.0',
    vitePlugins: [UnoCSS(options as any)],
  })
}

export default unocssPlugin
