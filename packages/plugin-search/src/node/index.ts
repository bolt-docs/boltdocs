/**
 * `@bdocs/plugin-search`
 *
 * Generates the `search.json` asset from route metadata. What a document *is*
 * lives here; what indexes or queries it belongs to the engine a site chooses.
 *
 * ```ts
 * import search from '@bdocs/plugin-search'
 *
 * export default defineConfig({
 *   plugins: [search()],
 * })
 * ```
 *
 * Without this plugin the build emits no `search.json` and warns once. That is
 * the whole point of the split: the core no longer ships a search engine it
 * cannot know a site wants.
 */

import type { BoltdocsPlugin } from 'boltdocs'
import type { SearchIndexParams } from '@bdocs/contracts'
import { generateSearchData } from './generate'

export {
  generateSearchData,
  SEARCH_HEADING_LIMIT,
  SEARCH_PAGE_CONTENT_LIMIT,
  SEARCH_PAGE_SECTION_BUDGET,
  SEARCH_SECTION_CONTENT_LIMIT,
  type SearchDocument,
} from './generate'

export interface SearchPluginOptions {
  /**
   * Disable generation while keeping the plugin configured.
   *
   * For a site that builds `search.json` in a separate step, or that consumes
   * the documents through another engine plugin rather than the default one.
   */
  enabled?: boolean
}

export default function searchPlugin(
  options: SearchPluginOptions = {},
): BoltdocsPlugin {
  const { enabled = true } = options
  return {
    name: 'plugin-search',
    version: '1.0.0',
    hooks: {
      /**
       * Registration happens here rather than through a static import of
       * `boltdocs/node/search`.
       *
       * A static import resolves to this package's **built** copy of the
       * registry, while the core reads its **source** copy — two module
       * instances, one empty registry, and a site that configured the plugin
       * and still got no `search.json`. Reaching the registry through the core
       * itself is what makes both sides the same instance again.
       *
       * The hook fires after route generation and before the SSG render, which
       * is the window in which `virtual:boltdocs-search` has not been
       * resolved yet.
       */
      async 'build:routes'(ctx: { routes?: unknown[] }) {
        if (!enabled) return
        const registry = await import('boltdocs/node/search')
        registry.registerSearchGenerator((routes) =>
          generateSearchData(
            routes as Parameters<typeof generateSearchData>[0],
          ),
        )
      },

      /**
       * The default engine's contribution to `search.json`.
       *
       * This plugin is the fallback, not an owner: a site that configures
       * Algolia or Pagefind wants that engine's index, and this hook is how it
       * says so. Returning `undefined` for `entries` is the explicit form of
       * "leave the asset alone" — the framework reads the field rather than
       * inferring intent from an absent return value, so a site with both
       * plugins configured publishes the engine's index and nothing stale.
       *
       * The hook fires before `SearchNotice`, so the notice reflects the state
       * after every engine has had its say.
       */
      async 'search:index'(
        _ctx: unknown,
        params: SearchIndexParams,
      ): Promise<SearchIndexParams | undefined> {
        if (!enabled) return undefined
        // Only the default entries are contributed here. An engine that set its
        // own entries has already done so, and publishing the generated ones
        // alongside would mix two index shapes in one asset.
        if (params.entries) return undefined

        return {
          ...params,
          entries: generateSearchData(params.routes as never),
        }
      },
    },
  }
}
