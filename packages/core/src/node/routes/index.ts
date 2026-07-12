import path from 'node:path'
import { fdir } from 'fdir'
import type { BoltdocsConfig } from '../config'
import { capitalize } from '../utils'

import type { RouteMeta, ParsedDocFile } from './types'
import {
  docCache,
  invalidateRouteCache as baseInvalidateRouteCache,
  invalidateFile as baseInvalidateFile,
} from './cache'
import { sortRoutes } from './sorter'

export type { RouteMeta }

export { getExternalRoutePaths } from './pages-external'
// Cache for file list and localized path computations
let cachedFileList: string[] | null = null
const localizedPathCache = new Map<string, string>()

const PARSE_CONCURRENCY = 32

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

// In-memory cache for parsed documents from native parser
let _cachedNativeDocs: Record<string, any> | null = null

export function invalidateFile(filePath: string): void {
  const normalized = filePath.replace(/\\/g, '/')
  if (_cachedNativeDocs && _cachedNativeDocs[normalized]) {
    delete _cachedNativeDocs[normalized]
  }
  baseInvalidateFile(filePath)
}

// Coalescing promise for concurrent calls
let activeGenerationPromise: Promise<RouteMeta[]> | null = null

/**
 * Invalidates the global route metadata and clears local state.
 */
export function invalidateRouteCache(): void {
  cachedFileList = null
  localizedPathCache.clear()
  baseInvalidateRouteCache()
  _cachedNativeDocs = null
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
  turbo: boolean = false,
): Promise<RouteMeta[]> {
  if (activeGenerationPromise) {
    return activeGenerationPromise
  }

  const currentTask = (async (): Promise<RouteMeta[]> => {
    const finalBasePath = basePath || config?.base || '/docs'
    // Load persistent cache
    await docCache.load()

    // Clear path computation cache between generations
    localizedPathCache.clear()

    let files: string[]
    if (!forceScan && cachedFileList) {
      files = cachedFileList
    } else {
      const api = new fdir()
        .withFullPaths()
        .filter((p) => {
          const isMd = p.endsWith('.md') || p.endsWith('.mdx')
          if (!isMd) return false

          // Get relative path and check if any part starts with an underscore
          const rel = path.relative(docsDir, p).replace(/\\/g, '/')
          const segments = rel.split('/')
          // Exclude if any directory or file itself starts with "_"
          return !segments.some(
            (seg) =>
              seg.startsWith('_') &&
              seg !== '_index.md' &&
              seg !== '_index.mdx',
          )
        })
        .crawl(docsDir)

      const rawFiles = await api.withPromise()

      // Prioritized prefetch: Sort files to process important ones first
      const PRIORITY_PATTERNS = [
        /index\./i,
        /intro/i,
        /getting-started/i,
        /readme/i,
      ]

      const scoredFiles = rawFiles.map((f) => {
        const base = path.basename(f)
        const score = PRIORITY_PATTERNS.findIndex((p) => p.test(base))
        return {
          f,
          score: score === -1 ? Number.MAX_SAFE_INTEGER : score,
        }
      })

      scoredFiles.sort((a, b) => a.score - b.score)
      files = scoredFiles.map((item) => item.f)

      cachedFileList = files
    }

    // Prune cache entries for deleted files
    docCache.pruneStale(new Set(files))

    const isTest =
      process.env.NODE_ENV === 'test' || process.env.VITEST === 'true'

    let parsed: ParsedDocFile[]

    // Check if all files are already cached in docCache
    let allCached = true
    for (const file of files) {
      if (!docCache.get(file)) {
        allCached = false
        break
      }
    }

    if (allCached) {
      parsed = files.map((file) => docCache.get(file)!)
    } else {
      if (!isTest && !_cachedNativeDocs) {
        try {
          const { runParser } = await import('@bdocs/parser')
          _cachedNativeDocs = await runParser(docsDir, turbo)
        } catch (e) {
          // Native parser not available or failed
        }
      }

      const useNative = !isTest && _cachedNativeDocs !== null

      if (useNative && _cachedNativeDocs) {
        const { parseDocFileWithNative, parseDocFile } = await import(
          './parser'
        )

        parsed = await runWithConcurrency(
          files,
          PARSE_CONCURRENCY,
          async (file) => {
            const cached = docCache.get(file)
            if (cached) return cached

            const normalizedPath = file.replace(/\\/g, '/')
            const nativeDoc = _cachedNativeDocs![normalizedPath]

            if (nativeDoc) {
              const result = await parseDocFileWithNative(
                file,
                nativeDoc,
                docsDir,
                finalBasePath,
                config,
              )
              docCache.set(file, result)
              return result
            } else {
              const result = await parseDocFile(
                file,
                docsDir,
                finalBasePath,
                config,
              )
              docCache.set(file, result)
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
            const cached = docCache.get(file)
            if (cached) return cached
            const result = await parseDocFile(
              file,
              docsDir,
              finalBasePath,
              config,
            )
            docCache.set(file, result)
            return result
          },
        )
      }
    }

    // Save cache after processing
    docCache.save()

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
      const dateA = a.date ? new Date(a.date).getTime() : 0
      const dateB = b.date ? new Date(b.date).getTime() : 0
      return dateB - dateA
    })

    let finalDocRoutes = docRoutes
    if (config?.i18n) {
      const fallbacks = generateI18nFallbacks(docRoutes, config, finalBasePath)
      finalDocRoutes = [...docRoutes, ...fallbacks]
    }

    const sortedDocs = sortRoutes(finalDocRoutes)
    const allRoutes = [...sortedDocs, ...collectionRoutes]

    return allRoutes
  })()

  activeGenerationPromise = currentTask

  try {
    return await currentTask
  } finally {
    activeGenerationPromise = null
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
  config?: BoltdocsConfig,
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
