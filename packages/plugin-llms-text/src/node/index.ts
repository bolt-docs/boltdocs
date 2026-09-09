import { createPlugin, type BoltdocsPlugin } from 'boltdocs'
import {
  LlmsTextPluginOptionsSchema,
  type LlmsTextPluginOptions,
} from './schema'
import path from 'node:path'
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
 * Models and AI agents. The file is emitted into the resolved build output
 * directory and is therefore served at `<siteUrl>/llms.txt`.
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
      locales: options.locales,
      defaultLocale: ctx.config.i18n?.defaultLocale,
    }
  }

  // Older Boltdocs versions only invoke `afterBuild`. Keep a per-plugin
  // guard so the compatibility hook cannot generate the file twice when a
  // current core invokes both `build:generate` and `afterBuild`.
  let generatedKey: string | null = null

  const generate = (ctx: any, routes: any[], outputDir: string): void => {
    const resolved = resolveConfig({ ...ctx, routes })
    if (!resolved) return

    const content = generateLlmsText(routes, resolved)
    // Both hooks can run on a current core. Deduplicate only identical
    // output, not merely identical directories: a later build can reuse
    // `dist/` while routes or descriptions have changed.
    const normalizedOutputDir = path.resolve(outputDir)
    const key = `${normalizedOutputDir}\0${content}`
    if (generatedKey === key) return

    writeLlmsText(content, normalizedOutputDir, ctx.logger.info)
    generatedKey = key
  }

  return createPlugin({
    name: 'boltdocs-plugin-llms-text',
    version: '0.1.0',
    hooks: {
      // `build:generate` receives the absolute output directory from the
      // core pipeline after SSG has finalized it. Using `ctx.outDir` from a
      // lifecycle context here could resolve relative to the wrong cwd.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async 'build:generate'(
        ctx: any,
        params: { routes: any[]; outDir: string },
      ) {
        generate(ctx, params.routes, params.outDir)
      },

      // Compatibility fallback for cores that predate `build:generate`.
      // `rootDir` makes a relative context output path deterministic.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async afterBuild(ctx: any) {
        const outputDir = path.resolve(ctx.rootDir ?? process.cwd(), ctx.outDir)
        generate(ctx, ctx.routes, outputDir)
      },

      transformHtml(ctx, params) {
        return linkTagInjection(ctx, params)
      },
    },
  })
}
