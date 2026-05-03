import fastGlob from 'fast-glob'
import type { BoltdocsConfig } from '../config'
import { capitalize } from '../utils'

import type { RouteMeta, ParsedDocFile } from './types'
import { docCache, invalidateRouteCache, invalidateFile } from './cache'
import { parseDocFile } from './parser'
import { sortRoutes } from './sorter'

// Re-export public API
export type { RouteMeta }
export { invalidateRouteCache, invalidateFile }

// Cache for file list and localized path computations
let cachedFileList: string[] | null = null
const localizedPathCache = new Map<string, string>()

/**
 * Generates the entire route map for the documentation site.
 * OPTIMIZED: Uses Map-based i18n lookups, chunked processing, and path caching.
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
  basePath: string = '/docs',
  forceScan: boolean = true,
): Promise<RouteMeta[]> {
  // Load persistent cache
  docCache.load()

  // Clear path computation cache between generations
  localizedPathCache.clear()

  // Force re-parse if specifically requested (e.g. for content/config changes)
  if (process.env.BOLTDOCS_FORCE_REPARSE === 'true' || config?.i18n) {
    docCache.invalidateAll()
  }

  // 1. FAST SCAN (Skip if incremental and we have a cache)
  let files: string[]
  if (!forceScan && cachedFileList) {
    files = cachedFileList
  } else {
    files = await fastGlob(['**/*.md', '**/*.mdx'], {
      cwd: docsDir,
      absolute: true,
      suppressErrors: true,
      followSymbolicLinks: false,
    })
    cachedFileList = files
  }

  // Prune cache entries for deleted files
  docCache.pruneStale(new Set(files))

  // 2. PARALLEL PROCESSING (Worker Threads)
  const { pool } = await import('./worker-pool')
  
  const parsed = await Promise.all(
    files.map(async (file) => {
      const cached = docCache.get(file)
      if (cached) return cached

      const result = await pool.parseFile(file, docsDir, basePath, config)
      docCache.set(file, result)
      return result
    })
  )

  // Save cache after processing
  docCache.save()

  // 3. OPTIMIZED METADATA COLLECTION
  const groupMeta = new Map<
    string,
    { title: string | Record<string, string>; position?: number; icon?: string }
  >()
  const groupIndexFiles: ParsedDocFile[] = []

  const defaultLocale = config?.i18n?.defaultLocale || ''

  for (const p of parsed) {
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
        let entry = groupMeta.get(groupKey)

        // Resolve title for this locale
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

  // 4. BUILD BASE ROUTES
  const routes: RouteMeta[] = new Array(parsed.length)
  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i]
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

    routes[i] = {
      ...p.route,
      group: dir,
      groupTitle: groupTitle || (dir ? capitalize(dir) : undefined),
      groupPosition: meta?.position,
      groupIcon: meta?.icon,
    }
  }

  // 5. OPTIMIZED I18N FALLBACKS
  let finalRoutes = routes
  if (config?.i18n) {
    const fallbacks = generateI18nFallbacks(routes, config, basePath)
    finalRoutes = [...routes, ...fallbacks]
  }

  const sorted = sortRoutes(finalRoutes)

  return sorted
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

  const normalizedBasePath = basePath.startsWith('/') ? basePath : '/' + basePath
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
