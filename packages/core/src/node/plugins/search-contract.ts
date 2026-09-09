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
      content: route._content || route.excerpt || '',
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

  const documents = createSearchDocuments(routes)
  const results: unknown[] = []

  for (const plugin of plugins) {
    if (plugin.hooks?.['search:index']) {
      try {
        const res = await manager.runChain('search:index', {
          documents,
          routes,
        })
        results.push(res)
      } catch (err) {
        manager.hasHook('search:index')
      }
    }
  }

  return results
}
