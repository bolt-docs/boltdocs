import { createPlugin, type BoltdocsPlugin } from 'boltdocs'

export interface SassPluginOptions {
  /** Additional SASS options passed to Vite css.preprocessorOptions.scss */
  additionalData?: string
  api?: 'modern' | 'legacy'
  includePaths?: string[]
}

export function sassPlugin(options: SassPluginOptions = {}): BoltdocsPlugin {
  const { additionalData, api = 'modern', includePaths } = options

  return createPlugin({
    name: 'plugin-sass',
    version: '1.0.0',
    css: {
      preprocessorOptions: {
        scss: {
          api,
          ...(additionalData ? { additionalData } : {}),
          ...(includePaths ? { includePaths } : {}),
        },
        sass: {
          api,
          ...(additionalData ? { additionalData } : {}),
        },
      },
    },
  })
}

export default sassPlugin
