import type {
  RouteMeta,
  SearchDocument,
  BoltdocsConfig,
} from '../../shared/types'
import { PluginLifecycleManager } from './plugin-lifecycle'

/**
 * Extracts standard SearchDocument objects from RouteMeta array.
 */
export function createSearchDocuments(routes: RouteMeta[]): SearchDocument[] {
  return routes.map((route) => {
    const id = route.path || route.filePath
    return {
      id,
      path: route.path,
      title: route.title || '',
      content: route._content || route.excerpt || route.description || '',
      headings: route.headings || [],
      frontmatter: route.frontmatter || {},
      locale: route.locale,
      version: route.version,
    }
  })
}

/**
 * Executes the 'search:index' plugin lifecycle hook across all configured plugins.
 * Passes standardized SearchDocument[] to search engine plugins (FlexSearch, Pagefind, Algolia, Meilisearch).
 */
export async function executeSearchIndexHook(
  routes: RouteMeta[],
  config: BoltdocsConfig,
  docsDir: string,
  rootDir: string,
): Promise<unknown[]> {
  const plugins = config.plugins || []
  if (plugins.length === 0) return []

  const manager = new PluginLifecycleManager(
    plugins,
    config,
    docsDir,
    rootDir,
    routes,
  )

  if (!manager.hasHook('search:index')) return []

  // `runChain` already executes every registered search hook once, in plugin
  // order. Calling it once per plugin multiplied the whole chain by the number
  // of search-enabled plugins and could feed later plugins duplicate data.
  const result = await manager.runChain('search:index', {
    documents: createSearchDocuments(routes),
    routes,
  })
  return [result]
}
