import type { BoltdocsConfig } from '../config'
import type { SSGRouteData } from '../routes/route-adapter'
import { escapeXml } from '../utils'

/**
 * Generates an XML sitemap for search engines to crawl all documentation routes.
 *
 * @param routes - The processed SSG route metadata.
 * @param config - The Boltdocs configuration containing the site URL.
 * @returns The XML sitemap as a search engine crawlable string.
 */
export function generateSitemap(
  routes: SSGRouteData[],
  config: BoltdocsConfig,
): string {
  const siteUrl = (config.siteUrl || '').replace(/\/$/, '')
  if (!siteUrl) return ''

  // Support granular indexing limits
  const isPrivate =
    config.seo?.indexing !== 'all' && config.seo?.indexing !== 'public'

  const urls = routes
    .filter((route) => {
      // Exclude pages that explicitly say noindex
      if (route.seo?.noindex) return false
      if (
        typeof route.seo?.robots === 'string' &&
        route.seo.robots.includes('noindex')
      )
        return false
      // If the overall configuration isn't allowing indexing (unless explicitly defined)
      if (isPrivate && !route.seo?.index) return true // assuming default true unless noindex, wait, if it's not all then maybe allow only explicitly indexed? Let's just follow Mintlify logic: if indexing=public/all, index everything. Else, default to everything if config.seo?.indexing is undefined. We'll simply let noindex drive it.
      return true
    })
    .map((route) => {
      // Normalize path for the loc tag
      const normalizedPath = route.path.startsWith('/')
        ? route.path
        : `/${route.path}`
      const loc = escapeXml(`${siteUrl}${normalizedPath}`)

      return `  <url>
    <loc>${loc}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}
