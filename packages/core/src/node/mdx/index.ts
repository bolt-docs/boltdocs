import mdxPlugin from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeSlug from 'rehype-slug'
import type { Plugin } from 'vite'
import crypto from 'node:crypto'
import fs from 'node:fs'

import type { BoltdocsConfig } from '../config'
import { mdxCache, MDX_PLUGIN_VERSION } from './cache'
import { getFileMtime } from '../utils'
import { rehypeShiki } from './rehype-shiki'
import { remarkMetaPlugin } from './remark-meta-plugin'
import { warn } from '@bdocs/dui'
import type { IPluginLifecycleManager } from '../../shared/types'
import { MdxWorkerPool } from './worker-pool'

let mdxCacheLoaded = false

export function boltdocsMdxPlugin(
  config?: BoltdocsConfig,
  getLifecycle?: () => IPluginLifecycleManager | undefined,
  compiler = mdxPlugin,
): Plugin {
  const workerPool = new MdxWorkerPool()
  const extraRemarkPlugins =
    config?.plugins?.flatMap((p) => p.remarkPlugins || []) || []
  const extraRehypePlugins =
    config?.plugins?.flatMap((p) => p.rehypePlugins || []) || []

  const baseMdxPlugin = compiler({
    remarkPlugins: [
      remarkGfm,
      remarkFrontmatter,
      remarkMetaPlugin,
      ...(extraRemarkPlugins as any[]),
    ],
    rehypePlugins: [
      rehypeSlug,
      [rehypeShiki, config],
      ...(extraRehypePlugins as any[]),
    ],
    jsxRuntime: 'automatic',
  }) as Plugin

  return {
    ...baseMdxPlugin,
    name: 'vite-plugin-boltdocs-mdx',

    async buildStart() {
      if (!mdxCacheLoaded) {
        await mdxCache.load()
        mdxCacheLoaded = true
      }
      if (baseMdxPlugin.buildStart) {
        // @ts-expect-error
        await baseMdxPlugin.buildStart.call(this)
      }
    },

    async load(id, options) {
      if (id.endsWith('.md') || id.endsWith('.mdx')) {
        try {
          let code = fs.readFileSync(id, 'utf-8')
          const lifecycle = getLifecycle?.()
          if (lifecycle) {
            const result = await lifecycle.runChain('transformSource', {
              code,
              filePath: id,
            })
            code = result.code
          }
          return code
        } catch {
          return null
        }
      }
      if (baseMdxPlugin.load) {
        // @ts-expect-error
        return baseMdxPlugin.load.call(this, id, options)
      }
      return null
    },

    async transform(code, id, options) {
      const [cleanId] = id.split('?')
      if (!cleanId.endsWith('.md') && !cleanId.endsWith('.mdx')) {
        // @ts-expect-error
        return baseMdxPlugin.transform?.call(this, code, id, options)
      }

      const isProd = process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
      // In dev, use file path + mtime instead of content hash.
      // This allows cache hits across restarts when files haven't changed,
      // and avoids the O(N) cost of hashing the full source on every transform.
      const isDev = isProd === 'dev'
      const cacheKey = isDev
        ? `${cleanId}:${getFileMtime(cleanId)}:${isProd}:${MDX_PLUGIN_VERSION}`
        : `${cleanId}:${crypto.createHash('md5').update(code).digest('hex')}:${isProd}:${MDX_PLUGIN_VERSION}`

      const cached = await mdxCache.getAsync(cacheKey)
      if (cached) {
        return { code: cached, map: null }
      }

      let finalCode: string

      // Offload the heavy MDX compilation to worker threads. This frees the
      // Vite main thread to keep serving modules while multiple files are
      // compiled in parallel on other CPU cores.
      try {
        const mode =
          process.env.NODE_ENV === 'production' ? 'production' : 'development'
        finalCode = await workerPool.transform({
          code,
          id: cleanId,
          docsDir: config?.docsDir || process.cwd(),
          root: process.cwd(),
          command: mode === 'production' ? 'build' : 'serve',
          mode,
        })
      } catch (workerErr) {
        // Worker failed (e.g. a plugin cannot be loaded in a worker context).
        // Fall back to the in-process transform so the build still completes.
        warn(
          `[mdx-worker] MDX worker transform failed for "${cleanId}", falling back to in-process transform: ${
            workerErr instanceof Error ? workerErr.message : String(workerErr)
          }`,
        )
        // @ts-expect-error
        const result = await baseMdxPlugin.transform.call(
          this,
          code,
          cleanId,
          options,
        )

        if (result && typeof result === 'object' && result.code) {
          finalCode = result.code
        } else {
          return result
        }
      }

      const lifecycle = getLifecycle?.()
      if (lifecycle) {
        const transformed = await lifecycle.runChain('transformMdx', {
          code: finalCode,
          filePath: cleanId,
        })
        finalCode = transformed.code
      }

      mdxCache.set(cacheKey, finalCode)
      return { code: finalCode, map: null }
    },

    async buildEnd() {
      mdxCache.save()
      await mdxCache.flush()
      await workerPool.terminate()
      if (baseMdxPlugin.buildEnd) {
        // @ts-expect-error
        await baseMdxPlugin.buildEnd.call(this)
      }
    },
  }
}
