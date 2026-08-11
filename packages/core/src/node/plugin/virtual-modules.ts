import type { Plugin, ResolvedConfig } from 'vite'
import { generateRoutes } from '../routes'
import type { RouteMeta } from '../routes/types'
import { normalizePath } from '../utils'
import { generateSearchData, type SearchDocument } from '../search'
import {
  virtualModuleRegistry,
  type PluginRuntimeState,
} from '../plugins/plugin-context'
import {
  getRouteGenerationFingerprint,
  getRouteCacheContext,
  getRouteCacheVariant,
  type RouteCacheContext,
  type RouteCacheVariant,
} from '../routes/cache'
import type { BoltdocsConfig } from '../config'
import type { BoltdocsPluginOptions } from './types'
import { generateEntryCode } from './entry'
import path from 'node:path'
import fs from 'node:fs'
export type ClientRouteData = Omit<
  RouteMeta,
  'componentPath' | '_content' | 'featureFlags'
> & {
  description: string
  headings: NonNullable<RouteMeta['headings']>
  _rawContent: string
}

export function toClientRouteData(route: RouteMeta): ClientRouteData {
  return {
    path: route.path,
    filePath: route.filePath,
    title: route.title,
    description: route.description || '',
    sidebarPosition: route.sidebarPosition,
    badge: route.badge,
    icon: route.icon,
    headings: route.headings || [],
    _rawContent: route._rawContent || '',
    frontmatter: route.frontmatter,
    locale: route.locale,
    version: route.version,
    tab: route.tab,
    collection: route.collection,
    tags: route.tags,
    author: route.author,
    draft: route.draft,
    excerpt: route.excerpt,
    coverImage: route.coverImage,
    group: route.group,
    groupTitle: route.groupTitle,
    groupPosition: route.groupPosition,
    groupIcon: route.groupIcon,
    subRouteGroup: route.subRouteGroup,
    seo: route.seo,
    date: route.date,
    lastUpdated: route.lastUpdated,
    category: route.category,
    order: route.order,
    sidebarLabel: route.sidebarLabel,
    sidebarHidden: route.sidebarHidden,
    slugParts: route.slugParts,
  }
}

export interface VirtualModuleState {
  routeCacheContext?: RouteCacheContext
  routeCacheVariant?: RouteCacheVariant
  routeGenerationFingerprint?: string
  directoryMetaCache: Record<string, unknown> | null
  routesDataMap: Map<string, RouteMeta>
  collectionsDataMap: Map<string, CollectionPost>
  searchDataMap: Map<string, SearchDocument>
}

export function createVirtualModuleState(
  routeCacheContext?: RouteCacheContext,
): VirtualModuleState {
  return {
    routeCacheContext,
    routeGenerationFingerprint: undefined,
    directoryMetaCache: null,
    routesDataMap: new Map(),
    collectionsDataMap: new Map(),
    searchDataMap: new Map(),
  }
}

const defaultVirtualModuleState = createVirtualModuleState()

function getVirtualModuleState(state?: VirtualModuleState): VirtualModuleState {
  return state ?? defaultVirtualModuleState
}

/** Minimal mirror of the client-side CollectionPost type to avoid importing from the client package on the server. */
interface CollectionPost {
  path: string
  title: string
  date?: string | Date
  excerpt?: string
  tags?: string[]
  author?: string
  coverImage?: string
  filePath: string
  locale?: string
  version?: string
  frontmatter?: Record<string, any>
  lastUpdated?: string | number | Date
  headings?: { level: number; text: string; id: string }[]
  draft?: boolean
  collection: string
}

// Per-route / per-item in-memory caches live in VirtualModuleState so two
// Vite instances cannot serve each other's route, collection, or search data.

export interface RouteDeltaPayload {
  updated: ClientRouteData[]
  deleted: string[]
}

export interface CollectionsDeltaPayload {
  updated: CollectionPost[]
  deleted: string[]
}

export interface SearchDeltaPayload {
  updated: SearchDocument[]
  deleted: string[]
}

export interface FrontmatterDeltaPayload {
  routes: RouteDeltaPayload
  collections: CollectionsDeltaPayload
  search: SearchDeltaPayload
}

/**
 * Called by the dev-server watcher whenever a file is added or removed
 * so that the next config module request re-crawls for meta.json files.
 */
export function invalidateDirectoryMetaCache(state?: VirtualModuleState): void {
  const moduleState = getVirtualModuleState(state)
  moduleState.directoryMetaCache = null
  moduleState.routeGenerationFingerprint = undefined
  moduleState.routeCacheVariant = undefined
  moduleState.routesDataMap.clear()
  moduleState.collectionsDataMap.clear()
  moduleState.searchDataMap.clear()
}

function clearVirtualData(state?: VirtualModuleState): void {
  const moduleState = getVirtualModuleState(state)
  moduleState.routesDataMap.clear()
  moduleState.collectionsDataMap.clear()
  moduleState.searchDataMap.clear()
}

async function regenerateRouteData(
  docsDir: string,
  config: BoltdocsConfig,
  state?: VirtualModuleState,
  routeCacheVariant?: RouteCacheVariant,
): Promise<void> {
  const moduleState = getVirtualModuleState(state)
  if (!moduleState.routeCacheContext) {
    moduleState.routeCacheContext = getRouteCacheContext(docsDir)
  }
  const generationKey = getRouteGenerationFingerprint(config)
  const existingVariant =
    routeCacheVariant?.fingerprint === generationKey &&
    moduleState.routeCacheContext.variants.get(generationKey) ===
      routeCacheVariant
      ? routeCacheVariant
      : undefined
  const variant =
    existingVariant ??
    getRouteCacheVariant(moduleState.routeCacheContext, generationKey)
  moduleState.routeCacheVariant = variant
  moduleState.routeGenerationFingerprint = generationKey
  const routes = await generateRoutes(
    docsDir,
    config,
    undefined,
    false,
    moduleState.routeCacheContext,
    variant,
  )
  moduleState.routesDataMap.clear()
  for (const route of routes) {
    moduleState.routesDataMap.set(route.path, route)
  }

  regenerateSearchAndCollections(moduleState)
}

function regenerateSearchAndCollections(state?: VirtualModuleState): void {
  const moduleState = getVirtualModuleState(state)
  const routes = Array.from(moduleState.routesDataMap.values())

  const searchData = generateSearchData(routes as any)
  moduleState.searchDataMap.clear()
  for (const doc of searchData) {
    moduleState.searchDataMap.set(doc.id, doc)
  }

  moduleState.collectionsDataMap.clear()
  for (const route of routes) {
    if (route.collection) {
      const post: CollectionPost = {
        path: route.path,
        title: route.title,
        date: route.date,
        excerpt: route.excerpt,
        tags: route.tags,
        author: route.author,
        coverImage: route.coverImage,
        filePath: route.filePath,
        locale: route.locale,
        version: route.version,
        frontmatter: route.frontmatter,
        draft: route.frontmatter?.draft,
        collection: route.collection,
      }
      moduleState.collectionsDataMap.set(route.filePath, post)
    }
  }
}

async function ensureRoutesGenerated(
  docsDir: string,
  config: BoltdocsConfig,
  state?: VirtualModuleState,
): Promise<void> {
  const moduleState = getVirtualModuleState(state)
  if (!moduleState.routeCacheContext) {
    moduleState.routeCacheContext = getRouteCacheContext(docsDir)
  }
  const generationKey = getRouteGenerationFingerprint(config)
  if (
    moduleState.routesDataMap.size === 0 ||
    moduleState.routeGenerationFingerprint !== generationKey
  ) {
    moduleState.routesDataMap.clear()
    moduleState.collectionsDataMap.clear()
    moduleState.searchDataMap.clear()
    await regenerateRouteData(docsDir, config, moduleState)
  }
}

function getCollectionsRecord(
  state?: VirtualModuleState,
): Record<string, CollectionPost[]> {
  const moduleState = getVirtualModuleState(state)
  const record: Record<string, CollectionPost[]> = {}
  const posts = Array.from(moduleState.collectionsDataMap.values()).sort(
    (a, b) => {
      const timestamp = (date: string | Date | undefined) => {
        if (!date) return Number.NEGATIVE_INFINITY
        const value = new Date(date).getTime()
        return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY
      }
      const dateA = timestamp(a.date)
      const dateB = timestamp(b.date)

      const dateOrder = dateB - dateA
      return dateOrder !== 0 ? dateOrder : a.path.localeCompare(b.path)
    },
  )
  for (const post of posts) {
    const collection = post.collection
    if (!collection) continue
    if (!record[collection]) record[collection] = []
    record[collection].push(post)
  }
  return record
}

function serializeMapToExport<T, R>(
  map: Map<string, T>,
  transform: (value: T) => R = (value) => value as unknown as R,
): string {
  const values = Array.from(map.values(), transform).sort((left, right) => {
    const getKey = (value: R): string => {
      if (typeof value !== 'object' || value === null) return String(value)
      const record = value as {
        path?: unknown
        id?: unknown
        filePath?: unknown
      }
      return `${String(record.path || '')}\u0000${String(record.id || '')}\u0000${String(record.filePath || '')}`
    }
    return getKey(left).localeCompare(getKey(right))
  })
  return `export default ${JSON.stringify(values, null, 2)};`
}

/** Export the current search document cache as a plain array. */
export function getSearchDataExport(
  state?: VirtualModuleState,
): SearchDocument[] {
  return Array.from(getVirtualModuleState(state).searchDataMap.values()).sort(
    (a, b) => a.id.localeCompare(b.id),
  )
}

function serializeCollectionsToExport(
  record: Record<string, CollectionPost[]>,
): string {
  return `export default ${JSON.stringify(record, null, 2)};`
}

/**
 * Regenerates all route data, compares it with the previous cached state, and
 * returns a delta payload suitable for sending over HMR. The cache is updated
 * in-place so subsequent virtual module loads returns the new data.
 */
export async function computeFrontmatterDelta(
  docsDir: string,
  config: BoltdocsConfig,
  state?: VirtualModuleState,
  routeCacheContext?: RouteCacheContext,
  routeCacheVariant?: RouteCacheVariant,
): Promise<FrontmatterDeltaPayload> {
  const moduleState = getVirtualModuleState(state)
  if (routeCacheContext) moduleState.routeCacheContext = routeCacheContext
  if (routeCacheVariant) moduleState.routeCacheVariant = routeCacheVariant
  const generationKey = getRouteGenerationFingerprint(config)
  if (moduleState.routeGenerationFingerprint !== generationKey) {
    moduleState.routesDataMap.clear()
    moduleState.collectionsDataMap.clear()
    moduleState.searchDataMap.clear()
  }
  const oldRoutes = new Map(moduleState.routesDataMap)
  const oldCollections = new Map(moduleState.collectionsDataMap)
  const oldSearch = new Map(moduleState.searchDataMap)

  await regenerateRouteData(docsDir, config, moduleState)

  const delta: FrontmatterDeltaPayload = {
    routes: { updated: [], deleted: [] },
    collections: { updated: [], deleted: [] },
    search: { updated: [], deleted: [] },
  }

  for (const [routePath, route] of moduleState.routesDataMap) {
    const previous = oldRoutes.get(routePath)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(route)) {
      delta.routes.updated.push(toClientRouteData(route))
    }
  }
  for (const routePath of oldRoutes.keys()) {
    if (!moduleState.routesDataMap.has(routePath)) {
      delta.routes.deleted.push(routePath)
    }
  }

  for (const [filePath, post] of moduleState.collectionsDataMap) {
    const previous = oldCollections.get(filePath)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(post)) {
      delta.collections.updated.push(post)
    }
  }
  for (const filePath of oldCollections.keys()) {
    if (!moduleState.collectionsDataMap.has(filePath)) {
      delta.collections.deleted.push(filePath)
    }
  }

  for (const [id, doc] of moduleState.searchDataMap) {
    const previous = oldSearch.get(id)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(doc)) {
      delta.search.updated.push(doc)
    }
  }
  for (const id of oldSearch.keys()) {
    if (!moduleState.searchDataMap.has(id)) {
      delta.search.deleted.push(id)
    }
  }

  return delta
}

/**
 * Creates the Vite plugin responsible for resolving and loading all
 * `virtual:boltdocs-*` modules. These virtual modules provide route data,
 * configuration, MDX components, layouts, icons, and search data to the client.
 */
export function createVirtualModulesPlugin(
  options: BoltdocsPluginOptions,
  getConfig: () => BoltdocsConfig,
  getViteConfig: () => ResolvedConfig | undefined,
  docsDir: string,
  runtime?: PluginRuntimeState,
  state?: VirtualModuleState,
): Plugin {
  const registry = runtime?.virtualModuleRegistry ?? virtualModuleRegistry
  const moduleState = getVirtualModuleState(state)
  return {
    name: 'vite-plugin-boltdocs-virtual-modules',

    resolveId(id) {
      const viteConfig = getViteConfig()
      const root = viteConfig?.root || process.cwd()
      if (
        id.includes('boltdocs-entry') ||
        id === 'virtual:boltdocs-entry' ||
        id === 'boltdocs/entry' ||
        id === 'boltdocs-entry' ||
        id === '\0virtual:boltdocs-entry' ||
        id === '\0virtual:boltdocs-entry.tsx'
      ) {
        return '\0virtual:boltdocs-entry.tsx'
      }
      if (
        id.includes('boltdocs-client') ||
        id === 'virtual:boltdocs-client' ||
        id === 'boltdocs/client' ||
        id === 'boltdocs-client' ||
        id === '\0virtual:boltdocs-client.mjs'
      ) {
        return '\0virtual:boltdocs-client.mjs'
      }

      // Plugin-registered virtual modules resolve to the Vite-internal
      // marker so Vite hands them to the `load` hook below without touching
      // the file system. We accept both the bare id and the `\0`-prefixed
      // form (Vite sometimes passes the resolved id back through resolveId).
      if (id.startsWith('\0')) {
        const cleanId = id.slice(1)
        if (
          !cleanId.startsWith('virtual:boltdocs-') &&
          registry?.has(cleanId)
        ) {
          return id
        }
      } else if (!id.startsWith('virtual:boltdocs-') && registry?.has(id)) {
        return '\0' + id
      }

      if (id.startsWith('virtual:boltdocs-')) {
        return '\0' + id
      }
      if (id.startsWith('\0virtual:boltdocs-')) {
        return id
      }

      return null
    },

    async load(id) {
      const config = getConfig()

      // Plugin-declared virtual modules take priority over the core
      // hard-coded list so plugins can shadow a specific `virtual:foo`
      // if they need to (only if their id does *not* start with
      // `virtual:boltdocs-`, which is reserved).
      const cleanId = id.startsWith('\0') ? id.slice(1) : id
      if (
        !cleanId.includes('boltdocs-entry.tsx') &&
        !cleanId.includes('boltdocs-client.mjs') &&
        !cleanId.startsWith('virtual:boltdocs-') &&
        registry?.has(cleanId)
      ) {
        const entry = registry?.get(cleanId)
        if (!entry) return null
        try {
          const code = await entry.loader()
          if (typeof code !== 'string') {
            throw new Error(
              `[boltdocs] Plugin virtual module '${cleanId}' loader must return a string source code, got ${typeof code}.`,
            )
          }
          return code
        } catch (err) {
          throw new Error(
            `[boltdocs] Plugin virtual module '${cleanId}' failed to load: ${
              err instanceof Error ? err.message : String(err)
            }`,
          )
        }
      }

      if (
        id.includes('boltdocs-entry.tsx') ||
        id === '\0virtual:boltdocs-entry'
      ) {
        const resolvedViteConfig = getViteConfig()
        return generateEntryCode(
          {
            ...options,
            ssr: Boolean(resolvedViteConfig?.build?.ssr),
            useCompiledPages: resolvedViteConfig?.command === 'build',
          },
          config,
        )
      }

      if (
        id.includes('boltdocs-client.mjs') ||
        id === '\0virtual:boltdocs-client.ts' ||
        id === 'virtual:boltdocs-client'
      ) {
        let currentDir = __dirname
        let packageRoot = currentDir
        while (currentDir !== path.parse(currentDir).root) {
          if (fs.existsSync(path.join(currentDir, 'package.json'))) {
            const pkg = JSON.parse(
              fs.readFileSync(path.join(currentDir, 'package.json'), 'utf-8'),
            )
            if (pkg.name === 'boltdocs') {
              packageRoot = currentDir
              break
            }
          }
          currentDir = path.dirname(currentDir)
        }

        const srcPath = path.join(packageRoot, 'src/client/index.ts')
        const distPath = path.join(packageRoot, 'dist/client/index.js')

        const filePath = fs.existsSync(srcPath) ? srcPath : distPath
        const normalized = normalizePath(filePath)
        return `export * from '${normalized}';`
      }

      if (!id.startsWith('\0virtual:boltdocs-')) return

      const nameWithExt = id.replace('\0virtual:boltdocs-', '')
      const name = nameWithExt.replace(/\.tsx?$/, '')

      if (name === 'routes') {
        await ensureRoutesGenerated(docsDir, config, moduleState)
        return serializeMapToExport(
          moduleState.routesDataMap,
          toClientRouteData,
        )
      }
      if (name === 'collections') {
        await ensureRoutesGenerated(docsDir, config, moduleState)
        const record = getCollectionsRecord(moduleState)
        return serializeCollectionsToExport(record)
      }
      if (name === 'config') {
        // Route generation discovers documents and meta.json in one crawl.
        // Reuse the same variant cache instead of performing a second metadata
        // crawl just to build the client config module.
        await ensureRoutesGenerated(docsDir, config, moduleState)
        const directoryMeta = moduleState.routeCacheVariant?.directoryMeta || {}
        moduleState.directoryMetaCache = directoryMeta
        const clientConfig = {
          base: config?.base,
          theme: config?.theme,
          i18n: config?.i18n,
          versions: config?.versions,
          siteUrl: config?.siteUrl,
          integrations: config?.integrations,
          collections: config?.collections,
          seo: config?.seo,
          experimental: config?.experimental,
          plugins: config?.plugins?.map((p) => ({ name: p.name })),
          directoryMeta,
        }
        return `export default ${JSON.stringify(clientConfig, null, 2)};`
      }
      if (name === 'entry') {
        const resolvedViteConfig = getViteConfig()
        return generateEntryCode(
          {
            ...options,
            ssr: Boolean(resolvedViteConfig?.build?.ssr),
            useCompiledPages: resolvedViteConfig?.command === 'build',
          },
          config,
        )
      }
      if (name === 'mdx-components') {
        const extensions = ['tsx', 'ts', 'jsx', 'js']
        let userMdxPath = null

        for (const ext of extensions) {
          const p = path.resolve(docsDir, `mdx-components.${ext}`)
          if (fs.existsSync(p)) {
            userMdxPath = p
            break
          }
        }

        // Aggregate components registered by plugins (e.g. Mermaid, Math, AskAI)
        const pluginComponents: Record<string, string> = {}
        if (config?.plugins) {
          for (const plugin of config.plugins) {
            if (plugin.components) {
              Object.assign(pluginComponents, plugin.components)
            }
          }
        }

        const pluginEntries = Object.entries(pluginComponents)
        const pluginImports = pluginEntries
          .map(
            ([_, compPath], idx) =>
              `import * as _pluginCompMod_${idx} from '${compPath}';`,
          )
          .join('\n')

        const pluginMapEntries = pluginEntries
          .map(
            ([compName], idx) =>
              `${JSON.stringify(compName)}: _pluginCompMod_${idx}[${JSON.stringify(
                compName,
              )}] || _pluginCompMod_${idx}["default"] || _pluginCompMod_${idx}`,
          )
          .join(',\n  ')

        if (userMdxPath) {
          const normalizedPath = normalizePath(userMdxPath)
          return `${pluginImports}
import * as components from '${normalizedPath}';
const userMdxComponents = components.default || components;
const mdxComponents = {
  ${pluginMapEntries}${pluginMapEntries ? ',' : ''}
  ...userMdxComponents,
};
export default mdxComponents;
export * from '${normalizedPath}';`
        }

        return `${pluginImports}
const mdxComponents = {
  ${pluginMapEntries}
};
export default mdxComponents;`
      }
      if (name === 'layout') {
        const extensions = ['tsx', 'jsx']
        let userLayoutPath = null

        for (const ext of extensions) {
          const p = path.resolve(docsDir, `layout.${ext}`)
          if (fs.existsSync(p)) {
            userLayoutPath = p
            break
          }
        }

        if (userLayoutPath) {
          const normalizedPath = normalizePath(userLayoutPath)
          return `import UserLayout from '${normalizedPath}';
export default UserLayout;`
        }

        throw new Error(
          `[Boltdocs] Layout file not found. A 'layout.tsx' or 'layout.jsx' file is mandatory in your docs directory. Please create one to define your site structure.`,
        )
      }

      if (name === 'icons') {
        const extensions = ['tsx', 'jsx', 'ts', 'js']
        let userIconsPath = null

        for (const ext of extensions) {
          const p = path.resolve(docsDir, `icons.${ext}`)
          if (fs.existsSync(p)) {
            userIconsPath = p
            break
          }
        }

        if (userIconsPath) {
          const normalizedPath = normalizePath(userIconsPath)
          return `import * as icons from '${normalizedPath}';\nexport default icons;`
        }

        return `export default {};`
      }

      if (name === 'search') {
        await ensureRoutesGenerated(docsDir, config, moduleState)
        // Serve search data as a runtime-fetched JSON asset so the large
        // document array is not embedded in the client JS bundle.
        return `export default async function fetchSearchData(options = {}) {
  const base = import.meta.env.BASE_URL || '/';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  const basePath = base.endsWith('/') ? base : base + '/';
  const url = new URL('search.json', new URL(basePath, origin));
  if (options.bustCache) url.searchParams.set('t', String(Date.now()));
  const res = await fetch(url, { cache: options.bustCache ? 'no-store' : 'default' });
  if (!res.ok) throw new Error('Failed to fetch search index');
  return res.json();
}`
      }

      if (name === 'client') {
        let currentDir = __dirname
        let clientPath = ''

        while (currentDir && currentDir !== path.parse(currentDir).root) {
          const srcPath = path.join(currentDir, 'src/client/index.ts')
          const distPath = path.join(currentDir, 'dist/client/index.mjs')
          const directPath = path.join(currentDir, 'client/index.ts')

          if (fs.existsSync(srcPath)) {
            clientPath = normalizePath(srcPath)
            break
          }
          if (fs.existsSync(distPath)) {
            clientPath = normalizePath(distPath)
            break
          }
          if (fs.existsSync(directPath)) {
            clientPath = normalizePath(directPath)
            break
          }
          currentDir = path.dirname(currentDir)
        }

        if (!clientPath) {
          throw new Error(
            `[boltdocs] Could not resolve boltdocs/client entry point starting from ${__dirname}`,
          )
        }

        return `export * from '${clientPath}';`
      }
    },
  }
}
