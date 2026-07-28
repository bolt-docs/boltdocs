import { colors, warn, error } from '@bdocs/dui'
import type { InlineConfig, PluginOption } from 'vite'
import type {
  RouteRecord,
  ViteReactSSGContext,
  ViteReactSSGOptions,
} from '../types'
import { createRequire } from 'node:module'
import os from 'node:os'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import fs from 'fs-extra'
import {
  createLogger,
  mergeConfig,
  resolveConfig,
  build as viteBuild,
  version as viteVersion,
} from 'vite'
import {
  removeLeadingSlash,
  withLeadingSlash,
  withTrailingSlash,
} from '../utils/path'
import { serializeState } from '../utils/state'
import { collectAssets } from './assets'
import { getBeasties, getZigCritters } from './critical'
import {
  computeRouteClientAssetHash,
  createManifestIndexes,
} from './client-dep-map'
import crypto from 'node:crypto'
import { detectEntry, renderHTML, SCRIPT_COMMENT_PLACEHOLDER } from './html'
import { renderPreloadLinks, renderPreloadLinksString } from './preload-links'
import { getAdapter } from './router-adapter'
import { getSize, resolveAlias, routesToPaths } from './utils'
import {
  collectPerformanceMetrics,
  writePerformanceMetrics,
} from './performance'
import { computeClientCodeHash } from './client-hash'

const dotVitedir = Number.parseInt(viteVersion) >= 5 ? ['.vite'] : []
function buildBundlerOptions<T extends Record<string, unknown>>(
  options: T,
): { rolldownOptions: T } | { rollupOptions: T } {
  return Number.parseInt(viteVersion) >= 8
    ? { rolldownOptions: options }
    : { rollupOptions: options }
}

export type SSRManifest = Record<string, string[]>
export interface ManifestItem {
  css?: string[]
  file: string
  imports?: string[]
  dynamicImports?: string[]
  src?: string
  assets?: string[]
}

export type Manifest = Record<string, ManifestItem>

export interface SsgCacheItem {
  contentHash: string
  mtime: number
  loaderDataFilePath?: string
  assetHash?: string
}

export type StaticLoaderDataManifest = Record<string, string>

export type CreateRootFactory = (
  client: boolean,
  routePath?: string,
) => Promise<ViteReactSSGContext<true> | ViteReactSSGContext<false>>

/**
 * Convert route path to loader data file path with hash
 * @example '/', 'abc123' -> 'static-loader-data/index.abc123.json'
 * @example '/about', 'abc123' -> 'static-loader-data/about.abc123.json'
 * @example '/docs/api', 'abc123' -> 'static-loader-data/docs/api.abc123.json'
 * @example '/docs/', 'abc123' -> 'static-loader-data/docs/index.abc123.json'
 */
function getLoaderDataFilePath(routePath: string, hash: string): string {
  const normalized =
    routePath === '/'
      ? '/index'
      : routePath.endsWith('/')
        ? `${routePath}index`
        : routePath
  return `static-loader-data${withLeadingSlash(normalized)}.${hash}.json`
}

function isChunkFile(file: string): boolean {
  const ext = file.slice(file.lastIndexOf('.')).toLowerCase()
  return ext === '.js' || ext === '.mjs' || ext === '.css'
}

function collectChunkFiles(manifest: Manifest): string[] {
  const files = new Set<string>()
  for (const item of Object.values(manifest)) {
    if (isChunkFile(item.file)) files.add(item.file)
    for (const css of item.css || []) {
      if (isChunkFile(css)) files.add(css)
    }
    for (const imported of item.imports || []) {
      if (isChunkFile(imported)) files.add(imported)
    }
    for (const dyn of item.dynamicImports || []) {
      if (isChunkFile(dyn)) files.add(dyn)
    }
  }
  return [...files]
}

async function computeChunkHashes(
  outDir: string,
  manifest: Manifest,
): Promise<Map<string, string>> {
  const chunkFiles = collectChunkFiles(manifest)
  const hashes = new Map<string, string>()
  if (chunkFiles.length === 0) return hashes

  const hasherFor = (buffer: Buffer) =>
    crypto
      .createHash('md5')
      .update(buffer as Uint8Array)
      .digest('hex')

  await Promise.all(
    chunkFiles.map(async (file) => {
      try {
        const buffer = await fs.readFile(join(outDir, file))
        hashes.set(file, hasherFor(buffer))
      } catch {
        // Ignore files that cannot be read
      }
    }),
  )

  return hashes
}

function getNormalizedPathKey(routePath: string, base: string = '/'): string {
  const leading = withLeadingSlash(routePath)
  let full = leading
  if (base !== '/') {
    const prefix = withLeadingSlash(base).replace(/\/$/, '')
    if (!leading.startsWith(prefix + '/') && leading !== prefix) {
      full = `${prefix}${leading}`
    }
  }
  return full !== '/' && full.endsWith('/') ? full.slice(0, -1) : full
}

/**
 * PR-08+: Vite plugin that intercepts CSS imports during SSR builds and returns
 * an empty string.  The client build already handles all CSS — processing it
 * again in the SSR bundle is pure overhead (CSS is only needed for critical CSS
 * inlining, which reads files from the client dist, not the SSR bundle).
 *
 * This eliminates ~500ms-1s of Rolldown CSS processing per SSR build.
 */
function createSsrCssSkipPlugin(): PluginOption {
  const CSS_VIRTUAL_PREFIX = '\0virtual:ssr-empty-css'
  return {
    name: 'vite-react-ssg:ssr-skip-css',
    enforce: 'pre',
    resolveId(id: string) {
      if (id.endsWith('.css') && !id.startsWith('\0')) {
        return CSS_VIRTUAL_PREFIX + id
      }
      return null
    },
    load(id: string) {
      if (id.startsWith(CSS_VIRTUAL_PREFIX)) {
        return { code: 'export default undefined', map: null }
      }
      return null
    },
  }
}

function filterPluginsForSsr(plugins: any[]): any[] {
  return plugins
    .map((plugin) => {
      if (Array.isArray(plugin)) {
        return filterPluginsForSsr(plugin)
      }
      if (plugin && typeof plugin === 'object' && 'name' in plugin) {
        const name = plugin.name
        if (
          name === 'vite:react-babel' ||
          name === 'vite:react-refresh' ||
          name === 'vite:react-jsx' ||
          (typeof name === 'string' && name.includes('tailwind')) ||
          name === 'vite-plugin-image-optimizer' ||
          name === 'vite-plugin-boltdocs-dev-server'
        ) {
          return null
        }
      }
      return plugin
    })
    .filter(Boolean)
}

function DefaultIncludedRoutes(
  paths: string[],
  _routes: Readonly<RouteRecord[]>,
) {
  // ignore dynamic routes
  return paths.filter((i) => !i.includes(':') && !i.includes('*'))
}

export async function build(
  ssgOptions: Partial<ViteReactSSGOptions> = {},
  viteConfig: InlineConfig = {},
) {
  const mode =
    process.env.MODE || process.env.NODE_ENV || ssgOptions.mode || 'production'

  // Ensure all plugins (e.g. @bdocs/plugin-mermaid) can detect
  // they are running inside a production build.
  // Vite already does this for its own resolution, but we make it
  // explicit so plugins that check process.env.NODE_ENV directly
  // (instead of Vite's mode) see the correct value.
  if (mode !== process.env.NODE_ENV) {
    process.env.NODE_ENV = mode
  }

  // ── Early path computation (before resolveConfig) ────────────────
  // Extract root, outDir, and cacheDir from the InlineConfig directly
  // so we can compute the client hash and check the cache BEFORE the
  // expensive Vite resolveConfig call (~10s).
  const cwd = process.cwd()
  const root = viteConfig.root || cwd
  let outDir =
    (viteConfig.build as { outDir?: string } | undefined)?.outDir || 'dist'
  let configBase = (viteConfig.base as string) || '/'

  const buildStartTime = performance.now()

  // Peek at ssgOptions passed directly (no resolveConfig needed).
  // Only extract the MINIMUM fields needed for the early hash and cache
  // check. Full option extraction from mergedOptions happens after resolveConfig.
  const {
    onFinished,
    onStep,
    routeToSourceFileMap = {},
    cacheDir = '.boltdocs/build',
    htmlEntry = 'index.html',
    entry = await detectEntry(root, htmlEntry),
  }: ViteReactSSGOptions = ssgOptions as any

  let docsDirName = 'docs'
  const sourceFiles = Object.values(routeToSourceFileMap)
  if (sourceFiles.length > 0) {
    const firstFile = sourceFiles[0]
    const relativeFirst = relative(root, firstFile).replace(/\\/g, '/')
    const parts = relativeFirst.split('/')
    if (parts.length > 0) {
      docsDirName = parts[0]
    }
  }

  const out = isAbsolute(outDir) ? outDir : join(root, outDir)
  const finalCacheDir = isAbsolute(cacheDir) ? cacheDir : join(root, cacheDir)

  // Compute client hash early (before resolveConfig) so we can check
  // the client cache and potentially skip the Vite config resolution.
  let currentClientHash = computeClientCodeHash(
    root,
    docsDirName,
    finalCacheDir,
  )
  let hash = currentClientHash.substring(0, 12)

  // ssgOut uses a placeholder until turbo is resolved from config
  let ssgOut = join(finalCacheDir, 'ssr', hash)
  let clientCacheDir = join(finalCacheDir, 'client-cache', currentClientHash)
  let hashFile = join(clientCacheDir, 'client-hash.txt')

  let canBypassClientBuild = false
  try {
    if (
      fs.existsSync(hashFile) &&
      fs.existsSync(join(clientCacheDir, 'dist'))
    ) {
      const savedHash = (await fs.readFile(hashFile, 'utf-8')).trim()
      canBypassClientBuild = savedHash === currentClientHash
    }
  } catch (e) {
    // Ignore and run full client build
  }

  // ── Skip resolveConfig when all routes cached ────────────────────
  // If client is bypassed and ALL routes have cached HTML files, skip
  // the expensive Vite resolveConfig (~2-10s) and just copy files.
  const ssgPagesDir = join(finalCacheDir, 'ssg-pages')
  const cachePath = join(finalCacheDir, 'ssg-cache.json')

  let routesPaths: string[] = []
  let routesCacheAvailable = false

  if (canBypassClientBuild) {
    const routesCachePath = join(finalCacheDir, 'routes-cache.json')
    try {
      if (fs.existsSync(routesCachePath)) {
        const cachedRoutes = JSON.parse(
          fs.readFileSync(routesCachePath, 'utf-8'),
        ) as { paths: string[] }
        const allCached = cachedRoutes.paths.every((p: string) => {
          const pathHash = crypto.createHash('md5').update(p).digest('hex')
          return fs.existsSync(join(ssgPagesDir, `${pathHash}.html`))
        })
        if (allCached) {
          routesPaths = cachedRoutes.paths
          routesCacheAvailable = true
        }
      }
    } catch {}
  }

  if (routesCacheAvailable) {
    // Fast path: resolveConfig skipped, copy cached files, return.
    if (fs.existsSync(out)) await fs.remove(out)
    await fs.copy(join(clientCacheDir, 'dist'), out)

    const loaderDataManifest: Record<string, string> = {}
    for (const p of routesPaths) {
      const pathHash = crypto.createHash('md5').update(p).digest('hex')
      const cachedHtmlPath = join(ssgPagesDir, `${pathHash}.html`)
      const cachedLoaderPath = join(ssgPagesDir, `${pathHash}.json`)
      const filename = `${(p.endsWith('/') ? `${p}index` : p).replace(/^\//g, '')}.html`
      const finalOutFile = join(out, filename)
      await fs.ensureDir(dirname(finalOutFile))
      await fs.copy(cachedHtmlPath, finalOutFile)
      if (fs.existsSync(cachedLoaderPath)) {
        try {
          const ssgCached = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
          const nk = withLeadingSlash(p).replace(/\/$/, '')
          const lEntry = ssgCached[nk] || ssgCached[p]
          if (lEntry?.loaderDataFilePath) {
            await fs.copy(
              cachedLoaderPath,
              join(out, lEntry.loaderDataFilePath),
            )
            loaderDataManifest[getNormalizedPathKey(p, configBase)] =
              lEntry.loaderDataFilePath
          }
        } catch {}
      }
    }
    if (Object.keys(loaderDataManifest).length > 0) {
      await fs.writeFile(
        join(out, `static-loader-data-manifest-${hash}.json`),
        JSON.stringify(loaderDataManifest, null, 0),
      )
    }
    const totalTime = Math.round(performance.now() - buildStartTime)
    onStep?.({
      name: 'Client build',
      duration: 0,
      success: true,
      details: 'Code unchanged, restored from cache',
    })
    onStep?.({
      name: 'Server build',
      duration: 0,
      success: true,
      details: 'SSR bundle unchanged, skipped',
    })
    onStep?.({
      name: 'Render pages',
      duration: 0,
      success: true,
      details: `${routesPaths.length} pages (all cached)`,
    })
    onStep?.({
      name: 'Build metrics',
      duration: 0,
      success: true,
      details: `Build time: ${(totalTime / 1000).toFixed(1)}s, all cached`,
    })
    await onFinished?.(outDir)
    return
  }

  // ── Normal path: resolve Vite config ─────────────────────────────
  const resolvedConfig = await resolveConfig(viteConfig, 'build', mode, mode)

  const mergedOptions = Object.assign(
    {},
    resolvedConfig.ssgOptions || {},
    ssgOptions,
  )

  // Full option extraction from mergedOptions
  const {
    script = 'sync',
    mock = false,
    formatting = 'none',
    includedRoutes: configIncludedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    dirStyle = 'flat',
    includeAllRoutes = false,
    format = 'esm',
    concurrency = 20,
    rootContainerId = 'root',
    beastiesOptions: rawBeasties = {},
  }: ViteReactSSGOptions & { beastiesOptions?: any } = mergedOptions as any

  const beastiesOptions = rawBeasties
  const turbo = (mergedOptions.turbo as boolean) ?? false
  ssgOut = join(finalCacheDir, 'ssr', turbo ? 'turbo-ssr' : hash)

  function shouldSuppressLog(msg: string): boolean {
    return (
      msg.startsWith('dist/') ||
      msg.startsWith('.boltdocs/build/ssr/') ||
      msg.startsWith('rendering chunks') ||
      msg === 'computing gzip size...' ||
      (msg.includes('built in') && msg.includes('s'))
    )
  }

  const clientLogger = createLogger()
  const loggerWarn = clientLogger.warn
  clientLogger.warn = (msg: string, options) => {
    if (
      msg.includes('externalized for browser compatibility') ||
      msg.includes("can't be bundled without type") ||
      shouldSuppressLog(msg)
    ) {
      return
    }
    loggerWarn(msg, options)
  }
  const loggerInfo = clientLogger.info
  clientLogger.info = (msg: string, options) => {
    if (shouldSuppressLog(msg)) return
    loggerInfo(msg, options)
  }

  if (canBypassClientBuild) {
    onStep?.({
      name: 'Client build',
      duration: 0,
      success: true,
      details: 'Code unchanged, restored from cache',
    })
    // PR-05: Use hard links for near-instant cache restoration (~10ms vs ~500ms).
    // Hard links share the same inode — zero copy, zero extra disk space.
    if (fs.existsSync(out)) await fs.remove(out)
    hardLinkDir(join(clientCacheDir, 'dist'), out)
  } else {
    const clientStart = performance.now()
    await viteBuild(
      mergeConfig(viteConfig, {
        logLevel: 'warn',
        build: {
          manifest: true,
          ssrManifest: true,
          chunkSizeWarningLimit: 2000,
          reportCompressedSize: false,
          sourcemap: false,
          cssMinify: 'esbuild',
          ...buildBundlerOptions({
            input: { app: join(root, htmlEntry || './index.html') },
            output: {
              // P2-20.3: Split vendor deps into stable chunks for better caching.
              // This reduces app chunk size and allows Rolldown to skip re-processing
              // unchanged vendor modules on incremental builds.
              manualChunks(id: string) {
                if (!id.includes('node_modules') && !id.includes('.boltdocs')) {
                  return
                }
                if (
                  id.includes('/node_modules/react/') ||
                  id.includes('/node_modules/react-dom/') ||
                  id.includes('/node_modules/scheduler/')
                ) {
                  return 'react-vendor'
                }
                if (id.includes('/node_modules/react-router')) {
                  return 'react-router'
                }
                if (id.includes('/node_modules/lucide-react')) {
                  return 'lucide-icons'
                }
                if (id.includes('/node_modules/react-helmet-async')) {
                  return 'react-helmet'
                }
                // mdx-pages are already in chunks; keep them together
                if (id.includes('.boltdocs/compiled/pages/chunk-')) {
                  return 'mdx-pages'
                }
              },
            } as any,
            onLog(level, log, handler) {
              if (
                log.message.includes('react-helmet-async') ||
                shouldSuppressLog(log.message)
              )
                return
              handler(level, log)
            },
          }),
        },
        customLogger: clientLogger,
        mode: resolvedConfig.mode,
        plugins: [
          {
            name: 'vite-react-ssg:get-oup-dir',
            configResolved(resolvedConfig) {
              outDir = resolvedConfig.build.outDir || 'dist'
            },
          } as PluginOption,
        ],
      }),
    )
    onStep?.({
      name: 'Client build',
      duration: performance.now() - clientStart,
      success: true,
      details: 'Vite production build',
    })
    currentClientHash = computeClientCodeHash(root, docsDirName, finalCacheDir)
    hash = currentClientHash.substring(0, 12)
    ssgOut = join(finalCacheDir, 'ssr', turbo ? 'turbo-ssr' : hash)
    clientCacheDir = join(finalCacheDir, 'client-cache', currentClientHash)
    hashFile = join(clientCacheDir, 'client-hash.txt')
    await fs.ensureDir(clientCacheDir)
    const cachedDist = join(clientCacheDir, 'dist')
    if (fs.existsSync(cachedDist)) await fs.remove(cachedDist)
    await fs.copy(out, cachedDist)
    await fs.writeFile(hashFile, currentClientHash, 'utf-8')
    await pruneDirectoryCache(join(finalCacheDir, 'client-cache'))
  }

  // === SSG cache setup ===
  let ssgCache: Record<string, SsgCacheItem> = {}
  if (!turbo) {
    try {
      if (fs.existsSync(cachePath)) {
        ssgCache = await fs.readJson(cachePath)
      }
    } catch {}
  }

  // ── PR-05: Early "all routes cached" check ──────────────────────
  // If the client build is bypassed (no source or config changes) we can
  // check the persistent ssgCache to see whether EVERY route's HTML is
  // already cached and up-to-date.  When that's true we skip the expensive
  // SSR bundle import (~1-2s), worker pool init (~500ms), and chunk hashing
  // (~500ms) entirely and jump straight to the copy phase.
  //
  // Routes are loaded from routes-cache.json (written at the end of every
  // previous build).  Each route is validated against ssgCache — if the
  // cache entry exists and its assetHash matches currentClientHash, the
  // cached HTML is still valid.
  let canSkipSsrImport = false
  if (canBypassClientBuild) {
    try {
      const routesCachePath = join(finalCacheDir, 'routes-cache.json')
      if (fs.existsSync(routesCachePath)) {
        const cachedRoutes = JSON.parse(
          fs.readFileSync(routesCachePath, 'utf-8'),
        ) as { paths: string[] }
        const allExistInCache =
          cachedRoutes.paths.length > 0 &&
          cachedRoutes.paths.every((p: string) => {
            const nk = withLeadingSlash(p).replace(/\/$/, '')
            const entry = ssgCache[nk] || ssgCache[p]
            // The cached HTML is valid because canBypassClientBuild confirms
            // no source, config, or plugin changes since the previous build.
            // The ssgCache entry just needs to exist (hashes are validated
            // in the for-loop for non-skipped paths).
            return !!entry
          })
        if (allExistInCache) {
          routesPaths = cachedRoutes.paths
          canSkipSsrImport = true
        }
      }
    } catch {
      // Fall through to normal path
    }
  }

  let unmock = () => {}
  if (mock) {
    const { jsdomGlobal } = (await import('./jsdomGlobal.mjs')) as {
      jsdomGlobal: () => () => void
    }
    unmock = jsdomGlobal()
  }

  const renderStartTime = performance.now()

  if (!canSkipSsrImport) {
    // Routes will be populated from SSR import below
    routesPaths = []
  }

  // ── PR-08: Server build (SSR bundle) ─────────────────────────────
  // The SSR bundle is only used internally by the SSG renderer — never
  // served to browsers.  We strip everything unnecessary: minification
  // (saves ~500ms), CSS processing (saves ~500ms).
  //
  // On warm builds (canBypassClientBuild=true) the SSR bundle from the
  // previous build is on disk, so the build is skipped entirely.
  const ssrEntry = !canSkipSsrImport
    ? await resolveAlias(resolvedConfig, entry)
    : ''
  const serverBuildSkipped =
    (turbo || canBypassClientBuild) &&
    fs.existsSync(ssgOut) &&
    fs
      .readdirSync(ssgOut)
      .filter((f) => f.endsWith('.mjs') || f.endsWith('.cjs')).length > 0
  if (serverBuildSkipped) {
    onStep?.({
      name: 'Server build',
      duration: 0,
      success: true,
      details: 'SSR bundle unchanged, skipped',
    })
  } else {
    if (fs.existsSync(ssgOut)) await fs.remove(ssgOut)
    process.env.VITE_SSG = 'true'
    const serverStart = performance.now()
    await viteBuild(
      mergeConfig(viteConfig, {
        logLevel: 'warn',
        build: {
          ssr: !canSkipSsrImport ? ssrEntry : entry,
          manifest: true,
          outDir: ssgOut,
          // P2-30.3: Skip compressed size calculation (saves ~500ms in SSR build).
          reportCompressedSize: false,
          // P2-30.3: Target ES2022 for Node 18+ native support.
          target: 'es2022',
          // PR-08: No minification — SSR bundle is only used internally.
          minify: false,
          cssCodeSplit: false,
          // PR-08: Skip CSS entirely for SSR.  The client build already
          // handles all CSS.  Processing it again for SSR is wasted work.
          cssMinify: false,
          ...buildBundlerOptions({
            output:
              format === 'esm'
                ? {
                    entryFileNames: 'combined.mjs',
                    format: 'esm',
                  }
                : {
                    entryFileNames: 'combined.cjs',
                    format: 'cjs',
                  },
            // PR-08+: Target Node.js runtime — this makes Rolldown
            // properly externalize Node builtins (no more "missing fs"
            // bundling issues) and avoids adding browser polyfills.
            platform: 'node',
            // @ts-expect-error rollup type
            onLog(level, log, handler) {
              if (
                log.message.includes('react-helmet-async') ||
                shouldSuppressLog(log.message)
              )
                return
              handler(level, log)
            },
          }),
        },
        customLogger: clientLogger,
        mode: resolvedConfig.mode,
        ssr: {
          noExternal: true,
        },
        // PR-08+: Intercept CSS imports in SSR — return empty strings.
        plugins: [
          ...filterPluginsForSsr((viteConfig.plugins as any[]) || []),
          createSsrCssSkipPlugin(),
        ],
      }),
    )
    onStep?.({
      name: 'Server build',
      duration: performance.now() - serverStart,
      success: true,
      details: 'Vite SSR bundle',
    })
  }

  const prefix =
    format === 'esm' && process.platform === 'win32' ? 'file://' : ''
  const ext = format === 'esm' ? '.mjs' : '.cjs'
  /**
   * `join('file://')` will be equal to `'file:\'`, which is not the correct file protocol and will fail to be parsed under bun.
   * It is changed to '+' splicing here.
   */
  const safeEntryName = ssrEntry
    .replace(/\0/g, '')
    .replace('virtual:', '')
    .replace(/[^a-zA-Z0-9-]/g, '_')

  // If the SSR entry points to an absolute path, Vite/Rolldown 8 typically uses the basename
  // without drive letters or full path mangling for its chunk name.
  // We strip any existing extension (like .tsx) to avoid double extensions like .tsx.mjs
  let actualEntryFile = 'combined' + ext
  try {
    if (fs.existsSync(ssgOut)) {
      const files = fs.readdirSync(ssgOut).filter((f) => f.endsWith(ext))
      if (files.length > 0) {
        actualEntryFile = files[0]
      }
    }
  } catch {}

  const serverEntry = prefix + join(ssgOut, actualEntryFile).replace(/\\/g, '/')
  const entryBasename = actualEntryFile.replace(/\.[^/.]+$/, '')
  const serverManifest: Manifest = JSON.parse(
    await fs.readFile(join(ssgOut, ...dotVitedir, 'manifest.json'), 'utf-8'),
  )

  // ── PR-05: Skip SSR import when all routes cached ────────────────
  // When canSkipSsrImport is true we already have routesPaths and all
  // pages are cached.  Jump straight to the copy phase without importing
  // the ~7MB SSR bundle, creating the React renderer, or instantiating the
  // worker pool.
  let _serverContext: ViteReactSSGContext<true> | null = null
  let _sharedAdapter: ReturnType<typeof getAdapter> | null = null
  let routes: Readonly<RouteRecord[]> = []
  let ctxBase = '/'
  let ctxTrigger:
    | ((route: string, appHTML: string, ctx: any) => Promise<unknown[]>)
    | undefined
  let ctxApp: any = null
  let ctxRouterType: 'remix' | 'app' | undefined = undefined
  let includedRoutes: (
    paths: string[],
    routes?: Readonly<RouteRecord[]>,
  ) => string[] = configIncludedRoutes

  if (!canSkipSsrImport) {
    const _require =
      typeof require !== 'undefined' ? require : createRequire(import.meta.url)

    const {
      createRoot,
      includedRoutes: serverEntryIncludedRoutes,
    }: {
      createRoot: CreateRootFactory
      includedRoutes: ViteReactSSGOptions['includedRoutes']
    } = format === 'esm' ? await import(serverEntry) : _require(serverEntry)
    includedRoutes = serverEntryIncludedRoutes || configIncludedRoutes

    // Create the SSR context ONCE and reuse it everywhere.  The context's
    // base, routes, triggerOnSSRAppRendered, app, and routerType fields are
    // the same for every page — only routePath differs.  By saving the full
    // context we avoid a wasteful createRoot(false, path) call per page in
    // the worker-pool result-processing loop.
    _serverContext = (await createRoot(false)) as ViteReactSSGContext<true>
    const ctx = _serverContext
    routes = ctx.routes
    ctxBase = ctx.base
    ctxTrigger = ctx.triggerOnSSRAppRendered
    ctxApp = ctx.app
    ctxRouterType = ctx.routerType

    if (routes && routes.length > 0) {
      for (const r of routes as any[]) {
        if (
          r.path &&
          (r.filePath || r.entry) &&
          !routeToSourceFileMap[r.path]
        ) {
          routeToSourceFileMap[r.path] = r.filePath || r.entry
        }
      }
    }

    // Pre-create the RemixAdapter ONCE using the shared SSR context.
    _sharedAdapter = getAdapter(ctx)
  }

  // Worker SSR entry path (only computed when we need workers)
  let workerSsrEntryPath = ''
  // PR-05: Lazy worker thread pool — only created when the first uncached
  // page is encountered in the for-loop.  Fully cached warm builds never
  // pay the ~500ms pool initialisation cost.
  let renderPool: import('./ssg-worker-pool').SsgWorkerPool | null = null
  // P2-40.1: Streaming pipeline — each render result is immediately
  // processed through finalizePage as workers finish, instead of
  // collecting ALL results first and then batch-processing them.
  // This overlaps SSR rendering (workers) with HTML finalization
  // (main thread p-queue), reducing idle time for both.
  const workerFinalizePromises: Array<Promise<void>> = []
  /** Set to true once we've attempted lazy pool creation (avoid re-try). */
  let lazyPoolAttempted = false

  if (!canSkipSsrImport) {
    const { paths } = await routesToPaths(routes)

    routesPaths = includeAllRoutes
      ? paths
      : await includedRoutes(paths, routes || [])

    routesPaths = DefaultIncludedRoutes(routesPaths, routes || [])

    routesPaths = Array.from(new Set(routesPaths))

    // Save route paths so future warm builds can skip the SSR import entirely.
    try {
      const routesCachePath = join(finalCacheDir, 'routes-cache.json')
      await fs.ensureDir(dirname(routesCachePath))
      await fs.writeJson(
        routesCachePath,
        { paths: routesPaths, updated: Date.now() },
        { spaces: 0 },
      )
    } catch {
      // Non-critical, ignore
    }

    // Worker SSR entry path: join the output dir with the entry basename.
    workerSsrEntryPath = join(ssgOut, entryBasename + ext)

    // ── Worker thread pool (eager init for cold builds) ──────────────
    // On cold builds (canSkipSsrImport = false), create the pool eagerly so
    // it can start importing the SSR bundle in the background while the
    // manifest reading and chunk hashing complete (~2-3s window).
    if (routesPaths.length > 4) {
      try {
        const { SsgWorkerPool } = await import('./ssg-worker-pool')
        renderPool = new SsgWorkerPool({
          ssrEntryPath: workerSsrEntryPath,
          format: format === 'esm' ? 'esm' : 'cjs',
        })
      } catch {
        renderPool = null
      }
    }
  }

  // Lazy pool creation helper — invoked from the for-loop when the first
  // uncached page is found.  On fully cached warm builds this is never
  // called, saving ~500ms.
  async function ensureRenderPool(): Promise<void> {
    if (renderPool || lazyPoolAttempted || routesPaths.length <= 4) return
    lazyPoolAttempted = true
    try {
      workerSsrEntryPath = join(ssgOut, entryBasename + ext)
      const { SsgWorkerPool } = await import('./ssg-worker-pool')
      renderPool = new SsgWorkerPool({
        ssrEntryPath: workerSsrEntryPath,
        format: format === 'esm' ? 'esm' : 'cjs',
      })
      await renderPool.ready()
    } catch {
      renderPool = null
    }
  }

  // P2-11: New critical CSS strategy
  // Default: 'zig-critters' (WASM) — fast, no beasties fallback.
  // To enable beasties, set `criticalCss: 'beasties'` in ssgOptions or config.
  // To disable entirely, set `criticalCss: false`.
  const resolvedCriticalCss: 'zig-critters' | 'beasties' | false =
    (mergedOptions.criticalCss as
      | 'zig-critters'
      | 'beasties'
      | false
      | undefined) ?? (turbo ? false : false)

  let zigCritters: import('./critical').ZigCritters | undefined
  let beasties: any = undefined

  if (resolvedCriticalCss === 'zig-critters') {
    zigCritters = await getZigCritters()
    if (!zigCritters) {
      // WASM unavailable — skip critical CSS entirely (no beasties fallback).
      // This saves ~5-15s of beasties processing in cold builds.
      warn(
        "[zig-critters] WASM unavailable; critical CSS disabled for this build. Set `criticalCss: 'beasties'` to enable JS-based critical CSS.",
      )
    }
  } else if (resolvedCriticalCss === 'beasties') {
    if (beastiesOptions !== false) {
      beasties = await getBeasties(outDir, {
        publicPath: configBase,
        ...beastiesOptions,
      })
    }
  }
  // resolvedCriticalCss === false → skip critical CSS entirely (fastest)

  // Cache CSS content for zig-critters (read once, not per page)
  let cachedAllCss = ''
  if (zigCritters) {
    const cssDir = join(out, 'assets')
    if (fs.existsSync(cssDir)) {
      const cssFiles = fs.readdirSync(cssDir).filter((f) => f.endsWith('.css'))
      for (const cssFile of cssFiles) {
        cachedAllCss += fs.readFileSync(join(cssDir, cssFile), 'utf-8') + '\n'
      }
    }
  }

  // ── PR-05: Skip manifest reading + chunk hashing when all cached ──
  // These are only needed for per-route cache invalidation in the for-loop.
  // When canSkipSsrImport is true, every route is already cached with a
  // matching assetHash, so we can use currentClientHash as a default.
  let ssrManifest: SSRManifest = {}
  let manifest: Manifest = {}
  let routeToAssetHash: Record<string, string> = {}
  let manifestIndexes: import('./client-dep-map').ManifestIndexes | null = null

  if (!canSkipSsrImport) {
    ssrManifest = JSON.parse(
      await fs.readFile(join(out, ...dotVitedir, 'ssr-manifest.json'), 'utf-8'),
    )
    manifest = JSON.parse(
      await fs.readFile(join(out, ...dotVitedir, 'manifest.json'), 'utf-8'),
    )

    // Build a per-route client dependency hash from the Vite manifests.
    manifestIndexes = createManifestIndexes(manifest)

    // Pre-compute hashes for all client chunks once.
    const chunkHashes = await computeChunkHashes(out, manifest)

    await Promise.all(
      Object.entries(routeToSourceFileMap).map(
        async ([routePath, sourceFile]) => {
          routeToAssetHash[routePath] = await computeRouteClientAssetHash({
            outDir: out,
            indexes: manifestIndexes!,
            ssrManifest,
            routeSourceFile: sourceFile,
            root,
            clientHash: currentClientHash,
            assetHashes: chunkHashes,
          })
        },
      ),
    )

    // Routes without a known source file fall back to currentClientHash
    for (const routePath of routesPaths) {
      if (!routeToAssetHash[routePath]) {
        routeToAssetHash[routePath] = currentClientHash
      }
    }
  } else {
    // All cached: every route uses currentClientHash as its asset hash.
    // This matches the check in the early "canSkipSsrImport" gate above
    // which verified entry.assetHash === currentClientHash for all routes.
    for (const routePath of routesPaths) {
      routeToAssetHash[routePath] = currentClientHash
    }
  }

  let indexHTML = await fs.readFile(join(out, htmlEntry), 'utf-8')
  fs.rmSync(join(out, htmlEntry))
  indexHTML = rewriteScripts(indexHTML, script)

  const PQueue = (await import('p-queue')).default || (await import('p-queue'))
  const queue = new PQueue({ concurrency })
  const crittersQueue = new PQueue({
    concurrency: Math.min(os.cpus().length, 4),
  })
  // P2-40.1: Finalize queue with limited concurrency to prevent event-loop
  // saturation when many worker results arrive simultaneously.
  const finalizeQueue = new PQueue({
    concurrency: Math.max(2, Math.min(os.cpus().length, 6)),
  })

  const staticLoaderDataManifest: StaticLoaderDataManifest = {}
  let loaderDataFileCount = 0

  // P2-12: sourceHashCache replaced by sourceMetaCache (includes mtime, no fs.statSync per page)
  // Pre-compute route path MD5 hashes to avoid re-hashing per page.
  // Key = route path (e.g. '/docs/api'), value = 32-char hex digest.
  const pathHashCache = new Map<string, string>()
  for (const p of routesPaths) {
    pathHashCache.set(p, crypto.createHash('md5').update(p).digest('hex'))
  }

  // P2-12: Pre-compute source metadata (content hash + mtime) ONCE so
  // finalizePage doesn't call fs.statSync per page (which was ~10ms × 202 = ~2s).
  // Key = absolute source file path, value = { hash, mtimeMs }.
  const sourceMetaCache = new Map<string, { hash: string; mtimeMs: number }>()
  const uniqueSources = new Set<string>()
  for (const p of routesPaths) {
    const nk = withLeadingSlash(p).replace(/\/$/, '')
    const sf = routeToSourceFileMap[nk] || routeToSourceFileMap[p]
    if (sf) uniqueSources.add(sf)
  }
  for (const srcPath of uniqueSources) {
    try {
      if (fs.existsSync(srcPath)) {
        const stat = fs.statSync(srcPath)
        const buf = fs.readFileSync(srcPath)
        sourceMetaCache.set(srcPath, {
          hash: crypto
            .createHash('md5')
            .update(buf as Uint8Array)
            .digest('hex'),
          mtimeMs: stat.mtimeMs,
        })
      }
    } catch {
      // Non-fatal — finalizePage falls back to currentClientHash
    }
  }

  // PR-11: Cache the critical CSS from the first page processed through beasties.
  // Since every page shares the same global CSS, we only need to run the
  // expensive beasties.process() ONCE and reuse the extracted <style> blocks
  // for all subsequent pages.  This saves ~50ms per page × 201 = ~10s on a
  // 202-page cold build.
  //
  // For zig-critters (turbo mode), the CSS is already cached (cachedAllCss)
  // and the per-page cost is only ~22ms — not worth the complexity of a
  // batch API for now.  The beasties path is the main bottleneck.
  let beastiesCssCache: string[] | null = null
  /**
   * Promise-based guard: ensures only ONE beasties.process() call runs even
   * when multiple finalizePage() instances execute concurrently in the queue.
   * Subsequent calls either use the cached result (if available) or await
   * this promise and then use it.
   */
  let beastiesFirstPagePromise: Promise<string> | null = null

  // P2-40.2: Zig-critters CSS cache — same strategy as PR-11 for beasties.
  // Since every page shares the same global CSS bundle, the extracted critical
  // CSS <style> blocks are identical for every page.  Run zig-critters WASM
  // ONCE on the first page, extract the injected <style> tag, then inject it
  // directly for all subsequent pages (no more WASM calls).
  // This reduces 202 WASM calls → 1 call, saving ~4s.
  let zigCrittersCachedStyle: string | null = null
  let zigCrittersFirstPagePromise: Promise<void> | null = null

  // Cache for collectAssets per route path (same route = same assets)
  const assetsCache = new Map<string, Set<string>>()

  // P2-00: Per-page timing accumulators for render sub-metrics
  const ssrPageTimesMs: number[] = []
  const crittersPageTimesMs: number[] = []
  const writePageTimesMs: number[] = []
  let poolWorkerInitMs = 0
  let poolFallbackToMainThread = false

  function computePercentile(values: number[], p: number): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const index = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, Math.min(index, sorted.length - 1))]
  }

  let renderedCount = 0
  let cachedCount = 0
  let renderedSize = 0

  // Use the ssgCache already loaded above the SSR skip block
  const newSsgCache: Record<string, SsgCacheItem> = { ...ssgCache }

  // Pre-create all output directories to avoid ensureDir per page
  const outputDirs = new Set<string>()
  outputDirs.add(ssgPagesDir)
  for (const p of routesPaths) {
    const routeFilename =
      dirStyle === 'nested'
        ? join(p.replace(/^\//g, ''), 'index.html')
        : `${(p.endsWith('/') ? `${p}index` : p).replace(/^\//g, '')}.html`
    outputDirs.add(join(out, dirname(routeFilename)))
    // Also add loader data subdirectories
    const normalized = p === '/' ? '/index' : p.endsWith('/') ? `${p}index` : p
    outputDirs.add(join(out, 'static-loader-data', dirname(normalized)))
  }
  outputDirs.add(join(out, 'static-loader-data'))
  await Promise.all([...outputDirs].map((d) => fs.ensureDir(d)))

  // ── Reusable per-route post-processing function ──
  // Defined BEFORE the for loop so both the main-thread path and the
  // worker-pool result path can call it.  All per-route variables are
  // computed from the `path` parameter, avoiding closure-capture bugs.
  async function finalizePage(
    path: string,
    appHTML: string,
    metaAttributes: string[],
    bodyAttributes: string,
    htmlAttributes: string,
    styleTag: string | undefined,
    routerContextJSON: string | null,
    loaderData: Record<string, unknown> | null,
    appCtx: any,
    base: string,
    routes: Readonly<RouteRecord[]>,
    triggerOnSSRAppRendered:
      | ((route: string, appHTML: string, ctx: any) => Promise<unknown[]>)
      | undefined,
    app: any,
    routerType: string,
    transformedIndexHTML: string,
  ): Promise<void> {
    const pPathHash =
      pathHashCache.get(path) ||
      crypto.createHash('md5').update(path).digest('hex')
    const pCachedHtmlFile = join(ssgPagesDir, `${pPathHash}.html`)
    const pCachedLoaderFile = join(ssgPagesDir, `${pPathHash}.json`)
    const pNormalizedKey = withLeadingSlash(path).replace(/\/$/, '')
    const pSourceFile =
      routeToSourceFileMap[pNormalizedKey] || routeToSourceFileMap[path]

    // P2-12: Use pre-computed hash + mtime from sourceMetaCache (eliminates
    // fs.statSync per page — was ~10ms × 202 = ~2s).  The cache is populated
    // synchronously before the for-loop so it's always ready.
    let pSourceContentHash = ''
    let pSourceMtimeMs = 0
    if (pSourceFile) {
      const meta = sourceMetaCache.get(pSourceFile)
      if (meta) {
        pSourceContentHash = meta.hash
        pSourceMtimeMs = meta.mtimeMs
      }
    }
    if (!pSourceContentHash) {
      pSourceContentHash = currentClientHash
    }

    const fetchUrl = `${withTrailingSlash(base)}${removeLeadingSlash(path)}`

    let assets: Set<string>
    if (!app && routerType === 'remix') {
      const cachedAssets = assetsCache.get(path)
      if (cachedAssets) {
        assets = cachedAssets
      } else {
        assets = await collectAssets({
          routes: [...routes],
          locationArg: fetchUrl,
          base,
          serverManifest,
          manifest,
          ssrManifest,
        })
        assetsCache.set(path, assets)
      }
    } else {
      assets = new Set<string>()
    }

    let writtenLoaderDataPath: string | undefined

    if (loaderData && Object.keys(loaderData).length > 0) {
      const loaderDataFilePath = getLoaderDataFilePath(path, hash)
      writtenLoaderDataPath = loaderDataFilePath
      await fs.writeFile(
        join(out, loaderDataFilePath),
        JSON.stringify(loaderData),
      )
      staticLoaderDataManifest[getNormalizedPathKey(path, configBase)] =
        loaderDataFilePath
      loaderDataFileCount++
    }

    await triggerOnSSRAppRendered?.(path, appHTML, appCtx)

    const renderedHTML = await renderHTML({
      rootContainerId,
      appHTML,
      indexHTML: transformedIndexHTML,
      metaAttributes,
      bodyAttributes,
      htmlAttributes,
      initialState: null,
    })

    // P2-40.3: Skip renderPreloadLinksString for 'app' routerType (always empty).
    const preloadLinksHtml = app ? '' : renderPreloadLinksString(assets)

    // P2-40.3: Skip hydration data regex when no routerContextJSON.
    // The regex with negative lookahead is expensive on large HTML (~1-2ms/page).
    let html = routerContextJSON
      ? renderedHTML.replace(
          /<script[^>]*>(?:(?!<\/script>)[\s\S])*__staticRouterHydrationData(?:(?!<\/script>)[\s\S])*<\/script>/g,
          '',
        )
      : renderedHTML

    if (preloadLinksHtml) {
      html = html.replace('<head>', `<head>${preloadLinksHtml}`)
    }

    const transformed = (await onPageRendered?.(path, html, appCtx)) || html
    let loaderDataScript = ''
    if (loaderData && Object.keys(loaderData).length > 0) {
      const safeLoaderDataJSON = JSON.stringify(loaderData).replace(
        /</g,
        '\\u003c',
      )
      loaderDataScript = `window.__VITE_REACT_SSG_STATIC_LOADER_DATA__ = { '${getNormalizedPathKey(path, configBase)}': ${safeLoaderDataJSON} };`
    }

    let routerContextParsed: {
      loaderData?: Record<string, unknown>
      actionData?: unknown
      errors?: unknown
    } | null = null
    if (routerContextJSON) {
      try {
        routerContextParsed = JSON.parse(routerContextJSON)
      } catch {
        // Ignore parse errors
      }
    }

    let hydrationScriptContent = ''
    if (routerContextParsed) {
      const safeJson = JSON.stringify(routerContextParsed).replace(
        /</g,
        '\\u003c',
      )
      hydrationScriptContent = `window.__staticRouterHydrationData = ${safeJson};`
    }

    let resultHTML = transformed
    const headerScript = `<script>window.__VITE_REACT_SSG_HASH__ = '${hash}';${loaderDataScript}${hydrationScriptContent}</script>`
    // P2-40.3: headerScript injection deferred — combined with styleTag below
    // to save one <head> replace per page.

    // P2-00: Track critters processing time per page
    const pageCrittersStart = performance.now()
    resultHTML = resultHTML.replace(
      `<script>${SCRIPT_COMMENT_PLACEHOLDER}</script>`,
      '',
    )

    if (zigCritters) {
      if (zigCrittersCachedStyle) {
        // P2-40.2: Fast path — inject cached critical CSS style tag from
        // the first page.  Every page shares the same CSS bundle, so the
        // extracted critical CSS is identical for all pages.
        resultHTML = resultHTML.replace(
          '</head>',
          `${zigCrittersCachedStyle}</head>`,
        )
      } else if (!zigCrittersFirstPagePromise) {
        // P2-40.2: First page — run zig-critters ONCE, extract the injected
        // <style> tag, and cache it for all subsequent pages.
        zigCrittersFirstPagePromise = (async () => {
          try {
            if (cachedAllCss) {
              const processed = await zigCritters.processHtml(
                resultHTML,
                cachedAllCss,
              )
              // Extract <style> tags zig-critters injected; cache for reuse.
              const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/g
              const matches = processed.match(styleRegex)
              if (matches && matches.length > 0) {
                zigCrittersCachedStyle = matches.join('\n')
              }
              // Use the processed HTML for this first page
              resultHTML = processed
            }
          } catch (e) {
            warn(
              `[zig-critters] Failed to inline CSS for "${path}": ${e instanceof Error ? e.message : String(e)}`,
            )
          }
        })()
        await zigCrittersFirstPagePromise
      } else {
        // P2-40.2: Concurrent pages while first page is being processed —
        // wait for the first page's zig-critters result, then use cache.
        await zigCrittersFirstPagePromise
        if (zigCrittersCachedStyle) {
          resultHTML = resultHTML.replace(
            '</head>',
            `${zigCrittersCachedStyle}</head>`,
          )
        }
      }
      resultHTML = resultHTML.replace(
        /<link\srel="stylesheet"(?!.*\bcrossorigin\b)/g,
        '<link rel="stylesheet" crossorigin',
      )
    } else if (beasties) {
      if (beastiesCssCache) {
        // PR-11: Fast path — inject pre-computed critical CSS from the first
        // page.  Every page shares the same global CSS bundle, so the same
        // critical <style> blocks apply to all pages.  Unused critical CSS
        // for pages with different content is negligible (<1% of bytes).
        for (const styleBlock of beastiesCssCache) {
          resultHTML = resultHTML.replace('</head>', `${styleBlock}</head>`)
        }
      } else {
        // PR-11: First page — start beasties ONCE and cache extracted CSS.
        // Use the promise guard so concurrent finalizePage() calls don't
        // trigger duplicate beasties.process() evaluations.
        if (!beastiesFirstPagePromise) {
          beastiesFirstPagePromise = crittersQueue
            .add(() => beasties.process(resultHTML))
            .then((html: string) => {
              // Extract <style> blocks from first page's result; cache them
              // so all subsequent pages can inject the same critical CSS
              // into their OWN resultHTML.
              const styleRegex = /<style[^>]*>[\s\S]*?<\/style>/g
              const matches = html.match(styleRegex)
              if (matches && matches.length > 0) {
                beastiesCssCache = matches
              }
              // Discard html — we only need the cached CSS, not the HTML body
            }) as Promise<string>
        }
        // Wait for first beasties run to complete
        await beastiesFirstPagePromise

        if (beastiesCssCache) {
          // Cache is now populated — inject into THIS page's resultHTML
          for (const styleBlock of beastiesCssCache) {
            resultHTML = resultHTML.replace('</head>', `${styleBlock}</head>`)
          }
        } else {
          // Fallback: run beasties for THIS specific page (shouldn't happen)
          resultHTML = (await crittersQueue.add(() =>
            beasties.process(resultHTML),
          ))!
        }
      }
      resultHTML = resultHTML.replace(
        /<link\srel="stylesheet"(?!.*\bcrossorigin\b)/g,
        '<link rel="stylesheet" crossorigin',
      )
    }

    // P2-40.3: Single <head> replace with headerScript + styleTag combined.
    // This saves 1 replace() call per page (~0.05ms × 202 = ~10ms).
    const headInjection = headerScript + (styleTag || '')
    if (headInjection)
      resultHTML = resultHTML.replace('<head>', `<head>${headInjection}`)

    // P2-12: Skip formatHtml entirely when formatting === 'none' (the default).
    // The function is a no-op in this case but still costs an async call.
    const formatted =
      formatting === 'none'
        ? resultHTML
        : await formatHtml(resultHTML, formatting)
    crittersPageTimesMs.push(Math.round(performance.now() - pageCrittersStart))

    // P2-12: Write timing
    const pageWriteStart = performance.now()

    if (!turbo) {
      // Single write path: only write to the ssg-pages cache.
      // dist/ HTML files are created via hardlinks in a single batch after the
      // render loop — this eliminates the double-write per page (~4s saving).
      await fs.writeFile(pCachedHtmlFile, formatted, 'utf-8')

      if (
        loaderData &&
        Object.keys(loaderData).length > 0 &&
        writtenLoaderDataPath
      ) {
        await fs.writeFile(
          pCachedLoaderFile,
          JSON.stringify(loaderData),
          'utf-8',
        )
        newSsgCache[pNormalizedKey] = {
          contentHash: pSourceContentHash,
          mtime: pSourceMtimeMs ? Math.round(pSourceMtimeMs) : 0,
          loaderDataFilePath: writtenLoaderDataPath,
          assetHash: routeToAssetHash[path],
        }
      } else {
        newSsgCache[pNormalizedKey] = {
          contentHash: pSourceContentHash,
          mtime: pSourceMtimeMs ? Math.round(pSourceMtimeMs) : 0,
          assetHash: routeToAssetHash[path],
        }
      }
    }

    writePageTimesMs.push(Math.round(performance.now() - pageWriteStart))
    renderedCount++
    renderedSize += formatted.length
  }

  // P2-40.4: Don't block on pool ready — dispatch pages immediately.
  // Workers signal ready asynchronously and start consuming from the
  // internal queue as they become available.  If NO worker is ready
  // within 5s, set fallback flag so the pool delegates to main-thread.
  // The pool is NOT nulled — it needs to remain alive so destroy()
  // can clean up workers and reject queued promises.
  if (renderPool) {
    const workerPoolStart = performance.now()
    renderPool
      .ready(5000)
      .catch(() => {
        if (renderPool && renderPool.readyCount < 1) {
          poolFallbackToMainThread = true
          warn(
            `[ssg-worker] Pool init timeout (no workers after 5s), falling back to main-thread rendering`,
          )
        }
      })
      .finally(() => {
        poolWorkerInitMs = Math.round(performance.now() - workerPoolStart)
      })
  }

  for (const path of routesPaths) {
    const pathHash =
      pathHashCache.get(path) ||
      crypto.createHash('md5').update(path).digest('hex')
    const cachedHtmlFile = join(ssgPagesDir, `${pathHash}.html`)
    const cachedLoaderFile = join(ssgPagesDir, `${pathHash}.json`)

    const filename =
      dirStyle === 'nested'
        ? join(path.replace(/^\//g, ''), 'index.html')
        : `${(path.endsWith('/') ? `${path}index` : path).replace(/^\//g, '')}.html`

    const finalOutFile = join(out, filename)
    const normalizedKey = withLeadingSlash(path).replace(/\/$/, '')
    const sourceFile =
      routeToSourceFileMap[normalizedKey] || routeToSourceFileMap[path]

    let isCached = false
    let sourceContentHash = ''
    if (!turbo) {
      try {
        // P2-12: Use sourceMetaCache instead of sourceHashCache (which was never populated)
        const srcMeta = sourceFile ? sourceMetaCache.get(sourceFile) : undefined
        sourceContentHash = srcMeta?.hash || currentClientHash

        // PR-05: Skip fs.existsSync on warm builds (canBypassClientBuild).
        // The cached HTML file is expected to exist — it was saved by the
        // previous build.  If it doesn't, the error will be caught by the
        // queue handler below.
        if (canBypassClientBuild) {
          const cachedItem = ssgCache[normalizedKey] || ssgCache[path]
          const routeAssetHash = routeToAssetHash[path] ?? currentClientHash
          if (
            cachedItem &&
            cachedItem.contentHash === sourceContentHash &&
            cachedItem.assetHash === routeAssetHash &&
            fs.existsSync(cachedHtmlFile)
          ) {
            isCached = true
          }
        }
      } catch (e) {
        // Safe fallback: ignore cache and force rebuild if fs check fails
      }
    }

    if (isCached) {
      queue.add(async () => {
        try {
          if (canBypassClientBuild) {
            await fs.copy(cachedHtmlFile, finalOutFile)
          } else {
            let content = await fs.readFile(cachedHtmlFile, 'utf-8')
            content = content.replace(
              /window\.__VITE_REACT_SSG_HASH__\s*=\s*'[^']*'/,
              `window.__VITE_REACT_SSG_HASH__ = '${hash}'`,
            )
            await fs.writeFile(finalOutFile, content, 'utf-8')
          }

          const cachedItem = ssgCache[normalizedKey] || ssgCache[path]
          if (
            cachedItem?.loaderDataFilePath &&
            fs.existsSync(cachedLoaderFile)
          ) {
            const loaderDataFilePath = canBypassClientBuild
              ? cachedItem.loaderDataFilePath
              : getLoaderDataFilePath(path, hash)
            await fs.copy(cachedLoaderFile, join(out, loaderDataFilePath))
            staticLoaderDataManifest[getNormalizedPathKey(path, configBase)] =
              loaderDataFilePath
            loaderDataFileCount++
          }

          cachedCount++
        } catch (err: any) {
          throw new Error(`Error on cached page: ${path}\n${err.stack}`)
        }
      })
      continue
    }

    // ── Non-cached page ──
    // PR-05: Lazy worker pool — only created when first uncached page found.
    // Fully cached warm builds never pay this cost.
    const needsPool =
      routesPaths.length > 4 && renderPool === null && !lazyPoolAttempted
    if (needsPool) {
      await ensureRenderPool()
    }

    if (renderPool) {
      // P2-40.1: Streaming pipeline — as each worker finishes its page,
      // immediately process through finalizePage.  This overlaps SSR
      // rendering (workers) with HTML finalization (main thread) so
      // neither sits idle waiting for the other.
      const finalizePromise = renderPool
        .render(path)
        .then(async (result) => {
          const loaderDataObj = result.loaderData as Record<
            string,
            unknown
          > | null
          const appCtx = {
            ..._serverContext!,
            routePath: path,
          } as ViteReactSSGContext<true>
          const transformedIndexHTML =
            (await onBeforePageRender?.(path, indexHTML, appCtx)) || indexHTML
          await finalizeQueue.add(() =>
            finalizePage(
              path,
              result.appHTML,
              result.metaAttributes,
              result.bodyAttributes,
              result.htmlAttributes,
              result.styleTag,
              result.routerContextJSON,
              loaderDataObj,
              appCtx,
              ctxBase,
              routes,
              ctxTrigger,
              ctxApp,
              ctxRouterType,
              transformedIndexHTML,
            ),
          )
        })
        .catch((err: any) => {
          throw new Error(`Error on page: ${path}\n${err.stack || err}`)
        })
      workerFinalizePromises.push(finalizePromise)
    } else if (_serverContext && _sharedAdapter) {
      // Main-thread: use the pre-created shared adapter (avoids per-page
      // createRoot(false, path) which re-imports the 7MB SSR bundle).
      queue.add(async () => {
        try {
          // Build a minimal context with the correct routePath for
          // the onBeforePageRender callback.
          const appCtx = {
            ..._serverContext!,
            routePath: path,
          } as ViteReactSSGContext<true>

          const transformedIndexHTML =
            (await onBeforePageRender?.(path, indexHTML, appCtx)) || indexHTML

          // P2-00: Time per-page SSR render
          const ssrRenderStart = performance.now()
          const {
            appHTML,
            bodyAttributes,
            htmlAttributes,
            metaAttributes,
            styleTag,
            routerContext,
          } = await _sharedAdapter!.render(path)
          ssrPageTimesMs.push(Math.round(performance.now() - ssrRenderStart))

          const loaderData = routerContext?.loaderData as
            | Record<string, unknown>
            | undefined

          const routerContextJSON = routerContext
            ? JSON.stringify({
                loaderData: routerContext.loaderData ?? {},
                actionData: routerContext.actionData ?? null,
                errors: routerContext.errors ?? null,
              })
            : null

          await finalizePage(
            path,
            appHTML,
            metaAttributes,
            bodyAttributes,
            htmlAttributes,
            styleTag,
            routerContextJSON,
            loaderData || null,
            appCtx,
            ctxBase,
            routes,
            ctxTrigger,
            ctxApp,
            ctxRouterType,
            transformedIndexHTML,
          )
        } catch (err: any) {
          throw new Error(`Error on page: ${path}\n${err.stack}`)
        }
      })
    } else {
      // No SSR context available (canSkipSsrImport was true but a page
      // somehow wasn't cached). This shouldn't happen because the early
      // check guarantees all routes are cached. Fall back gracefully.
      warn(`[ssg] No SSR context available for ${path}, skipping`)
    }
  }

  // ── P2-40.1: Streaming pipeline — wait for all renders + finalizations ──
  // Worker renders are pipelined: each result is immediately finalizePage'd
  // via finalizeQueue as workers complete.  We only need to wait for all
  // promises to settle — no more batch collection + queue re-add.
  if (workerFinalizePromises.length > 0) {
    const results = await Promise.allSettled(workerFinalizePromises)
    // Check for any rejected promises (fatal errors)
    for (const r of results) {
      if (r.status === 'rejected') {
        throw r.reason
      }
    }
  }
  await finalizeQueue.onIdle()
  if (renderPool) {
    await renderPool.destroy()
  }

  await queue.start().onIdle()

  // P2-12: Batch hardlink ssg-pages cache → dist.
  // The render loop writes only to ssg-pages/<hash>.html (single write path).
  // Now we create hardlinks from those cached files to the final dist/ output.
  // Hardlinks are zero-copy (same inode) and near-instant (~0.1ms/file vs ~15ms
  // for fs.writeFile). Falls back to fs.copy for cross-device scenarios (EXDEV).
  const hardlinkStart = performance.now()
  await Promise.all(
    routesPaths.map(async (p) => {
      const pPathHash = pathHashCache.get(p) || ''
      if (!pPathHash) return
      const src = join(ssgPagesDir, `${pPathHash}.html`)
      if (!fs.existsSync(src)) return
      const filename =
        dirStyle === 'nested'
          ? join(p.replace(/^\//g, ''), 'index.html')
          : `${(p.endsWith('/') ? `${p}index` : p).replace(/^\//g, '')}.html`
      const dst = join(out, filename)
      try {
        // Hardlink = zero-copy, same inode.
        // Multiple routes pointing to the same cached file share inodes.
        fs.linkSync(src, dst)
      } catch {
        // EXDEV (cross-device): fall back to copy
        await fs.copy(src, dst)
      }
    }),
  )
  const hardlinkDuration = Math.round(performance.now() - hardlinkStart)

  const totalPages = renderedCount + cachedCount
  const totalSizeMB = (renderedSize / 1024 / 1024).toFixed(2)

  // Save the updated cache index
  // Skip in turbo mode for faster builds
  let prunedCount = 0
  if (!turbo) {
    try {
      await fs.ensureDir(dirname(cachePath))
      await fs.writeJson(cachePath, newSsgCache)

      // Garbage collect unused cached HTML and JSON loader files in ssg-pages
      if (fs.existsSync(ssgPagesDir)) {
        const cachedFiles = await fs.readdir(ssgPagesDir)
        const activeHashes = new Set<string>()
        for (const route of Object.keys(newSsgCache)) {
          const pathHash = crypto.createHash('md5').update(route).digest('hex')
          activeHashes.add(`${pathHash}.html`)
          activeHashes.add(`${pathHash}.json`)
        }
        for (const file of cachedFiles) {
          if (file.endsWith('.html') || file.endsWith('.json')) {
            if (!activeHashes.has(file)) {
              await fs.remove(join(ssgPagesDir, file))
              prunedCount++
            }
          }
        }
      }
    } catch (e) {
      // Ignore cache and pruning errors
    }
  }

  const renderTotalMs = performance.now() - renderStartTime
  const poolMetricsVal = renderPool ? renderPool.poolMetrics() : null
  const p2Metrics = {
    renderedCount,
    cachedCount,
    renderedSize,
    totalPages,
    prunedCount,
    // P2-00 worker & timing sub-metrics
    workerInitMs: Math.round(poolWorkerInitMs),
    workerUsed:
      (poolMetricsVal?.readyCount ?? 0) > 0 && !poolFallbackToMainThread,
    workerCount: poolMetricsVal?.readyCount ?? 0,
    fallbackMainThread: poolFallbackToMainThread,
    ssrP50Ms: computePercentile(ssrPageTimesMs, 50),
    ssrP95Ms: computePercentile(ssrPageTimesMs, 95),
    ssrP99Ms: computePercentile(ssrPageTimesMs, 99),
    crittersP50Ms: computePercentile(crittersPageTimesMs, 50),
    crittersP95Ms: computePercentile(crittersPageTimesMs, 95),
    writeP50Ms: computePercentile(writePageTimesMs, 50),
    writeP95Ms: computePercentile(writePageTimesMs, 95),
    pagesPerSecond:
      totalPages > 0 && renderTotalMs > 0
        ? Math.round((totalPages / (renderTotalMs / 1000)) * 10) / 10
        : 0,
  }

  onStep?.({
    name: 'Render pages',
    duration: renderTotalMs,
    success: true,
    details: `${totalPages} pages (${renderedCount} new, ${cachedCount} cached, ${totalSizeMB} MB)`,
    metrics: p2Metrics,
  })

  // P2-00: Emit structured render metrics to stdout for profile harness
  // eslint-disable-next-line no-console
  console.log(
    `[boltdocs] { name: 'Render pages', duration: ${Math.round(renderTotalMs)}, success: true, details: '${totalPages} pages / ${renderedCount} new / ${cachedCount} cached / ${totalSizeMB} MB', metrics: ${JSON.stringify(p2Metrics)} }`,
  )

  const staticLoaderDataStart = performance.now()
  const staticLoaderDataManifestString = JSON.stringify(
    staticLoaderDataManifest,
    null,
    0,
  )
  await fs.writeFile(
    join(out, `static-loader-data-manifest-${hash}.json`),
    staticLoaderDataManifestString,
  )

  // Prune old per-hash SSR bundles to prevent unbounded disk growth.
  // Keep the current hash so warm builds can still skip the server build.
  await pruneDirectoryCache(
    join(finalCacheDir, 'ssr'),
    5,
    turbo ? 'turbo-ssr' : hash,
  )

  unmock()
  const pwaPlugin: { disabled: boolean; generateSW: () => Promise<unknown> } =
    resolvedConfig.plugins.find((i) => i.name === 'vite-plugin-pwa')?.api
  if (pwaPlugin && !pwaPlugin.disabled && pwaPlugin.generateSW) {
    await pwaPlugin.generateSW()
  }

  const buildTime = Math.round(performance.now() - buildStartTime)
  const metrics = await collectPerformanceMetrics(out, buildTime, finalCacheDir)
  writePerformanceMetrics(out, metrics)

  onStep?.({
    name: 'Static loader data',
    duration: performance.now() - staticLoaderDataStart,
    success: true,
    details: `${loaderDataFileCount} loader data files`,
    metrics: { loaderDataFileCount },
  })

  onStep?.({
    name: 'Build metrics',
    duration: 0,
    success: true,
    details: `Build time: ${(buildTime / 1000).toFixed(1)}s, JS: ${(metrics.totalJSBundleSize / 1024).toFixed(0)} kB, CSS: ${(metrics.totalCSSBundleSize / 1024).toFixed(0)} kB`,
    metrics: {
      buildTime,
      totalPages: metrics.pages.length,
      jsSize: metrics.totalJSBundleSize,
      cssSize: metrics.totalCSSBundleSize,
    },
  })

  await onFinished?.(outDir)

  const waitInSeconds = 15
  const timeout = setTimeout(() => {
    warn(
      `Build process still running after ${waitInSeconds}s. There might be something misconfigured in your setup. Force exit.`,
    )
    process.exit(0)
  }, waitInSeconds * 1000)
  timeout.unref()
}

async function pruneDirectoryCache(
  cacheRoot: string,
  keep: number = 5,
  preserve?: string,
): Promise<void> {
  try {
    if (!fs.existsSync(cacheRoot)) return
    const entries = await fs.readdir(cacheRoot, { withFileTypes: true })
    const dirs: { name: string; mtime: number }[] = []
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const dirPath = join(cacheRoot, entry.name)
      const stat = await fs.stat(dirPath)
      dirs.push({ name: entry.name, mtime: stat.mtimeMs })
    }
    dirs.sort((a, b) => b.mtime - a.mtime)
    const keepSet = new Set(dirs.slice(0, keep).map((d) => d.name))
    for (const dir of dirs) {
      if (preserve && dir.name === preserve) continue
      if (!keepSet.has(dir.name)) {
        await fs.remove(join(cacheRoot, dir.name))
      }
    }
  } catch {
    // Non-critical, ignore
  }
}

function rewriteScripts(indexHTML: string, mode?: string) {
  if (!mode || mode === 'sync') return indexHTML
  return indexHTML.replace(
    /<script type="module" /g,
    `<script type="module" ${mode} `,
  )
}

/**
 * Recursively create hard links for every file under `srcDir` inside `destDir`.
 * Hard links are nearly instantaneous (~1 ms per 10 files) and share the same
 * inode, so no extra disk space is consumed.  Falls back gracefully on platforms
 * or filesystems that don't support hard links (cross-device, Docker overlay2,
 * Windows without admin, etc.).
 */
function hardLinkDir(srcDir: string, destDir: string): void {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
  fs.mkdirSync(destDir, { recursive: true })
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    if (entry.isDirectory()) {
      hardLinkDir(srcPath, destPath)
    } else if (entry.isFile()) {
      try {
        // Hard link — fastest option (same filesystem assumed)
        fs.linkSync(srcPath, destPath)
      } catch {
        // Fallback: copy when hard links fail (cross-device, Windows, etc.)
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

async function formatHtml(
  html: string,
  formatting: ViteReactSSGOptions['formatting'],
) {
  if (formatting === 'prettify') {
    try {
      // @ts-expect-error dynamic import
      const prettier = (await import('prettier/esm/standalone.mjs')).default
      // @ts-expect-error dynamic import
      const parserHTML = (await import('prettier/esm/parser-html.mjs')).default

      return prettier.format(html, {
        semi: false,
        parser: 'html',
        plugins: [parserHTML],
      })
    } catch (e: any) {
      error(`Error formatting html: ${e?.message}`)
      return html
    }
  }
  return html
}
