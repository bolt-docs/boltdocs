import type { CodeHighlightConfig, CodeTheme } from './highlighting'
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

export interface BoltdocsImageOptimizerConfig {
  enabled?: boolean
  /** Also optimize files in the public directory. @default true */
  includePublic?: boolean
}

export interface BoltdocsExperimentalConfig {
  viewTransitions?: ExperimentalViewTransitions
  fileRouting?: boolean
  /**
   * Image optimization is opt-in.
   *
   * The optimizer resolves `sharp` and `svgo`, which are native binaries of a
   * few megabytes each, so enabling it costs an installation whether or not a
   * single image is ever processed. Off by default keeps that cost off projects
   * that do not need it.
   */
  imageOptimizer?: boolean | BoltdocsImageOptimizerConfig
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

export type RedirectStatus = 301 | 302 | 307 | 308

export interface RedirectConfig {
  /** Source path. External URLs and hash targets are rejected. */
  from: string
  /** Destination path or absolute URL. */
  to: string
  /** HTTP status. Permanent statuses (301/308) are the default. */
  status?: RedirectStatus
  /** Mirror the redirect for every configured locale. */
  locale?: boolean
}

export interface BoltdocsConfigContract<Plugin = PluginDefinition> {
  theme?: BoltdocsThemeConfig
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
  redirects?: RedirectConfig[]
  security?: BoltdocsSecurityConfig
  seo?: BoltdocsSeoConfig
  integrations?: BoltdocsIntegrationsConfig
  drafts?: BoltdocsDraftsConfig
  featureFlags?: Record<string, boolean | string>
  experimental?: BoltdocsExperimentalConfig
  directoryMeta?: Record<string, unknown>
}

/**
 * A social link rendered in the navbar or the footer.
 *
 * Lives here rather than in the core because the browser reads it: the navbar
 * destructures `icon` and `link` to render the entry. Anything the build alone
 * needs stays out.
 */
export interface BoltdocsSocialLink {
  /** Platform id, e.g. `github`, `discord`, `x`, `bluesky`. */
  icon: 'discord' | 'x' | 'github' | 'bluesky' | string
  link: string
}

/**
 * Theme configuration.
 *
 * Also read at runtime — the title, description and logo are rendered into the
 * document, and the navbar entries become links — so the shape is a contract
 * rather than a core detail. `BoltdocsRoutePathWithFallback` is inlined as
 * `string` here on purpose: it already collapses to `string`, and contracts
 * cannot depend on the generated `Boltdocs.RoutePaths` global that sharpens it
 * on a site that has run the type generator.
 */
export interface BoltdocsThemeConfig {
  title?: string | Record<string, string>
  description?: string | Record<string, string>
  logo?:
    | string
    | {
        dark: string
        light: string
        alt?: string
        width?: number
        height?: number
      }
  navbar?: Array<{
    label: string | Record<string, string>
    href: string
    items?: Array<{
      label: string | Record<string, string>
      href: string
    }>
  }>
  sidebar?: Record<string, Array<{ text: string; link: string }>>
  sidebarGroups?: Record<
    string,
    { title?: string | Record<string, string>; icon?: string }
  >
  socialLinks?: BoltdocsSocialLink[]
  editLink?: string
  communityHelp?: string
  version?: string
  githubRepo?: string
  favicon?: string
  tabs?: Array<{
    id: string
    text: string | Record<string, string>
    icon?: string
  }>
  /**
   * Legacy alias for `codeHighlighting.theme`. Kept for backwards
   * compatibility — prefer `codeHighlighting`.
   * @deprecated Use `codeHighlighting` instead.
   */
  codeTheme?: CodeTheme
  /**
   * Configures the markdown code highlighting engine. The engine is
   * engine-agnostic: `engine` accepts a registry id (`'shiki'` by default),
   * an adapter instance, or an adapter factory — so any highlighter can be
   * plugged in without changes to the core.
   *
   * Shorthand: a plain string is a registry id, i.e. `'shiki'` is
   * equivalent to `{ engine: 'shiki' }` (resolved by
   * `normalizeCodeHighlightConfig()` at every read site).
   */
  codeHighlighting?: CodeHighlightConfig | string
}
