import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import UnoCSS, { type VitePluginConfig } from 'unocss/vite'

/** Options supported by UnoCSS plus Boltdocs-specific source discovery. */
export type UnoCSSPluginOptions = Omit<VitePluginConfig, 'mode'> & {
  mode?: VitePluginConfig['mode']
  /** Directory containing the docs sources scanned by UnoCSS. */
  docsDir?: string
  /** Disable the automatic `.md`/`.mdx` source scan. */
  scanDocs?: boolean
}

export function unocssPlugin(
  options: UnoCSSPluginOptions = {},
): BoltdocsPlugin {
  const { docsDir = 'docs', scanDocs = true, ...unocssOptions } = options
  const normalizedDocsDir = docsDir.replace(/\\/g, '/').replace(/\/$/, '')
  const content = scanDocs
    ? {
        ...unocssOptions.content,
        filesystem: [
          ...(unocssOptions.content?.filesystem ?? []),
          `${normalizedDocsDir}/**/*.{md,mdx}`,
        ],
      }
    : unocssOptions.content

  return createPlugin({
    name: 'plugin-unocss',
    version: '1.0.0',
    // `UnoCSS()` returns the plugin list itself; wrapping it in another array
    // produced a nested list that Vite happened to flatten.
    vitePlugins: UnoCSS({
      ...unocssOptions,
      ...(content ? { content } : {}),
    }),
  })
}

export default unocssPlugin
