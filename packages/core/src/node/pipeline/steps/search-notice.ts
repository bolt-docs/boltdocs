import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { hasSearchGenerator } from '../../search/registry'
import { info } from '@bdocs/dui'

/**
 * Reports the absence of a search plugin.
 *
 * Until 4.0 the core generated `search.json` itself, so every site had one and
 * the built-in search dialog worked. The generator now lives in
 * `@bdocs/plugin-search`, registered through a registry so the core can stay
 * free of it — the coupling the 4.0 roadmap named when it listed Search among
 * the integrations `@bdocs/core-node` must not import.
 *
 * This is `info`, not `warn`, and the difference is deliberate. Losing an SEO
 * plugin costs `sitemap.xml` and `robots.txt`, which nothing tells a user about
 * until search traffic stops arriving weeks later. Losing the search plugin
 * costs a search dialog that returns nothing — immediately visible, and a
 * deliberate choice for a site that never wanted one. Escalating it would train
 * people to ignore build output, which is what the SEO notice already risks on
 * sites that legitimately configure nothing.
 */
export class SearchNoticeStep implements PipelineStep<BuildContext> {
  name = 'SearchNotice'

  async execute(ctx: BuildContext): Promise<void> {
    if (hasSearchGenerator()) return

    info(
      'No search plugin found: search.json will not be generated. ' +
        'Add `@bdocs/plugin-search` to `plugins` in boltdocs.config.ts ' +
        'if this site should have a search index.',
    )
  }
}
