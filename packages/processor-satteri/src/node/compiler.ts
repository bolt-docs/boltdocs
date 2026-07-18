import { mdxToJs as satteriMdxToJs } from 'satteri'
import type { MdastPluginDefinition, HastPluginDefinition } from 'satteri'
import { transformSync } from 'esbuild'
import crypto from 'node:crypto'

const MDX_PLUGIN_VERSION = 'v6-fallback'

/** Minimal interface for TransformCache from boltdocs/node/cache. */
interface TransformCache {
  load(): Promise<void>
  save(): void
  getAsync(key: string): Promise<string | null>
  set(key: string, result: string): void
  flush(): Promise<void>
}

/** Result from the fallback MDX compiler. */
interface FallbackCompiler {
  transform(code: string, id: string): Promise<{ code: string } | null>
}

/**
 * Handles MDX compilation using Sätteri as the primary engine,
 * with a fallback to @mdx-js/rollup when Sätteri is unavailable.
 */
export class MdxCompiler {
  private mdastPlugins: MdastPluginDefinition[]
  private hastPlugins: HastPluginDefinition[]
  private cache!: TransformCache
  private cacheReady = false
  private fallbackCompiler: FallbackCompiler | null = null
  private fallbackPromise: Promise<FallbackCompiler | null> | null = null

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

  private async ensureFallback(): Promise<FallbackCompiler | null> {
    if (this.fallbackCompiler) return this.fallbackCompiler
    if (this.fallbackPromise) return this.fallbackPromise

    this.fallbackPromise = this.loadFallback()
    this.fallbackCompiler = await this.fallbackPromise
    return this.fallbackCompiler
  }

  private async loadFallback(): Promise<FallbackCompiler | null> {
    try {
      const mod = (await import('@mdx-js/rollup')) as {
        default: (opts: Record<string, unknown>) => FallbackCompiler
      }
      const [remarkGfm, remarkFrontmatter, rehypeSlug] = await Promise.all([
        import('remark-gfm').then((m) => m.default),
        import('remark-frontmatter').then((m) => m.default),
        import('rehype-slug').then((m) => m.default),
      ])
      return mod.default({
        jsxRuntime: 'automatic',
        jsxImportSource: 'react',
        remarkPlugins: [remarkGfm, remarkFrontmatter],
        rehypePlugins: [rehypeSlug],
      })
    } catch {
      return null
    }
  }

  /**
   * Compile source code using Sätteri, with esbuild for JSX transformation.
   * Returns the compiled code string, or null if compilation fails.
   */
  async satteriCompile(
    sourceCode: string,
    cleanId: string,
  ): Promise<string | null> {
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

    try {
      if (typeof satteriMdxToJs !== 'function') return null

      const result = await satteriMdxToJs(sourceCode, {
        jsxRuntime: 'automatic',
        jsxImportSource: 'react',
        outputFormat: 'program',
        mdastPlugins: [...this.mdastPlugins],
        hastPlugins: [...this.hastPlugins],
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

      // Store in cache
      try {
        const cache = await this.getCache()
        cache.set(cacheKey, compiledCode)
      } catch {
        // Cache write failure is non-fatal
      }

      return compiledCode
    } catch {
      return null
    }
  }

  /**
   * Fallback compilation using @mdx-js/rollup.
   */
  async fallbackCompile(
    sourceCode: string,
    cleanId: string,
  ): Promise<string | null> {
    const compiler = await this.ensureFallback()
    if (!compiler) return null
    try {
      const result = await compiler.transform(sourceCode, cleanId)
      if (result?.code) return result.code
    } catch {
      // Fallback failed
    }
    return null
  }

  /**
   * Compile MDX source code, trying Sätteri first then falling back.
   */
  async compile(sourceCode: string, cleanId: string): Promise<string | null> {
    const satteriResult = await this.satteriCompile(sourceCode, cleanId)
    if (satteriResult) return satteriResult
    return this.fallbackCompile(sourceCode, cleanId)
  }

  /** Flush cache on build end. */
  async flushCache(): Promise<void> {
    if (this.cache) {
      this.cache.save()
      await this.cache.flush()
    }
  }
}
