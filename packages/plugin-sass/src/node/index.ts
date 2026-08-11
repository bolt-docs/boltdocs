import { createPlugin, type BoltdocsPlugin } from 'boltdocs'

export interface SassPluginOptions {
  additionalData?: string
  api?: 'modern' | 'modern-compiler' | 'legacy'
  loadPaths?: string[]
  includePaths?: string[]
}

export function sassPlugin(options: SassPluginOptions = {}): BoltdocsPlugin {
  const { additionalData, api = 'modern', loadPaths, includePaths } = options
  const resolvedLoadPaths = loadPaths ?? includePaths
  const pathOptions =
    api === 'legacy'
      ? resolvedLoadPaths
        ? { includePaths: resolvedLoadPaths }
        : {}
      : resolvedLoadPaths
        ? { loadPaths: resolvedLoadPaths }
        : {}

  return createPlugin({
    name: 'plugin-sass',
    version: '1.0.0',
    css: {
      preprocessorOptions: {
        scss: {
          api,
          ...(additionalData ? { additionalData } : {}),
          ...pathOptions,
        },
        sass: {
          api,
          ...(additionalData ? { additionalData } : {}),
          ...pathOptions,
        },
      },
    },
  })
}

export default sassPlugin
