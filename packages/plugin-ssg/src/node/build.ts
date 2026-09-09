import { colors, warn, error } from '@bdocs/dui'
import type { InlineConfig } from 'vite'
import type {
  MatchRouteBranchWithParams,
  RouterContextData,
  RouterEntryModule,
} from '../router-contract'
import type {
  RouteRecord,
  ViteReactSSGContext,
  ViteReactSSGOptions,
} from '../types'
import { createRequire } from 'node:module'
import os from 'node:os'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import fs from 'fs-extra'
import { createLogger, resolveConfig, version as viteVersion } from 'vite'
import {
  removeLeadingSlash,
  withLeadingSlash,
  withTrailingSlash,
} from '../utils/path'
import { serializeState } from '../utils/state'
import { createAssetCollector } from './assets'
import type { AssetCollector } from './assets'
import { getBeasties, getZigCritters } from './critical'
import {
  createCriticalCssCacheKey,
  CriticalCssCache,
  extractNewStyleTags,
} from './critical-cache'
import {
  computeRouteClientAssetHash,
  createManifestIndexes,
} from './client-dep-map'
import crypto from 'node:crypto'
import {
  createHtmlTemplate,
  detectEntry,
  renderHTML,
  SCRIPT_COMMENT_PLACEHOLDER,
  type HtmlTemplate,
} from './html'
import { renderPreloadLinks, renderPreloadLinksString } from './preload-links'
import { getAdapter } from './router-adapter'
import { getSize, resolveAlias, routesToPaths } from './utils'
import { materializeFiles } from './materialize'
import { createDeferredFileWriteQueue } from './deferred-file-write'
import {
  getCanonicalRouteKey,
  getSsgOutputPageFiles,
  isClientCacheReusable,
  isSsgOutputReusable,
  listOutputFiles,
  readSsgOutputState,
  reconcileRouteCache,
  writeFileIfChanged,
  writeJsonIfChanged,
  writeSsgOutputState,
} from './cache-io'
import {
  collectPerformanceMetrics,
  writePerformanceMetrics,
} from './performance'
import { computeClientCodeHash } from './client-hash'
import { computeChunkHashesWithCache } from './chunk-hash-cache'
import {
  getSsgSourceContentHash,
  isSsgPageCacheValid,
} from './cache-validation'
import { getSsgPoolMetrics } from './pool-metrics'
import {
  createSsgHydrationScript,
  createSsgRouterContextPayload,
} from './ssg-worker-payload'
import {
  attachSsgRouteManifest,
  createSsgBuildSnapshot,
  createSsgRouteManifest,
} from './pipeline/snapshot'
import type { SsgBuildSnapshot } from './pipeline/snapshot'
import {
  createBundleLogger,
  executeClientBundle,
  executeServerBundle,
  pruneDirectoryCache,
  syncPublicAssets,
  resolveSsrCacheDirectory,
  shouldSuppressBundleLog,
} from './pipeline/bundles'
import { createRenderPlans, getRenderPlan } from './pipeline/render-plan'
import type { RenderPlan } from './pipeline/render-plan'
import { executeRenderSchedule } from './pipeline/render-executor'

const dotVitedir = Number.parseInt(viteVersion) >= 5 ? ['.vite'] : []

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

export function serializeStaticLoaderDataManifest(
  manifest: StaticLoaderDataManifest,
): string {
  const sortedManifest = Object.fromEntries(
    Object.entries(manifest).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    ),
  )
  return JSON.stringify(sortedManifest)
}

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
  cacheDir?: string,
): Promise<Map<string, string>> {
  return computeChunkHashesWithCache(
    outDir,
    collectChunkFiles(manifest),
    cacheDir ? join(cacheDir, 'chunk-hashes.json') : undefined,
  )
}

export function getNormalizedPathKey(
  routePath: string,
  _base: string = '/',
): string {
  // `routesToPaths()` already returns absolute public paths, including the
  // configured docs base. Never prepend the base here: doing so aliases an
  // external/localized route such as `/es` to `/docs/es` and makes the final
  // loader-data manifest depend on parallel completion order.
  const leading = withLeadingSlash(routePath)
  return leading !== '/' && leading.endsWith('/')
    ? leading.slice(0, -1)
    : leading
}

interface RoutesCacheRecord {
  paths: string[]
  dirStyle?: string
  base?: string
  sourceFiles?: Record<string, string>
}

function getCachedRouteSourceFile(
  root: string,
  sourceFiles: Record<string, string> | undefined,
  routePath: string,
): string | undefined {
  const source = sourceFiles?.[routePath]
  if (!source) return undefined
  return isAbsolute(source) ? source : join(root, source)
}

function createCachedSourceFiles(
  root: string,
  sourceFiles: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sourceFiles).map(([routePath, sourceFile]) => [
      routePath,
      isAbsolute(sourceFile) ? relative(root, sourceFile) : sourceFile,
    ]),
  )
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
  const configBase = (viteConfig.base as string) || '/'

  const buildStartTime = performance.now()
  let clientBuildDurationMs = 0
  let serverBuildDurationMs = 0
  let ssrImportDurationMs = 0

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
  const currentClientHash = computeClientCodeHash(
    root,
    docsDirName,
    finalCacheDir,
  )
  // Phase 1: establish one immutable build contract before Vite is resolved.
  // The existing pipeline still consumes its legacy locals below; subsequent
  // phases will replace those locals with this snapshot step by step.
  let buildSnapshot: SsgBuildSnapshot = createSsgBuildSnapshot({
    root,
    outDir: out,
    cacheDir: finalCacheDir,
    base: configBase,
    mode,
    entry,
    htmlEntry,
    docsDirName,
    clientHash: currentClientHash,
    routeToSourceFileMap,
  })
  // The public loader-data filenames must use the definitive client hash. On
  // the first build the early probe can be stat-only, while the client bundle
  // later produces Sätteri's stable content hash. Keep this mutable until the
  // bundle phase completes; the SSR cache directory is tracked independently.
  let hash = buildSnapshot.clientHash.substring(0, 12)

  // ssgOut uses a placeholder until turbo is resolved from config
  let ssgOut = join(buildSnapshot.cacheDir, 'ssr', hash)
  const clientCacheDir = join(
    buildSnapshot.cacheDir,
    'client-cache',
    buildSnapshot.clientHash,
  )
  // The Sätteri manifest can be generated during the client build, which may
  // make the definitive post-build hash differ from the early probe. Keep the
  // resolved directory separate so final metrics/output state always point at
  // the bundle that was actually produced.
  let resolvedClientCacheDir = clientCacheDir
  let resolvedClientHash = currentClientHash
  // Identity used for routes without a source file (for example synthetic
  // base routes such as /docs). The first cold probe may use the stat-only
  // fallback hash, while the completed client build has the stable Sätteri
  // manifest hash. Keep this separate from the client-cache decision hash.
  let pageContentFallbackHash = currentClientHash
  const hashFile = join(clientCacheDir, 'client-hash.txt')

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
  const outputStatePath = join(finalCacheDir, 'ssg-output.json')
  // The early path must never bypass plugins/hooks that generate auxiliary
  // files. Legacy builds without a state file also take the normal pipeline.
  const earlyOutputState = await readSsgOutputState(outputStatePath)
  const canUseDeterministicFastPath =
    earlyOutputState !== undefined &&
    earlyOutputState.auxiliaryFiles.length === 0

  if (canBypassClientBuild) {
    const actualClientFiles = listOutputFiles(join(clientCacheDir, 'dist'))
    if (
      !isClientCacheReusable(earlyOutputState, actualClientFiles, htmlEntry)
    ) {
      // Without a strict output state or with an incomplete client cache, do
      // not let runClientBuild() hard-link an invalid bundle into dist.
      canBypassClientBuild = false
    }
  }

  let routesPaths: string[] = []
  let routesCacheAvailable = false
  const requestedDirStyle =
    (ssgOptions.dirStyle || (viteConfig as any).ssgOptions?.dirStyle) ?? 'flat'

  if (
    canBypassClientBuild &&
    canUseDeterministicFastPath &&
    requestedDirStyle !== 'nested'
  ) {
    const routesCachePath = join(finalCacheDir, 'routes-cache.json')
    try {
      if (fs.existsSync(routesCachePath) && fs.existsSync(cachePath)) {
        const cachedRoutes = JSON.parse(
          fs.readFileSync(routesCachePath, 'utf-8'),
        ) as RoutesCacheRecord
        const rawCachedSsgIndex = JSON.parse(
          fs.readFileSync(cachePath, 'utf-8'),
        ) as Record<string, SsgCacheItem>
        const cachedSsgIndex = reconcileRouteCache(
          rawCachedSsgIndex,
          cachedRoutes.paths,
        )
        const cacheMatchesConfig =
          cachedRoutes.dirStyle === requestedDirStyle &&
          cachedRoutes.base === configBase
        if (cacheMatchesConfig) {
          const allCached = cachedRoutes.paths.every((p: string) => {
            const normalizedPath = getCanonicalRouteKey(p)
            const cacheEntry = cachedSsgIndex[normalizedPath]
            const sourceFile =
              routeToSourceFileMap[normalizedPath] ||
              routeToSourceFileMap[p] ||
              getCachedRouteSourceFile(
                root,
                cachedRoutes.sourceFiles,
                normalizedPath,
              ) ||
              getCachedRouteSourceFile(root, cachedRoutes.sourceFiles, p)
            return isSsgPageCacheValid({
              routePath: p,
              cacheItem: cacheEntry,
              sourceContentHash: getSsgSourceContentHash(
                sourceFile,
                pageContentFallbackHash,
              ),
              ssgPagesDir,
              requireAssetHash: true,
            })
          })
          if (cachedRoutes.paths.length > 0 && allCached) {
            routesPaths = cachedRoutes.paths
            routesCacheAvailable = true
          }
        }
      }
    } catch {}
  }

  if (routesCacheAvailable) {
    // Fast path: resolveConfig skipped, copy cached files, return.
    // Keep this path observable too: a fully cached warm build must not
    // disappear from the Render pages benchmark.
    const cachedFastPathStart = performance.now()
    let cachedSsgIndex: Record<string, SsgCacheItem> = {}
    try {
      if (fs.existsSync(cachePath)) {
        cachedSsgIndex = reconcileRouteCache(
          JSON.parse(fs.readFileSync(cachePath, 'utf-8')),
          routesPaths,
        )
      }
    } catch {}

    const expectedPageFiles = [
      ...getSsgOutputPageFiles(
        routesPaths,
        cachedSsgIndex,
        requestedDirStyle === 'nested' ? 'nested' : 'flat',
      ),
      `static-loader-data-manifest-${hash}.json`,
    ]
    const clientCacheDist = join(clientCacheDir, 'dist')
    const expectedClientFiles = listOutputFiles(clientCacheDist).filter(
      (file) => file !== htmlEntry,
    )
    const outputState = await readSsgOutputState(outputStatePath)
    // Auxiliary files are produced by plugins/hooks after the client bundle
    // and cannot be recomputed safely before resolveConfig. Force the normal
    // pipeline whenever they exist; the state remains useful for diagnostics,
    // while the early fast path stays limited to deterministic output.
    const outputReused =
      outputState?.auxiliaryFiles.length === 0 &&
      isSsgOutputReusable(
        outputState,
        currentClientHash,
        out,
        expectedClientFiles,
        expectedPageFiles,
        [],
      )

    const loaderDataManifest: Record<string, string> = {}

    if (!outputReused) {
      if (fs.existsSync(out)) await fs.remove(out)
      const clientCacheDist = join(clientCacheDir, 'dist')
      await syncPublicAssets(viteConfig.publicDir, clientCacheDist)
      await fs.copy(clientCacheDist, out)

      const cachedFilesToMaterialize: Array<{
        source: string
        destination: string
      }> = []
      for (const p of routesPaths) {
        const pathHash = crypto.createHash('md5').update(p).digest('hex')
        const cachedHtmlPath = join(ssgPagesDir, `${pathHash}.html`)
        const cachedLoaderPath = join(ssgPagesDir, `${pathHash}.json`)
        const filename = `${(p.endsWith('/') ? `${p}index` : p).replace(/^\//g, '')}.html`
        cachedFilesToMaterialize.push({
          source: cachedHtmlPath,
          destination: join(out, filename),
        })
        if (fs.existsSync(cachedLoaderPath)) {
          const nk = getCanonicalRouteKey(p)
          const lEntry = cachedSsgIndex[nk]
          if (lEntry?.loaderDataFilePath) {
            cachedFilesToMaterialize.push({
              source: cachedLoaderPath,
              destination: join(out, lEntry.loaderDataFilePath),
            })
            loaderDataManifest[getNormalizedPathKey(p, configBase)] =
              lEntry.loaderDataFilePath
          }
        }
      }
      await materializeFiles(cachedFilesToMaterialize)

      await writeFileIfChanged(
        join(out, `static-loader-data-manifest-${hash}.json`),
        serializeStaticLoaderDataManifest(loaderDataManifest),
      )
    }
    await pruneSsgPagesIfDue(ssgPagesDir, cachedSsgIndex, routesPaths)
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
    const cachedFastPathMs = Math.round(performance.now() - cachedFastPathStart)
    const cachedPipelineMetrics = {
      renderedPageCount: 0,
      cachedPageCount: routesPaths.length,
      clientBuildMs: 0,
      serverBuildMs: 0,
      ssrImportMs: 0,
      workerPoolSetupMs: 0,
      routePreparationMs: 0,
      workerTransportMs: 0,
      workerRoundTripMs: 0,
      workerTransportAvgMs: 0,
      finalizeP50Ms: 0,
      finalizeP95Ms: 0,
      assetCollectionMs: 0,
      beforeHookMs: 0,
      htmlAssemblyMs: 0,
      onPageRenderedHookMs: 0,
      criticalCssP50Ms: 0,
      criticalCssP95Ms: 0,
      cacheWriteMs: 0,
      cachedOutputMs: cachedFastPathMs,
      renderQueueDrainMs: 0,
      renderPipelineSettleMs: 0,
      outputLinkMs: cachedFastPathMs,
    }
    // The machine-readable JSON envelope is part of the benchmark contract
    // (scripts/benchmarks parse it from stdout). Emit it only in benchmark
    // mode — the same gate the core CLI uses for its own phase envelope — so
    // ordinary builds stay clean.
    if (process.env.BOLTDOCS_BENCHMARK_PHASES === 'true') {
      // eslint-disable-next-line no-console
      console.log(
        `[boltdocs] ${JSON.stringify({
          name: 'Render pages',
          duration: 0,
          success: true,
          details: `${routesPaths.length} pages / 0 new / ${routesPaths.length} cached`,
          metrics: {
            renderedCount: 0,
            cachedCount: routesPaths.length,
            renderedSize: 0,
            totalPages: routesPaths.length,
            prunedCount: 0,
            clientBuildMs: 0,
            serverBuildMs: 0,
            ssrImportMs: 0,
            workerPoolSetupMs: 0,
            workerUsed: false,
            workerCount: 0,
            fallbackMainThread: false,
            ssrP50Ms: 0,
            ssrP95Ms: 0,
            ssrP99Ms: 0,
            crittersP50Ms: 0,
            crittersP95Ms: 0,
            writeP50Ms: 0,
            writeP95Ms: 0,
            routerTimingCount: 0,
            routerMatchAvgMs: 0,
            routerResolveAvgMs: 0,
            routerLoadersAvgMs: 0,
            routerRenderAvgMs: 0,
            routerHelmetAvgMs: 0,
            routerTotalAvgMs: 0,
            pagesPerSecond: 0,
            pipeline: cachedPipelineMetrics,
          },
        })}`,
      )
    }
    await onFinished?.(outDir)
    await removeOutputBuildMetadata(out)
    await writeSsgOutputState(
      join(finalCacheDir, 'ssg-output.json'),
      currentClientHash,
      out,
      expectedPageFiles,
      expectedClientFiles,
    )
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
  const ssrCacheRoot = join(finalCacheDir, 'ssr')
  const ssrCacheIndexPath = join(finalCacheDir, 'ssr-cache-index.json')
  ssgOut = join(ssrCacheRoot, turbo ? 'turbo-ssr' : hash)

  // The early client hash can be a stat-only probe on cold builds, while the
  // completed Sätteri manifest produces the definitive hash. Persist the
  // mapping so a later warm build can reuse the SSR bundle created under the
  // early probe directory without serializing client and server builds.
  if (!turbo && canBypassClientBuild) {
    try {
      const index = (await fs.readJson(ssrCacheIndexPath)) as Record<
        string,
        string
      >
      const mappedDirectory = index[currentClientHash]
      if (typeof mappedDirectory === 'string') {
        const candidate = resolveSsrCacheDirectory(
          ssrCacheRoot,
          mappedDirectory,
        )
        if (candidate) ssgOut = candidate
      }
    } catch {
      // A missing or invalid index only costs one SSR rebuild.
    }
  }

  const clientLogger = createBundleLogger(
    createLogger(),
    shouldSuppressBundleLog,
  )

  // === SSG cache setup ===
  let unmock = () => {}
  if (mock) {
    const { jsdomGlobal } = (await import('./jsdomGlobal.mjs')) as {
      jsdomGlobal: (
        html?: string,
        options?: import('jsdom').ConstructorOptions,
      ) => () => void
    }
    unmock = jsdomGlobal()
  }
  let ssgCache: Record<string, SsgCacheItem> = {}
  try {
    if (fs.existsSync(cachePath)) {
      const cachedIndex = await fs.readJson(cachePath)
      ssgCache = reconcileRouteCache(cachedIndex, Object.keys(cachedIndex))
    }
  } catch {}

  let canSkipSsrImport = false
  if (canBypassClientBuild) {
    try {
      const routesCachePath = join(finalCacheDir, 'routes-cache.json')
      if (fs.existsSync(routesCachePath)) {
        const cachedRoutes = JSON.parse(
          fs.readFileSync(routesCachePath, 'utf-8'),
        ) as RoutesCacheRecord
        const allExistInCache =
          cachedRoutes.paths.length > 0 &&
          cachedRoutes.paths.every((p: string) => {
            const nk = getCanonicalRouteKey(p)
            const entry = ssgCache[nk]
            const sourceFile =
              routeToSourceFileMap[nk] ||
              routeToSourceFileMap[p] ||
              getCachedRouteSourceFile(root, cachedRoutes.sourceFiles, nk) ||
              getCachedRouteSourceFile(root, cachedRoutes.sourceFiles, p)
            return isSsgPageCacheValid({
              routePath: p,
              cacheItem: entry,
              sourceContentHash: getSsgSourceContentHash(
                sourceFile,
                pageContentFallbackHash,
              ),
              ssgPagesDir,
              requireAssetHash: true,
            })
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

  const ssrEntry = !canSkipSsrImport
    ? await resolveAlias(resolvedConfig, entry)
    : ''
  const serverBuildSkipped =
    (turbo || canBypassClientBuild) &&
    fs.existsSync(ssgOut) &&
    fs
      .readdirSync(ssgOut)
      .filter((f) => f.endsWith('.mjs') || f.endsWith('.cjs')).length > 0

  const renderStartTime = performance.now()
  const [clientBundle, serverBundle] = await Promise.all([
    executeClientBundle(
      {
        viteConfig,
        resolvedMode: resolvedConfig.mode,
        root,
        htmlEntry,
        outDir: out,
        clientCacheDir,
        finalCacheDir,
        docsDirName,
        initialClientHash: currentClientHash,
        canBypassClientBuild,
        customLogger: clientLogger,
        onStep,
        shouldSuppressLog: shouldSuppressBundleLog,
      },
      () => computeClientCodeHash(root, docsDirName, finalCacheDir),
    ),
    executeServerBundle({
      viteConfig,
      resolvedMode: resolvedConfig.mode,
      entry,
      ssrEntry,
      ssgOut,
      format,
      canSkipSsrImport,
      serverBuildSkipped,
      customLogger: clientLogger,
      onStep,
      shouldSuppressLog: shouldSuppressBundleLog,
    }),
  ])
  outDir = clientBundle.outDir
  resolvedClientCacheDir = clientBundle.resolvedClientCacheDir
  resolvedClientHash = clientBundle.resolvedClientHash
  pageContentFallbackHash = clientBundle.pageContentFallbackHash
  hash = resolvedClientHash.substring(0, 12)
  clientBuildDurationMs = clientBundle.durationMs
  serverBuildDurationMs = serverBundle.durationMs

  if (!turbo) {
    try {
      let ssrCacheIndex: Record<string, string> = {}
      try {
        ssrCacheIndex = (await fs.readJson(ssrCacheIndexPath)) as Record<
          string,
          string
        >
      } catch {
        // Start a new index when the cache has not been populated yet.
      }
      ssrCacheIndex[resolvedClientHash] = relative(ssrCacheRoot, ssgOut)
      await writeJsonIfChanged(ssrCacheIndexPath, ssrCacheIndex)
    } catch {
      // Cache metadata is advisory; never fail a successful build.
    }
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

  // ── Skip SSR import when all routes cached ────────────────
  // When canSkipSsrImport is true we already have routesPaths and all
  // pages are cached.  Jump straight to the copy phase without importing
  // the ~7MB SSR bundle, creating the React renderer, or instantiating the
  // worker pool.
  let _serverContext: ViteReactSSGContext<true> | null = null
  let _sharedAdapter: ReturnType<typeof getAdapter> | null = null
  let routes: Readonly<RouteRecord[]> = []
  let matchRouteBranchWithParams: MatchRouteBranchWithParams | undefined
  let ctxBase = '/'
  let ctxTrigger:
    | ((route: string, appHTML: string, ctx: any) => Promise<unknown[]>)
    | undefined
  let ctxApp: any = null
  let ctxRouterType: 'remix' | 'single-page' | undefined
  type IncludedRoutesFn = NonNullable<ViteReactSSGOptions['includedRoutes']>
  let includedRoutes: IncludedRoutesFn = configIncludedRoutes

  if (!canSkipSsrImport) {
    const _require =
      typeof require !== 'undefined' ? require : createRequire(import.meta.url)

    const ssrImportStart = performance.now()
    const serverEntryModule = (
      format === 'esm' ? await import(serverEntry) : _require(serverEntry)
    ) as RouterEntryModule & {
      createRoot: CreateRootFactory
      includedRoutes?: ViteReactSSGOptions['includedRoutes']
    }
    ssrImportDurationMs = performance.now() - ssrImportStart
    matchRouteBranchWithParams = serverEntryModule.matchRouteBranchWithParams
    const { createRoot, includedRoutes: serverEntryIncludedRoutes } =
      serverEntryModule
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

    buildSnapshot = attachSsgRouteManifest(
      buildSnapshot,
      createSsgRouteManifest(root, routes, routeToSourceFileMap),
    )

    // Pre-create the RemixAdapter ONCE using the shared SSR context and the
    // exact SSR entry module that created the route tree.
    _sharedAdapter = getAdapter(ctx, serverEntryModule)
  }

  // Worker SSR entry path (only computed when we need workers)
  let workerSsrEntryPath = ''
  // Route preparation starts before the per-page metric block below.
  let routePreparationMs = 0
  // Lazy worker thread pool — only created when the first uncached
  // page is encountered in the for-loop.  Fully cached warm builds never
  // pay the ~500ms pool initialisation cost.
  let renderPool: import('./ssg-worker-pool').SsgWorkerPool | null = null
  let poolForCleanup: import('./ssg-worker-pool').SsgWorkerPool | null = null
  let poolDestroyPromise: Promise<void> | null = null
  /** Set to true once we've attempted lazy pool creation (avoid re-try). */
  let lazyPoolAttempted = false

  // Pool shutdown can be requested by the worker-failure fallback and by the
  // executor's finally block. Share one promise so cleanup is idempotent and
  // never asks Piscina to destroy the same pool twice.
  async function destroyRenderPool(): Promise<void> {
    if (poolDestroyPromise) {
      await poolDestroyPromise
      return
    }
    const pool = poolForCleanup
    if (!pool) return
    poolDestroyPromise = pool.destroy()
    await poolDestroyPromise
  }

  if (!canSkipSsrImport) {
    const routePreparationStart = performance.now()
    const { paths } = await routesToPaths(routes)

    routesPaths = includeAllRoutes
      ? paths
      : await includedRoutes(paths, routes || [])

    routesPaths = DefaultIncludedRoutes(routesPaths, routes || [])

    routesPaths = Array.from(new Set(routesPaths))
    routePreparationMs += performance.now() - routePreparationStart

    // Save route paths so future warm builds can skip the SSR import entirely.
    try {
      const routesCachePath = join(finalCacheDir, 'routes-cache.json')
      await writeJsonIfChanged(
        routesCachePath,
        {
          paths: routesPaths,
          dirStyle,
          base: configBase,
          sourceFiles: createCachedSourceFiles(root, routeToSourceFileMap),
        },
        0,
      )
    } catch {
      // Non-critical, ignore
    }

    // Worker SSR entry path: join the output dir with the entry basename.
    workerSsrEntryPath = join(ssgOut, entryBasename + ext)

    // Worker startup is deferred until the complete render pipeline is ready.
    // This keeps every possible failure before dispatch from leaking a pool;
    // the cold-build policy is applied immediately before the protected block.
  }

  // Lazy pool creation helper — invoked from the for-loop when the first
  // uncached page is found.  On fully cached warm builds this is never
  // called, saving ~500ms.
  async function ensureRenderPool(): Promise<void> {
    if (renderPool || lazyPoolAttempted || routesPaths.length <= 4) return
    lazyPoolAttempted = true
    const workerInitStart = performance.now()
    try {
      workerSsrEntryPath = join(ssgOut, entryBasename + ext)
      const { SsgWorkerPool } = await import('./ssg-worker-pool')
      renderPool = new SsgWorkerPool({
        ssrEntryPath: workerSsrEntryPath,
        format: format === 'esm' ? 'esm' : 'cjs',
      })
      poolForCleanup = renderPool
      await renderPool.ready()
      workerPoolSetupMs = performance.now() - workerInitStart
    } catch {
      workerPoolSetupMs = performance.now() - workerInitStart
      renderPool = null
    }
  }

  // New critical CSS strategy
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
  let beasties: any

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

  // ── Skip manifest reading + chunk hashing when all cached ──
  // These are only needed for per-route cache invalidation in the for-loop.
  // When canSkipSsrImport is true, every route is already cached with a
  // matching assetHash, so we can use currentClientHash as a default.
  let ssrManifest: SSRManifest = {}
  let manifest: Manifest = {}
  const routeToAssetHash: Record<string, string> = {}
  let manifestIndexes: import('./client-dep-map').ManifestIndexes | null = null

  if (!canSkipSsrImport) {
    const [ssrManifestText, manifestText] = await Promise.all([
      fs.readFile(join(out, ...dotVitedir, 'ssr-manifest.json'), 'utf-8'),
      fs.readFile(join(out, ...dotVitedir, 'manifest.json'), 'utf-8'),
    ])
    ssrManifest = JSON.parse(ssrManifestText)
    manifest = JSON.parse(manifestText)

    // Build a per-route client dependency hash from the Vite manifests.
    manifestIndexes = createManifestIndexes(manifest)

    // Pre-compute hashes for all client chunks once.
    const chunkHashes = await computeChunkHashes(out, manifest, finalCacheDir)

    // Keep every source-map entry here. The map may contain localized,
    // basename, or alias keys that do not equal the final public route string;
    // filtering it would silently replace a precise asset hash with the global
    // fallback and weaken invalidation correctness. The parallel manifest
    // reads are independent of this conservative cache behavior.
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

    // Routes without a known source file (including synthetic base routes)
    // use the stable post-build page identity on cold builds. The initial
    // stat-only client probe can differ from the Sätteri manifest hash.
    for (const routePath of routesPaths) {
      if (!routeToAssetHash[routePath]) {
        routeToAssetHash[routePath] = pageContentFallbackHash
      }
    }
  } else {
    // All cached: preserve each route's previously computed asset hash.
    // The route hash is more precise than currentClientHash and is the value
    // used by the per-route cache check below.
    for (const routePath of routesPaths) {
      const normalizedPath = getCanonicalRouteKey(routePath)
      const cachedItem = ssgCache[normalizedPath]
      routeToAssetHash[routePath] = cachedItem?.assetHash || currentClientHash
    }
  }

  let indexHTML = await fs.readFile(join(out, htmlEntry), 'utf-8')
  fs.rmSync(join(out, htmlEntry))
  indexHTML = rewriteScripts(indexHTML, script)
  // Compile the common template once. If a user hook transforms index.html,
  // finalizePage automatically falls back to the original renderer.
  const compiledIndexTemplate: HtmlTemplate | null = onBeforePageRender
    ? null
    : createHtmlTemplate({ rootContainerId, indexHTML })

  const PQueue = (await import('p-queue')).default || (await import('p-queue'))
  const queue = new PQueue({ concurrency })
  const crittersQueue = new PQueue({
    concurrency: Math.min(os.cpus().length, 4),
  })
  // Finalize queue with limited concurrency to prevent event-loop
  // saturation when many worker results arrive simultaneously.
  const finalizeQueue = new PQueue({
    concurrency: Math.max(2, Math.min(os.cpus().length, 6)),
  })

  const staticLoaderDataManifest: StaticLoaderDataManifest = {}
  let loaderDataFileCount = 0

  // Pre-compute source metadata (content hash + mtime) ONCE so
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
        sourceMetaCache.set(srcPath, {
          hash: `${stat.mtimeMs}:${stat.size}`,
          mtimeMs: stat.mtimeMs,
        })
      }
    } catch {
      // Non-fatal — finalizePage falls back to currentClientHash
    }
  }

  let assetCollector: AssetCollector | null = null
  if (!canSkipSsrImport && matchRouteBranchWithParams) {
    assetCollector = createAssetCollector({
      routes: [...routes],
      base: ctxBase,
      matchRouteBranchWithParams,
      serverManifest,
      manifest,
      ssrManifest,
    })
  }

  // Build one immutable plan per route after all source metadata and asset
  // hashes are known. Both cache validation and HTML finalization consume the
  // same values, eliminating duplicate path/hash/string work and preventing
  // nested/flat output logic from drifting between code paths.
  const renderPlans = createRenderPlans({
    routes: routesPaths,
    outDir: out,
    ssgPagesDir,
    dirStyle,
    contextBase: ctxBase,
    fallbackHash: pageContentFallbackHash,
    routeToSourceFileMap,
    sourceMeta: sourceMetaCache,
    routeToAssetHash,
  })

  // Cache only identical structural pages. Unlike the old first-page cache,
  // this never applies one route's critical CSS to a different route shape.
  const criticalCssCache = new CriticalCssCache()

  // Per-page timing accumulators for render sub-metrics.
  // Keep these as primitive totals/arrays so instrumentation has negligible
  // overhead and remains safe when worker results resolve out of order.
  const ssrPageTimesMs: number[] = []
  const finalizePageTimesMs: number[] = []
  const crittersPageTimesMs: number[] = []
  const writePageTimesMs: number[] = []
  let assetCollectionMs = 0
  let beforeHookMs = 0
  let pageHtmlAssemblyMs = 0
  let onPageRenderedHookMs = 0
  const cacheWriteMs = 0
  let cachedOutputMs = 0
  let workerRoundTripMs = 0
  let workerRoundTripCount = 0
  let renderedPageCount = 0
  let cachedPageCount = 0
  let outputLinkMs = 0
  let renderQueueDrainMs = 0
  const routerTimingTotals = {
    count: 0,
    matchMs: 0,
    resolveMs: 0,
    loadersMs: 0,
    renderMs: 0,
    helmetMs: 0,
    totalMs: 0,
  }
  function recordRouterTimings(
    timings:
      | {
          matchMs: number
          resolveMs: number
          loadersMs: number
          renderMs: number
          helmetMs: number
          totalMs: number
        }
      | undefined,
  ): void {
    if (!timings) return
    routerTimingTotals.count++
    routerTimingTotals.matchMs += timings.matchMs
    routerTimingTotals.resolveMs += timings.resolveMs
    routerTimingTotals.loadersMs += timings.loadersMs
    routerTimingTotals.renderMs += timings.renderMs
    routerTimingTotals.helmetMs += timings.helmetMs
    routerTimingTotals.totalMs += timings.totalMs
  }
  // This measures pool construction plus the pool's readiness hook. The pool
  // currently does not expose a per-worker handshake, so do not label this as
  // worker initialization; Piscina lazily initializes workers on first work.
  let workerPoolSetupMs = 0
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
  // Cache hits are materialized directly into dist before the final batch.
  // Track those destinations so the hardlink pass does not repeat the I/O.
  const materializedHtmlFiles = new Set<string>()
  const materializedLoaderFiles = new Set<string>()
  // Warm cache hits are registered here and materialized in one batch after
  // rendering. This avoids one copy/remove operation per cached route.
  const filesToMaterialize: Array<{
    source: string
    destination: string
  }> = []
  const deferredPageWrites = createDeferredFileWriteQueue({
    writeFile: async (filePath, content) => {
      await fs.ensureDir(dirname(filePath))
      await fs.writeFile(filePath, content, 'utf-8')
    },
  })

  // Reconcile the index with the current route set before rendering. This
  // removes deleted routes from the persisted index and lets the page-cache
  // pruning pass skip a full directory scan when nothing changed.
  const originalSsgCacheString = JSON.stringify(ssgCache)
  const newSsgCache = reconcileRouteCache(ssgCache, routesPaths)
  const assetPromises = new Map<string, Promise<ReadonlySet<string>>>()

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
    plan: RenderPlan,
    appHTML: string,
    metaAttributes: string[],
    bodyAttributes: string,
    htmlAttributes: string,
    styleTag: string | undefined,
    routerContext: RouterContextData | null,
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
    const finalizeStart = performance.now()
    const {
      path,
      cachedHtmlFile: pCachedHtmlFile,
      cachedLoaderFile: pCachedLoaderFile,
      normalizedKey: pNormalizedKey,
      sourceContentHash: pSourceContentHash,
      sourceMtimeMs: pSourceMtimeMs,
      fetchUrl,
    } = plan

    let assets: Set<string>
    if (!app && routerType === 'remix') {
      if (!assetCollector) {
        throw new Error(
          'The SSR entry must expose matchRouteBranchWithParams for asset collection',
        )
      }
      const assetStart = performance.now()
      assets = new Set(
        await (assetPromises.get(path) || assetCollector(fetchUrl)),
      )
      assetCollectionMs += performance.now() - assetStart
    } else {
      assets = new Set<string>()
    }

    let writtenLoaderDataPath: string | undefined

    if (loaderData && Object.keys(loaderData).length > 0) {
      const loaderDataFilePath = getLoaderDataFilePath(path, hash)
      writtenLoaderDataPath = loaderDataFilePath
      // Keep the rendered payload in the page cache first. For normal builds
      // it is linked into dist in the same batch as the HTML below, avoiding
      // one direct dist write per rendered route. Turbo mode intentionally
      // skips the persistent page cache, so it keeps the direct write path.
      if (turbo) {
        await fs.writeFile(
          join(out, loaderDataFilePath),
          JSON.stringify(loaderData),
        )
      }
      staticLoaderDataManifest[getNormalizedPathKey(path, configBase)] =
        loaderDataFilePath
      loaderDataFileCount++
    }

    await triggerOnSSRAppRendered?.(path, appHTML, appCtx)

    const htmlAssemblyStart = performance.now()
    const renderedHTML =
      compiledIndexTemplate && transformedIndexHTML === indexHTML
        ? compiledIndexTemplate({
            appHTML,
            metaAttributes,
            bodyAttributes,
            htmlAttributes,
            initialState: null,
          })
        : await renderHTML({
            rootContainerId,
            appHTML,
            indexHTML: transformedIndexHTML,
            metaAttributes,
            bodyAttributes,
            htmlAttributes,
            initialState: null,
          })
    pageHtmlAssemblyMs += performance.now() - htmlAssemblyStart

    // Skip renderPreloadLinksString for 'app' routerType (always empty).
    const preloadLinksHtml = app ? '' : renderPreloadLinksString(assets)

    // Skip hydration data regex when no router context.
    // The regex with negative lookahead is expensive on large HTML (~1-2ms/page).
    let html = routerContext
      ? renderedHTML.replace(
          /<script[^>]*>(?:(?!<\/script>)[\s\S])*__staticRouterHydrationData(?:(?!<\/script>)[\s\S])*<\/script>/g,
          '',
        )
      : renderedHTML

    if (preloadLinksHtml) {
      html = html.replace('<head>', `<head>${preloadLinksHtml}`)
    }

    const onPageRenderedStart = performance.now()
    const transformed = (await onPageRendered?.(path, html, appCtx)) || html
    onPageRenderedHookMs += performance.now() - onPageRenderedStart
    let loaderDataScript = ''
    if (loaderData && Object.keys(loaderData).length > 0) {
      const safeLoaderDataJSON = JSON.stringify(loaderData).replace(
        /</g,
        '\\u003c',
      )
      loaderDataScript = `window.__VITE_REACT_SSG_STATIC_LOADER_DATA__ = { '${getNormalizedPathKey(path, configBase)}': ${safeLoaderDataJSON} };`
    }

    const hydrationScriptContent = createSsgHydrationScript(routerContext)

    let resultHTML = transformed
    const headerScript = `<script>window.__VITE_REACT_SSG_HASH__ = '${hash}';${loaderDataScript}${hydrationScriptContent}</script>`
    // headerScript injection deferred — combined with styleTag below
    // to save one <head> replace per page.

    // Track critters processing time per page
    const pageCrittersStart = performance.now()
    resultHTML = resultHTML.replace(
      `<script>${SCRIPT_COMMENT_PLACEHOLDER}</script>`,
      '',
    )

    if (zigCritters) {
      // Critical CSS depends on the rendered page structure. Cache only the
      // generated style block by (engine, structural HTML, CSS) so repeated
      // layouts avoid a second WASM pass without sharing styles across routes
      // that need different selectors.
      if (cachedAllCss) {
        const cacheKey = createCriticalCssCacheKey(
          resultHTML,
          cachedAllCss,
          'zig-critters',
        )
        try {
          const criticalStyle = await criticalCssCache.getOrCreate(
            cacheKey,
            async () => {
              const processed = await zigCritters.processHtml(
                resultHTML,
                cachedAllCss,
              )
              const matches = processed.match(
                /<style[^>]*data-zig-critters[^>]*>[\s\S]*?<\/style>/g,
              )
              return matches?.join('\\n') || null
            },
          )
          if (criticalStyle && !resultHTML.includes('data-zig-critters')) {
            resultHTML = resultHTML.replace(
              '</head>',
              `${criticalStyle}</head>`,
            )
          }
        } catch (e) {
          warn(
            `[zig-critters] Failed to inline CSS for "${path}": ${e instanceof Error ? e.message : String(e)}`,
          )
        }
      }
      resultHTML = resultHTML.replace(
        /<link\srel="stylesheet"(?!.*\bcrossorigin\b)/g,
        '<link rel="stylesheet" crossorigin',
      )
    } else if (beasties) {
      const cacheKey = createCriticalCssCacheKey(
        resultHTML,
        cachedAllCss,
        'beasties',
      )
      const criticalStyle = await criticalCssCache.getOrCreate(
        cacheKey,
        async () => {
          const processed = await crittersQueue.add(() =>
            beasties.process(resultHTML),
          )
          return extractNewStyleTags(resultHTML, processed)
        },
      )
      if (criticalStyle && !resultHTML.includes(criticalStyle)) {
        resultHTML = resultHTML.replace('</head>', `${criticalStyle}</head>`)
      }
      resultHTML = resultHTML.replace(
        /<link\srel="stylesheet"(?!.*\bcrossorigin\b)/g,
        '<link rel="stylesheet" crossorigin',
      )
    }

    // Single <head> replace with headerScript + styleTag combined.
    // This saves 1 replace() call per page (~0.05ms × 202 = ~10ms).
    const headInjection = headerScript + (styleTag || '')
    if (headInjection)
      resultHTML = resultHTML.replace('<head>', `<head>${headInjection}`)

    // Skip formatHtml entirely when formatting === 'none' (the default).
    // The function is a no-op in this case but still costs an async call.
    const formatted =
      formatting === 'none'
        ? resultHTML
        : await formatHtml(resultHTML, formatting)
    crittersPageTimesMs.push(Math.round(performance.now() - pageCrittersStart))

    // Phase 7: enqueue page writes instead of awaiting each file inside
    // finalizePage. The bounded queue flushes before output/cache state is
    // published, allowing rendering/finalization to overlap filesystem I/O.
    const pageWriteStart = performance.now()

    if (!turbo) {
      await deferredPageWrites.enqueue(pCachedHtmlFile, formatted)

      if (
        loaderData &&
        Object.keys(loaderData).length > 0 &&
        writtenLoaderDataPath
      ) {
        await deferredPageWrites.enqueue(
          pCachedLoaderFile,
          JSON.stringify(loaderData),
        )
        newSsgCache[pNormalizedKey] = {
          contentHash: pSourceContentHash,
          mtime: pSourceMtimeMs ? Math.round(pSourceMtimeMs) : 0,
          loaderDataFilePath: writtenLoaderDataPath,
          assetHash: plan.routeAssetHash,
        }
      } else {
        newSsgCache[pNormalizedKey] = {
          contentHash: pSourceContentHash,
          mtime: pSourceMtimeMs ? Math.round(pSourceMtimeMs) : 0,
          assetHash: plan.routeAssetHash,
        }
      }
    } else if (
      loaderData &&
      Object.keys(loaderData).length > 0 &&
      writtenLoaderDataPath
    ) {
      await deferredPageWrites.enqueue(
        join(out, writtenLoaderDataPath),
        JSON.stringify(loaderData),
      )
    }

    const pageWriteDuration = performance.now() - pageWriteStart
    writePageTimesMs.push(Math.round(pageWriteDuration))
    // Actual filesystem time is recorded when the bounded queue flushes;
    // enqueue time stays in the finalize timing and is not counted as I/O.
    finalizePageTimesMs.push(Math.round(performance.now() - finalizeStart))
    renderedCount++
    renderedPageCount++
    renderedSize += formatted.length
  }

  // Dispatch pages immediately. Piscina starts workers lazily when
  // render() receives work; SsgWorkerPool.ready() is intentionally a no-op
  // compatibility method, so awaiting it here only adds a microtask before
  // the render loop. Real worker failures are handled by the render promise
  // fallback below, where the failed route is still available.

  const drainStart = performance.now()
  const mainThreadTasks: Array<Promise<unknown>> = []

  await executeRenderSchedule({
    routes: routesPaths,
    canBypassClientBuild,
    getPlan: (path) => getRenderPlan(renderPlans, path),
    isCached: (plan) => {
      if (turbo || !canBypassClientBuild) return false
      try {
        return isSsgPageCacheValid({
          routePath: plan.path,
          cacheItem: ssgCache[plan.normalizedKey],
          sourceContentHash: plan.sourceContentHash,
          expectedAssetHash: plan.routeAssetHash,
          ssgPagesDir,
        })
      } catch {
        return false
      }
    },
    onCacheHit: async (plan) => {
      const cachedItem = ssgCache[plan.normalizedKey]
      const loaderDataFilePath = cachedItem?.loaderDataFilePath
      const loaderDestination = loaderDataFilePath
        ? join(out, loaderDataFilePath)
        : undefined
      const ownsHtmlDestination = !materializedHtmlFiles.has(plan.finalOutFile)
      const ownsLoaderDestination =
        !!loaderDestination && !materializedLoaderFiles.has(loaderDestination)
      if (ownsHtmlDestination) materializedHtmlFiles.add(plan.finalOutFile)
      if (ownsLoaderDestination && loaderDestination) {
        materializedLoaderFiles.add(loaderDestination)
      }

      const cachedOutputStart = performance.now()
      try {
        if (ownsHtmlDestination) {
          filesToMaterialize.push({
            source: plan.cachedHtmlFile,
            destination: plan.finalOutFile,
          })
        }
        if (
          loaderDestination &&
          loaderDataFilePath &&
          fs.existsSync(plan.cachedLoaderFile)
        ) {
          if (ownsLoaderDestination) {
            filesToMaterialize.push({
              source: plan.cachedLoaderFile,
              destination: loaderDestination,
            })
          }
          staticLoaderDataManifest[
            getNormalizedPathKey(plan.path, configBase)
          ] = loaderDataFilePath
          loaderDataFileCount++
        }
        cachedCount++
        cachedPageCount++
        cachedOutputMs += performance.now() - cachedOutputStart
      } catch (err: any) {
        if (ownsHtmlDestination) materializedHtmlFiles.delete(plan.finalOutFile)
        if (ownsLoaderDestination && loaderDestination) {
          materializedLoaderFiles.delete(loaderDestination)
        }
        throw new Error(`Error on cached page: ${plan.path}\n${err.stack}`)
      }
    },
    prepareRoute: (plan) => {
      if (!ctxApp && ctxRouterType === 'remix' && assetCollector) {
        assetPromises.set(plan.path, assetCollector(plan.fetchUrl))
      }
    },
    ensurePool: ensureRenderPool,
    getPool: () => renderPool,
    getWorkerCount: () => getSsgPoolMetrics(renderPool)?.totalWorkers ?? 0,
    onWorkerFailure: async (path, _plan, error, workerPool) => {
      if (!_sharedAdapter) {
        throw new Error(`Error on page: ${path}\n${String(error)}`)
      }
      warn(
        `[ssg-worker] Retrying ${path} on the main thread after worker failure`,
      )
      poolFallbackToMainThread = true
      try {
        await destroyRenderPool()
      } catch {
        // Ignore cleanup failures while disabling the pool.
      }
      renderPool = null
      lazyPoolAttempted = true
      const fallback = await _sharedAdapter.render(path)
      return {
        path,
        appHTML: fallback.appHTML,
        metaAttributes: fallback.metaAttributes,
        bodyAttributes: fallback.bodyAttributes,
        htmlAttributes: fallback.htmlAttributes,
        styleTag: fallback.styleTag,
        timings: fallback.timings,
        routerContext: createSsgRouterContextPayload(fallback.routerContext),
      }
    },
    onWorkerResult: async (path, plan, result, elapsedMs) => {
      workerRoundTripMs += Math.max(
        0,
        elapsedMs - (result.timings?.totalMs ?? 0),
      )
      workerRoundTripCount++
      if (result.timings) {
        ssrPageTimesMs.push(Math.round(result.timings.totalMs))
        recordRouterTimings(result.timings)
      }
      const appCtx = {
        ..._serverContext!,
        routePath: path,
      } as ViteReactSSGContext<true>
      const beforeHookStart = performance.now()
      const transformedIndexHTML =
        (await onBeforePageRender?.(path, indexHTML, appCtx)) || indexHTML
      beforeHookMs += performance.now() - beforeHookStart
      const loaderDataObj = result.routerContext?.loaderData
        ? (result.routerContext.loaderData as Record<string, unknown>)
        : null
      await finalizeQueue.add(() =>
        finalizePage(
          plan,
          result.appHTML,
          result.metaAttributes,
          result.bodyAttributes,
          result.htmlAttributes,
          result.styleTag,
          result.routerContext,
          loaderDataObj,
          appCtx,
          ctxBase,
          routes,
          ctxTrigger,
          ctxApp,
          ctxRouterType ?? 'remix',
          transformedIndexHTML,
        ),
      )
    },
    scheduleMainThread: (path, plan) => {
      mainThreadTasks.push(
        queue.add(async () => {
          try {
            const appCtx = {
              ..._serverContext!,
              routePath: path,
            } as ViteReactSSGContext<true>
            const beforeHookStart = performance.now()
            const transformedIndexHTML =
              (await onBeforePageRender?.(path, indexHTML, appCtx)) || indexHTML
            beforeHookMs += performance.now() - beforeHookStart
            const ssrRenderStart = performance.now()
            const {
              appHTML,
              bodyAttributes,
              htmlAttributes,
              metaAttributes,
              styleTag,
              routerContext,
              timings,
            } = await _sharedAdapter!.render(path)
            ssrPageTimesMs.push(Math.round(performance.now() - ssrRenderStart))
            recordRouterTimings(timings)
            const loaderData = routerContext?.loaderData as
              | Record<string, unknown>
              | undefined
            await finalizePage(
              plan,
              appHTML,
              metaAttributes,
              bodyAttributes,
              htmlAttributes,
              styleTag,
              createSsgRouterContextPayload(routerContext),
              loaderData || null,
              appCtx,
              ctxBase,
              routes,
              ctxTrigger,
              ctxApp,
              ctxRouterType ?? 'remix',
              transformedIndexHTML,
            )
          } catch (err: any) {
            throw new Error(`Error on page: ${path}\n${err.stack}`)
          }
        }),
      )
    },
    drainFinalizers: () => finalizeQueue.onIdle(),
    drainMainThread: async () => {
      await Promise.all(mainThreadTasks)
      await queue.onIdle()
    },
    drainWrites: () => deferredPageWrites.flush(),
    cleanupAfterFailure: async () => {
      try {
        if (fs.existsSync(out)) await fs.remove(out)
      } catch {
        // Preserve the original render error if cleanup fails.
      }
    },
    destroyPool: destroyRenderPool,
    onNoRenderer: (path) => {
      warn(`[ssg] No SSR context available for ${path}, skipping`)
    },
  })
  renderQueueDrainMs += performance.now() - drainStart

  // Batch hardlink ssg-pages cache → dist.
  // The render loop writes only to ssg-pages/<hash>.html and, for normal
  // builds, ssg-pages/<hash>.json. Creating both output files here avoids a
  // second direct write per rendered route. Hardlinks are zero-copy and fall
  // back to copying for cross-device filesystems.
  const hardlinkStart = performance.now()

  for (const p of routesPaths) {
    if (turbo) continue
    const plan = renderPlans.get(p)
    if (!plan || !fs.existsSync(plan.cachedHtmlFile)) continue

    if (!materializedHtmlFiles.has(plan.finalOutFile)) {
      filesToMaterialize.push({
        source: plan.cachedHtmlFile,
        destination: plan.finalOutFile,
      })
    }

    const cacheEntry = newSsgCache[plan.normalizedKey]
    if (!cacheEntry?.loaderDataFilePath) continue
    if (!fs.existsSync(plan.cachedLoaderFile)) continue

    const loaderDestination = join(out, cacheEntry.loaderDataFilePath)
    if (materializedLoaderFiles.has(loaderDestination)) continue
    filesToMaterialize.push({
      source: plan.cachedLoaderFile,
      destination: loaderDestination,
    })
  }

  await materializeFiles(filesToMaterialize)
  const hardlinkDuration = Math.round(performance.now() - hardlinkStart)
  outputLinkMs += hardlinkDuration

  const totalPages = renderedCount + cachedCount
  const totalSizeMB = (renderedSize / 1024 / 1024).toFixed(2)

  // Save the updated cache index
  // Skip in turbo mode for faster builds
  let prunedCount = 0
  if (!turbo) {
    try {
      const cacheIndexChanged =
        JSON.stringify(newSsgCache) !== originalSsgCacheString
      if (cacheIndexChanged) {
        await writeJsonIfChanged(cachePath, newSsgCache)
      }

      // Garbage collect unused cached HTML and JSON loader files in ssg-pages.
      // Stable warm builds skip the directory scan, but a periodic maintenance
      // pass still recovers orphaned files left by interrupted/older builds.
      prunedCount = await pruneSsgPagesIfDue(
        ssgPagesDir,
        newSsgCache,
        routesPaths,
        cacheIndexChanged,
      )
    } catch (e) {
      // Ignore cache and pruning errors
    }
  }

  const renderTotalMs = performance.now() - renderStartTime
  const poolMetricsVal = getSsgPoolMetrics(poolForCleanup)
  const p2Metrics = {
    renderedCount,
    cachedCount,
    renderedSize,
    totalPages,
    prunedCount,
    clientBuildMs: Math.round(clientBuildDurationMs),
    serverBuildMs: Math.round(serverBuildDurationMs),
    ssrImportMs: Math.round(ssrImportDurationMs),
    //  worker & timing sub-metrics. Piscina starts workers lazily, so
    // this is pool setup time rather than a claim that every worker is ready.
    workerPoolSetupMs: Math.round(workerPoolSetupMs),
    workerUsed: poolMetricsVal !== null && !poolFallbackToMainThread,
    workerCount: poolMetricsVal?.totalWorkers ?? 0,
    fallbackMainThread: poolFallbackToMainThread,
    ssrP50Ms: computePercentile(ssrPageTimesMs, 50),
    ssrP95Ms: computePercentile(ssrPageTimesMs, 95),
    ssrP99Ms: computePercentile(ssrPageTimesMs, 99),
    crittersP50Ms: computePercentile(crittersPageTimesMs, 50),
    crittersP95Ms: computePercentile(crittersPageTimesMs, 95),
    writeP50Ms: computePercentile(writePageTimesMs, 50),
    writeP95Ms: computePercentile(writePageTimesMs, 95),
    routerTimingCount: routerTimingTotals.count,
    routerMatchAvgMs:
      routerTimingTotals.count > 0
        ? routerTimingTotals.matchMs / routerTimingTotals.count
        : 0,
    routerResolveAvgMs:
      routerTimingTotals.count > 0
        ? routerTimingTotals.resolveMs / routerTimingTotals.count
        : 0,
    routerLoadersAvgMs:
      routerTimingTotals.count > 0
        ? routerTimingTotals.loadersMs / routerTimingTotals.count
        : 0,
    routerRenderAvgMs:
      routerTimingTotals.count > 0
        ? routerTimingTotals.renderMs / routerTimingTotals.count
        : 0,
    routerHelmetAvgMs:
      routerTimingTotals.count > 0
        ? routerTimingTotals.helmetMs / routerTimingTotals.count
        : 0,
    routerTotalAvgMs:
      routerTimingTotals.count > 0
        ? routerTimingTotals.totalMs / routerTimingTotals.count
        : 0,
    pagesPerSecond:
      totalPages > 0 && renderTotalMs > 0
        ? Math.round((totalPages / (renderTotalMs / 1000)) * 10) / 10
        : 0,
    pipeline: {
      renderedPageCount,
      cachedPageCount,
      clientBuildMs: Math.round(clientBuildDurationMs),
      serverBuildMs: Math.round(serverBuildDurationMs),
      ssrImportMs: Math.round(ssrImportDurationMs),
      workerPoolSetupMs: Math.round(workerPoolSetupMs),
      routePreparationMs: Math.round(routePreparationMs),
      // Includes queue wait, worker execution not covered by router timings,
      // structured clone and any fallback overhead; it is not pure IPC time.
      workerTransportMs: Math.round(workerRoundTripMs),
      workerRoundTripMs: Math.round(workerRoundTripMs),
      workerTransportAvgMs:
        workerRoundTripCount > 0
          ? Math.round(workerRoundTripMs / workerRoundTripCount)
          : 0,
      finalizeP50Ms: computePercentile(finalizePageTimesMs, 50),
      finalizeP95Ms: computePercentile(finalizePageTimesMs, 95),
      assetCollectionMs: Math.round(assetCollectionMs),
      beforeHookMs: Math.round(beforeHookMs),
      htmlAssemblyMs: Math.round(pageHtmlAssemblyMs),
      onPageRenderedHookMs: Math.round(onPageRenderedHookMs),
      criticalCssP50Ms: computePercentile(crittersPageTimesMs, 50),
      criticalCssP95Ms: computePercentile(crittersPageTimesMs, 95),
      cacheWriteMs: Math.round(cacheWriteMs + deferredPageWrites.writeTimeMs()),
      cachedOutputMs: Math.round(cachedOutputMs),
      // Measured from worker settlement through both finalization queues.
      renderQueueDrainMs: Math.round(renderQueueDrainMs),
      renderPipelineSettleMs: Math.round(renderQueueDrainMs),
      outputLinkMs: Math.round(outputLinkMs),
    },
  }

  onStep?.({
    name: 'Render pages',
    duration: renderTotalMs,
    success: true,
    details: `${totalPages} pages (${renderedCount} new, ${cachedCount} cached, ${totalSizeMB} MB)`,
    metrics: p2Metrics,
  })

  // Emit one machine-readable JSON record. Keeping the complete
  // envelope valid JSON makes benchmark parsing deterministic even when the
  // nested pipeline object grows. Only emitted in benchmark mode so normal
  // build output stays human-readable.
  if (process.env.BOLTDOCS_BENCHMARK_PHASES === 'true') {
    // eslint-disable-next-line no-console
    console.log(
      `[boltdocs] ${JSON.stringify({
        name: 'Render pages',
        duration: Math.round(renderTotalMs),
        success: true,
        details: `${totalPages} pages / ${renderedCount} new / ${cachedCount} cached / ${totalSizeMB} MB`,
        metrics: p2Metrics,
      })}`,
    )
  }

  const staticLoaderDataStart = performance.now()
  const staticLoaderDataManifestString = serializeStaticLoaderDataManifest(
    staticLoaderDataManifest,
  )
  await writeFileIfChanged(
    join(out, `static-loader-data-manifest-${hash}.json`),
    staticLoaderDataManifestString,
  )

  // Prune old per-hash SSR bundles to prevent unbounded disk growth.
  // Keep the current hash so warm builds can still skip the server build.
  await pruneDirectoryCache(
    join(finalCacheDir, 'ssr'),
    5,
    turbo ? 'turbo-ssr' : basename(ssgOut),
  )

  unmock()
  const pwaPlugin: { disabled: boolean; generateSW: () => Promise<unknown> } =
    resolvedConfig.plugins.find((i) => i.name === 'vite-plugin-pwa')?.api
  if (pwaPlugin && !pwaPlugin.disabled && pwaPlugin.generateSW) {
    await pwaPlugin.generateSW()
  }

  const buildTime = Math.round(performance.now() - buildStartTime)

  onStep?.({
    name: 'Static loader data',
    duration: performance.now() - staticLoaderDataStart,
    success: true,
    details: `${loaderDataFileCount} loader data files`,
    metrics: { loaderDataFileCount },
  })

  await onFinished?.(outDir)
  // Vite manifests are internal build metadata. They remain in the client
  // cache for incremental asset invalidation, but should not ship in dist.
  await removeOutputBuildMetadata(out)
  // Capture the final output inventory once after cleanup. Reuse this exact
  // inventory for both performance metrics and output state so neither step
  // recursively scans dist a second time. Vite already copied publicDir into
  // the client output; syncing it again here can overwrite generated files.
  const finalOutputFiles = listOutputFiles(out)
  const clientManifestPath = join(
    resolvedClientCacheDir,
    'dist',
    ...dotVitedir,
    'manifest.json',
  )
  const metrics = await collectPerformanceMetrics(
    out,
    buildTime,
    finalCacheDir,
    {
      outputFiles: finalOutputFiles,
      manifestPath: clientManifestPath,
    },
  )
  writePerformanceMetrics(out, metrics)

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

  await writeSsgOutputState(
    join(finalCacheDir, 'ssg-output.json'),
    resolvedClientHash,
    out,
    getSsgOutputPageFiles(routesPaths, newSsgCache, dirStyle).concat(
      `static-loader-data-manifest-${hash}.json`,
    ),
    clientBundle.clientFiles,
    finalOutputFiles,
  )
}

async function pruneSsgPagesIfDue(
  ssgPagesDir: string,
  activeCache: Record<string, SsgCacheItem>,
  activeRoutes: readonly string[] = [],
  force = false,
): Promise<number> {
  try {
    if (!fs.existsSync(ssgPagesDir)) return 0

    const pruneStatePath = join(ssgPagesDir, '.prune-state')
    if (!force) {
      try {
        const pruneState = await fs.stat(pruneStatePath)
        if (Date.now() - pruneState.mtimeMs < 60_000) return 0
      } catch {
        // Missing state triggers maintenance immediately.
      }
    }

    const cachedFiles = await fs.readdir(ssgPagesDir)
    const activeHashes = new Set<string>()
    const activeRouteKeys = new Set([
      ...Object.keys(activeCache),
      ...activeRoutes,
    ])
    for (const route of activeRouteKeys) {
      const pathHash = crypto.createHash('md5').update(route).digest('hex')
      activeHashes.add(`${pathHash}.html`)
      activeHashes.add(`${pathHash}.json`)
    }

    let prunedCount = 0
    for (const file of cachedFiles) {
      if (
        (file.endsWith('.html') || file.endsWith('.json')) &&
        !activeHashes.has(file)
      ) {
        await fs.remove(join(ssgPagesDir, file))
        prunedCount++
      }
    }

    await fs.writeFile(pruneStatePath, String(Date.now()), 'utf8')
    return prunedCount
  } catch {
    return 0
  }
}

async function removeOutputBuildMetadata(outDir: string): Promise<void> {
  try {
    if (dotVitedir.length > 0) {
      await fs.remove(join(outDir, ...dotVitedir))
    } else {
      await Promise.all([
        fs.remove(join(outDir, 'manifest.json')),
        fs.remove(join(outDir, 'ssr-manifest.json')),
      ])
    }
  } catch {
    // Non-critical: metadata cleanup must never fail a successful build.
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
