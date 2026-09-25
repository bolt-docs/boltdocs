import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import type { CSSOptions } from 'vite'

type ViteSassOptions = NonNullable<
  NonNullable<CSSOptions['preprocessorOptions']>['scss']
>

type SassCompilerOptions = Omit<
  ViteSassOptions,
  'additionalData' | 'api' | 'includePaths' | 'loadPaths'
>

/** Options shared by Vite's `.scss` and indented `.sass` preprocessors. */
export type SassPluginOptions = SassCompilerOptions & {
  additionalData?: ViteSassOptions['additionalData']
  api?: 'modern' | 'modern-compiler' | 'legacy'
  loadPaths?: string[]
  /** Alias for `loadPaths`; kept for the legacy Sass API. */
  includePaths?: string[]
}

export function sassPlugin(options: SassPluginOptions = {}): BoltdocsPlugin {
  const {
    additionalData,
    api = 'modern',
    loadPaths,
    includePaths,
    ...compilerOptions
  } = options
  const resolvedLoadPaths = loadPaths ?? includePaths
  const pathOptions =
    api === 'legacy'
      ? resolvedLoadPaths
        ? { includePaths: resolvedLoadPaths }
        : {}
      : resolvedLoadPaths
        ? { loadPaths: resolvedLoadPaths }
        : {}
  const preprocessorOptions = {
    ...compilerOptions,
    api,
    ...(additionalData !== undefined ? { additionalData } : {}),
    ...pathOptions,
  }

  return createPlugin({
    name: 'plugin-sass',
    version: '1.0.0',
    css: {
      preprocessorOptions: {
        scss: preprocessorOptions,
        sass: preprocessorOptions,
      },
    },
  })
}

export default sassPlugin
