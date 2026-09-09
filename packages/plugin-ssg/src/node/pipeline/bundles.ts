import { createHash } from 'node:crypto'
import { isAbsolute, join, relative, resolve, sep } from 'node:path'
import fs from 'fs-extra'
import type { InlineConfig, LogOptions, PluginOption } from 'vite'
import { build as viteBuild, mergeConfig, version as viteVersion } from 'vite'
import type { LogLevel, LogOrStringHandler, RollupLog } from 'rollup'
import {
  SSR_BUNDLED_PACKAGE_PATTERNS,
  SSR_EXTERNAL_PACKAGE_NAMES,
} from '../ssr-bundle-policy'

export interface BundleStep {
  name: 'Client build' | 'Server build'
  duration: number
  success: boolean
  details?: string
}

export type BundleStepHandler = (step: BundleStep) => void

export interface ClientBundleInput {
  readonly viteConfig: InlineConfig
  readonly resolvedMode: string
  readonly root: string
  readonly htmlEntry: string
  readonly outDir: string
  readonly clientCacheDir: string
  readonly finalCacheDir: string
  readonly docsDirName: string
  /** Hash computed by the early build probe; avoids a duplicate cold scan. */
  readonly initialClientHash?: string
  readonly canBypassClientBuild: boolean
  readonly customLogger: InlineConfig['customLogger']
  readonly onStep?: BundleStepHandler
  readonly shouldSuppressLog: (message: string) => boolean
}

export interface ClientBundleOutput {
  readonly outDir: string
  readonly durationMs: number
  readonly resolvedClientCacheDir: string
  readonly resolvedClientHash: string
  readonly pageContentFallbackHash: string
  /** Public client files, captured once before the bundle leaves this stage. */
  readonly clientFiles: readonly string[]
}

export interface ServerBundleInput {
  readonly viteConfig: InlineConfig
  readonly resolvedMode: string
  readonly entry: string
  readonly ssrEntry: string
  readonly ssgOut: string
  readonly format: 'esm' | 'cjs'
  readonly canSkipSsrImport: boolean
  readonly serverBuildSkipped: boolean
  readonly customLogger: InlineConfig['customLogger']
  readonly onStep?: BundleStepHandler
  readonly shouldSuppressLog: (message: string) => boolean
}

export interface ServerBundleOutput {
  readonly durationMs: number
}

function buildBundlerOptions<T extends Record<string, unknown>>(
  options: T,
): { rolldownOptions: T } | { rollupOptions: T } {
  return Number.parseInt(viteVersion, 10) >= 8
    ? { rolldownOptions: options }
    : { rollupOptions: options }
}

function createSsrCssSkipPlugin(): PluginOption {
  const cssVirtualPrefix = '\0virtual:ssr-empty-css'
  return {
    name: 'vite-react-ssg:ssr-skip-css',
    enforce: 'pre',
    resolveId(id: string) {
      if (id.endsWith('.css') && !id.startsWith('\0')) {
        return cssVirtualPrefix + id
      }
      return null
    },
    load(id: string) {
      if (id.startsWith(cssVirtualPrefix)) {
        return { code: 'export default undefined', map: null }
      }
      return null
    },
  }
}

export function listClientBundleFiles(
  rootDir: string,
  htmlEntry: string,
): string[] {
  const files: string[] = []

  const visit = (directory: string) => {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name === '.vite') continue
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) {
        visit(absolute)
      } else if (entry.isFile()) {
        const relativePath = relative(rootDir, absolute).split(sep).join('/')
        if (relativePath !== htmlEntry) files.push(relativePath)
      }
    }
  }

  visit(rootDir)
  return files.sort()
}

function filterPluginsForSsr(plugins: any[]): any[] {
  return plugins
    .map((plugin) => {
      if (Array.isArray(plugin)) return filterPluginsForSsr(plugin)
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

async function listPublicAssetFiles(publicDir: string): Promise<string[]> {
  const files: string[] = []
  const visit = async (directory: string): Promise<void> => {
    let entries: fs.Dirent[]
    try {
      entries = await fs.readdir(directory, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      const absolute = join(directory, entry.name)
      if (entry.isDirectory()) {
        await visit(absolute)
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        files.push(relative(publicDir, absolute).split(sep).join('/'))
      }
    }
  }

  await visit(publicDir)
  return files.sort()
}

async function hashFile(filePath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(filePath)
    return createHash('sha256').update(content.toString()).digest('hex')
  } catch {
    return undefined
  }
}

function resolveTrackedAsset(
  outDir: string,
  assetPath: string,
): string | undefined {
  if (!assetPath || isAbsolute(assetPath)) return undefined
  const outputRoot = resolve(outDir)
  const destination = resolve(outputRoot, assetPath)
  const relativeDestination = relative(outputRoot, destination)
  if (
    !relativeDestination ||
    relativeDestination === '..' ||
    relativeDestination.startsWith(`..${sep}`) ||
    isAbsolute(relativeDestination)
  ) {
    return undefined
  }
  return destination
}

/**
 * Copy Vite's public directory into an output directory.
 *
 * Vite normally performs this copy itself, but the SSG cache restores only
 * files tracked by its bundle inventory. Keeping the copy explicit makes
 * cold builds, warm restores, and older caches behave identically.
 */
export async function syncPublicAssets(
  publicDir: string | false | undefined,
  outDir: string,
): Promise<void> {
  const markerPath = join(resolve(outDir, '..'), '.boltdocs-public-assets.json')
  const previousFiles: Record<string, string> = {}
  try {
    const marker = await fs.readJson(markerPath)
    if (Array.isArray(marker)) {
      // Legacy inventories did not record ownership hashes. Keep those files
      // rather than risking deletion of a newer generated file with the same
      // name; the next sync writes a safe, hashed inventory.
      for (const entry of marker) {
        if (typeof entry === 'string') previousFiles[entry] = ''
      }
    } else if (marker && typeof marker === 'object') {
      const files = (marker as { files?: unknown }).files
      if (files && typeof files === 'object') {
        for (const [entry, hash] of Object.entries(
          files as Record<string, unknown>,
        )) {
          if (typeof hash === 'string') previousFiles[entry] = hash
        }
      }
    }
  } catch {
    // Older caches have no public asset inventory yet.
  }

  const sourceEntries =
    publicDir && fs.existsSync(publicDir)
      ? await listPublicAssetFiles(publicDir)
      : []
  const sourceFiles: Record<string, string> = {}
  for (const entry of sourceEntries) {
    const sourceHash = await hashFile(join(publicDir as string, entry))
    if (sourceHash) sourceFiles[entry] = sourceHash
  }

  // Only remove a tracked public file when the destination still matches the
  // previously copied bytes. This prevents a later Vite/plugin output from
  // being deleted merely because it reused a public asset's filename.
  for (const [entry, previousHash] of Object.entries(previousFiles)) {
    if (sourceFiles[entry] !== undefined) continue
    if (!previousHash) continue
    const destination = resolveTrackedAsset(outDir, entry)
    if (!destination) continue
    const destinationHash = await hashFile(destination)
    if (destinationHash === previousHash) await fs.remove(destination)
  }

  if (publicDir && fs.existsSync(publicDir)) {
    await fs.ensureDir(outDir)
    await fs.copy(publicDir, outDir, { overwrite: true, errorOnExist: false })
  }
  await fs.ensureDir(resolve(outDir, '..'))
  await fs.writeJson(markerPath, { version: 1, files: sourceFiles })
}

function createClientBuildConfig(
  input: Pick<
    ClientBundleInput,
    | 'viteConfig'
    | 'resolvedMode'
    | 'root'
    | 'htmlEntry'
    | 'customLogger'
    | 'shouldSuppressLog'
  > & { onResolvedOutputDir: (outDir: string) => void },
): InlineConfig {
  return mergeConfig(input.viteConfig, {
    logLevel: 'warn',
    build: {
      manifest: true,
      ssrManifest: true,
      chunkSizeWarningLimit: 2000,
      reportCompressedSize: false,
      sourcemap: false,
      cssMinify: 'esbuild',
      ...buildBundlerOptions({
        input: { app: join(input.root, input.htmlEntry || './index.html') },
        output: {
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
          },
        },
        onLog(
          level: LogLevel,
          log: RollupLog,
          defaultHandler: LogOrStringHandler,
        ) {
          if (
            log.message.includes('react-helmet-async') ||
            input.shouldSuppressLog(log.message)
          ) {
            return
          }
          defaultHandler(level, log)
        },
      }),
    },
    customLogger: input.customLogger,
    mode: input.resolvedMode,
    plugins: [
      {
        name: 'vite-react-ssg:get-oup-dir',
        configResolved(resolvedConfig) {
          input.onResolvedOutputDir(
            isAbsolute(resolvedConfig.build.outDir || '')
              ? resolvedConfig.build.outDir || 'dist'
              : resolve(input.root, resolvedConfig.build.outDir || 'dist'),
          )
        },
      } as PluginOption,
    ],
  })
}

function createServerBuildConfig(
  input: Pick<
    ServerBundleInput,
    | 'viteConfig'
    | 'resolvedMode'
    | 'entry'
    | 'ssrEntry'
    | 'ssgOut'
    | 'format'
    | 'canSkipSsrImport'
    | 'customLogger'
    | 'shouldSuppressLog'
  >,
): InlineConfig {
  return mergeConfig(input.viteConfig, {
    logLevel: 'warn',
    build: {
      ssr:
        input.entry.includes('boltdocs') || input.entry.startsWith('virtual:')
          ? 'virtual:boltdocs-entry'
          : !input.canSkipSsrImport && input.ssrEntry
            ? input.ssrEntry
            : input.entry,
      manifest: true,
      outDir: input.ssgOut,
      reportCompressedSize: false,
      target: 'es2022',
      minify: false,
      cssCodeSplit: false,
      cssMinify: false,
      ...buildBundlerOptions({
        output:
          input.format === 'esm'
            ? { entryFileNames: 'combined.mjs', format: 'esm' }
            : { entryFileNames: 'combined.cjs', format: 'cjs' },
        platform: 'node',
        onLog(
          level: LogLevel,
          log: RollupLog,
          defaultHandler: LogOrStringHandler,
        ) {
          if (
            log.message.includes('react-helmet-async') ||
            input.shouldSuppressLog(log.message)
          ) {
            return
          }
          defaultHandler(level, log)
        },
      }),
    },
    customLogger: input.customLogger,
    mode: input.resolvedMode,
    ssr: {
      noExternal: [...SSR_BUNDLED_PACKAGE_PATTERNS],
      external: [...SSR_EXTERNAL_PACKAGE_NAMES],
    },
    plugins: [
      ...filterPluginsForSsr((input.viteConfig.plugins as any[]) || []),
      createSsrCssSkipPlugin(),
    ],
  })
}

export async function executeClientBundle(
  input: ClientBundleInput,
  computeClientHash: () => string,
): Promise<ClientBundleOutput> {
  let resolvedOutDir = input.outDir
  let resolvedClientCacheDir = input.clientCacheDir
  let resolvedClientHash = input.initialClientHash ?? computeClientHash()
  let pageContentFallbackHash = resolvedClientHash
  let clientFiles: readonly string[] = []
  const start = performance.now()

  if (input.canBypassClientBuild) {
    input.onStep?.({
      name: 'Client build',
      duration: 0,
      success: true,
      details: 'Code unchanged, restored from cache',
    })
    if (fs.existsSync(input.outDir)) await fs.remove(input.outDir)
    const cachedDist = join(input.clientCacheDir, 'dist')
    await syncPublicAssets(input.viteConfig.publicDir, cachedDist)
    hardLinkDir(cachedDist, input.outDir)
    clientFiles = listClientBundleFiles(
      join(input.clientCacheDir, 'dist'),
      input.htmlEntry,
    )
  } else {
    await viteBuild(
      createClientBuildConfig({
        ...input,
        onResolvedOutputDir: (outDir) => {
          resolvedOutDir = outDir
        },
      }),
    )
    const durationMs = performance.now() - start
    input.onStep?.({
      name: 'Client build',
      duration: durationMs,
      success: true,
      details: 'Vite production build',
    })

    resolvedClientHash = computeClientHash()
    pageContentFallbackHash = resolvedClientHash
    resolvedClientCacheDir = join(
      input.finalCacheDir,
      'client-cache',
      resolvedClientHash,
    )
    const buildHashFile = join(resolvedClientCacheDir, 'client-hash.txt')
    await fs.ensureDir(resolvedClientCacheDir)
    const cachedDist = join(resolvedClientCacheDir, 'dist')
    if (fs.existsSync(cachedDist)) await fs.remove(cachedDist)
    // Use a real copy for the cache snapshot: public asset reconciliation may
    // replace files with the same names, and hard links would mutate Vite's
    // live output through shared inodes.
    await fs.copy(resolvedOutDir, cachedDist, {
      overwrite: true,
      errorOnExist: false,
    })
    await syncPublicAssets(input.viteConfig.publicDir, cachedDist)
    clientFiles = listClientBundleFiles(cachedDist, input.htmlEntry)
    await fs.writeFile(buildHashFile, resolvedClientHash, 'utf-8')
    await pruneDirectoryCache(join(input.finalCacheDir, 'client-cache'))
  }

  return {
    outDir: resolvedOutDir,
    durationMs: input.canBypassClientBuild ? 0 : performance.now() - start,
    resolvedClientCacheDir,
    resolvedClientHash,
    pageContentFallbackHash,
    clientFiles,
  }
}

export async function executeServerBundle(
  input: ServerBundleInput,
): Promise<ServerBundleOutput> {
  if (input.serverBuildSkipped) {
    input.onStep?.({
      name: 'Server build',
      duration: 0,
      success: true,
      details: 'SSR bundle unchanged, skipped',
    })
    return { durationMs: 0 }
  }

  if (fs.existsSync(input.ssgOut)) await fs.remove(input.ssgOut)
  process.env.VITE_SSG = 'true'
  const start = performance.now()
  await viteBuild(createServerBuildConfig(input))
  const durationMs = performance.now() - start
  input.onStep?.({
    name: 'Server build',
    duration: durationMs,
    success: true,
    details: 'Vite SSR bundle',
  })
  return { durationMs }
}

export function resolveSsrCacheDirectory(
  cacheRoot: string,
  relativeDirectory: string,
): string | undefined {
  if (!relativeDirectory || isAbsolute(relativeDirectory)) return undefined

  const candidate = resolve(cacheRoot, relativeDirectory)
  const relativeCandidate = relative(resolve(cacheRoot), candidate)
  if (
    relativeCandidate === '..' ||
    relativeCandidate.startsWith(`..${sep}`) ||
    isAbsolute(relativeCandidate)
  ) {
    return undefined
  }

  try {
    const cacheRootReal = fs.realpathSync(cacheRoot)
    const candidateReal = fs.realpathSync(candidate)
    const realRelative = relative(cacheRootReal, candidateReal)
    if (
      realRelative === '..' ||
      realRelative.startsWith(`..${sep}`) ||
      isAbsolute(realRelative)
    ) {
      return undefined
    }
    const files = fs.readdirSync(candidateReal)
    if (!files.some((file) => file.endsWith('.mjs') || file.endsWith('.cjs'))) {
      return undefined
    }
    return candidateReal
  } catch {
    return undefined
  }
}

export function shouldSuppressBundleLog(message: string): boolean {
  return (
    message.startsWith('dist/') ||
    message.startsWith('.boltdocs/build/ssr/') ||
    message.startsWith('rendering chunks') ||
    message === 'computing gzip size...' ||
    (message.includes('built in') && message.includes('s'))
  )
}

export function hardLinkDir(srcDir: string, destDir: string): void {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true })
  fs.mkdirSync(destDir, { recursive: true })
  for (const entry of entries) {
    const srcPath = join(srcDir, entry.name)
    const destPath = join(destDir, entry.name)
    if (entry.isDirectory()) {
      hardLinkDir(srcPath, destPath)
    } else if (entry.isFile()) {
      try {
        fs.linkSync(srcPath, destPath)
      } catch {
        fs.copyFileSync(srcPath, destPath)
      }
    }
  }
}

export async function pruneDirectoryCache(
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
      if (!keepSet.has(dir.name)) await fs.remove(join(cacheRoot, dir.name))
    }
  } catch {
    // Non-critical cache cleanup must never fail a successful build.
  }
}

export function createBundleLogger(
  logger: NonNullable<InlineConfig['customLogger']>,
  shouldSuppressLog: (message: string) => boolean,
): NonNullable<InlineConfig['customLogger']> {
  const loggerWarn = logger.warn
  logger.warn = (msg: string, options?: LogOptions) => {
    if (
      msg.includes('externalized for browser compatibility') ||
      msg.includes("can't be bundled without type") ||
      shouldSuppressLog(msg)
    ) {
      return
    }
    loggerWarn(msg, options)
  }
  const loggerInfo = logger.info
  logger.info = (msg: string, options?: LogOptions) => {
    if (shouldSuppressLog(msg)) return
    loggerInfo(msg, options)
  }
  return logger
}
