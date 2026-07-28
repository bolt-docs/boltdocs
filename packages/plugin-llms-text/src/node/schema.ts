import { z } from 'zod'

/**
 * Configuration for a custom section in the llms.txt file.
 * Each section maps to an H2 heading with a list of curated links.
 */
export const LlmsTextSectionSchema = z.object({
  /** The H2 heading label for this section (e.g. 'Getting Started'). */
  title: z.string().min(1).max(100),
  /** Path prefix filter — only routes starting with this path are included. */
  pathPrefix: z.string().min(1).max(200),
  /** Optional description paragraph placed right after the H2 heading. */
  description: z.string().max(500).optional(),
  /** Maximum links in this section. Default: no limit. */
  maxLinks: z.number().int().positive().max(500).optional(),
  /** Whether this section should appear under the '## Optional' umbrella. */
  optional: z.boolean().default(false),
})

/**
 * Controls link sorting within each section.
 */
export const SortBySchema = z
  .enum(['path', 'title', 'sidebarPosition'])
  .default('sidebarPosition')

/**
 * Controls which routes are included in the llms.txt.
 */
export const LlmsTextPluginOptionsSchema = z.object({
  /**
   * Project title used as the H1 heading.
   * Defaults to the site title from boltdocs config.
   */
  title: z.string().min(1).max(200).optional(),

  /**
   * Project description used as the blockquote summary.
   * Defaults to the site description from boltdocs config.
   */
  description: z.string().min(1).max(1000).optional(),

  /**
   * Additional markdown body text inserted after the blockquote
   * and before any H2 sections. Use this for LLM-specific instructions,
   * common patterns, or high-level architecture notes.
   */
  bodyText: z.string().max(2000).optional(),

  /**
   * If set, only routes matching at least one of these path prefixes
   * are included. Example: ['/docs', '/blog']. Default: all routes.
   */
  includePaths: z.array(z.string()).optional(),

  /**
   * Routes matching any of these path prefixes are excluded.
   * Applied AFTER includePaths. Example: ['/docs/api/experimental'].
   */
  excludePaths: z.array(z.string()).optional(),

  /**
   * Custom H2 sections that group links by path prefix.
   * When provided, the default "Documentation" section is replaced.
   * Default: a single "Documentation" section with all routes.
   */
  sections: z.array(LlmsTextSectionSchema).optional(),

  /**
   * How to sort links within each section.
   */
  sortBy: SortBySchema,

  /**
   * Maximum number of links per section. Default: no limit.
   */
  maxLinksPerSection: z.number().int().positive().max(500).optional(),

  /**
   * Whether to include draft routes. Default: false.
   */
  includeDrafts: z.boolean().default(false),

  /**
   * Whether to generate the llms.txt file in dev mode.
   * Default: false (production builds only).
   */
  devMode: z.boolean().default(false),

  /**
   * Whether to inject a `<link rel="llms-txt">` tag into the HTML `<head>`.
   * Default: true.
   */
  addLinkTag: z.boolean().default(true),

  /**
   * URL base for generating absolute links in llms.txt.
   * Falls back to `siteUrl` from the boltdocs config.
   */
  baseUrl: z.string().url().optional(),
})

export type LlmsTextPluginOptions = z.input<typeof LlmsTextPluginOptionsSchema>
export type LlmsTextSection = z.infer<typeof LlmsTextSectionSchema>
