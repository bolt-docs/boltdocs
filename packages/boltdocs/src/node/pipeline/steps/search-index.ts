import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { setSearchEntries } from '../../search/registry'

/**
 * Fires the plugin `search:index` hook.
 *
 * This is the seam between "the framework knows your pages" and "somebody builds
 * an index out of them". FlexSearch consumes the published asset, Algolia pushes
 * records to a remote index, Pagefind indexes the built HTML after the render —
 * three genuinely different jobs, one input.
 *
 * It runs after `RoutesEnrich` (routes exist and plugins have seen them) and
 * after `TypeGenerate` but before `SSGBuild`. The position before the render is
 * what lets an engine that only needs metadata — Algolia — finish inside the
 * build rather than after it.
 *
 * ## Why the hook is fired here and not by the search plugin
 *
 * `@bdocs/plugin-search` registers a *default* generator: the one that produces
 * the plain `search.json` the built-in dialog reads. An engine plugin overrides
 * it by returning its own `entries` from `search:index`. Firing the hook from
 * the pipeline means the decision of which generator wins is made once, in one
 * place, instead of by whichever plugin happened to register last.
 */
export class SearchIndexStep implements PipelineStep<BuildContext> {
  name = 'SearchIndex'

  async execute(ctx: BuildContext): Promise<void> {
    if (!ctx.routes?.length) return
    if (!ctx.config) return

    const plugins = ctx.config.plugins ?? []
    const hasEngine = plugins.some((p) => {
      const hooks = p?.hooks as Record<string, unknown> | undefined
      return typeof hooks?.['search:index'] === 'function'
    })
    if (!hasEngine) return

    const { executeSearchIndexHook } = await import(
      '../../plugins/search-contract'
    )
    const entries = await executeSearchIndexHook(
      ctx.routes,
      ctx.config,
      ctx.docsDir || `${ctx.root}/docs`,
      ctx.root,
    )

    // `null` means an engine took over and produces its own index. Only a
    // non-null result replaces the published asset, so an engine plugin cannot
    // leave `search.json` half-written by omitting a field.
    if (entries) setSearchEntries(entries)

    // The routes module was built before this step ran, so its search cache
    // still holds whatever the default generator produced — or nothing at all,
    // when the generator only registered during `build:routes`. Refreshing here
    // is what makes the entries the hook chose the ones the client bundle emits.
    const { regenerateSearchAndCollections } = await import(
      '../../plugin/virtual-modules'
    )
    regenerateSearchAndCollections()
  }
}
