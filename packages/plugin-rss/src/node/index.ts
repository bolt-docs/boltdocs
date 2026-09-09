import path from 'node:path'
import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import type { BoltdocsConfig, RouteMeta } from 'boltdocs'
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

const MISSING_SITE_URL_MESSAGE =
  'RSS feed not generated: siteUrl is not configured in boltdocs.config.ts'

type FeedOutput = {
  filename: string
  label: string
  xml: string
}

type FeedLocalePlan = {
  locale: string
  title: string
  description: string
  routes: RouteMeta[]
}

/**
 * Resolve the feed locale for a rendered page. The core attempts to pass
 * the matched `RouteMeta` (from `onPageRendered → transformHtml`), but the
 * lookup can miss when the route `path` shape differs from the rendered
 * path, so the locale is also derived from the path segments using the same
 * convention as the core route resolver: non-default locales are
 * path-prefixed (`/docs/es/...`, `/es/docs/...`), while default-locale
 * routes carry `locale: undefined`. Every segment is scanned (not just the
 * first) so translated docs pages under a shared base (`/docs/es/...`)
 * resolve to `es` rather than the default locale.
 */
function resolvePageLocale(
  config: BoltdocsConfig,
  route: RouteMeta | undefined,
  path: string | undefined,
): string {
  const defaultLocale = config.i18n?.defaultLocale ?? 'en'
  if (route?.locale) return route.locale
  const segments = path?.split('/').filter(Boolean) ?? []
  const locales = getLocales(config)
  const localeSegment = segments.find((segment) => locales.includes(segment))
  if (localeSegment) return localeSegment
  return defaultLocale
}

/** Group non-draft routes per locale, applying the plugin filters + limit. */
function buildFeedPlan(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  config: any,
  routes: RouteMeta[],
  opts: RssPluginOptions,
): { siteUrl: string; locales: FeedLocalePlan[] } {
  const siteUrl = (config?.siteUrl as string | undefined) ?? ''
  const defaultLocale =
    (config?.i18n?.defaultLocale as string | undefined) ?? 'en'

  const filteredRoutes = (routes ?? [])
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

  const siteTitle = getSiteTitle(config)
  const locales = getLocales(config)

  const plan: FeedLocalePlan[] = locales.map((locale) => {
    // Default-locale routes carry `locale: undefined` from the route
    // resolver; bucket them under the configured default locale so the
    // primary feed is not silently empty.
    const localeRoutes = limited.filter(
      (r) => (r.locale ?? defaultLocale) === locale,
    )
    return {
      locale,
      title: getLocalizedTitle(config, locale, siteTitle),
      description: getLocalizedDescription(config, locale),
      routes: localeRoutes,
    }
  })

  return { siteUrl, locales: plan }
}

/** Render every requested feed file in memory (RSS and/or Atom per locale). */
function buildFeedOutputs(
  siteUrl: string,
  locales: FeedLocalePlan[],
  opts: RssPluginOptions,
): FeedOutput[] {
  const outputs: FeedOutput[] = []

  for (const { locale, title, description, routes } of locales) {
    const feedConfig: FeedConfig = {
      title,
      description,
      siteUrl,
      language: locale,
      locale,
    }

    if (opts.format === 'rss' || opts.format === 'both') {
      outputs.push({
        filename: `rss/rss-${locale}.xml`,
        label: 'RSS',
        xml: generateRssXml(feedConfig, routes),
      })
    }

    if (opts.format === 'atom' || opts.format === 'both') {
      outputs.push({
        filename: `rss/atom-${locale}.xml`,
        label: 'Atom',
        xml: generateAtomXml(feedConfig, routes),
      })
    }
  }

  return outputs
}

export default function rssPlugin(
  options: RssPluginOptions = {},
): BoltdocsPlugin {
  const opts = RssPluginOptionsSchema.parse(options)

  // Older Boltdocs versions only invoke `afterBuild`. Keep a per-plugin
  // guard so the compatibility hook cannot write the feeds twice when a
  // current core invokes both `build:generate` and `afterBuild`.
  let lastWriteKey: string | null = null

  /**
   * Shared generation entry point. `routes` and `outDir` are passed
   * explicitly because each lifecycle entry point resolves them
   * differently (see the hooks below).
   */
  function generate(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ctx: any,
    routes: RouteMeta[],
    outDir: string,
  ): void {
    const plan = buildFeedPlan(ctx.config, routes, opts)
    if (!plan.siteUrl) {
      ctx.diagnostics?.report?.(
        'warn',
        'RSS_MISSING_SITE_URL',
        MISSING_SITE_URL_MESSAGE,
      )
      return
    }

    const outputs = buildFeedOutputs(plan.siteUrl, plan.locales, opts)
    // Deduplicate only identical output, not merely identical directories:
    // a later build can reuse `dist/` while routes or frontmatter changed.
    const normalizedOutDir = path.resolve(outDir)
    const key = `${normalizedOutDir}\0${outputs
      .map((output) => `${output.filename}:${output.xml}`)
      .join('\0')}`
    if (key === lastWriteKey) return

    for (const output of outputs) {
      writeFeed({
        filename: output.filename,
        generateXml: () => output.xml,
        label: output.label,
        logger: ctx.logger.info,
        outDir: normalizedOutDir,
      })
    }
    lastWriteKey = key
  }

  return createPlugin({
    name: 'boltdocs-plugin-rss',
    version: '0.1.0',
    hooks: {
      // `build:generate` receives the absolute output directory from the
      // core pipeline (SEOWriteStep) after SSG has finalized it. Using
      // `ctx.outDir` from a lifecycle context here could resolve relative
      // to the wrong cwd.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async 'build:generate'(ctx: any, params: any) {
        generate(
          ctx,
          params?.routes ?? ctx.routes ?? [],
          params?.outDir ?? ctx.outDir,
        )
      },

      // Compatibility fallback for cores that predate `build:generate`.
      // `rootDir` makes a relative context output path deterministic.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async afterBuild(ctx: any) {
        const outputDir = path.resolve(
          ctx.rootDir ?? process.cwd(),
          ctx.outDir ?? 'dist',
        )
        generate(ctx, ctx.routes ?? [], outputDir)
      },

      transformHtml(ctx, params) {
        if (!ctx.config.siteUrl) return { html: params.html }

        const locale = resolvePageLocale(ctx.config, params.route, params.path)
        const siteUrl = ctx.config.siteUrl.replace(/\/$/, '')
        const feedType = opts.format === 'atom' ? 'atom' : 'rss'
        const feedFile =
          feedType === 'atom' ? `atom-${locale}.xml` : `rss-${locale}.xml`
        const linkType =
          feedType === 'atom' ? 'application/atom+xml' : 'application/rss+xml'
        const linkTag = `  <link rel="alternate" type="${linkType}" title="RSS Feed" href="${siteUrl}/rss/${feedFile}"/>\n</head>`

        return {
          html: params.html.replace('</head>', linkTag),
        }
      },
    },
  })
}
