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
import type { PluginLifecycleManager } from '../plugins'

let mdxCacheLoaded = false

export function boltdocsMdxPlugin(
  config?: BoltdocsConfig,
  getLifecycle?: () => PluginLifecycleManager | undefined,
  compiler = mdxPlugin,
): Plugin {
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

      // @ts-expect-error
      const result = await baseMdxPlugin.transform.call(
        this,
        code,
        cleanId,
        options,
      )

      if (result && typeof result === 'object' && result.code) {
        let finalCode = result.code

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
      }

      return result
    },

    async buildEnd() {
      mdxCache.save()
      await mdxCache.flush()
      if (baseMdxPlugin.buildEnd) {
        // @ts-expect-error
        await baseMdxPlugin.buildEnd.call(this)
      }
    },
  }
}
