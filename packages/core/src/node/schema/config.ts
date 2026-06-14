import { z } from 'zod'

/**
 * Zod schema for a single social link.
 */
export const SocialLinkSchema = z.object({
  icon: z.string().max(50),
  link: z.string().url(),
})

/**
 * Zod schema for footer configuration.
 */
export const FooterConfigSchema = z.object({
  text: z.string().max(2000).optional(),
})

/**
 * Zod schema for a Boltdocs plugin.
 */
export const BoltdocsPluginSchema = z.object({
  name: z.string(),
  enforce: z.enum(['pre', 'post']).optional(),
  version: z.string().optional(),
  boltdocsVersion: z.string().optional(),
  remarkPlugins: z.array(z.unknown()).optional(),
  rehypePlugins: z.array(z.unknown()).optional(),
  vitePlugins: z.array(z.unknown()).optional(),
  components: z.record(z.string(), z.string()).optional(),
  hooks: z.record(z.string(), z.unknown()).optional(),
})

/**
 * Zod schema for theme configuration.
 */
export const ThemeConfigSchema = z.object({
  title: z.union([z.string(), z.record(z.string(), z.string())]).optional(),
  description: z
    .union([z.string(), z.record(z.string(), z.string())])
    .optional(),
  logo: z
    .union([
      z.string(),
      z.object({
        dark: z.string(),
        light: z.string(),
        alt: z.string().optional(),
        width: z.number().optional(),
        height: z.number().optional(),
      }),
    ])
    .optional(),
  navbar: z
    .array(
      z.object({
        label: z.union([z.string(), z.record(z.string(), z.string())]),
        href: z.string(),
        items: z
          .array(
            z.object({
              label: z.union([z.string(), z.record(z.string(), z.string())]),
              href: z.string(),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  sidebar: z
    .record(
      z.string(),
      z.array(
        z.object({
          text: z.string(),
          link: z.string(),
        }),
      ),
    )
    .optional(),
  sidebarGroups: z
    .record(
      z.string(),
      z.object({
        title: z
          .union([z.string(), z.record(z.string(), z.string())])
          .optional(),
        icon: z.string().optional(),
      }),
    )
    .optional(),
  socialLinks: z.array(SocialLinkSchema).optional(),
  editLink: z
    .string()
    .refine((val) => !val || val.includes(':path'), {
      message: "editLink must contain ':path' placeholder if specified",
    })
    .optional(),
  communityHelp: z.string().url().optional(),
  version: z.string().max(50).optional(),
  githubRepo: z.string().max(100).optional(),
  favicon: z.string().optional(),
  tabs: z
    .array(
      z.object({
        id: z.string(),
        text: z.union([z.string(), z.record(z.string(), z.string())]),
        icon: z.string().optional(),
      }),
    )
    .optional(),
  codeTheme: z
    .union([z.string(), z.object({ light: z.string(), dark: z.string() })])
    .optional(),
})

/**
 * Zod schema for robots.txt configuration.
 */
export const RobotsConfigSchema = z.union([
  z.string(),
  z.object({
    rules: z
      .array(
        z.object({
          userAgent: z.string(),
          allow: z.union([z.string(), z.array(z.string())]).optional(),
          disallow: z.union([z.string(), z.array(z.string())]).optional(),
        }),
      )
      .optional(),
    sitemaps: z.array(z.string().url()).optional(),
  }),
])

/**
 * Zod schema for internationalization configuration.
 */
export const I18nConfigSchema = z.object({
  defaultLocale: z.string(),
  locales: z
    .union([z.record(z.string(), z.string()), z.array(z.string())])
    .transform((val) => {
      if (Array.isArray(val)) {
        return Object.fromEntries(val.map((l) => [l, l]))
      }
      return val
    }),
  localeConfigs: z
    .record(
      z.string(),
      z.object({
        label: z.string().optional(),
        direction: z.enum(['ltr', 'rtl']).optional(),
        htmlLang: z.string().optional(),
        calendar: z.string().optional(),
      }),
    )
    .optional(),
})

/**
 * Zod schema for versioning configuration.
 */
export const VersionsConfigSchema = z.object({
  defaultVersion: z.string(),
  prefix: z.string().optional(),
  versions: z.array(
    z.object({
      label: z.string(),
      path: z.string(),
    }),
  ),
})

/**
 * Zod schema for security configuration.
 */
export const SecurityConfigSchema = z.object({
  headers: z.record(z.string(), z.string()).optional(),
  enableCSP: z.boolean().optional(),
  customHeaders: z.record(z.string(), z.string()).optional(),
})

export const VerificationConfigSchema = z.object({
  google: z.string().optional(),
  bing: z.string().optional(),
  yandex: z.string().optional(),
  pinterest: z.string().optional(),
  facebook: z.string().optional(),
})

/**
 * Zod schema for SEO configuration.
 */
export const BoltdocsSeoConfigSchema = z.object({
  metatags: z.record(z.string(), z.string()).optional(),
  indexing: z.enum(['all', 'public']).optional(),
  thumbnails: z
    .object({
      background: z.string().optional(),
    })
    .optional(),
  verification: VerificationConfigSchema.optional(),
})

/**
 * Zod schema for GA4 configuration.
 */
export const GA4ConfigSchema = z.object({
  measurementId: z.string().min(1, 'Measurement ID is required for GA4'),
  debug: z.boolean().optional(),
  anonymizeIp: z.boolean().optional(),
  sendPageView: z.boolean().optional(),
  cookieFlags: z.string().optional(),
  autoTrack: z
    .object({
      pageViews: z.boolean().optional(),
      downloads: z.boolean().optional(),
      externalLinks: z.boolean().optional(),
      search: z.boolean().optional(),
    })
    .optional(),
})

/**
 * Zod schema for GTM configuration.
 */
export const GTMConfigSchema = z.object({
  tagId: z.string().min(1, 'Tag ID is required for GTM'),
  dataLayerName: z.string().optional(),
  preview: z.string().optional(),
})

/**
 * Zod schema for Algolia DocSearch configuration.
 */
export const AlgoliaConfigSchema = z.object({
  appId: z.string().min(1, 'Algolia App ID is required'),
  apiKey: z.string().min(1, 'Algolia API Key is required'),
  indexName: z.string().min(1, 'Algolia Index Name is required'),
})

export const GiscusConfigSchema = z.object({
  repo: z.string().min(1, 'Giscus repository is required'),
  repoId: z.string().min(1, 'Giscus repository ID is required'),
  category: z.string().optional(),
  categoryId: z.string().optional(),
  mapping: z
    .enum(['pathname', 'url', 'title', 'og:title', 'specific', 'number'])
    .optional(),
  strict: z.union([z.enum(['0', '1']), z.boolean()]).optional(),
  reactionsEnabled: z.union([z.enum(['0', '1']), z.boolean()]).optional(),
  emitMetadata: z.union([z.enum(['0', '1']), z.boolean()]).optional(),
  inputPosition: z.enum(['top', 'bottom']).optional(),
  theme: z.string().optional(),
  darkTheme: z.string().optional(),
  lang: z.string().optional(),
  loading: z.enum(['lazy', 'eager']).optional(),
})

export const CustomFeedbackConfigSchema = z.object({
  enabled: z.boolean(),
  owner: z.string().min(1, 'GitHub owner is required'),
  repo: z.string().min(1, 'GitHub repository name is required'),
  categorySlug: z.string().optional(),
  endpoint: z.string().optional(),
})

export const VercelConfigSchema = z.object({
  analytics: z.boolean().optional(),
  speedInsights: z.boolean().optional(),
})

export const AnalyticsConfigSchema = z.object({
  ga4: GA4ConfigSchema.optional(),
  gtm: GTMConfigSchema.optional(),
  vercel: VercelConfigSchema.optional(),
})

export const SearchConfigSchema = z.object({
  algolia: AlgoliaConfigSchema.optional(),
})

export const FeedbackConfigSchema = z.object({
  giscus: GiscusConfigSchema.optional(),
  custom: CustomFeedbackConfigSchema.optional(),
})

export const IntegrationsConfigSchema = z.object({
  analytics: AnalyticsConfigSchema.optional(),
  search: SearchConfigSchema.optional(),
  feedback: FeedbackConfigSchema.optional(),
})

/**
 * Root Zod schema for Boltdocs project configuration.
 */
export const BoltdocsConfigSchema = z.object({
  siteUrl: z.string().url().optional(),
  docsDir: z.string().optional(),
  base: z.string().optional(),
  theme: ThemeConfigSchema.optional(),
  i18n: I18nConfigSchema.optional(),
  versions: VersionsConfigSchema.optional(),
  plugins: z.array(BoltdocsPluginSchema).optional(),
  robots: RobotsConfigSchema.optional(),
  security: SecurityConfigSchema.optional(),
  seo: BoltdocsSeoConfigSchema.optional(),
  integrations: IntegrationsConfigSchema.optional(),
  vite: z.record(z.string(), z.unknown()).optional(),
})
