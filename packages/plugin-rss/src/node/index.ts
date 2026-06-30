import fs from 'node:fs'
import path from 'node:path'
import type { BoltdocsPlugin } from 'boltdocs'
import { RssPluginOptionsSchema, type RssPluginOptions } from './feed-schema'
import { generateRssXml, generateAtomXml, FeedConfig } from './feed-generator'

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

        let routes = ctx.routes

        if (opts.paths) {
          routes = routes.filter((r) =>
            opts.paths!.some((p) => r.path.startsWith(p)),
          )
        }

        if (opts.collections) {
          routes = routes.filter((r) =>
            opts.collections!.includes(r.collection ?? ''),
          )
        }

        routes = routes.filter((r) => !r.draft)

        routes.sort((a, b) => {
          const dateA = new Date(a.date ?? a.lastUpdated ?? 0)
          const dateB = new Date(b.date ?? b.lastUpdated ?? 0)
          return dateB.getTime() - dateA.getTime()
        })

        const limited = opts.limit ? routes.slice(0, opts.limit) : routes

        const siteTitle =
          typeof ctx.config.theme?.title === 'object'
            ? (Object.values(ctx.config.theme.title)[0] ?? 'Documentation')
            : (ctx.config.theme?.title ?? 'Documentation')

        const locales = ctx.config.i18n?.locales
          ? Array.isArray(ctx.config.i18n.locales)
            ? ctx.config.i18n.locales
            : Object.keys(ctx.config.i18n.locales)
          : ['en']

        const defaultLocale = ctx.config.i18n?.defaultLocale ?? 'en'

        for (const locale of locales) {
          const localeRoutes = limited.filter((r) => {
            const routeLocale = r.locale || defaultLocale
            return routeLocale === locale
          })

          const title =
            typeof ctx.config.theme?.title === 'object'
              ? (ctx.config.theme.title[locale] ??
                ctx.config.theme.title[defaultLocale] ??
                siteTitle)
              : siteTitle

          const description =
            typeof ctx.config.theme?.description === 'object'
              ? (ctx.config.theme.description[locale] ??
                ctx.config.theme.description[defaultLocale] ??
                '')
              : (ctx.config.theme?.description ?? '')

          const feedConfig: FeedConfig = {
            title,
            description,
            siteUrl,
            language: locale,
            locale,
          }

          if (opts.format === 'rss' || opts.format === 'both') {
            const xml = generateRssXml(feedConfig, localeRoutes)
            const filename = `rss/feed-${locale}.xml`
            const filePath = path.join(outDir, filename)
            fs.mkdirSync(path.dirname(filePath), { recursive: true })
            fs.writeFileSync(filePath, xml, 'utf-8')
            ctx.logger.info(`RSS feed generated: ${filename}`)
          }

          if (opts.format === 'atom' || opts.format === 'both') {
            const xml = generateAtomXml(feedConfig, localeRoutes)
            const filename = `rss/atom-${locale}.xml`
            const filePath = path.join(outDir, filename)
            fs.mkdirSync(path.dirname(filePath), { recursive: true })
            fs.writeFileSync(filePath, xml, 'utf-8')
            ctx.logger.info(`Atom feed generated: ${filename}`)
          }
        }
      },
    },
  }
}
