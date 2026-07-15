import fs from 'node:fs'
import type { BoltdocsPlugin } from 'boltdocs'
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

export default function rssPlugin(
  options: RssPluginOptions = {},
): BoltdocsPlugin {
  const opts = RssPluginOptionsSchema.parse(options)

  return {
    name: 'boltdocs-plugin-rss',
    version: '0.1.0',
    hooks: {
      async afterBuild(ctx) {
        const siteUrl = ctx.config.siteUrl
        if (!siteUrl) {
          ctx.logger.warn(
            'RSS feed not generated: siteUrl is not configured in boltdocs.config.ts',
          )
          return
        }

        const outDir = ctx.outDir
        if (!fs.existsSync(outDir)) {
          ctx.logger.warn(
            `RSS feed not generated: output directory not found at ${outDir}`,
          )
          return
        }

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

        const siteTitle = getSiteTitle(ctx)
        const locales = getLocales(ctx)

        for (const locale of locales) {
          const localeRoutes = limited.filter((r) => {
            const routeLocale = r.locale
            return routeLocale === locale
          })

          const title = getLocalizedTitle(ctx, locale, siteTitle)
          const description = getLocalizedDescription(ctx, locale)

          const feedConfig: FeedConfig = {
            title,
            description,
            siteUrl,
            language: locale,
            locale,
          }

          if (opts.format === 'rss' || opts.format === 'both') {
            writeFeed({
              filename: `rss/rss-${locale}.xml`,
              generateXml: () => generateRssXml(feedConfig, localeRoutes),
              label: 'RSS',
              logger: ctx.logger.info,
              outDir,
            })
          }

          if (opts.format === 'atom' || opts.format === 'both') {
            writeFeed({
              filename: `rss/atom-${locale}.xml`,
              generateXml: () => generateAtomXml(feedConfig, localeRoutes),
              label: 'Atom',
              logger: ctx.logger.info,
              outDir,
            })
          }
        }
      },
    },
  }
}
