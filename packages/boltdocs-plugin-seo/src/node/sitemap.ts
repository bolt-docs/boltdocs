import type { BoltdocsConfigContract, RouteMeta } from '@bdocs/contracts'

/**
 * Escapes a string for XML character data.
 *
 * Duplicated from the core rather than imported: core's copy is internal to its
 * `node/utils` module and is not part of the published API, and a 6-line
 * function is cheaper than widening core's public surface to share one.
 */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/**
 * Generates an XML sitemap listing every indexable documentation route.
 *
 * Returns an empty string when `siteUrl` is unset, since a sitemap of relative
 * paths is not something a crawler can use.
 */
export function generateSitemap(
  routes: readonly RouteMeta[],
  config: BoltdocsConfigContract,
): string {
  const siteUrl = (config.siteUrl || '').replace(/\/$/, '')
  if (!siteUrl) return ''

  // A private indexing policy hides the whole site in robots.txt, not here.
  // The sitemap filters per route via `noindex`, which is why `indexing` is not
  // consulted here.

  const urls = routes
    .filter((route) => {
      const seo = route.seo as Record<string, unknown> | undefined
      if (seo?.noindex) return false
      if (typeof seo?.robots === 'string' && seo.robots.includes('noindex')) {
        return false
      }
      // A private indexing policy hides the whole site in robots.txt but does
      // not empty the sitemap: routes stay listed unless they opt out with
      // `noindex`. Both branches returning true is deliberate, not dead code.
      return true
    })
    .map((route) => {
      // Normalize before sorting so the sitemap does not depend on the order
      // routes were discovered in.
      const path = route.path.startsWith('/') ? route.path : `/${route.path}`
      return `${siteUrl}${path}`
    })
    .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))
    .map(
      (url) => `  <url>
    <loc>${escapeXml(url)}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`,
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`
}
