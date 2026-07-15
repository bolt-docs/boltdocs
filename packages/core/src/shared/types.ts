import type { Plugin as VitePlugin } from 'vite'
import type { ComponentType } from 'react'

/**
 * Metadata representing a single documentation route.
 * This information is used to build the client-side router and the sidebar navigation.
 */
export interface RouteMeta {
  /** The final URL path for the route (e.g., '/docs/guide/start') */
  path: string
  /** The absolute filesystem path to the source markdown/mdx file */
  componentPath: string
  /** The title of the page, usually extracted from frontmatter or the filename */
  title: string
  /** The relative path from the docs directory, used for edit links */
  filePath: string
  /** Optional description of the page (for SEO/meta tags) */
  description?: string
  /** Optional explicit position for ordering in the sidebar */
  sidebarPosition?: number
  /** The group (directory) this route belongs to */
  group?: string
  /** The display title for the route's group */
  groupTitle?: string
  /** Optional explicit position for ordering the group itself */
  groupPosition?: number
  /** Optional icon for the route's group */
  groupIcon?: string
  /** The sub-route group this route belongs to (from folders starting with _) */
  subRouteGroup?: string
  /** Extracted markdown headings for search indexing */
  headings?: { level: number; text: string; id: string }[]
  /** The locale this route belongs to, if i18n is configured */
  locale?: string
  /** The version this route belongs to, if versioning is configured */
  version?: string
  /** Optional badge to display next to the sidebar item (e.g., 'New', 'Experimental') */
  badge?: BadgeValue
  /** Optional icon to display (Lucide icon name or raw SVG) */
  icon?: string
  /** The tab this route belongs to, if tabs are configured */
  tab?: string
  /** The collection this route belongs to (from [name] directories like [blog]) */
  collection?: string
  /** Tags for blog posts or other taxonomy */
  tags?: string[]
  /** Author identifier for blog posts */
  author?: string
  /** Draft flag — excluded from production builds */
  draft?: boolean
  /** Feature flags required for this page to be visible */
  featureFlags?: string[]
  /** Short excerpt/summary for list displays */
  excerpt?: string
  /** Cover image for blog posts */
  coverImage?: string
  /** The extracted plain-text content of the page for search indexing */
  _content?: string
  /** The raw markdown content of the page */
  _rawContent?: string
  /** Extracted SEO and Open Graph metadata from frontmatter */
  seo?: Record<string, any>
  /** The publication date */
  date?: string | Date
  /** The last updated timestamp or date */
  lastUpdated?: string | number | Date
  /** Optional category for the page */
  category?: string
  /** Optional explicit order (alternative to sidebarPosition) */
  order?: number
  /** Optional explicit label for the sidebar */
  sidebarLabel?: string
  /** Whether the page is hidden from the sidebar */
  sidebarHidden?: boolean
  /** Raw extensible frontmatter data for custom components and formatters */
  frontmatter?: Record<string, any>
  /** Optional recursive child routes for deep sidebar hierarchies */
  subRoutes?: RouteMeta[]
  /** Clean URL segments stripped of locale/version prefixes */
  slugParts?: string[]
}

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
  codeTheme?: ShikiTheme | { light: ShikiTheme; dark: ShikiTheme }
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
 * Configuration for documentation versioning.
 */
export interface BoltdocsVersionsConfig {
  defaultVersion: string
  prefix?: string
  versions: BoltdocsVersionConfig[]
}

/**
 * Shared badge value type used in frontmatter, RouteMeta, and ComponentRoute.
 */
export type BadgeValue = string | { text: string; expires?: string }

/**
 * Context provided to plugin lifecycle hooks.
 */
export interface PluginContext {
  readonly config: BoltdocsConfig
  readonly logger: PluginLogger
  readonly store: PluginStore
  readonly meta: PluginMeta
  readonly docsDir: string
  readonly rootDir: string
  readonly outDir: string
  readonly routes: RouteMeta[]
}

/**
 * Logger interface for plugin logging.
 */
export interface PluginLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string | Error): void
  debug(message: string): void
}

/**
 * Key-value store interface for plugins.
 */
export interface PluginStore {
  get<T = unknown>(pluginName: string, key: string): T | undefined
  set(pluginName: string, key: string, value: unknown): void
  has(pluginName: string, key: string): boolean
}

/**
 * Plugin metadata provided in the context.
 */
export interface PluginMeta {
  name: string
  version?: string
  boltdocsVersion?: string
}

/**
 * Plugin lifecycle hooks with full type safety.
 */
export interface PluginLifecycleHooks {
  beforeBuild?: (ctx: PluginContext) => Promise<void> | void
  afterBuild?: (ctx: PluginContext) => Promise<void> | void
  beforeDev?: (ctx: PluginContext) => Promise<void> | void
  afterDev?: (ctx: PluginContext) => Promise<void> | void
  buildEnd?: (ctx: PluginContext) => Promise<void> | void
  transformSource?: (
    ctx: PluginContext,
    params: { code: string; filePath: string },
  ) => Promise<{ code: string }> | { code: string }
  transformMdx?: (
    ctx: PluginContext,
    params: { code: string; filePath: string },
  ) => Promise<{ code: string }> | { code: string }
  transformHtml?: (
    ctx: PluginContext,
    params: { html: string; path: string },
  ) => Promise<{ html: string }> | { html: string }
}

/**
 * MDX processor configuration.
 * When `processor` is set to 'satteri', the Sätteri Rust-based compiler is used.
 */
export interface BoltdocsMdxConfig {
  processor?: 'unified' | 'satteri'
}

/**
 * Defines a Boltdocs plugin.
 *
 * Use the `createPlugin()` helper from the node API for full type safety and
 * access to lifecycle hooks.
 */
export interface BoltdocsPlugin {
  name: string
  enforce?: 'pre' | 'post'
  version?: string
  boltdocsVersion?: string
  remarkPlugins?: unknown[]
  rehypePlugins?: unknown[]
  vitePlugins?: VitePlugin[]
  components?: Record<string, string>
  /**
   * Declarative layout slots. Each entry maps a slot id (e.g. `floating-bottom`,
   * `right-rail`) to a module path + optional named export that the default
   * `docs-layout-default` will mount at the corresponding position.
   */
  slots?: SlotDeclaration[]
  /** Lifecycle hooks with full type safety */
  hooks?: PluginLifecycleHooks
}

/**
 * A single slot declaration a plugin can emit to mount UI into a reserved
 * layout position without coupling to `packages/core`.
 *
 * - `id`: Reserved slot id from the core (e.g. `floating-bottom`, `right-rail`)
 *   OR a plugin-private id consumed by a custom layout.
 * - `modulePath`: ES module path that exports the component.
 * - `component`: Optional named export. If omitted, the module's default
 *   export is used.
 */
export interface SlotDeclaration {
  id: string
  modulePath: string
  component?: string
}

/**
 * Reserved slot ids the default docs layout understands. Layouts can support
 * additional plugin-private ids; the core layout only mounts these 7.
 */
export type ReservedSlotId =
  | 'floating-bottom'
  | 'right-rail'
  | 'navbar-extra'
  | 'header-extra'
  | 'toc-extra'
  | 'footer-extra'
  | 'body-portal'

/**
 * A single user-level slot override from `boltdocs.config.ts > slots`.
 *
 * - String shorthand: equivalent to `{ replace: <modulePath> }`.
 * - `replace`: replace all mounting of the slot (plugin-supplied components
 *   are discarded).
 * - `append`: append the user component after plugin-supplied ones.
 * - `disable`: remove the slot entirely (zero JS impact).
 */
export type BoltdocsSlotsEntry =
  | string
  | {
      replace?: string
      append?: string
      disable?: true
    }

/**
 * Top-level `slots` configuration block in `boltdocs.config.ts`.
 */
export type BoltdocsSlotsConfig = Record<string, BoltdocsSlotsEntry>

/**
 * Configuration for the collections (blog) feature.
 */
export interface BoltdocsCollectionsConfig {
  /** Number of posts per page in collection listing pages. Defaults to 10. */
  postsPerPage?: number
  /** The name of the default collection used by BlogList when none is specified. */
  defaultCollection?: string
  /** Date format string for rendering post dates (e.g., 'MMMM dd, yyyy'). */
  dateFormat?: string
  /** Field to sort posts by. Defaults to 'date'. */
  sortBy?: 'date' | 'title' | 'sidebarPosition'
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

/**
 * Configuration for SEO.
 */
export interface BoltdocsSeoConfig {
  metatags?: Record<string, string>
  indexing?: 'all' | 'public'
  thumbnails?: {
    background?: string
  }
  verification?: BoltdocsVerificationConfig
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
  plugins?: BoltdocsPlugin[]
  slots?: BoltdocsSlotsConfig
  collections?: BoltdocsCollectionsConfig
  robots?: BoltdocsRobotsConfig
  security?: BoltdocsSecurityConfig
  seo?: BoltdocsSeoConfig
  integrations?: BoltdocsIntegrationsConfig
  drafts?: BoltdocsDraftsConfig
  featureFlags?: Record<string, boolean | string>
  directoryMeta?: Record<string, unknown>
  vite?: unknown
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

export type BoltdocsRoutePathWithFallback = BoltdocsRoutePath extends never
  ? string
  : BoltdocsRoutePath

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
  : {
      [key: string]: ComponentType<any>
      Frontmatter: Record<string, ComponentType<any>>
    }
