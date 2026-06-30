import { mdxToJs as satteriMdxToJs } from 'satteri'
import type {
  MdastPluginInput,
  HastPluginInput,
  RehypePluginLike,
} from 'satteri'
import { transformSync } from 'esbuild'
import type { Plugin } from 'vite'
import crypto from 'node:crypto'
import fs from 'node:fs'
import type { BoltdocsConfig } from 'boltdocs'
import type { PluginLifecycleManager } from 'boltdocs'
import { createSatteriProcessorPlugin } from './index'
import type { SatteriProcessorPlugin } from './index'
import {
  wrapRemarkPlugin,
  wrapRemarkCodePlugin,
} from './satteri-plugins/remark-adapter'
import { wrapHastPlugin } from './satteri-plugins/rehype-adapter'

const MDX_PLUGIN_VERSION = 'v6-fallback'

function collectUserPlugins(config: BoltdocsConfig) {
  const remarkPlugins: any[] = []
  const rehypePlugins: any[] = []

  for (const plugin of config?.plugins || []) {
    if (plugin.remarkPlugins) {
      for (const entry of plugin.remarkPlugins) {
        // Handle [pluginFn, options] tuple format
        if (Array.isArray(entry)) {
          const [fn, opts] = entry
          // Detect mermaid plugin by name pattern
          if (plugin.name === 'boltdocs-plugin-mermaid') {
            remarkPlugins.push(
              wrapRemarkCodePlugin(fn, opts, 'Mermaid', 'mermaid'),
            )
          } else {
            remarkPlugins.push(wrapRemarkPlugin(fn))
          }
        } else {
          remarkPlugins.push(wrapRemarkPlugin(entry))
        }
      }
    }
    if (plugin.rehypePlugins) {
      for (const entry of plugin.rehypePlugins) {
        if (Array.isArray(entry)) {
          rehypePlugins.push(wrapHastPlugin(entry[0]))
        } else {
          rehypePlugins.push(wrapHastPlugin(entry))
        }
      }
    }
  }

  return { remarkPlugins, rehypePlugins }
}

export function createSatteriMdxPlugin(
  config: BoltdocsConfig,
  getLifecycle: () => PluginLifecycleManager | undefined,
): Plugin {
  const processor = createSatteriProcessorPlugin()
  const mdastPlugins = processor.mdastPlugins || []
  const hastPlugins = processor.hastPlugins || []

  const {
    remarkPlugins: adaptedRemarkPlugins,
    rehypePlugins: adaptedRehypePlugins,
  } = collectUserPlugins(config)

  let _cache: any = null
  let _cacheReady = false
  let _fallbackCompiler: any = null

  async function ensureCache() {
    if (!_cacheReady) {
      const mod = await import('boltdocs/node/cache')
      _cache = new mod.TransformCache('mdx')
      _cacheReady = true
    }
    return _cache
  }

  async function ensureFallback() {
    if (!_fallbackCompiler) {
      try {
        const mod = await import('@mdx-js/rollup')
        const [remarkGfm, remarkFrontmatter, rehypeSlug] = await Promise.all([
          import('remark-gfm').then((m) => m.default),
          import('remark-frontmatter').then((m) => m.default),
          import('rehype-slug').then((m) => m.default),
        ])
        _fallbackCompiler = mod.default({
          jsxRuntime: 'automatic',
          jsxImportSource: 'react',
          remarkPlugins: [remarkGfm, remarkFrontmatter],
          rehypePlugins: [rehypeSlug],
        })
      } catch {
        return null
      }
    }
    return _fallbackCompiler
  }

  function isMdx(id: string): boolean {
    const [cleanId] = id.split('?')
    return cleanId.endsWith('.md') || cleanId.endsWith('.mdx')
  }

  function looksCompiled(code: string): boolean {
    return (
      code.includes('function _createMdxContent') ||
      code.includes('react/jsx-runtime') ||
      code.includes('export default function MDXContent')
    )
  }

  async function getCache() {
    const c = await ensureCache()
    return c
  }

  async function satteriCompile(
    sourceCode: string,
    cleanId: string,
  ): Promise<string | null> {
    const contentHash = crypto
      .createHash('md5')
      .update(sourceCode)
      .digest('hex')
    const isProd = process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
    const cacheKey = `${cleanId}:${contentHash}:${isProd}:${MDX_PLUGIN_VERSION}`

    try {
      const cache = await getCache()
      const cached = await cache.getAsync(cacheKey)
      if (cached) return cached
    } catch {}

    try {
      if (typeof satteriMdxToJs !== 'function') return null
      const result = await satteriMdxToJs(sourceCode, {
        jsxRuntime: 'automatic',
        jsxImportSource: 'react',
        outputFormat: 'program',
        mdastPlugins: [...mdastPlugins, ...adaptedRemarkPlugins],
        hastPlugins: [...hastPlugins, ...adaptedRehypePlugins],
        features: { gfm: true, frontmatter: true },
      })
      if (!result?.code) return null

      let compiledCode = result.code
      // Only invoke esbuild if there are uncompiled JSX elements (e.g. <Settings />)
      if (/<\w+/.test(compiledCode)) {
        try {
          const transformed = transformSync(compiledCode, {
            loader: 'jsx',
            jsx: 'automatic',
            jsxImportSource: 'react',
          })
          if (transformed?.code) {
            compiledCode = transformed.code
          }
        } catch (err) {
          console.error('[boltdocs-satteri-mdx] esbuild error:', err)
        }
      }

      try {
        const cache = await getCache()
        cache.set(cacheKey, compiledCode)
      } catch {}
      return compiledCode
    } catch {
      return null
    }
  }

  async function fallbackCompile(
    sourceCode: string,
    cleanId: string,
  ): Promise<string | null> {
    const compiler = await ensureFallback()
    if (!compiler) return null
    try {
      const result = await compiler.transform(sourceCode, cleanId)
      if (result?.code) return result.code
    } catch {}
    return null
  }

  async function compileMdx(
    sourceCode: string,
    cleanId: string,
  ): Promise<string | null> {
    const satteriResult = await satteriCompile(sourceCode, cleanId)
    if (satteriResult) return satteriResult
    return fallbackCompile(sourceCode, cleanId)
  }

  return {
    name: 'vite-plugin-boltdocs-satteri-mdx',
    enforce: 'pre',

    async load(id) {
      if (!isMdx(id)) return null

      const [cleanId] = id.split('?')
      let rawCode: string
      try {
        rawCode = fs.readFileSync(cleanId, 'utf-8')
      } catch {
        return null
      }

      const lifecycle = getLifecycle?.()
      let sourceCode = rawCode
      if (lifecycle) {
        try {
          const result = await lifecycle.runChain('transformSource', {
            code: rawCode,
            filePath: cleanId,
          })
          if (result?.code) sourceCode = result.code
        } catch {}
      }

      const compiled = await compileMdx(sourceCode, cleanId)
      if (compiled) return compiled
      return sourceCode
    },

    async transform(code, id) {
      if (!isMdx(id)) return null

      let finalCode = code as string
      if (!looksCompiled(finalCode)) {
        const compiled = await compileMdx(finalCode, id.split('?')[0])
        if (compiled) finalCode = compiled
      }

      let codeResult = finalCode
      const lifecycle = getLifecycle?.()
      if (lifecycle) {
        try {
          const result = await lifecycle.runChain('transformMdx', {
            code: finalCode,
            filePath: id.split('?')[0],
          })
          if (result?.code) codeResult = result.code
        } catch {}
      }

      return { code: codeResult, map: null }
    },

    async buildEnd() {
      if (_cache) {
        _cache.save()
        await _cache.flush()
      }
    },
  }
}
