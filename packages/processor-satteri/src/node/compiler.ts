import { mdxToJs as satteriMdxToJs } from 'satteri'
import type { MdastPluginDefinition, HastPluginDefinition } from 'satteri'
import { transformSync } from 'esbuild'
import crypto from 'node:crypto'

export const MDX_PLUGIN_VERSION = 'v7-satteri-only'

/** Minimal interface for TransformCache from boltdocs/node/cache. */
interface TransformCache {
  load(): Promise<void>
  save(): void
  getAsync(key: string): Promise<string | null>
  set(key: string, result: string): void
  flush(): Promise<void>
}

/**
 * Handles MDX compilation using Sätteri as the only engine.
 * No fallback — Sätteri is the default processor for Boltdocs.
 */
export class MdxCompiler {
  private mdastPlugins: MdastPluginDefinition[]
  private hastPlugins: HastPluginDefinition[]
  private cache!: TransformCache
  private cacheReady = false

  constructor(
    mdastPlugins: MdastPluginDefinition[],
    hastPlugins: HastPluginDefinition[],
  ) {
    this.mdastPlugins = mdastPlugins
    this.hastPlugins = hastPlugins
  }

  private async ensureCache(): Promise<TransformCache> {
    if (!this.cacheReady) {
      const mod = (await import('boltdocs/node/cache')) as {
        TransformCache: new (name: string) => TransformCache
      }
      this.cache = new mod.TransformCache('mdx')
      this.cacheReady = true
    }
    return this.cache
  }

  private async getCache(): Promise<TransformCache> {
    return this.ensureCache()
  }

  /**
   * Compile MDX source code using Sätteri (Rust-based) with Shiki syntax highlighting.
   * Returns the compiled JS code string, or throws on failure.
   */
  async compile(sourceCode: string, cleanId: string): Promise<string> {
    const contentHash = crypto
      .createHash('md5')
      .update(sourceCode)
      .digest('hex')
    const isProd = process.env.NODE_ENV === 'production' ? 'prod' : 'dev'
    const cacheKey = `${cleanId}:${contentHash}:${isProd}:${MDX_PLUGIN_VERSION}`

    // Check cache first
    try {
      const cache = await this.getCache()
      const cached = await cache.getAsync(cacheKey)
      if (cached) return cached
    } catch {
      // Cache miss, continue
    }

    if (typeof satteriMdxToJs !== 'function') {
      throw new Error(
        `[boltdocs-satteri-mdx] Sätteri MDX compiler not available for ${cleanId}. ` +
          'Install @bdocs/processor-satteri or ensure the satteri npm package is installed.',
      )
    }

    const result = await satteriMdxToJs(sourceCode, {
      jsxRuntime: 'automatic',
      jsxImportSource: 'react',
      outputFormat: 'program',
      mdastPlugins: [...this.mdastPlugins],
      hastPlugins: [...this.hastPlugins],
      features: { gfm: true, frontmatter: true },
    })

    if (!result?.code) {
      throw new Error(
        `[boltdocs-satteri-mdx] Sätteri compilation returned no output for ${cleanId}`,
      )
    }

    const compiledCode = result.code

    // Store in cache
    try {
      const cache = await this.getCache()
      cache.set(cacheKey, compiledCode)
    } catch {
      // Cache write failure is non-fatal
    }

    return compiledCode
  }

  /**
   * Save cache to disk at build end.
   *
   * PR-03: Don't flush — the TransformCache is content-addressed so stale
   * entries are never returned.  Keeping them on disk means the next build
   * can skip re-compilation for unchanged files, saving ~1-2s on cold builds
   * after the first build.
   */
  async flushCache(): Promise<void> {
    if (this.cache) {
      this.cache.save()
      // P2-22: Actually flush the cache so it persists between processes.
      // Without this, cached entries written in one build are lost when
      // the process exits, and the next build starts with a cold TransformCache.
      // This ensures cold-dist builds get cache hits (~1-2s saved).
      await this.cache.flush()
    }
  }
}
