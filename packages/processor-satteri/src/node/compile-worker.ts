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
import { workerData } from 'node:worker_threads'
import { mdxToJs } from 'satteri'
import { transformSync } from 'esbuild'
import { satteriRemarkMetaPlugin } from './satteri-plugins/remark-meta-plugin'
import { satteriRehypeSlugPlugin } from './satteri-plugins/rehype-slug-plugin'
import {
  satteriRehypeCodeHighlightPlugin,
  type CodeHighlightConfig,
} from './satteri-plugins/rehype-shiki-plugin'

const workerCodeHighlighting = (
  workerData as { codeHighlighting?: CodeHighlightConfig } | undefined
)?.codeHighlighting

// Built-in plugins (created once per worker, reused for all compilations)
const DEFAULT_MDAST_PLUGINS = [satteriRemarkMetaPlugin()]
const DEFAULT_HAST_PLUGINS = [
  satteriRehypeSlugPlugin(),
  satteriRehypeCodeHighlightPlugin(workerCodeHighlighting),
]

// Eagerly pre-warm Sätteri + the highlighter engine at worker instantiation.
// The source includes fenced blocks in every eager (common) language so the
// grammars load while the pool spins up instead of serially during the first
// real page compilations. `mdxToJs` is synchronous in the NAPI
// implementation, so use try/catch instead of Promise.catch() here. The
// compile path below intentionally uses `await`, which remains compatible
// with both sync and async implementations.
const PREWARM_SNIPPET = 'const boltdocsPrewarm = 1'
const PREWARM_SOURCE = [
  '# Prewarm',
  '',
  ...[
    'ts',
    'js',
    'tsx',
    'bash',
    'json',
    'css',
    'html',
    'python',
    'go',
    'markdown',
  ].map((lang) => ['```' + lang, PREWARM_SNIPPET, '```', ''].join('\n')),
].join('\n')

try {
  mdxToJs(PREWARM_SOURCE, {
    jsxRuntime: 'automatic',
    jsxImportSource: 'react',
    outputFormat: 'program',
    mdastPlugins: [...DEFAULT_MDAST_PLUGINS],
    hastPlugins: [...DEFAULT_HAST_PLUGINS],
    features: { gfm: true, frontmatter: true },
  })
} catch {
  // Prewarming is best-effort; compilation reports real errors to the caller.
}

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
