import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import type { CSSOptions, Plugin } from 'vite'

type LightningCssOptions = NonNullable<CSSOptions['lightningcss']>

export type LightningCssPluginOptions = LightningCssOptions

function lightningCssVitePlugin(options: LightningCssPluginOptions): Plugin {
  return {
    name: 'boltdocs:lightningcss',
    config() {
      return {
        css: {
          transformer: 'lightningcss',
          lightningcss: options,
        },
      }
    },
  }
}

export function lightningcssPlugin(
  options: LightningCssPluginOptions = {},
): BoltdocsPlugin {
  return createPlugin({
    name: 'plugin-lightningcss',
    version: '1.0.0',
    vitePlugins: [lightningCssVitePlugin(options)],
  })
}

export default lightningcssPlugin
