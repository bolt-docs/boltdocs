import { Pipeline } from './index'
import type { BuildContext } from './types'
import { ConfigResolveStep } from './steps/config-resolve'
import { RouteGenerateStep } from './steps/route-generate'
import { RoutesEnrichStep } from './steps/routes-enrich'
import { TypeGenerateStep } from './steps/type-generate'
import { SSGBuildStep } from './steps/ssg-build'
import { RedirectsWriteStep } from './steps/redirects-write'
import { GenerateStep } from './steps/generate'
import { SeoMissingNoticeStep } from './steps/seo-missing-notice'
import { SearchNoticeStep } from './steps/search-notice'
import { SearchIndexStep } from './steps/search-index'

/**
 * Creates the build pipeline for a Boltdocs site.
 *
 * The order is load-bearing in two places:
 *
 * - `RoutesEnrich` sits between route generation and the SSG render. It fires
 *   the plugin `build:routes` hook, the only window in which a plugin can still
 *   influence what gets rendered.
 * - `Generate` runs after the SSG build, when output files exist, and fires
 *   `build:generate` for artifacts like feeds and sitemaps.
 *
 * SEO itself is no longer here: `sitemap.xml`, `robots.txt` and route SEO
 * enrichment moved to `@bdocs/plugin-seo` in 4.0. Search likewise: `search.json`
 * is produced by `@bdocs/plugin-search`, which registers a generator rather than
 * being imported here — a direct dependency would be a cycle and would make
 * search mandatory for every site.
 *
 * `SearchNotice` runs *after* `RoutesEnrich`, which is the step that fires the
 * `build:routes` hook the search plugin registers in. Placing it earlier
 * reports a missing plugin for a site that configured one — the step order is
 * the whole difference between an accurate notice and a false alarm on every
 * build.
 */
export function createBuildPipeline(): Pipeline<BuildContext> {
  return (
    new Pipeline<BuildContext>()
      .addStep(new ConfigResolveStep())
      .addStep(new RouteGenerateStep())
      .addStep(new SeoMissingNoticeStep())
      .addStep(new RoutesEnrichStep())
      .addParallelSteps([new TypeGenerateStep()])
      // Fires `search:index` for engine plugins. After the routes are settled and
      // before the render, so an engine that only needs metadata (Algolia) is
      // finished inside the build rather than after it.
      .addStep(new SearchIndexStep())
      .addStep(new SearchNoticeStep())
      .addStep(new SSGBuildStep())
      .addParallelSteps([new RedirectsWriteStep(), new GenerateStep()])
  )
}
