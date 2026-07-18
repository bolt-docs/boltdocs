import { createPlugin } from 'boltdocs'
import { RssPluginOptionsSchema, type RssPluginOptions } from './feed-schema'
import {
  generateRssXml,
  generateAtomXml,
  type FeedConfig,
} from './feed-generator'
import { writeFeed } from './write-feed'
import {
  getLocales,
  getLocalizedDescription,
  getLocalizedTitle,
  getSiteTitle,
} from './helpers'

export type { RssPluginOptions }

export default function rssPlugin(options: RssPluginOptions = {}) {
  const opts = RssPluginOptionsSchema.parse(options)

  return createPlugin({
    name: 'boltdocs-plugin-rss',
    version: '0.1.0',
    hooks: {
      async afterBuild(ctx) {
        const siteUrl = ctx.config.siteUrl
        if (!siteUrl) {
          ctx.diagnostics.report(
            'warn',
            'RSS_MISSING_SITE_URL',
            'RSS feed not generated: siteUrl is not configured in boltdocs.config.ts',
          )
          return
        }

        const outDir = ctx.outDir
        const filteredRoutes = ctx.routes
          .filter((route) => !route.draft)
          .filter((route) => {
            if (!opts.paths) return true
            return opts.paths.some((p) => route.path.startsWith(p))
          })
          .filter((route) => {
            if (!opts.collections) return true
            return opts.collections.includes(route.collection ?? '')
          })
          .sort((a, b) => {
            const dateA = new Date(a.date ?? a.lastUpdated ?? 0)
            const dateB = new Date(b.date ?? b.lastUpdated ?? 0)
            return dateB.getTime() - dateA.getTime()
          })

        const limited = opts.limit
          ? filteredRoutes.slice(0, opts.limit)
          : filteredRoutes

        const siteTitle = getSiteTitle(ctx.config)
        const locales = getLocales(ctx.config)

        // In-memory cache with 30s TTL to avoid regenerating identical
        // feeds on every HMR-triggered afterBuild call.
        const cache = ctx.caches.memory<string>('rss', { ttl: 30_000 })

        for (const locale of locales) {
          const localeRoutes = limited.filter((r) => {
            const routeLocale = r.locale
            return routeLocale === locale
          })

          const title = getLocalizedTitle(ctx.config, locale, siteTitle)
          const description = getLocalizedDescription(ctx.config, locale)

          const feedConfig: FeedConfig = {
            title,
            description,
            siteUrl,
            language: locale,
            locale,
          }

          if (opts.format === 'rss' || opts.format === 'both') {
            const cacheKey = `rss-${locale}`
            let xml = cache.get(cacheKey)
            if (!xml) {
              xml = generateRssXml(feedConfig, localeRoutes)
              cache.set(cacheKey, xml)
            }
            writeFeed({
              filename: `rss/rss-${locale}.xml`,
              generateXml: () => xml ?? '',
              label: 'RSS',
              logger: ctx.logger.info,
              outDir,
            })
          }

          if (opts.format === 'atom' || opts.format === 'both') {
            const cacheKey = `atom-${locale}`
            let xml = cache.get(cacheKey)
            if (!xml) {
              xml = generateAtomXml(feedConfig, localeRoutes)
              cache.set(cacheKey, xml)
            }
            writeFeed({
              filename: `rss/atom-${locale}.xml`,
              generateXml: () => xml ?? '',
              label: 'Atom',
              logger: ctx.logger.info,
              outDir,
            })
          }
        }
      },

      transformHtml(ctx, { html, route }) {
        if (!ctx.config.siteUrl) return { html }

        const locale = route?.locale ?? 'en'
        const siteUrl = ctx.config.siteUrl.replace(/\/$/, '')
        const feedType = opts.format === 'atom' ? 'atom' : 'rss'
        const feedFile =
          feedType === 'atom' ? `atom-${locale}.xml` : `rss-${locale}.xml`
        const linkType =
          feedType === 'atom' ? 'application/atom+xml' : 'application/rss+xml'
        const linkTag = `  <link rel="alternate" type="${linkType}" title="RSS Feed" href="${siteUrl}/rss/${feedFile}"/>\n</head>`

        return {
          html: html.replace('</head>', linkTag),
        }
      },
    },
  })
}
