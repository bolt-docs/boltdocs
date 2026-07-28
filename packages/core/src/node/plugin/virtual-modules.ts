import type { Plugin, ResolvedConfig } from 'vite'
import { generateRoutes } from '../routes'
import { adaptRoutesForSSG, type SSGRouteData } from '../routes/route-adapter'
import { normalizePath } from '../utils'
import { generateSearchData, type SearchDocument } from '../search'
import { virtualModuleRegistry } from '../plugins/plugin-context'
import type { BoltdocsConfig } from '../config'
import type { BoltdocsPluginOptions } from './types'
import { generateEntryCode } from './entry'
import path from 'node:path'
import fs from 'node:fs'
let _directoryMetaCache: Record<string, unknown> | null = null

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

// Per-route / per-item in-memory caches for virtual module data. These keep
// the generated values keyed so the dev server can compute delta patches for
// HMR instead of regenerating monolithic modules every time.
const _routesDataMap = new Map<string, SSGRouteData>()
const _collectionsDataMap = new Map<string, CollectionPost>()
const _searchDataMap = new Map<string, SearchDocument>()

export interface RouteDeltaPayload {
  updated: SSGRouteData[]
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
export function invalidateDirectoryMetaCache(): void {
  _directoryMetaCache = null
  _routesDataMap.clear()
  _collectionsDataMap.clear()
  _searchDataMap.clear()
}

function clearVirtualData(): void {
  _routesDataMap.clear()
  _collectionsDataMap.clear()
  _searchDataMap.clear()
}

async function regenerateRouteData(
  docsDir: string,
  config: BoltdocsConfig,
): Promise<void> {
  const routes = await generateRoutes(docsDir, config)
  const ssgRoutes = adaptRoutesForSSG(routes)

  _routesDataMap.clear()
  for (const route of ssgRoutes) {
    _routesDataMap.set(route.path, route)
  }

  regenerateSearchAndCollections()
}

function regenerateSearchAndCollections(): void {
  const routes = Array.from(_routesDataMap.values())

  const searchData = generateSearchData(routes as any)
  _searchDataMap.clear()
  for (const doc of searchData) {
    _searchDataMap.set(doc.id, doc)
  }

  _collectionsDataMap.clear()
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
      _collectionsDataMap.set(route.filePath, post)
    }
  }
}

async function ensureRoutesGenerated(
  docsDir: string,
  config: BoltdocsConfig,
): Promise<void> {
  if (_routesDataMap.size === 0) {
    await regenerateRouteData(docsDir, config)
  }
}

function getCollectionsRecord(): Record<string, CollectionPost[]> {
  const record: Record<string, CollectionPost[]> = {}
  for (const post of _collectionsDataMap.values()) {
    const collection = post.collection
    if (!collection) continue
    if (!record[collection]) record[collection] = []
    record[collection].push(post)
  }
  return record
}

function serializeMapToExport<T>(map: Map<string, T>): string {
  return `export default ${JSON.stringify(Array.from(map.values()), null, 2)};`
}

/** Export the current search document cache as a plain array. */
export function getSearchDataExport(): SearchDocument[] {
  return Array.from(_searchDataMap.values())
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
): Promise<FrontmatterDeltaPayload> {
  const oldRoutes = new Map(_routesDataMap)
  const oldCollections = new Map(_collectionsDataMap)
  const oldSearch = new Map(_searchDataMap)

  await regenerateRouteData(docsDir, config)

  const delta: FrontmatterDeltaPayload = {
    routes: { updated: [], deleted: [] },
    collections: { updated: [], deleted: [] },
    search: { updated: [], deleted: [] },
  }

  for (const [routePath, route] of _routesDataMap) {
    const previous = oldRoutes.get(routePath)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(route)) {
      delta.routes.updated.push(route)
    }
  }
  for (const routePath of oldRoutes.keys()) {
    if (!_routesDataMap.has(routePath)) {
      delta.routes.deleted.push(routePath)
    }
  }

  for (const [filePath, post] of _collectionsDataMap) {
    const previous = oldCollections.get(filePath)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(post)) {
      delta.collections.updated.push(post)
    }
  }
  for (const filePath of oldCollections.keys()) {
    if (!_collectionsDataMap.has(filePath)) {
      delta.collections.deleted.push(filePath)
    }
  }

  for (const [id, doc] of _searchDataMap) {
    const previous = oldSearch.get(id)
    if (!previous || JSON.stringify(previous) !== JSON.stringify(doc)) {
      delta.search.updated.push(doc)
    }
  }
  for (const id of oldSearch.keys()) {
    if (!_searchDataMap.has(id)) {
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
): Plugin {
  return {
    name: 'vite-plugin-boltdocs-virtual-modules',

    resolveId(id) {
      const viteConfig = getViteConfig()
      const root = viteConfig?.root || process.cwd()
      if (
        id.includes('boltdocs-entry.tsx') ||
        id === 'virtual:boltdocs-entry' ||
        id === 'boltdocs-entry' ||
        id === '\0virtual:boltdocs-entry'
      ) {
        return normalizePath(path.resolve(root, 'boltdocs-entry.tsx'))
      }
      if (
        id.includes('boltdocs-client.mjs') ||
        id === 'virtual:boltdocs-client' ||
        id === 'boltdocs-client' ||
        id === '\0virtual:boltdocs-client.ts'
      ) {
        return normalizePath(path.resolve(root, 'boltdocs-client.mjs'))
      }

      // Plugin-registered virtual modules resolve to the Vite-internal
      // marker so Vite hands them to the `load` hook below without touching
      // the file system. We accept both the bare id and the `\0`-prefixed
      // form (Vite sometimes passes the resolved id back through resolveId).
      if (id.startsWith('\0')) {
        const cleanId = id.slice(1)
        if (
          !cleanId.startsWith('virtual:boltdocs-') &&
          virtualModuleRegistry.has(cleanId)
        ) {
          return id
        }
      } else if (
        !id.startsWith('virtual:boltdocs-') &&
        virtualModuleRegistry.has(id)
      ) {
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
        virtualModuleRegistry.has(cleanId)
      ) {
        const entry = virtualModuleRegistry.get(cleanId)
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
        return generateEntryCode(options, config)
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
        await ensureRoutesGenerated(docsDir, config)
        return serializeMapToExport(_routesDataMap)
      }
      if (name === 'collections') {
        await ensureRoutesGenerated(docsDir, config)
        const record = getCollectionsRecord()
        return serializeCollectionsToExport(record)
      }
      if (name === 'config') {
        // Use cached directory meta to avoid a full fdir crawl on every request.
        // The cache is invalidated by the dev-server watcher on add/unlink events.
        if (_directoryMetaCache === null) {
          const { loadDirectoryMeta } = await import('../routes/meta-loader')
          _directoryMetaCache = await loadDirectoryMeta(docsDir)
        }
        const directoryMeta = _directoryMetaCache
        const clientConfig = {
          base: config?.base,
          theme: config?.theme,
          i18n: config?.i18n,
          versions: config?.versions,
          siteUrl: config?.siteUrl,
          integrations: config?.integrations,
          plugins: config?.plugins?.map((p) => ({ name: p.name })),
          directoryMeta,
        }
        return `export default ${JSON.stringify(clientConfig, null, 2)};`
      }
      if (name === 'entry') {
        const code = generateEntryCode(options, config)
        return code
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
              `import _pluginComp_${idx} from '${compPath}';`,
          )
          .join('\n')

        const pluginMapEntries = pluginEntries
          .map(
            ([compName], idx) =>
              `${JSON.stringify(compName)}: _pluginComp_${idx}`,
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
        await ensureRoutesGenerated(docsDir, config)
        // Serve search data as a runtime-fetched JSON asset so the large
        // document array is not embedded in the client JS bundle.
        return `export default async function fetchSearchData() {
  const base = import.meta.env.BASE_URL || '/';
  const url = new URL('search.json', base).toString();
  const res = await fetch(url);
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
