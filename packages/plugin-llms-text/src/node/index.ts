import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import {
  LlmsTextPluginOptionsSchema,
  type LlmsTextPluginOptions,
} from './schema'
import {
  generateLlmsText,
  buildDefaultSections,
  writeLlmsText,
  formatSiteUrl,
  type LlmsTextConfig,
} from './generator'

export type { LlmsTextPluginOptions }

/**
 * @bdocs/plugin-llms-text — Generate an `llms.txt` file at build time.
 *
 * The llms.txt specification (llmstxt.org) provides a standardised
 * plain-text index of documentation pages optimised for Large Language
 * Models and AI agents. The file lives at `<siteUrl>/llms.txt` and
 * mirrors the structure of robots.txt and sitemap.xml.
 */
export default function llmsTextPlugin(
  rawOptions: LlmsTextPluginOptions = {},
): BoltdocsPlugin {
  const options = LlmsTextPluginOptionsSchema.parse(rawOptions)

  // Shared <link> tag injection — used in both dev and production.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function linkTagInjection(
    ctx: any,
    params: { html: string },
  ): { html: string } {
    if (!options.addLinkTag) return { html: params.html }
    const siteUrl = ctx.config.siteUrl ?? options.baseUrl
    if (!siteUrl) return { html: params.html }
    const tag = `<link rel="llms-txt" href="${formatSiteUrl(siteUrl)}/llms.txt"/>\n</head>`
    return { html: params.html.replace('</head>', tag) }
  }

  // Resolve effective options — some defaults depend on `ctx.config`
  // which is only available inside lifecycle hooks.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function resolveConfig(ctx: any): LlmsTextConfig | null {
    const siteUrl = options.baseUrl ?? ctx.config.siteUrl
    if (!siteUrl) {
      ctx.logger.info(
        '[llms-text] Skipping generation: no siteUrl configured. Set siteUrl in boltdocs.config.ts or pass baseUrl to the plugin.',
      )
      return null
    }

    const themeTitle = ctx.config.theme?.title
    const title =
      options.title ??
      (typeof themeTitle === 'object' && themeTitle !== null
        ? Object.values(themeTitle)[0]
        : themeTitle) ??
      'Documentation'

    const themeDescription = ctx.config.theme?.description
    const description =
      options.description ??
      (typeof themeDescription === 'object' && themeDescription !== null
        ? Object.values(themeDescription)[0]
        : themeDescription) ??
      ''

    const sections = options.sections ?? buildDefaultSections(ctx.routes)

    return {
      title,
      description,
      bodyText: options.bodyText,
      siteUrl: formatSiteUrl(siteUrl),
      sections,
      sortBy: options.sortBy,
      maxLinksPerSection: options.maxLinksPerSection,
      includeDrafts: options.includeDrafts,
      includePaths: options.includePaths,
      excludePaths: options.excludePaths,
    }
  }

  const isEnabled =
    options.devMode || process.env.NODE_ENV === 'production' || process.env.CI

  return createPlugin({
    name: 'boltdocs-plugin-llms-text',
    version: '0.1.0',
    hooks: {
      ...(isEnabled
        ? {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            async afterBuild(ctx: any) {
              const resolved = resolveConfig(ctx)
              if (!resolved) return

              const content = generateLlmsText(ctx.routes, resolved)
              writeLlmsText(content, ctx.outDir, ctx.logger.info)
            },
          }
        : {}),

      transformHtml(ctx, params) {
        return linkTagInjection(ctx, params)
      },
    },
  })
}
