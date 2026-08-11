import { mdxToJs as satteriMdxToJs } from 'satteri'
import type { MdastPluginDefinition, HastPluginDefinition } from 'satteri'
import { transformSync } from 'esbuild'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

export const MDX_PLUGIN_VERSION = 'v9-transpile-jsx'

function resolveSatteriVersion(): string {
  try {
    const require = createRequire(import.meta.url)
    let directory = path.dirname(require.resolve('satteri'))
    for (let depth = 0; depth < 6; depth++) {
      const packagePath = path.join(directory, 'package.json')
      if (fs.existsSync(packagePath)) {
        const packageJson = JSON.parse(
          fs.readFileSync(packagePath, 'utf8'),
        ) as {
          name?: string
          version?: string
        }
        if (packageJson.name === 'satteri' && packageJson.version) {
          return packageJson.version
        }
      }
      const parent = path.dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  } catch {
    // Cache safety falls back to the compiler implementation signature.
  }
  return 'unknown'
}

const SATTERI_VERSION = resolveSatteriVersion()
const PROCESS_CACHE_NONCE = `${process.pid}:${Date.now()}:${Math.random()}`

/** Minimal interface for TransformCache from boltdocs/node/cache. */
interface TransformCache {
  load(): Promise<void>
  save(): void
  getAsync(key: string): Promise<string | null>
  set(key: string, result: string): void
  flush(): Promise<void>
}

function pluginSignature(
  plugin: unknown,
  ancestors: WeakSet<object> = new WeakSet(),
): string {
  if (typeof plugin === 'function') {
    return `function:${plugin.toString()}`
  }
  if (plugin === null || typeof plugin !== 'object') {
    return `${typeof plugin}:${String(plugin)}`
  }
  if (ancestors.has(plugin)) return '[Circular]'
  ancestors.add(plugin)

  const record = plugin as Record<string, unknown>
  if (record.__boltdocsPersistentCache === false) {
    return `nonpersistent:${PROCESS_CACHE_NONCE}:${String(record.__boltdocsCacheSignature ?? 'unknown')}`
  }
  const result = Array.isArray(plugin)
    ? `[${plugin.map((item) => pluginSignature(item, ancestors)).join(',')}]`
    : `{${Object.keys(record)
        .sort()
        .map(
          (key) =>
            `${JSON.stringify(key)}:${pluginSignature(record[key], ancestors)}`,
        )
        .join(',')}}`
  ancestors.delete(plugin)
  return result
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
  private cacheLoadPromise: Promise<void> | null = null
  private readonly compilerSignature: string

  constructor(
    mdastPlugins: MdastPluginDefinition[],
    hastPlugins: HastPluginDefinition[],
    cacheSignature = '',
  ) {
    this.mdastPlugins = mdastPlugins
    this.hastPlugins = hastPlugins
    this.compilerSignature = crypto
      .createHash('md5')
      .update(
        [
          MDX_PLUGIN_VERSION,
          `satteri:${SATTERI_VERSION}`,
          `engine:${pluginSignature(satteriMdxToJs)}`,
          `config:${cacheSignature}`,
          ...mdastPlugins.map((plugin) => pluginSignature(plugin)),
          ...hastPlugins.map((plugin) => pluginSignature(plugin)),
        ].join('|'),
      )
      .digest('hex')
  }

  get signature(): string {
    return this.compilerSignature
  }

  private async ensureCache(): Promise<TransformCache> {
    if (!this.cacheReady) {
      const mod = (await import('boltdocs/node/cache')) as {
        TransformCache: new (name: string) => TransformCache
      }
      this.cache = new mod.TransformCache('mdx')
      this.cacheLoadPromise = this.cache.load()
      this.cacheReady = true
    }
    if (this.cacheLoadPromise) {
      await this.cacheLoadPromise
      this.cacheLoadPromise = null
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
    const cacheKey = `${cleanId}:${contentHash}:${isProd}:${this.compilerSignature}`

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

    let compiledCode = result.code
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
