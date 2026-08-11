import path from 'node:path'
import fs from 'node:fs/promises'
import { fdir } from 'fdir'
import type { BoltdocsConfig } from '../config'
import { capitalize, getCacheConfig } from '../utils'
import { warn } from '@bdocs/dui'

import type { DirectoryMeta, RouteMeta, ParsedDocFile } from './types'
import {
  getRouteGenerationFingerprint,
  getRouteCacheVariant,
  getRouteCacheContext,
  invalidateRouteCache as baseInvalidateRouteCache,
  invalidateFile as baseInvalidateFile,
  invalidateDirectoryMetaFile as baseInvalidateDirectoryMetaFile,
  type RouteCacheContext,
  type RouteCacheVariant,
  syncRouteCacheFacade,
  type DirectoryMetaCacheEntry,
  type RouteDiscoverySnapshot,
} from './cache'
import { sortRoutes } from './sorter'

export type { RouteMeta }

export { getExternalRoutePaths } from './pages-external'
const PARSE_CONCURRENCY = 32
const ROUTE_GENERATION_INVALIDATED = Symbol('route-generation-invalidated')

async function loadDirectoryMeta(
  docsDir: string,
  files: readonly string[],
  routeVariant: RouteCacheVariant,
): Promise<Record<string, DirectoryMeta>> {
  // Keep the public filename canonical when both conventions are present:
  // `_meta.json` is read first and `meta.json` wins deterministically.
  const sortedFiles = [...files].sort((left, right) => {
    const leftDir = path.dirname(left)
    const rightDir = path.dirname(right)
    if (leftDir === rightDir) {
      const leftName = path.basename(left)
      const rightName = path.basename(right)
      if (leftName === '_meta.json' && rightName === 'meta.json') return -1
      if (leftName === 'meta.json' && rightName === '_meta.json') return 1
    }
    return left.localeCompare(right)
  })
  const currentFiles = new Set(sortedFiles)
  const entries = routeVariant.directoryMetaEntries

  for (const file of entries.keys()) {
    if (!currentFiles.has(file)) entries.delete(file)
  }

  await Promise.all(
    sortedFiles.map(async (file) => {
      let stat: Awaited<ReturnType<typeof fs.stat>>
      try {
        stat = await fs.stat(file)
      } catch (error) {
        entries.delete(file)
        warn(
          `Failed to stat meta.json: ${error instanceof Error ? error.message : String(error)}`,
        )
        return
      }

      const cached = entries.get(file)
      if (
        cached &&
        cached.mtimeMs === stat.mtimeMs &&
        cached.size === stat.size
      ) {
        return
      }

      try {
        const raw = await fs.readFile(file, 'utf8')
        entries.set(file, {
          mtimeMs: stat.mtimeMs,
          size: stat.size,
          content: JSON.parse(raw) as DirectoryMeta,
        } satisfies DirectoryMetaCacheEntry)
      } catch (error) {
        entries.delete(file)
        warn(
          `Failed to read meta.json: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }),
  )

  const results: Record<string, DirectoryMeta> = {}
  for (const file of sortedFiles) {
    const entry = entries.get(file)
    if (!entry) continue
    const relativeDir = path
      .relative(docsDir, path.dirname(file))
      .replace(/\\/g, '/')
    results[relativeDir || '.'] = entry.content
  }
  return results
}

async function loadDiscoverySnapshot(
  docsDir: string,
  routeVariant: RouteCacheVariant,
): Promise<RouteDiscoverySnapshot | null> {
  if (!routeVariant.discoverySnapshotPath || getCacheConfig().noCache)
    return null
  if (routeVariant.discoverySnapshotLoaded) {
    return routeVariant.discoverySnapshot
  }
  routeVariant.discoverySnapshotLoaded = true
  try {
    const raw = await fs.readFile(routeVariant.discoverySnapshotPath, 'utf8')
    const snapshot = JSON.parse(raw) as Partial<RouteDiscoverySnapshot>
    const isStringArray = (value: unknown): value is string[] =>
      Array.isArray(value) && value.every((entry) => typeof entry === 'string')
    const files = snapshot.files
    const directoryMetaFiles = snapshot.directoryMetaFiles
    const directories =
      snapshot.directories && typeof snapshot.directories === 'object'
        ? Object.entries(snapshot.directories)
        : []
    const normalizedDocsDir = path.resolve(docsDir)
    const realDocsDir = await fs.realpath(normalizedDocsDir)
    const isWithinDocs = (filePath: string): boolean => {
      const normalized = path.resolve(filePath)
      return (
        normalized === normalizedDocsDir ||
        normalized.startsWith(`${normalizedDocsDir}${path.sep}`)
      )
    }
    const isDocumentFile = (filePath: string): boolean =>
      /\.(?:md|mdx)$/i.test(filePath)
    const isMetaFile = (filePath: string): boolean => {
      const basename = path.basename(filePath)
      return basename === 'meta.json' || basename === '_meta.json'
    }
    if (
      snapshot.version !== 1 ||
      !isStringArray(files) ||
      !isStringArray(directoryMetaFiles) ||
      !snapshot.directories ||
      typeof snapshot.directories !== 'object' ||
      Array.isArray(snapshot.directories) ||
      files.some(
        (filePath) => !isWithinDocs(filePath) || !isDocumentFile(filePath),
      ) ||
      directoryMetaFiles.some(
        (filePath) => !isWithinDocs(filePath) || !isMetaFile(filePath),
      ) ||
      directories.some(
        ([directory, mtimeMs]) =>
          !isWithinDocs(directory) ||
          typeof mtimeMs !== 'number' ||
          !Number.isFinite(mtimeMs),
      )
    ) {
      return null
    }
    const isWithinRealDocs = (filePath: string): boolean => {
      const normalized = path.resolve(filePath)
      return (
        normalized === realDocsDir ||
        normalized.startsWith(`${realDocsDir}${path.sep}`)
      )
    }
    const validFiles = await Promise.all(
      [...files, ...directoryMetaFiles].map(async (filePath) => {
        try {
          const stat = await fs.lstat(filePath)
          if (!stat.isFile()) return false
          return isWithinRealDocs(await fs.realpath(filePath))
        } catch {
          return false
        }
      }),
    )
    const validDirectories = await Promise.all(
      directories.map(async ([directory, mtimeMs]) => {
        try {
          const stat = await fs.stat(directory)
          return (
            stat.isDirectory() &&
            stat.mtimeMs === mtimeMs &&
            isWithinRealDocs(await fs.realpath(directory))
          )
        } catch {
          return false
        }
      }),
    )
    if (validFiles.every(Boolean) && validDirectories.every(Boolean)) {
      const validatedSnapshot: RouteDiscoverySnapshot = {
        version: 1,
        files,
        directoryMetaFiles,
        directories: Object.fromEntries(directories),
      }
      routeVariant.discoverySnapshot = validatedSnapshot
      return validatedSnapshot
    }
  } catch {
    // A missing/corrupt snapshot simply falls back to a fresh crawl.
  }
  return null
}

async function saveDiscoverySnapshot(
  routeVariant: RouteCacheVariant,
  snapshot: RouteDiscoverySnapshot,
): Promise<void> {
  if (getCacheConfig().noCache) {
    routeVariant.discoverySnapshot = null
    routeVariant.discoverySnapshotLoaded = false
    return
  }

  routeVariant.discoverySnapshot = snapshot
  routeVariant.discoverySnapshotLoaded = true
  try {
    await fs.mkdir(path.dirname(routeVariant.discoverySnapshotPath), {
      recursive: true,
    })
    await fs.writeFile(
      routeVariant.discoverySnapshotPath,
      JSON.stringify(snapshot),
    )
  } catch {
    // Discovery persistence is an optimization; a future build can crawl.
  }
}

async function getDiscoverySnapshot(
  docsDir: string,
  routeVariant: RouteCacheVariant,
  forceScan: boolean,
): Promise<RouteDiscoverySnapshot> {
  if (!forceScan) {
    const cached = await loadDiscoverySnapshot(docsDir, routeVariant)
    if (cached) return cached
  }

  const api = new fdir({ excludeSymlinks: true })
    .withFullPaths()
    .filter((p) => {
      const basename = path.basename(p)
      const isMeta = basename === 'meta.json' || basename === '_meta.json'
      const isMd = p.endsWith('.md') || p.endsWith('.mdx')
      if (!isMd && !isMeta) return false

      const rel = path.relative(docsDir, p).replace(/\\/g, '/')
      const segments = rel.split('/')
      return !segments.some(
        (seg) =>
          seg.startsWith('_') &&
          seg !== '_index.md' &&
          seg !== '_index.mdx' &&
          seg !== '_meta.json',
      )
    })
    .crawl(docsDir)

  const rawFiles = await api.withPromise()
  const directoryMetaFiles = rawFiles
    .filter((file) => {
      const basename = path.basename(file)
      return basename === 'meta.json' || basename === '_meta.json'
    })
    .sort((left, right) => left.localeCompare(right))
  const documentFiles = rawFiles.filter(
    (file) => file.endsWith('.md') || file.endsWith('.mdx'),
  )
  const PRIORITY_PATTERNS = [
    /index\./i,
    /intro/i,
    /getting-started/i,
    /readme/i,
  ]
  const scoredFiles = documentFiles.map((file) => {
    const score = PRIORITY_PATTERNS.findIndex((pattern) =>
      pattern.test(path.basename(file)),
    )
    return { file, score: score === -1 ? Number.MAX_SAFE_INTEGER : score }
  })
  scoredFiles.sort((a, b) => a.score - b.score || a.file.localeCompare(b.file))
  const files = scoredFiles.map(({ file }) => file)
  const allFiles = [...files, ...directoryMetaFiles]
  const directories = new Set<string>([path.resolve(docsDir)])
  for (const file of allFiles) {
    let directory = path.dirname(file)
    while (directory.startsWith(path.resolve(docsDir))) {
      directories.add(directory)
      if (directory === path.resolve(docsDir)) break
      directory = path.dirname(directory)
    }
  }
  const directoryEntries = await Promise.all(
    [...directories].sort().map(async (directory) => {
      try {
        const stat = await fs.stat(directory)
        return [directory, stat.mtimeMs] as const
      } catch {
        return null
      }
    }),
  )
  const snapshot: RouteDiscoverySnapshot = {
    version: 1,
    files,
    directoryMetaFiles,
    directories: Object.fromEntries(
      directoryEntries.filter(
        (entry): entry is readonly [string, number] => entry !== null,
      ),
    ),
  }
  await saveDiscoverySnapshot(routeVariant, snapshot)
  return snapshot
}

async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let index = 0

  async function worker() {
    while (index < items.length) {
      const i = index++
      results[i] = await fn(items[i])
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  )
  return results
}

export function invalidateDirectoryMetaFile(
  filePath: string,
  contextOrDocsDir?: RouteCacheContext | string,
): void {
  baseInvalidateDirectoryMetaFile(filePath, contextOrDocsDir)
}

export function invalidateFile(
  filePath: string,
  contextOrDocsDir?: RouteCacheContext | string,
): void {
  const target =
    typeof contextOrDocsDir === 'string'
      ? getRouteCacheContext(contextOrDocsDir)
      : contextOrDocsDir
  if (target) {
    const normalized = filePath.replace(/\\/g, '/')
    if (
      path.basename(normalized) === 'meta.json' ||
      path.basename(normalized) === '_meta.json'
    ) {
      baseInvalidateDirectoryMetaFile(filePath, target)
    }
    if (target.cachedNativeDocs?.[normalized]) {
      delete target.cachedNativeDocs[normalized]
    }
    baseInvalidateFile(filePath, target)
    return
  }
  baseInvalidateFile(filePath)
}

/** Invalidates one project's route metadata and parser state. */
export function invalidateRouteCache(
  contextOrDocsDir?: RouteCacheContext | string,
): void {
  if (contextOrDocsDir) {
    baseInvalidateRouteCache(contextOrDocsDir)
    return
  }
  baseInvalidateRouteCache()
}

/**
 * Generates the entire route map for the documentation site.
 *
 * Automatically handles versioning and i18n routing, including fallback
 * generation for missing translations.
 *
 * @param docsDir - The root documentation directory
 * @param config - The Boltdocs configuration
 * @param basePath - The base URL path for the routes (default: '/docs')
 * @returns A promise resolving to an array of RouteMeta objects
 */
export async function generateRoutes(
  docsDir: string,
  config?: BoltdocsConfig,
  basePath?: string,
  forceScan: boolean = false,
  cacheContext?: RouteCacheContext,
  cacheVariant?: RouteCacheVariant,
): Promise<RouteMeta[]> {
  const routeContext = cacheContext ?? getRouteCacheContext(docsDir)
  if (routeContext.disposed) {
    throw new Error('[boltdocs] Route cache context has been disposed.')
  }
  const generationKey = getRouteGenerationFingerprint(config, basePath)

  if (cacheVariant && cacheVariant.fingerprint !== generationKey) {
    throw new Error(
      '[boltdocs] Route cache variant does not match the requested route configuration fingerprint.',
    )
  }
  if (
    cacheVariant &&
    routeContext.variants.get(generationKey) !== cacheVariant
  ) {
    throw new Error(
      '[boltdocs] Route cache variant does not belong to the requested route cache context.',
    )
  }

  const activeGeneration = routeContext.activeGenerations.get(generationKey)
  if (activeGeneration) return activeGeneration

  const routeVariant =
    cacheVariant ?? getRouteCacheVariant(routeContext, generationKey)
  const generationEpoch = routeContext.generationEpoch

  const currentTask = (async (): Promise<RouteMeta[]> => {
    const finalBasePath = basePath || config?.base || '/docs'
    // Load persistent cache for this documentation tree and configuration.
    await routeVariant.docCache.load()

    let files: string[]
    let directoryMetaFiles: string[]
    const discovery = await getDiscoverySnapshot(
      docsDir,
      routeVariant,
      forceScan || getCacheConfig().noCache,
    )
    files = discovery.files.filter((file) => {
      if (!config?.experimental?.fileRouting) return true
      const relative = path.relative(docsDir, file).replace(/\\\\/g, '/')
      return !relative.split('/').includes('pages-external')
    })
    directoryMetaFiles = discovery.directoryMetaFiles
    routeVariant.cachedFileList = files
    routeVariant.cachedDirectoryMetaFiles = directoryMetaFiles

    routeVariant.directoryMeta = await loadDirectoryMeta(
      docsDir,
      directoryMetaFiles,
      routeVariant,
    )
    syncRouteCacheFacade(routeContext, routeVariant)

    // Prune cache entries for deleted files
    routeVariant.docCache.pruneStale(new Set(files))

    const isTest =
      process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

    let parsed: ParsedDocFile[]

    // Check if all files are already cached in docCache
    let allCached = true
    for (const file of files) {
      if (!routeVariant.docCache.get(file)) {
        allCached = false
        break
      }
    }

    if (allCached) {
      parsed = files.map((file) => {
        const cached = routeVariant.docCache.get(file)
        if (!cached) {
          throw new Error(
            `[boltdocs] Route cache entry disappeared for ${file}`,
          )
        }
        return cached
      })
    } else {
      if (!isTest && !routeVariant.cachedNativeDocs) {
        try {
          const { runParser } = await import('@bdocs/parser')
          routeVariant.cachedNativeDocs = await runParser(docsDir, true) // Sätteri always active
        } catch {
          // Native parser not available or failed.
        }
      }

      const useNative = !isTest && routeVariant.cachedNativeDocs !== null

      if (useNative && routeVariant.cachedNativeDocs) {
        const { parseDocFileWithNative } = await import('./parser/native')
        const missingNativeFiles = files.filter(
          (file) => !routeVariant.cachedNativeDocs?.[file.replace(/\\/g, '/')],
        )
        if (missingNativeFiles.length > 0) {
          try {
            const { runParserFiles } = await import('@bdocs/parser')
            const refreshed = await runParserFiles(
              docsDir,
              missingNativeFiles,
              true,
            )
            routeVariant.cachedNativeDocs = {
              ...routeVariant.cachedNativeDocs,
              ...refreshed,
            }
          } catch {
            // The JS parser remains the safe fallback for missing entries.
          }
        }
        const hasFallbackFiles = files.some(
          (file) => !routeVariant.cachedNativeDocs?.[file.replace(/\\/g, '/')],
        )
        const parseDocFile = hasFallbackFiles
          ? (await import('./parser')).parseDocFile
          : undefined

        parsed = await runWithConcurrency(
          files,
          PARSE_CONCURRENCY,
          async (file) => {
            const cached = routeVariant.docCache.get(file)
            if (cached) return cached

            const normalizedPath = file.replace(/\\/g, '/')
            const nativeDoc = routeVariant.cachedNativeDocs![normalizedPath]

            if (nativeDoc) {
              const result = await parseDocFileWithNative(
                file,
                nativeDoc,
                docsDir,
                finalBasePath,
                config,
                routeVariant.parserCache,
              )
              routeVariant.docCache.set(file, result)
              return result
            } else {
              if (!parseDocFile) {
                throw new Error(
                  `[boltdocs] Native parser did not return a document for ${file}`,
                )
              }
              const result = await parseDocFile(
                file,
                docsDir,
                finalBasePath,
                config,
                routeVariant.parserCache,
              )
              routeVariant.docCache.set(file, result)
              return result
            }
          },
        )
      } else {
        const { parseDocFile } = await import('./parser')
        parsed = await runWithConcurrency(
          files,
          PARSE_CONCURRENCY,
          async (file) => {
            const cached = routeVariant.docCache.get(file)
            if (cached) return cached
            const result = await parseDocFile(
              file,
              docsDir,
              finalBasePath,
              config,
              routeVariant.parserCache,
            )
            routeVariant.docCache.set(file, result)
            return result
          },
        )
      }
    }

    // An HMR invalidation may have happened while parsing. Never persist or
    // return a result produced from the invalidated snapshot; restart using
    // the same stable variant after removing this in-flight coalescing entry.
    if (routeContext.generationEpoch !== generationEpoch) {
      throw ROUTE_GENERATION_INVALIDATED
    }

    // Save cache after processing
    routeVariant.docCache.save()

    const docFiles: ParsedDocFile[] = []
    const collectionFiles: Map<string, ParsedDocFile[]> = new Map()

    const nodeEnv = process.env.NODE_ENV || 'development'
    const draftsVisible =
      config?.drafts?.visible ||
      process.env.BOLTDOCS_DRAFTS === 'true' ||
      (config?.drafts?.environments?.includes(nodeEnv) ?? false)

    for (const p of parsed) {
      // Exclude drafts unless drafts are configured to be visible
      if (p.route.draft && !draftsVisible) continue

      // Exclude pages with unmet feature flags
      if (p.route.featureFlags && config?.featureFlags) {
        const allEnabled = p.route.featureFlags.every((flag) => {
          const value = config.featureFlags?.[flag]
          return value === true || value === nodeEnv
        })
        if (!allEnabled) continue
      } else if (p.route.featureFlags && !config?.featureFlags) {
        // No feature flags configured but page requires them — exclude
        continue
      }

      if (p.inferredCollection) {
        const col = p.inferredCollection
        if (!collectionFiles.has(col)) collectionFiles.set(col, [])
        collectionFiles.get(col)!.push(p)
      } else {
        docFiles.push(p)
      }
    }

    const groupMeta = new Map<
      string,
      {
        title: string | Record<string, string>
        position?: number
        icon?: string
      }
    >()
    const groupIndexFiles: ParsedDocFile[] = []

    const defaultLocale = config?.i18n?.defaultLocale || ''

    for (const p of docFiles) {
      if (p.isGroupIndex && p.relativeDir) {
        groupIndexFiles.push(p)
      }

      if (p.relativeDir) {
        const locale = p.route.locale || defaultLocale
        const groupKey = `${locale}:${p.relativeDir}`

        let entry = groupMeta.get(groupKey)
        if (!entry) {
          entry = {
            title: capitalize(p.relativeDir),
            position: p.inferredGroupPosition,
          }
          groupMeta.set(groupKey, entry)
        } else {
          if (
            entry.position === undefined &&
            p.inferredGroupPosition !== undefined
          ) {
            entry.position = p.inferredGroupPosition
          }
        }
      }
    }

    // Override with explicit group index metadata
    for (const p of groupIndexFiles) {
      const locale = p.route.locale || defaultLocale
      const groupKey = `${locale}:${p.relativeDir!}`
      const entry = groupMeta.get(groupKey)!
      if (p.groupMeta) {
        entry.title = p.groupMeta.title
        if (p.groupMeta.position !== undefined)
          entry.position = p.groupMeta.position
        if (p.groupMeta.icon) entry.icon = p.groupMeta.icon
      }
    }

    // Override with boltdocs.config.ts sidebarGroups configurations
    if (config?.theme?.sidebarGroups) {
      const allLocales = config.i18n
        ? Object.keys(config.i18n.locales)
        : [defaultLocale]

      for (const [groupName, groupConfig] of Object.entries(
        config.theme.sidebarGroups,
      )) {
        for (const locale of allLocales) {
          const groupKey = `${locale}:${groupName}`
          const entry = groupMeta.get(groupKey)

          let resolvedTitle: string | undefined
          if (typeof groupConfig.title === 'string') {
            resolvedTitle = groupConfig.title
          } else if (groupConfig.title) {
            resolvedTitle =
              groupConfig.title[locale] || groupConfig.title[defaultLocale]
          }

          if (entry) {
            if (resolvedTitle) entry.title = resolvedTitle
            if (groupConfig.icon) entry.icon = groupConfig.icon
          } else {
            groupMeta.set(groupKey, {
              title: resolvedTitle || capitalize(groupName),
              icon: groupConfig.icon,
            })
          }
        }
      }
    }

    const docRoutes: RouteMeta[] = new Array(docFiles.length)
    for (let i = 0; i < docFiles.length; i++) {
      const p = docFiles[i]
      const dir = p.relativeDir
      const locale = p.route.locale || defaultLocale
      const groupKey = dir ? `${locale}:${dir}` : undefined
      const meta = groupKey ? groupMeta.get(groupKey) : undefined

      let groupTitle: string | undefined
      if (meta) {
        if (typeof meta.title === 'string') {
          groupTitle = meta.title
        } else {
          groupTitle = meta.title[locale] || meta.title[defaultLocale]
        }
      }

      docRoutes[i] = {
        ...p.route,
        group: dir,
        groupTitle: groupTitle || (dir ? capitalize(dir) : undefined),
        groupPosition: meta?.position,
        groupIcon: meta?.icon,
      }
    }

    const collectionRoutes: RouteMeta[] = []
    for (const [, posts] of collectionFiles) {
      for (const p of posts) {
        collectionRoutes.push({
          ...p.route,
          collection: p.inferredCollection,
        })
      }
    }
    collectionRoutes.sort((a, b) => {
      const getTimestamp = (date: string | Date | undefined) => {
        if (!date) return Number.NEGATIVE_INFINITY
        const value = new Date(date).getTime()
        return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
      }
      const dateA = getTimestamp(a.date)
      const dateB = getTimestamp(b.date)
      const dateOrder = dateB - dateA
      return dateOrder !== 0 ? dateOrder : a.path.localeCompare(b.path)
    })

    let finalDocRoutes = docRoutes
    if (config?.i18n) {
      const fallbacks = generateI18nFallbacks(
        docRoutes,
        config,
        finalBasePath,
        routeVariant.localizedPathCache,
      )
      finalDocRoutes = [...docRoutes, ...fallbacks]
    }

    const sortedDocs = sortRoutes(finalDocRoutes)
    const allRoutes = [...sortedDocs, ...collectionRoutes]

    if (routeContext.generationEpoch !== generationEpoch) {
      throw ROUTE_GENERATION_INVALIDATED
    }

    return allRoutes
  })()

  routeContext.activeGenerations.set(generationKey, currentTask)

  try {
    return await currentTask
  } catch (error) {
    if (error !== ROUTE_GENERATION_INVALIDATED) throw error
    if (routeContext.disposed) {
      throw new Error(
        '[boltdocs] Route cache context was disposed during generation.',
      )
    }
    routeVariant.docCache.invalidateAll()
    routeVariant.parserCache.clear()
    if (routeContext.activeGenerations.get(generationKey) === currentTask) {
      routeContext.activeGenerations.delete(generationKey)
    }
    return generateRoutes(docsDir, config, basePath, forceScan, routeContext)
  } finally {
    if (routeContext.activeGenerations.get(generationKey) === currentTask) {
      routeContext.activeGenerations.delete(generationKey)
    }
  }
}

/**
 * Generates fallback routes for missing translations.
 * Optimization: Uses Map for O(1) existence checks instead of nested filters.
 */
function generateI18nFallbacks(
  routes: RouteMeta[],
  config: BoltdocsConfig,
  basePath: string,
  localizedPathCache: Map<string, string>,
): RouteMeta[] {
  const defaultLocale = config.i18n!.defaultLocale
  const allLocales = Object.keys(config.i18n!.locales)
  const fallbackRoutes: RouteMeta[] = []

  // Index existing routes by locale for O(1) lookup
  const routesByLocale = new Map<string, Set<string>>()
  const defaultRoutes: RouteMeta[] = []

  for (const r of routes) {
    const locale = r.locale || defaultLocale
    if (!routesByLocale.has(locale)) {
      routesByLocale.set(locale, new Set())
    }
    routesByLocale.get(locale)!.add(r.path)

    if (locale === defaultLocale) {
      defaultRoutes.push(r)
    }
  }

  for (const locale of allLocales) {
    if (locale === defaultLocale) continue
    const localePaths = routesByLocale.get(locale) || new Set<string>()

    for (const defRoute of defaultRoutes) {
      const targetPath = computeLocalizedPath(
        defRoute.path,
        defaultLocale,
        locale,
        basePath,
        config,
        localizedPathCache,
      )

      // Skip if the path is already the same (e.g. for default locale unprefixed)
      if (targetPath === defRoute.path) continue

      if (!localePaths.has(targetPath)) {
        fallbackRoutes.push({
          ...defRoute,
          path: targetPath,
          locale,
        })
      }
    }
  }

  return fallbackRoutes
}

/**
 * Computes a localized path based on the default locale and target locale.
 * Uses a cache to avoid redundant string manipulation.
 */
function computeLocalizedPath(
  path: string,
  defaultLocale: string,
  targetLocale: string,
  basePath: string,
  config: BoltdocsConfig | undefined,
  localizedPathCache: Map<string, string>,
): string {
  const cacheKey = `${path}:${targetLocale}`
  const cached = localizedPathCache.get(cacheKey)
  if (cached) return cached

  const normalizedBasePath = basePath.startsWith('/')
    ? basePath
    : '/' + basePath
  let prefix = normalizedBasePath
  if (config?.versions) {
    const vPrefix = config.versions.prefix || ''
    for (const vConfig of config.versions.versions) {
      const fullVPath = vPrefix + vConfig.path
      const versionSearchPrefix = `${normalizedBasePath}/${fullVPath}`
      if (path.startsWith(versionSearchPrefix)) {
        prefix = versionSearchPrefix
        break
      }
      const simpleVersionSearchPrefix = `${normalizedBasePath}/${vConfig.path}`
      if (path.startsWith(simpleVersionSearchPrefix)) {
        prefix = simpleVersionSearchPrefix
        break
      }
    }
  }

  let pathAfterVersion = path.substring(prefix.length)

  // Handle case where path already has default locale
  const defaultLocaleSegment = `/${defaultLocale}`
  if (pathAfterVersion.startsWith(defaultLocaleSegment + '/')) {
    pathAfterVersion =
      '/' +
      targetLocale +
      '/' +
      pathAfterVersion.substring(defaultLocaleSegment.length + 1)
  } else if (pathAfterVersion === defaultLocaleSegment) {
    pathAfterVersion = '/' + targetLocale
  } else if (pathAfterVersion === '/' || pathAfterVersion === '') {
    pathAfterVersion = '/' + targetLocale
  } else {
    // Regular route without locale segment
    const pathPrefix = pathAfterVersion.startsWith('/') ? '' : '/'
    pathAfterVersion = '/' + targetLocale + pathPrefix + pathAfterVersion
  }

  const result = prefix + pathAfterVersion

  // Simple cache eviction to prevent memory leaks in extreme cases
  if (localizedPathCache.size > 2000) localizedPathCache.clear()
  localizedPathCache.set(cacheKey, result)

  return result
}
