import { parentPort } from 'node:worker_threads'
import { compile } from '@mdx-js/mdx'
import remarkGfm from 'remark-gfm'
import remarkFrontmatter from 'remark-frontmatter'
import rehypeSlug from 'rehype-slug'
import type { BoltdocsConfig } from '../config'
import { resolveConfig } from '../config'
import { remarkMetaPlugin } from './remark-meta-plugin'
import { rehypeShiki } from './rehype-shiki'

interface TransformMessage {
  type: 'TRANSFORM_MDX'
  code: string
  id: string
  docsDir: string
  root: string
  command: string
  mode: string
}

// Cache the resolved config at the worker-thread level. A single worker can
// process many MDX files, so reloading the user config on every message would
// be extremely expensive and could re-instantiate plugins repeatedly.
const configCache = new Map<string, Promise<BoltdocsConfig>>()

function getConfigCacheKey(docsDir: string, root: string): string {
  return `${root}:${docsDir}`
}

parentPort?.on('message', async (message: TransformMessage) => {
  if (message.type !== 'TRANSFORM_MDX') return

  try {
    const cacheKey = getConfigCacheKey(message.docsDir, message.root)
    let cached = configCache.get(cacheKey)
    if (!cached) {
      cached = resolveConfig(
        message.docsDir,
        message.root,
        message.command,
        message.mode,
      )
      configCache.set(cacheKey, cached)
    }
    const config = await cached

    const extraRemarkPlugins =
      config.plugins?.flatMap((p) => p.remarkPlugins || []) || []
    const extraRehypePlugins =
      config.plugins?.flatMap((p) => p.rehypePlugins || []) || []

    const file = await compile(message.code, {
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
    })

    parentPort?.postMessage({ type: 'SUCCESS', code: String(file) })
  } catch (err) {
    parentPort?.postMessage({
      type: 'ERROR',
      error: err instanceof Error ? err.message : String(err),
    })
  }
})
