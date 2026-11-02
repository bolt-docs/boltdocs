import type { BoltdocsConfigContract } from '@bdocs/contracts'

/**
 * Generates `robots.txt` for the documentation site.
 *
 * Three shapes, in priority order:
 * - `seo.indexing` set to anything other than public/all emits a blanket
 *   `Disallow: /`, because that is an explicit request not to be crawled.
 * - `robots` as a string is passed through untouched.
 * - `robots` as an object is serialized rule by rule.
 */
export function generateRobotsTxt(config: BoltdocsConfigContract): string {
  const siteUrl = config.siteUrl || ''
  const sitemapUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}/sitemap.xml` : ''

  const isPrivate =
    config.seo?.indexing !== 'all' && config.seo?.indexing !== 'public'

  if (isPrivate && config.seo?.indexing) {
    return ['User-agent: *', 'Disallow: /'].filter(Boolean).join('\n')
  }

  if (typeof config.robots === 'string') {
    return config.robots
  }

  if (config.robots && typeof config.robots === 'object') {
    const rules = config.robots.rules || []
    const sitemaps = config.robots.sitemaps || []

    const robotsContent = rules
      .map((rule) => {
        let entry = `User-agent: ${rule.userAgent}\n`
        if (rule.allow) {
          entry +=
            (Array.isArray(rule.allow) ? rule.allow : [rule.allow])
              .map((value) => `Allow: ${value}`)
              .join('\n') + '\n'
        }
        if (rule.disallow) {
          entry +=
            (Array.isArray(rule.disallow) ? rule.disallow : [rule.disallow])
              .map((value) => `Disallow: ${value}`)
              .join('\n') + '\n'
        }
        return entry.trim()
      })
      .join('\n\n')

    // Deduplicate: a site that lists its own sitemap under `robots.sitemaps`
    // used to get it emitted twice, once from the implicit entry and once from
    // the explicit list. A repeated `Sitemap:` line is at best noise and at
    // worst a parser error for strict crawlers.
    const allSitemaps = [
      ...new Set([...(sitemapUrl ? [sitemapUrl] : []), ...sitemaps]),
    ]
    const sitemapsContent = allSitemaps
      .map((url) => `Sitemap: ${url}`)
      .join('\n')

    return `${robotsContent}${sitemapsContent ? `\n\n${sitemapsContent}` : ''}`
  }

  return [
    'User-agent: *',
    'Allow: /',
    '',
    sitemapUrl ? `Sitemap: ${sitemapUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
