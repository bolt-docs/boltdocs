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
 * enrichment moved to `@bdocs/plugin-seo` in 4.0.
 */
export function createBuildPipeline(): Pipeline<BuildContext> {
  return new Pipeline<BuildContext>()
    .addStep(new ConfigResolveStep())
    .addStep(new RouteGenerateStep())
    .addStep(new SeoMissingNoticeStep())
    .addStep(new RoutesEnrichStep())
    .addParallelSteps([new TypeGenerateStep()])
    .addStep(new SSGBuildStep())
    .addParallelSteps([new RedirectsWriteStep(), new GenerateStep()])
}
