/**
 * P2-22: Compile worker — runs in a Node.js worker_thread to parallelize
 * Sätteri MDX compilation across CPU cores.
 *
 * Each worker imports satteri + esbuild once (expensive init) and then
 * handles compile requests via message passing.
 *
 * Built-in plugins (remark-meta, rehype-slug, rehype-shiki) are imported
 * directly.  User plugins are handled by the main thread (fallback).
 */
import { mdxToJs } from 'satteri'
import { transformSync } from 'esbuild'
import { satteriRemarkMetaPlugin } from './satteri-plugins/remark-meta-plugin'
import { satteriRehypeSlugPlugin } from './satteri-plugins/rehype-slug-plugin'
import { satteriRehypeShikiPlugin } from './satteri-plugins/rehype-shiki-plugin'

// Built-in plugins (created once per worker, reused for all compilations)
const DEFAULT_MDAST_PLUGINS = [satteriRemarkMetaPlugin()]
const DEFAULT_HAST_PLUGINS = [
  satteriRehypeSlugPlugin(),
  satteriRehypeShikiPlugin(),
]

export default async function compileTask(msg: {
  sourceCode: string
  filePath: string
}) {
  const { sourceCode, filePath } = msg

  try {
    const result = await mdxToJs(sourceCode, {
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      outputFormat: 'program',
      mdastPlugins: [...DEFAULT_MDAST_PLUGINS],
      hastPlugins: [...DEFAULT_HAST_PLUGINS],
      features: { gfm: true, frontmatter: true },
    })

    let compiledCode = result?.code ?? ''
    if (compiledCode.includes('<')) {
      try {
        const transformed = transformSync(compiledCode, {
          loader: 'jsx',
          jsx: 'automatic',
          jsxImportSource: 'react',
        })
        if (transformed?.code) {
          compiledCode = transformed.code
        }
      } catch {}
    }

    return {
      compiledCode,
      filePath,
      success: true,
    }
  } catch (err) {
    return {
      compiledCode: '',
      filePath,
      success: false,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}
