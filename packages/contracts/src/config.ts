import type { PluginDefinition } from './plugins'

export type BoltdocsRobotsConfig =
  | string
  | {
      rules?: Array<{
        userAgent: string
        allow?: string | string[]
        disallow?: string | string[]
      }>
      sitemaps?: string[]
    }

export interface BoltdocsLocaleConfig {
  label?: string
  direction?: 'ltr' | 'rtl'
  htmlLang?: string
  calendar?: string
}

export interface BoltdocsI18nConfig {
  defaultLocale: string
  locales: string[] | Record<string, string>
  localeConfigs?: Record<string, BoltdocsLocaleConfig>
}

export interface BoltdocsVersionConfig {
  label: string
  path: string
}

export interface BoltdocsVersionsConfig {
  defaultVersion: string
  prefix?: string
  versions: BoltdocsVersionConfig[]
}

export interface BoltdocsCollectionsConfig {
  labels?: Record<string, string | Record<string, string>>
  positions?: Record<string, number>
  postsPerPage?: number
  defaultCollection?: string
  dateFormat?: string
  sortBy?: 'date' | 'title' | 'sidebarPosition'
}

export interface BoltdocsMdxConfig {
  processor?: 'satteri'
}

export interface BoltdocsSecurityConfig {
  headers?: Record<string, string>
  enableCSP?: boolean
  customHeaders?: Record<string, string>
}

export interface BoltdocsVerificationConfig {
  google?: string
  bing?: string
  yandex?: string
  pinterest?: string
  facebook?: string
}

export type JsonLdPrimitive = string | number | boolean | null
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdValue[]
export interface JsonLdObject {
  [key: string]: JsonLdValue | undefined
}
export type StructuredData = JsonLdObject | JsonLdObject[]

export interface BoltdocsSeoConfig {
  metatags?: Record<string, string>
  indexing?: 'all' | 'public'
  thumbnails?: {
    background?: string
  }
  verification?: BoltdocsVerificationConfig
  structuredData?: StructuredData
}

export interface BoltdocsViewTransitionsConfig {
  enabled?: boolean
  types?: string[]
}

export type ExperimentalViewTransitions =
  | boolean
  | BoltdocsViewTransitionsConfig

export interface BoltdocsExperimentalConfig {
  viewTransitions?: ExperimentalViewTransitions
  fileRouting?: boolean
}

export interface ExternalFileRoute {
  path: string
  filePath: string
  kind: 'component' | 'mdx'
  locale?: string
}

export interface BoltdocsGA4Config {
  measurementId: string
  debug?: boolean
  anonymizeIp?: boolean
  sendPageView?: boolean
  cookieFlags?: string
  autoTrack?: {
    pageViews?: boolean
    downloads?: boolean
    externalLinks?: boolean
    search?: boolean
  }
}

export interface BoltdocsGTMConfig {
  tagId: string
  dataLayerName?: string
  preview?: string
}

export interface BoltdocsAlgoliaConfig {
  appId: string
  apiKey: string
  indexName: string
}

export interface BoltdocsGiscusConfig {
  repo: string
  repoId: string
  category?: string
  categoryId?: string
  mapping?: 'pathname' | 'url' | 'title' | 'og:title' | 'specific' | 'number'
  strict?: '0' | '1' | boolean
  reactionsEnabled?: '0' | '1' | boolean
  emitMetadata?: '0' | '1' | boolean
  inputPosition?: 'top' | 'bottom'
  theme?: string
  darkTheme?: string
  lang?: string
  loading?: 'lazy' | 'eager'
}

export interface BoltdocsCustomFeedbackConfig {
  enabled: boolean
  owner: string
  repo: string
  categorySlug?: string
  endpoint?: string
}

export interface BoltdocsVercelConfig {
  analytics?: boolean
  speedInsights?: boolean
}

export interface BoltdocsPostHogConfig {
  apiKey: string
  host?: string
  capturePageview?: boolean
  capturePageleave?: boolean
  sessionRecording?: boolean
  autocapture?: boolean
}

export interface BoltdocsIntegrationsConfig {
  analytics?: {
    ga4?: BoltdocsGA4Config
    vercel?: BoltdocsVercelConfig
    gtm?: BoltdocsGTMConfig
    posthog?: BoltdocsPostHogConfig
  }
  search?: {
    algolia?: BoltdocsAlgoliaConfig
  }
  feedback?: {
    giscus?: BoltdocsGiscusConfig
    custom?: BoltdocsCustomFeedbackConfig
  }
}

export interface BoltdocsSsgConfig {
  criticalCss?: 'zig-critters' | 'beasties' | 'none'
  criticalCssMaxSize?: number
}

export interface BoltdocsDraftsConfig {
  visible?: boolean
  environments?: string[]
}

export interface BoltdocsConfigContract<Plugin = PluginDefinition> {
  siteUrl?: string
  docsDir?: string
  base?: string
  i18n?: BoltdocsI18nConfig
  versions?: BoltdocsVersionsConfig
  mdx?: BoltdocsMdxConfig
  ssg?: BoltdocsSsgConfig
  plugins?: Plugin[]
  collections?: BoltdocsCollectionsConfig
  robots?: BoltdocsRobotsConfig
  security?: BoltdocsSecurityConfig
  seo?: BoltdocsSeoConfig
  integrations?: BoltdocsIntegrationsConfig
  drafts?: BoltdocsDraftsConfig
  featureFlags?: Record<string, boolean | string>
  experimental?: BoltdocsExperimentalConfig
  directoryMeta?: Record<string, unknown>
}
