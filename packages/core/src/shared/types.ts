import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AliasOptions, Plugin as VitePlugin, UserConfig } from 'vite'
import type { ComponentType } from 'react'
import type {
  CodeHighlightConfig,
  CodeTheme,
  IPluginLifecycleManager as ContractIPluginLifecycleManager,
  PluginContext as ContractPluginContext,
  PluginClientConfig,
  PluginLifecycleHooks as ContractPluginLifecycleHooks,
  PluginMiddlewareAPI as ContractPluginMiddlewareAPI,
  PluginServerAPI as ContractPluginServerAPI,
  PluginServerMiddleware as ContractPluginServerMiddleware,
  PluginTransformMiddleware as ContractPluginTransformMiddleware,
} from '@bdocs/contracts'

export type {
  BadgeValue,
  BoltdocsUiSlot,
  ChainSignal,
  CodeHighlightConfig,
  CodeHighlighterAdapter,
  CodeHighlighterEngine,
  CodeHighlighterRuntime,
  CodeTheme,
  DiagnosticRecord,
  ParsedMetaLike,
  PluginCachesAPI,
  PluginClientConfig,
  PluginDiagnosticsAPI,
  PluginHmrAPI,
  PluginHmrEvent,
  PluginHeadEntry,
  PluginLogger,
  PluginMemoryCacheAPI,
  PluginMeta,
  PluginPathsAPI,
  PluginRoutesCacheAPI,
  PluginStore,
  PluginTransformCacheAPI,
  PluginVirtualModulesAPI,
  RegisteredVirtualModule,
  RouteHeading,
  RouteMeta,
  SearchDocument,
  TransformHtmlParams,
  TransformResult,
  TransformSourceParams,
} from '@bdocs/contracts'

export type PluginServerMiddleware = ContractPluginServerMiddleware<
  IncomingMessage,
  ServerResponse
>

export interface PluginServerAPI
  extends ContractPluginServerAPI<IncomingMessage, ServerResponse> {}

export interface PluginMiddlewareAPI
  extends ContractPluginMiddlewareAPI<
    BoltdocsConfig,
    IncomingMessage,
    ServerResponse
  > {}

export interface PluginContext
  extends ContractPluginContext<
    BoltdocsConfig,
    IncomingMessage,
    ServerResponse
  > {}

export interface PluginLifecycleHooks
  extends ContractPluginLifecycleHooks<
    BoltdocsConfig,
    IncomingMessage,
    ServerResponse
  > {}

export interface PluginTransformMiddleware
  extends ContractPluginTransformMiddleware<
    BoltdocsConfig,
    IncomingMessage,
    ServerResponse
  > {}

export interface IPluginLifecycleManager
  extends ContractIPluginLifecycleManager<
    BoltdocsConfig,
    IncomingMessage,
    ServerResponse
  > {}

/**
 * Represents a single social link in the configuration.
 */
export interface BoltdocsSocialLink {
  icon: 'discord' | 'x' | 'github' | 'bluesky' | string
  link: string
}

/**
 * Theme-specific configuration options.
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
    href: BoltdocsRoutePathWithFallback
    items?: Array<{
      label: string | Record<string, string>
      href: BoltdocsRoutePathWithFallback
    }>
  }>
  sidebar?: Record<
    string,
    Array<{ text: string; link: BoltdocsRoutePathWithFallback }>
  >
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

/**
 * List of supported syntax highlighting themes.
 */
export type ShikiTheme =
  | 'github-dark'
  | 'github-light'
  | 'tokyo-night'
  | 'dracula'
  | 'nord'
  | 'one-dark-pro'
  | 'one-light'

/**
 * Configuration for the robots.txt file.
 */
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

/**
 * Configuration for a specific locale.
 */
export interface BoltdocsLocaleConfig {
  label?: string
  direction?: 'ltr' | 'rtl'
  htmlLang?: string
  calendar?: string
}

/**
 * Configuration for internationalization (i18n).
 */
export interface BoltdocsI18nConfig {
  defaultLocale: string
  locales: string[] | Record<string, string>
  localeConfigs?: Record<string, BoltdocsLocaleConfig>
}

/**
 * Configuration for a specific documentation version.
 */
export interface BoltdocsVersionConfig {
  label: string
  path: string
}

/**
 * Configuration for content collections (e.g. blog posts, changelog)
 * declared in `boltdocs.config.ts`. Each entry maps a directory name
 * (e.g. `[blog]`) to its display + ordering settings.
 */
export interface BoltdocsCollectionsConfig {
  /**
   * Map of collection id (matches the bracketed directory name) to
   * its display label. Falls back to the id when a label is missing.
   */
  labels?: Record<string, string | Record<string, string>>
  /**
   * Map of collection id to a numeric position used for sidebar ordering.
   * Collections with no explicit position are sorted last.
   */
  positions?: Record<string, number>
  /**
   * Items-per-page for paginated collection routes (e.g. blog indexes).
   * Falls back to the framework default (10) when omitted.
   */
  postsPerPage?: number
  /**
   * Default collection ID used by collection routing when no collection
   * is explicitly referenced. Defaults to `'blog'`.
   */
  defaultCollection?: string
  /**
   * Date format string for rendering post dates in listing pages.
   * Defaults to `'MMMM dd, yyyy'`.
   */
  dateFormat?: string
  /**
   * Field used to sort posts within a collection.
   * Defaults to `'date'`.
   */
  sortBy?: 'date' | 'title' | 'sidebarPosition'
}

/**
 * Configuration for documentation versioning.
 */
export interface BoltdocsVersionsConfig {
  defaultVersion: string
  prefix?: string
  versions: BoltdocsVersionConfig[]
}

/**
 * MDX processor configuration.
 * When `processor` is set to 'satteri', the Sätteri Rust-based compiler is used.
 */
export interface BoltdocsMdxConfig {
  processor?: 'satteri'
}

/**
 * Defines a Boltdocs plugin.
 *
 * Use the `definePlugin()` or `createPlugin()` helper from the node API for full
 * type safety and access to lifecycle hooks.
 */
export interface PluginCssConfig {
  cssFiles?: string[]
  headStyles?: string[]
  postcssPlugins?: unknown[]
  preprocessorOptions?: Record<string, unknown>
}

export interface BoltdocsPlugin {
  name: string
  enforce?: 'pre' | 'post'
  version?: string
  boltdocsVersion?: string
  remarkPlugins?: unknown[]
  rehypePlugins?: unknown[]
  vitePlugins?: VitePlugin[]
  components?: Record<string, string>
  client?: PluginClientConfig
  metadata?: Record<string, unknown>
  css?: PluginCssConfig
  middleware?: PluginTransformMiddleware[]
  hooks?: PluginLifecycleHooks
}

/**
 */

/**
 */

/**
 */

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

/**
 * Configuration for SEO.
 */
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
  /** Global JSON-LD graph emitted in every page head. */
  structuredData?: StructuredData
}

export interface BoltdocsViewTransitionsConfig {
  /** Native document transitions are enabled when true. */
  enabled?: boolean
  /** Optional transition types passed to `document.startViewTransition`. */
  types?: string[]
}

export interface BoltdocsExperimentalConfig {
  /** Enables the native View Transition API integration. */
  viewTransitions?: boolean | BoltdocsViewTransitionsConfig
  /** Enables static file-routing under `docs/pages-external/`. */
  fileRouting?: boolean
}

export type ExperimentalViewTransitions =
  | boolean
  | BoltdocsViewTransitionsConfig

export interface ExternalFileRoute {
  path: string
  filePath: string
  kind: 'component' | 'mdx'
  /**
   * Locale the file provides, derived from a `pages-external/{locale}/`
   * directory. Absent for default-locale files.
   */
  locale?: string
}

/**
 * Configuration for Google Analytics 4 (GA4).
 */
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

/**
 * Configuration for Google Tag Manager (GTM).
 */
export interface BoltdocsGTMConfig {
  tagId: string
  dataLayerName?: string
  preview?: string
}

/**
 * Configuration for Algolia DocSearch.
 */
export interface BoltdocsAlgoliaConfig {
  appId: string
  apiKey: string
  indexName: string
}

/**
 * Configuration for Giscus comments.
 */
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

/**
 * Configuration for custom feedback system using GitHub Discussions API.
 */
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

/**
 * Configuration for static site generation.
 */
export interface BoltdocsSsgConfig {
  /** Critical CSS strategy; `none` disables critical CSS processing. */
  criticalCss?: 'zig-critters' | 'beasties' | 'none'
  /**
   * Per-page budget (bytes) for inlined critical CSS. Pages exceeding it get
   * no inline critical CSS (with a build warning). Default: 24576 (24KB).
   */
  criticalCssMaxSize?: number
}

/**
 * Configuration for drafts visibility control.
 */
export interface BoltdocsDraftsConfig {
  /** If true, drafts are visible in all environments. Default: false */
  visible?: boolean
  /** Environments where drafts are visible (e.g. ['development', 'staging']). Default: [] */
  environments?: string[]
}

/**
 * The root configuration object for Boltdocs.
 */
export interface BoltdocsConfig {
  siteUrl?: string
  docsDir?: string
  base?: string
  theme?: BoltdocsThemeConfig
  i18n?: BoltdocsI18nConfig
  versions?: BoltdocsVersionsConfig
  mdx?: BoltdocsMdxConfig
  ssg?: BoltdocsSsgConfig
  plugins?: BoltdocsPlugin[]
  collections?: BoltdocsCollectionsConfig
  robots?: BoltdocsRobotsConfig
  security?: BoltdocsSecurityConfig
  seo?: BoltdocsSeoConfig
  integrations?: BoltdocsIntegrationsConfig
  drafts?: BoltdocsDraftsConfig
  featureFlags?: Record<string, boolean | string>
  experimental?: BoltdocsExperimentalConfig
  directoryMeta?: Record<string, unknown>
  aliases?: AliasOptions
  vite?: UserConfig
}

/**
 * Global namespace for Boltdocs types that can be augmented by generated code.
 * This allows for strictly typed locales and versions based on the project configuration.
 */
declare global {
  namespace Boltdocs {
    interface Types {}

    /**
     * Marker interface augmented by generated code to provide strict route path typing.
     * When no types have been generated (e.g., before first dev server start),
     * keyof is never, and BoltdocsRoutePath falls back to string.
     */
    interface RoutePaths {}
  }
}

export type BoltdocsTypes = Boltdocs.Types

export type BoltdocsRoutePath = keyof Boltdocs.RoutePaths

export type ExternalRouteReference =
  | `/${string}`
  | `#${string}`
  | `?${string}`
  | `site:/${string}`
  | `site:${string}`
  | `http://${string}`
  | `https://${string}`
  | `//${string}`

export type BoltdocsRoutePathWithFallback =
  | BoltdocsRoutePath
  | ExternalRouteReference
  | string

export type BoltdocsLocale = Boltdocs.Types extends { Locale: infer L }
  ? L
  : string
export type BoltdocsVersion = Boltdocs.Types extends { Version: infer V }
  ? V
  : string

export type UnpackMdxComponents<T> = T extends { default: infer D } ? D : T

export type TransformMdxComponents<T> = {
  [K in keyof T as K extends `Frontmatter_${string}` ? never : K]: T[K]
} & {
  Frontmatter: {
    [K in keyof T as K extends `Frontmatter_${infer Name}` ? Name : never]: T[K]
  }
}

export type BoltdocsMdxComponents = Boltdocs.Types extends {
  MdxComponents: infer M
}
  ? TransformMdxComponents<UnpackMdxComponents<M>>
  : Omit<Record<string, ComponentType<unknown>>, 'Frontmatter'> & {
      Frontmatter: Record<string, ComponentType<unknown>>
    }
