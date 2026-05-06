import type { BoltdocsConfig } from '../config'

/**
 * Generates a standard robots.txt file for the documentation site.
 *
 * @param config - The Boltdocs configuration containing the site URL.
 * @returns The contents of the robots.txt file.
 */
export function generateRobotsTxt(config: BoltdocsConfig): string {
  const siteUrl = config.siteUrl || ''
  const sitemapUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}/sitemap.xml` : ''

  const isPrivate =
    config.seo?.indexing !== 'all' && config.seo?.indexing !== 'public'

  if (isPrivate && config.seo?.indexing) {
    return ['User-agent: *', 'Disallow: /'].filter(Boolean).join('\n')
  }

  // Support advanced robots configurations
  if (typeof config.robots === 'string') {
    return config.robots
  } else if (config.robots && typeof config.robots === 'object') {
    const rules = config.robots.rules || []
    const sitemaps = config.robots.sitemaps || []

    const robotsContent = rules
      .map((rule) => {
        let r = `User-agent: ${rule.userAgent}\n`
        if (rule.allow) {
          if (Array.isArray(rule.allow))
            r += rule.allow.map((a) => `Allow: ${a}`).join('\n') + '\n'
          else r += `Allow: ${rule.allow}\n`
        }
        if (rule.disallow) {
          if (Array.isArray(rule.disallow))
            r += rule.disallow.map((d) => `Disallow: ${d}`).join('\n') + '\n'
          else r += `Disallow: ${rule.disallow}\n`
        }
        return r.trim()
      })
      .join('\n\n')

    const allSitemaps = [...(sitemapUrl ? [sitemapUrl] : []), ...sitemaps]
    const sitemapsContent = allSitemaps.map((s) => `Sitemap: ${s}`).join('\n')

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
