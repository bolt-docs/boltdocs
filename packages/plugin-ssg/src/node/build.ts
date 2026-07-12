import {
  colors,
  info,
  warn,
  success,
  error,
  dividerLog,
  table,
  createSpinner,
} from '@bdocs/dui'
import type { InlineConfig, PluginOption } from 'vite'
import type {
  RouteRecord,
  ViteReactSSGContext,
  ViteReactSSGOptions,
} from '../types'
import { createRequire } from 'node:module'
import os from 'node:os'
import { dirname, isAbsolute, join, relative } from 'node:path'
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
import crypto from 'node:crypto'
import { detectEntry, renderHTML, SCRIPT_COMMENT_PLACEHOLDER } from './html'
import { renderPreloadLinks, renderPreloadLinksString } from './preload-links'
import { getAdapter } from './router-adapter'
import { buildLog, getSize, resolveAlias, routesToPaths } from './utils'
import {
  collectPerformanceMetrics,
  writePerformanceMetrics,
} from './performance'

const dotVitedir = Number.parseInt(viteVersion) >= 5 ? ['.vite'] : []
function buildBundlerOptions<T extends Record<string, unknown>>(
  options: T,
): { rolldownOptions: T } | { rollupOptions: T } {
  return Number.parseInt(viteVersion) >= 8
    ? { rolldownOptions: options }
    : { rollupOptions: options }
}

const SOURCE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.css',
  '.json',
  '.md',
  '.mdx',
  '.html',
  '.svg',
  '.yaml',
  '.yml',
])

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.boltdocs',
  '.turbo',
  'dist',
  'coverage',
  '__tests__',
  'test',
  'tests',
  '.next',
  '.cache',
  'public',
])

function getSourceFiles(dir: string): string[] {
  const files: string[] = []
  if (!fs.existsSync(dir)) return files

  // Use Node 18+ recursive readdir for non-blocking directory scan
  const entries = fs.readdirSync(dir, { withFileTypes: true, recursive: true })
  for (const entry of entries) {
    if (!entry.isFile()) continue
    if (entry.name.startsWith('.')) continue

    // Skip ignored directories (check parent path)
    const relativePath = String(entry.parentPath ?? entry.path)
    const segments = relativePath.split('/').slice(-1)
    if (segments.some((s) => IGNORE_DIRS.has(s))) continue

    const ext = '.' + entry.name.split('.').pop()?.toLowerCase()
    if (SOURCE_EXTS.has(ext)) {
      files.push(join(relativePath, entry.name))
    }
  }
  return files
}

let _cachedHash: string | null = null
let _cachedHashKey: string | null = null

function computeClientCodeHash(
  root: string,
  docsDirName: string,
  _outDirName: string,
  cacheDir?: string,
): string {
  try {
    const files: string[] = []

    const docsDir = join(root, docsDirName)
    if (fs.existsSync(docsDir)) {
      files.push(...getSourceFiles(docsDir))
    }

    const CONFIG_FILES = [
      'boltdocs.config.ts',
      'boltdocs.config.js',
      'boltdocs.config.mjs',
      'boltdocs.config.cjs',
      'package.json',
      'tsconfig.json',
    ]
    for (const configFile of CONFIG_FILES) {
      const configPath = join(root, configFile)
      if (fs.existsSync(configPath)) {
        files.push(configPath)
      }
    }

    files.sort()

    // Fast-change key: file count + first/last paths skip full recompute
    const fastKey = `${files.length}:${files[0]}:${files[files.length - 1]}`
    if (_cachedHash && _cachedHashKey === fastKey) {
      return _cachedHash
    }

    // Single pass: stat each file once and collect results for both
    // the pre-check and the hash computation.
    const fileStats = new Array<{ file: string; mtime: number; size: number }>(
      files.length,
    )
    for (let i = 0; i < files.length; i++) {
      const stat = fs.statSync(files[i])
      fileStats[i] = { file: files[i], mtime: stat.mtimeMs, size: stat.size }
    }

    // Lightweight pre-check: compare file count + most recent mtime
    // against a persisted meta file. If unchanged, skip the full SHA-256 scan.
    if (cacheDir) {
      const metaPath = join(cacheDir, 'hash-meta.json')
      const hashFile = join(cacheDir, 'client-hash.txt')
      try {
        if (fs.existsSync(metaPath) && fs.existsSync(hashFile)) {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
          const lastMtime = Math.max(...fileStats.map((s) => s.mtime))
          if (meta.fileCount === files.length && meta.lastMtime === lastMtime) {
            const savedHash = fs.readFileSync(hashFile, 'utf-8').trim()
            if (savedHash) {
              _cachedHash = savedHash
              _cachedHashKey = fastKey
              return savedHash
            }
          }
        }
      } catch {
        // Fall through to full scan
      }
    }

    // Compute hash using the already-collected stats (no additional stat calls)
    const hasher = crypto.createHash('sha256')
    for (const { file, mtime, size } of fileStats) {
      hasher.update(relative(root, file).replace(/\\/g, '/'))
      hasher.update(mtime.toString())
      hasher.update(size.toString())
    }
    const hash = hasher.digest('hex')
    _cachedHash = hash
    _cachedHashKey = fastKey

    // Persist meta for next build's pre-check
    if (cacheDir) {
      try {
        const lastMtime = Math.max(...fileStats.map((s) => s.mtime))
        const metaPath = join(cacheDir, 'hash-meta.json')
        fs.mkdirSync(cacheDir, { recursive: true })
        fs.writeFileSync(
          metaPath,
          JSON.stringify({ fileCount: files.length, lastMtime }),
        )
      } catch {
        // Non-critical, ignore
      }
    }

    return hash
  } catch (e) {
    return Math.random().toString(36).substring(2, 12)
  }
}

export type SSRManifest = Record<string, string[]>
export interface ManifestItem {
  css?: string[]
  file: string
  dynamicImports?: string[]
  src: string
  assets?: string[]
}

export type Manifest = Record<string, ManifestItem>

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
  const config = await resolveConfig(viteConfig, 'build', mode, mode)
  const cwd = process.cwd()
  const root = config.root || cwd
  let outDir = config.build.outDir || 'dist'
  const configBase = config.base

  const mergedOptions = Object.assign({}, config.ssgOptions || {}, ssgOptions)
  const buildStartTime = performance.now()

  const {
    script = 'sync',
    mock = false,
    htmlEntry = 'index.html',
    entry = await detectEntry(root, htmlEntry),
    formatting = 'none',
    includedRoutes: configIncludedRoutes = DefaultIncludedRoutes,
    onBeforePageRender,
    onPageRendered,
    onFinished,
    dirStyle = 'flat',
    includeAllRoutes = false,
    format = 'esm',
    concurrency = 20,
    rootContainerId = 'root',
    routeToSourceFileMap = {},
    cacheDir = '.boltdocs/build',
  }: ViteReactSSGOptions = mergedOptions

  const beastiesOptions = mergedOptions.beastiesOptions ?? {}
  const turbo = mergedOptions.turbo ?? false

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
  const currentClientHash = computeClientCodeHash(
    root,
    docsDirName,
    outDir,
    finalCacheDir,
  )
  const hash = currentClientHash.substring(0, 12)
  const ssgOut = join(finalCacheDir, 'ssr', turbo ? 'turbo-ssr' : hash)

  const hashFile = join(finalCacheDir, 'client-hash.txt')
  const templateHtmlFile = join(finalCacheDir, 'template-index.html')

  let canBypassClientBuild = false
  try {
    if (
      fs.existsSync(hashFile) &&
      fs.existsSync(templateHtmlFile) &&
      fs.existsSync(out) &&
      fs.existsSync(join(out, 'assets'))
    ) {
      const savedHash = await fs.readFile(hashFile, 'utf-8')
      if (savedHash.trim() === currentClientHash) {
        canBypassClientBuild = true
      }
    }
  } catch (e) {
    // Ignore and run full client build
  }

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
    buildLog('Client code unchanged. Bypassing client build...')
    await fs.ensureDir(out)
    await fs.copy(templateHtmlFile, join(out, htmlEntry))
  } else {
    // client
    dividerLog()
    buildLog('Build for client...')
    await viteBuild(
      mergeConfig(viteConfig, {
        logLevel: 'warn',
        build: {
          manifest: true,
          ssrManifest: true,
          chunkSizeWarningLimit: 2000,
          ...buildBundlerOptions({
            input: {
              app: join(root, htmlEntry || './index.html'),
            },
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
        mode: config.mode,
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
    success('Client build complete')

    // Save the template index.html to cache
    await fs.ensureDir(finalCacheDir)
    await fs.copy(join(out, htmlEntry), templateHtmlFile)
    await fs.writeFile(hashFile, currentClientHash, 'utf-8')
  }

  dividerLog()

  let unmock = () => {}
  if (mock) {
    const { jsdomGlobal }: { jsdomGlobal: () => () => void } =
      // @ts-expect-error allow js
      await import('./jsdomGlobal.mjs')
    unmock = jsdomGlobal()
  }

  // server
  const ssrEntry = await resolveAlias(config, entry)
  const serverBuildSkipped =
    (turbo || canBypassClientBuild) &&
    fs.existsSync(ssgOut) &&
    fs
      .readdirSync(ssgOut)
      .filter((f) => f.endsWith('.mjs') || f.endsWith('.cjs')).length > 0
  if (serverBuildSkipped) {
    buildLog('Server build unchanged. Bypassing server build...')
  } else {
    if (fs.existsSync(ssgOut)) await fs.remove(ssgOut)
    buildLog('Build for server...')
    process.env.VITE_SSG = 'true'
    await viteBuild(
      mergeConfig(viteConfig, {
        logLevel: 'warn',
        build: {
          ssr: ssrEntry,
          manifest: true,
          outDir: ssgOut,
          minify: false,
          cssCodeSplit: false,
          ...buildBundlerOptions({
            output:
              format === 'esm'
                ? {
                    entryFileNames: '[name].mjs',
                    format: 'esm',
                  }
                : {
                    entryFileNames: '[name].cjs',
                    format: 'cjs',
                  },
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
        mode: config.mode,
      }),
    )
    success('Server build complete')
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
  const entryBasename =
    ssrEntry.includes('/') || ssrEntry.includes('\\')
      ? ssrEntry
          .split(/[/\\]/)
          .pop()!
          .replace(/\.[^/.]+$/, '')
          .replace(ext, '')
      : safeEntryName

  const serverEntry =
    prefix + join(ssgOut, entryBasename + ext).replace(/\\/g, '/')
  const serverManifest: Manifest = JSON.parse(
    await fs.readFile(join(ssgOut, ...dotVitedir, 'manifest.json'), 'utf-8'),
  )

  const _require =
    typeof require !== 'undefined' ? require : createRequire(import.meta.url)

  const {
    createRoot,
    includedRoutes: serverEntryIncludedRoutes,
  }: {
    createRoot: CreateRootFactory
    includedRoutes: ViteReactSSGOptions['includedRoutes']
  } = format === 'esm' ? await import(serverEntry) : _require(serverEntry)
  const includedRoutes = serverEntryIncludedRoutes || configIncludedRoutes
  const { routes } = await createRoot(false)

  const { paths } = await routesToPaths(routes)

  let routesPaths = includeAllRoutes
    ? paths
    : await includedRoutes(paths, routes || [])

  routesPaths = DefaultIncludedRoutes(routesPaths, routes || [])

  routesPaths = Array.from(new Set(routesPaths))

  dividerLog()
  buildLog('Rendering Pages...', routesPaths.length)

  const beasties =
    beastiesOptions !== false && !turbo
      ? await getBeasties(outDir, {
          publicPath: configBase,
          ...beastiesOptions,
        })
      : undefined

  let zigCritters: import('./critical').ZigCritters | undefined
  if (turbo) {
    zigCritters = await getZigCritters()
    if (zigCritters) {
      info('Critical CSS generation enabled via `zig-critters` (turbo)')
    } else {
      warn('zig-critters not available, falling back to beasties')
    }
  }

  if (beasties && !zigCritters) {
    info('Critical CSS generation enabled via `beasties`')
  }

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

  const renderSpinner = createSpinner('Rendering pages...')
  renderSpinner.start()

  const ssrManifest: SSRManifest = JSON.parse(
    await fs.readFile(join(out, ...dotVitedir, 'ssr-manifest.json'), 'utf-8'),
  )
  const manifest: Manifest = JSON.parse(
    await fs.readFile(join(out, ...dotVitedir, 'manifest.json'), 'utf-8'),
  )
  let indexHTML = await fs.readFile(join(out, htmlEntry), 'utf-8')
  fs.rmSync(join(out, htmlEntry))
  indexHTML = rewriteScripts(indexHTML, script)

  const PQueue = (await import('p-queue')).default || (await import('p-queue'))
  const queue = new PQueue({ concurrency })
  const crittersQueue = new PQueue({
    concurrency: Math.min(os.cpus().length, 4),
  })

  const staticLoaderDataManifest: StaticLoaderDataManifest = {}
  let loaderDataFileCount = 0

  // Cache for collectAssets per route path (same route = same assets)
  const assetsCache = new Map<string, Set<string>>()

  let renderedCount = 0
  let cachedCount = 0
  let renderedSize = 0

  // Load the previous SSG cache metadata
  // Turbo mode skips page caching entirely for faster cold builds
  const cachePath = join(finalCacheDir, 'ssg-cache.json')
  const ssgPagesDir = join(finalCacheDir, 'ssg-pages')

  let ssgCache: Record<string, { mtime: number; loaderDataFilePath?: string }> =
    {}
  if (!turbo) {
    try {
      if (fs.existsSync(cachePath)) {
        ssgCache = await fs.readJson(cachePath)
      }
    } catch (e) {
      // Ignore cache errors
    }
  }
  const newSsgCache: Record<
    string,
    { mtime: number; loaderDataFilePath?: string }
  > = { ...ssgCache }

  // Pre-create all output directories to avoid ensureDir per page
  const outputDirs = new Set<string>()
  outputDirs.add(ssgPagesDir)
  for (const p of routesPaths) {
    const filename =
      dirStyle === 'nested'
        ? join(p.replace(/^\//g, ''), 'index.html')
        : `${(p.endsWith('/') ? `${p}index` : p).replace(/^\//g, '')}.html`
    outputDirs.add(join(out, dirname(filename)))
    // Also add loader data subdirectories
    const normalized = p === '/' ? '/index' : p.endsWith('/') ? `${p}index` : p
    outputDirs.add(join(out, 'static-loader-data', dirname(normalized)))
  }
  outputDirs.add(join(out, 'static-loader-data'))
  await Promise.all([...outputDirs].map((d) => fs.ensureDir(d)))

  for (const path of routesPaths) {
    const pathHash = crypto.createHash('md5').update(path).digest('hex')
    const cachedHtmlFile = join(ssgPagesDir, `${pathHash}.html`)
    const cachedLoaderFile = join(ssgPagesDir, `${pathHash}.json`)

    const relativeRouteFile = `${(
      path.endsWith('/') ? `${path}index` : path
    ).replace(/^\//g, '')}.html`

    const filename =
      dirStyle === 'nested'
        ? join(path.replace(/^\//g, ''), 'index.html')
        : relativeRouteFile

    const finalOutFile = join(out, filename)
    const normalizedKey = withLeadingSlash(path).replace(/\/$/, '')
    const sourceFile =
      routeToSourceFileMap[normalizedKey] || routeToSourceFileMap[path]

    let isCached = false
    let sourceMtime = 0
    if (
      !turbo &&
      canBypassClientBuild &&
      sourceFile &&
      fs.existsSync(sourceFile)
    ) {
      try {
        sourceMtime = Math.round(fs.statSync(sourceFile).mtimeMs)
        if (fs.existsSync(cachedHtmlFile)) {
          const cachedItem = ssgCache[normalizedKey] || ssgCache[path]
          if (cachedItem && Math.round(cachedItem.mtime) === sourceMtime) {
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
            // Hash unchanged, direct copy
            await fs.copy(cachedHtmlFile, finalOutFile)
          } else {
            // Hash changed, replace hash in cached HTML
            let content = await fs.readFile(cachedHtmlFile, 'utf-8')
            content = content.replace(
              /window\.__VITE_REACT_SSG_HASH__\s*=\s*'[^']*'/,
              `window.__VITE_REACT_SSG_HASH__ = '${hash}'`,
            )
            await fs.writeFile(finalOutFile, content, 'utf-8')
          }

          // Copy loader data if exists
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

    queue.add(async () => {
      try {
        const appCtx = (await createRoot(
          false,
          path,
        )) as ViteReactSSGContext<true>
        const {
          base,
          routes,
          triggerOnSSRAppRendered,
          transformState = serializeState,
          app,
          routerType,
        } = appCtx

        const transformedIndexHTML =
          (await onBeforePageRender?.(path, indexHTML, appCtx)) || indexHTML

        const fetchUrl = `${withTrailingSlash(base)}${removeLeadingSlash(path)}`

        const adapter = getAdapter(appCtx)
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

        const {
          appHTML,
          bodyAttributes,
          htmlAttributes,
          metaAttributes,
          styleTag,
          routerContext,
        } = await adapter.render(path)

        // Write loader data to separate file if exists
        const loaderData = routerContext?.loaderData as
          | Record<string, unknown>
          | undefined
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

        // String-based preload links (no JSDOM needed)
        const preloadLinksHtml = renderPreloadLinksString(assets)

        // Remove __staticRouterHydrationData script via regex (no JSDOM needed)
        // Use negative lookahead to avoid crossing </script> boundaries
        let html = renderedHTML.replace(
          /<script[^>]*>(?:(?!<\/script>)[\s\S])*__staticRouterHydrationData(?:(?!<\/script>)[\s\S])*<\/script>/g,
          '',
        )

        // Inject preload links into <head>
        if (preloadLinksHtml) {
          html = html.replace('<head>', `<head>${preloadLinksHtml}`)
        }

        let transformed = (await onPageRendered?.(path, html, appCtx)) || html
        let loaderDataScript = ''
        if (loaderData && Object.keys(loaderData).length > 0) {
          const safeLoaderDataJSON = JSON.stringify(loaderData).replace(
            /</g,
            '\\u003c',
          )
          loaderDataScript = `window.__VITE_REACT_SSG_STATIC_LOADER_DATA__ = { '${getNormalizedPathKey(path, configBase)}': ${safeLoaderDataJSON} };`
        }

        // Always generate our OWN hydration script from routerContext
        // instead of reusing React Router's built-in one. React Router's
        // output wraps the JSON in JSON.parse(...) which is valid but
        // ties us to React Router's serialisation format.  Owning the
        // serialisation ourselves keeps it under our control and means
        // the value is assigned directly as a plain object literal.
        let hydrationScriptContent = ''
        if (routerContext) {
          const payload = {
            loaderData: routerContext.loaderData ?? {},
            actionData: routerContext.actionData ?? null,
            errors: routerContext.errors ?? null,
          }
          const safeJson = JSON.stringify(payload).replace(/</g, '\\u003c')
          hydrationScriptContent = `window.__staticRouterHydrationData = ${safeJson};`
        }

        const headerScript = `<script>window.__VITE_REACT_SSG_HASH__ = '${hash}';${loaderDataScript}${hydrationScriptContent}</script>`
        transformed = transformed.replace('<head>', `<head>${headerScript}`)
        // Clean up the script placeholder
        transformed = transformed.replace(
          `<script>${SCRIPT_COMMENT_PLACEHOLDER}</script>`,
          '',
        )
        if (zigCritters) {
          // Turbo mode: use zig-critters WASM for critical CSS (cached CSS)
          try {
            if (cachedAllCss) {
              transformed = await zigCritters.processHtml(
                transformed,
                cachedAllCss,
              )
            }
          } catch (e) {
            warn(
              `[zig-critters] Failed to inline CSS for "${path}": ${e instanceof Error ? e.message : String(e)}`,
            )
          }
          transformed = transformed.replace(
            /<link\srel="stylesheet"(?!.*\bcrossorigin\b)/g,
            '<link rel="stylesheet" crossorigin',
          )
        } else if (beasties) {
          transformed = (await crittersQueue.add(() =>
            beasties.process(transformed),
          ))!
          transformed = transformed.replace(
            /<link\srel="stylesheet"(?!.*\bcrossorigin\b)/g,
            '<link rel="stylesheet" crossorigin',
          )
        }

        if (styleTag)
          transformed = transformed.replace('<head>', `<head>${styleTag}`)

        const formatted = await formatHtml(transformed, formatting)

        await fs.writeFile(join(out, filename), formatted, 'utf-8')

        // Save generated page and loader data to the SSG cache folder
        // Skip in turbo mode for faster builds
        if (!turbo && sourceFile && fs.existsSync(sourceFile)) {
          await fs.writeFile(cachedHtmlFile, formatted, 'utf-8')

          const normalizedKey = withLeadingSlash(path).replace(/\/$/, '')
          const mtimeRounded = Math.round(sourceMtime)

          if (
            loaderData &&
            Object.keys(loaderData).length > 0 &&
            writtenLoaderDataPath
          ) {
            await fs.writeFile(
              cachedLoaderFile,
              JSON.stringify(loaderData),
              'utf-8',
            )
            newSsgCache[normalizedKey] = {
              mtime: mtimeRounded,
              loaderDataFilePath: writtenLoaderDataPath,
            }
          } else {
            newSsgCache[normalizedKey] = {
              mtime: mtimeRounded,
            }
          }
        }

        renderedCount++
        renderedSize += formatted.length
      } catch (err: any) {
        throw new Error(`Error on page: ${path}\n${err.stack}`)
      }
    })
  }

  await queue.start().onIdle()

  renderSpinner.stop('success', 'Rendering complete')

  const totalPages = renderedCount + cachedCount
  const totalSizeMB = (renderedSize / 1024 / 1024).toFixed(2)
  info(
    `${colors.cyan(String(totalPages).padStart(3, ' '))} pages rendered  ${colors.dim(`(${renderedCount} new, ${cachedCount} cached, ${totalSizeMB} MB)`)}`,
  )

  // Save the updated cache index
  // Skip in turbo mode for faster builds
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
        let prunedCount = 0
        for (const file of cachedFiles) {
          if (file.endsWith('.html') || file.endsWith('.json')) {
            if (!activeHashes.has(file)) {
              await fs.remove(join(ssgPagesDir, file))
              prunedCount++
            }
          }
        }
        if (prunedCount > 0) {
          buildLog(`Pruned ${prunedCount} obsolete files from SSG cache.`)
        }
      }
    } catch (e) {
      // Ignore cache and pruning errors
    }
  }

  dividerLog()
  buildLog('Generating static loader data...', loaderDataFileCount)
  const staticLoaderDataManifestString = JSON.stringify(
    staticLoaderDataManifest,
    null,
    0,
  )
  await fs.writeFile(
    join(out, `static-loader-data-manifest-${hash}.json`),
    staticLoaderDataManifestString,
  )
  info(
    `${colors.dim(`${outDir}/`)}${colors.cyan(`static-loader-data-manifest-${hash}.json`.padEnd(15, ' '))}  ${colors.dim(getSize(staticLoaderDataManifestString))}`,
  )

  // Only clean up SSR temp dir when client build actually ran (hash changed).
  // When canBypassClientBuild is true, preserve it for serverBuildSkipped check.
  if (!canBypassClientBuild) {
    await fs.remove(join(finalCacheDir, 'ssr'))
  }

  unmock()
  const pwaPlugin: { disabled: boolean; generateSW: () => Promise<unknown> } =
    config.plugins.find((i) => i.name === 'vite-plugin-pwa')?.api
  if (pwaPlugin && !pwaPlugin.disabled && pwaPlugin.generateSW) {
    buildLog('Regenerate PWA...')
    await pwaPlugin.generateSW()
  }

  const buildTime = Math.round(performance.now() - buildStartTime)
  const metrics = await collectPerformanceMetrics(out, buildTime)
  writePerformanceMetrics(out, metrics)

  const toKB = (b: number) => (b / 1024).toFixed(0)
  const toMB = (b: number) => (b / 1024 / 1024).toFixed(1)
  const jsSize =
    metrics.totalJSBundleSize > 1024 * 1024
      ? toMB(metrics.totalJSBundleSize) + ' MB'
      : toKB(metrics.totalJSBundleSize) + ' kB'
  const cssSize =
    metrics.totalCSSBundleSize > 1024 * 1024
      ? toMB(metrics.totalCSSBundleSize) + ' MB'
      : toKB(metrics.totalCSSBundleSize) + ' kB'

  console.log(
    table(
      ['Metric', 'Result'],
      [
        ['Build Time', `${(buildTime / 1000).toFixed(1)}s`],
        ['Pages', String(metrics.pages.length)],
        ['JavaScript', jsSize],
        ['CSS', cssSize],
      ],
      { style: 'round', headerSeparator: true },
    ),
  )

  success('Build finished.')

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

function rewriteScripts(indexHTML: string, mode?: string) {
  if (!mode || mode === 'sync') return indexHTML
  return indexHTML.replace(
    /<script type="module" /g,
    `<script type="module" ${mode} `,
  )
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
