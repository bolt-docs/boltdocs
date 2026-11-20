import type { PipelineStep } from '../index'
import type { BuildContext } from '../types'
import { warn } from '@bdocs/dui'

/**
 * Warns when the site has SEO configuration but no plugin to act on it.
 *
 * Until 4.0 the core wrote `sitemap.xml` and `robots.txt` itself, so every site
 * had them. The behaviour now lives in `@bdocs/plugin-seo`, and a site that
 * upgrades without adding it silently loses both files. Silent loss is the worst
 * outcome available here: the build still succeeds, and the problem surfaces
 * weeks later as search traffic that stopped.
 *
 * Warns only when there is something configured. A site that never set `siteUrl`,
 * `robots` or `seo` had no sitemap to lose, so warning would be noise.
 */
export class SeoMissingNoticeStep implements PipelineStep<BuildContext> {
  name = 'SeoMissingNotice'

  async execute(ctx: BuildContext): Promise<void> {
    const config = ctx.config
    if (!config) return

    const hasSeoPlugin = (config.plugins ?? []).some(
      (plugin) => plugin?.name === 'plugin-seo',
    )
    if (hasSeoPlugin) return

    const hasSeoIntent = Boolean(config.siteUrl || config.robots || config.seo)
    if (!hasSeoIntent) return

    warn(
      'No SEO plugin found: sitemap.xml and robots.txt will not be generated. ' +
        'Add `@bdocs/plugin-seo` to `plugins` in boltdocs.config.ts — ' +
        'the core stopped writing these files in 4.0.',
    )
  }
}
