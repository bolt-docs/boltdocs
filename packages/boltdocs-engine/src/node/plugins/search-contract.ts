import type {
  BoltdocsConfig,
  RouteMeta,
  SearchDocument,
  SearchIndexEntry,
  SearchIndexParams,
} from '../../shared/types'
import { PluginLifecycleManager } from './plugin-lifecycle'

/**
 * Entries an engine plugin wants published as `search.json`, or `null` when no
 * engine claimed the asset.
 */
export type SearchIndexEntries = SearchIndexEntry[] | null

/**
 * Search index orchestration.
 *
 * Runs the `search:index` hook, which is the seam between "the framework knows
 * your pages" and "somebody builds an index out of them". FlexSearch consumes
 * the published asset, Algolia pushes records to a remote index, Pagefind
 * indexes the built HTML after the render — three genuinely different jobs,
 * one input.
 *
 * Nothing here knows an engine exists.
 */

/**
 * Flatten routes into the engine-facing document shape.
 *
 * Uses `SearchDocument` from `@bdocs/contracts` rather than declaring a local
 * copy: an engine plugin compiles against that type, and a second definition
 * here would be free to drift from the one it was handed.
 */
export function createSearchDocuments(routes: RouteMeta[]): SearchDocument[] {
  return routes.map((route) => ({
    id: route.path || route.filePath,
    path: route.path,
    title: route.title || '',
    content: route._content || route.excerpt || route.description || '',
    headings: route.headings || [],
    frontmatter: route.frontmatter || {},
    locale: route.locale,
    version: route.version,
  }))
}

/**
 * Fire `search:index` and report what the engine plugins produced.
 *
 * `entries` is populated only when a plugin returned them. An engine that
 * builds its own index returns `undefined` for that field, which is how it says
 * "do not publish `search.json`" — the alternative, publishing an asset no
 * client will read, is the failure mode this shape exists to avoid.
 */
export async function executeSearchIndexHook(
  routes: RouteMeta[],
  config: BoltdocsConfig,
  docsDir: string,
  rootDir: string,
): Promise<SearchIndexEntries> {
  const plugins = config.plugins || []
  if (plugins.length === 0) return null

  const manager = new PluginLifecycleManager(
    plugins,
    config,
    docsDir,
    rootDir,
    routes,
  )
  if (!manager.hasHook('search:index')) return null

  // `runChain` executes every registered `search:index` once, in plugin order,
  // threading `params` through. Calling it once per plugin multiplied the whole
  // chain by the number of search-enabled plugins and fed later plugins
  // duplicate data.
  const params: SearchIndexParams = {
    documents: createSearchDocuments(routes),
    routes,
  }

  const result = await manager.runChain('search:index', params)
  return result?.entries ?? null
}
