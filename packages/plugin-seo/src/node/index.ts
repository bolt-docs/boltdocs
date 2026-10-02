import type { BoltdocsPlugin, PluginContext, RouteMeta } from 'boltdocs'
import type { BoltdocsConfigContract } from '@bdocs/contracts'
import { generateSitemap } from './sitemap'
import { generateRobotsTxt } from './robots'
import { enrichRouteSeo } from './enrich'
import { writeSeoArtifacts } from './artifacts'

export { generateSitemap } from './sitemap'
export { generateRobotsTxt } from './robots'
export { enrichRouteSeo, RouteSeoSchema } from './enrich'
export { writeSeoArtifacts } from './artifacts'

// The JSON-LD factories are not re-exported here. They are pure builders with no
// framework dependency, so they live in `@bdocs/contracts` and both `boltdocs`
// and `boltdocs/client` keep re-exporting them from there. Reaching them through
// this plugin would make the plugin look like the only way to use them.
export {
  createArticleStructuredData,
  createBreadcrumbStructuredData,
  createStructuredData,
  createWebSiteStructuredData,
  defineStructuredData,
} from '@bdocs/contracts'
export type {
  ArticleStructuredDataOptions,
  BreadcrumbStructuredDataItem,
  StructuredDataFactoryOptions,
  WebSiteStructuredDataOptions,
} from '@bdocs/contracts'

/**
 * Sitemap, robots.txt and per-route SEO metadata.
 *
 * Register it in `boltdocs.config.ts`:
 *
 * ```ts
 * import seo from '@bdocs/plugin-seo'
 *
 * export default defineConfig({
 *   siteUrl: 'https://example.com',
 *   plugins: [seo()],
 * })
 * ```
 *
 * Two hooks, because SEO has two jobs that happen at different points in the
 * build:
 *
 * - `build:routes` resolves `canonical`, `og:url` and `og:image` on every route.
 *   It has to run before the SSG render, since the client `Head` reads these
 *   while rendering.
 * - `build:generate` writes `sitemap.xml` and `robots.txt`, which need the
 *   output directory to already exist.
 *
 * Until 4.0 the core did both of these itself and required no configuration.
 */
export function seo(): BoltdocsPlugin {
  return {
    name: 'plugin-seo',
    version: '1.0.0',
    hooks: {
      'build:routes'(ctx: PluginContext, params: { routes: RouteMeta[] }) {
        enrichRouteSeo(
          params.routes,
          ctx.config as BoltdocsConfigContract,
          (message) => ctx.logger.warn(message),
        )
      },

      async 'build:generate'(
        ctx: PluginContext,
        params: { routes: RouteMeta[]; outDir: string },
      ) {
        writeSeoArtifacts(
          params.routes,
          ctx.config as BoltdocsConfigContract,
          params.outDir,
          (message) => ctx.logger.warn(message),
        )
      },
    },
  }
}

export default seo
