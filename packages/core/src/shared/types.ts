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
  /** Namespaced cache helpers bound to the core's cache machinery. */
  readonly caches: PluginCachesAPI
  /** Structured diagnostics channel; reports can be drained via `list()`. */
  readonly diagnostics: PluginDiagnosticsAPI
  /** Helpers for resolving paths inside the workspace safely. */
  readonly paths: PluginPathsAPI
  /** Declare virtual modules the core should expose to Vite. */
  readonly virtualModules: PluginVirtualModulesAPI
  /** Register and query transform middleware at runtime. */
  readonly middleware: PluginMiddlewareAPI
  /**
   * Hook into dev-server file watching and send custom HMR events
   * to connected clients.
   */
  readonly hmr: PluginHmrAPI
  /**
   * Register HTTP middleware and server lifecycle hooks without
   * writing a Vite plugin.
   */
  readonly server: PluginServerAPI
}

/**
 * Functional cache helpers exposed through `PluginContext.caches`.
 *
 * Plugin authors do not get a reference to the raw `TransformCache` /
 * `FileCache` instances — those stay encapsulated in core. The methods
 * returned here are bound to namespaced keys so two plugins cannot
 * collide.
 */
export interface PluginCachesAPI {
  /** Sharded, hash-keyed cache. One namespace per plugin recommended. */
  transform(namespace: string): PluginTransformCacheAPI
  /** Routes cache wrapper around the parsed-doc cache. */
  routes: PluginRoutesCacheAPI
  /** In-memory LRU cache keyed by namespace + plugin-supplied key. */
  memory<V = unknown>(
    namespace: string,
    opts?: { max?: number; ttl?: number },
  ): PluginMemoryCacheAPI<V>
}

export interface PluginTransformCacheAPI {
  /** Async read — first call may warm from disk if the entry was evicted. */
  get(key: string): Promise<string | null>
  /** Synchronous write that batches a background disk flush. */
  set(key: string, value: string): void
  /** Force-flush background writes. Call before measuring disk state. */
  flush(): Promise<void>
}

export interface PluginRoutesCacheAPI {
  /** Read a parsed `RouteMeta` (and its private `_content` blob) by abs file path. */
  get(filePath: string): RouteMeta | null
  /** Write a parsed route entry. Caller assumptions match `docCache.set`. */
  set(filePath: string, route: RouteMeta): void
  /** Invalidate one route. Use when content changes. */
  invalidate(filePath: string): void
  /** Clear every cached route. Use when the directory layout changes. */
  invalidateAll(): void
}

export interface PluginMemoryCacheAPI<V> {
  get(key: string): V | undefined
  set(key: string, value: V): void
  has(key: string): boolean
}

/**
 * Plugin diagnostics API.
 *
 * Plugins push structured records instead of spamming the logger; downstream
 * tools (dev-server overlay, CI reporters, IDE plugins) drain the queue via
 * `list()`.
 */
export interface DiagnosticRecord {
  readonly id: number
  readonly severity: 'info' | 'warn' | 'error'
  readonly code: string
  readonly message: string
  readonly pluginName: string
  readonly filePath?: string
  readonly routePath?: string
  readonly time: Date
}

export interface PluginDiagnosticsAPI {
  report(
    severity: DiagnosticRecord['severity'],
    code: string,
    message: string,
    where?: { filePath?: string; routePath?: string },
  ): void
  list(): readonly DiagnosticRecord[]
  clear(): void
}

/**
 * Path-resolution helpers exposed through `PluginContext.paths`.
 *
 * Both `resolveDocs` and `resolveAsset` validate the resulting path against
 * the workspace boundary and reject any segment that resolves outside the
 * docs / project root directories.
 */
export interface PluginPathsAPI {
  resolveDocs(...parts: string[]): string
  resolveAsset(...parts: string[]): string
  /**
   * Build a `file://` URL for an absolute path inside the workspace.
   * Useful for `new URL(import.meta.url)` replacements and image srcsets.
   */
  safeFileURL(absFilePath: string): string
}

/**
 * Plugin virtual-modules registration.
 *
 * Plugins call `add(id, loader)` to expose a `virtual:<plugin>/<id>` module
 * to Vite without having to author a full Vite plugin. The loader returns
 * the module source code as a string; the core wraps it in the right
 * `resolveId`/`load` plumbing at Vite build time.
 */
export interface RegisteredVirtualModule {
  readonly id: string
  readonly eager: boolean
  readonly loader: () => string | Promise<string>
}

export interface PluginVirtualModulesAPI {
  add(
    id: string,
    loader: () => string | Promise<string>,
    opts?: { eager?: boolean },
  ): void
  has(id: string): boolean
  list(): readonly RegisteredVirtualModule[]
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
 * Chain control signal returned by transform hooks. Use with `__signal` in
 * the return value to influence the middleware chain:
 *
 * - `'skip'`: stop processing this hook for the current file (remaining
 *   plugins in the chain still run).
 * - `'break'`: stop the entire chain immediately — no further plugin's
 *   transform hooks run for this file.
 *
 * @example
 * ```ts
 * transformMdx: async (_ctx, { code }) => ({
 *   code: code.replace(/foo/g, 'bar'),
 *   __signal: 'skip',   // skip remaining plugins
 * })
 * ```
 */
export type ChainSignal = 'skip' | 'break'

/**
 * Returned by a transform hook that wants to signal the chain. The `__signal`
 * field is optional — most hooks will just return `{ code: string }` and the
 * chain continues normally. When `__signal` is present, `runChain` reacts:
 *
 * - `'skip'` continues with the next plugin, but passes the **original params**
 *   (the output of this hook is discarded).
 * - `'break'` stops the chain immediately.
 *
 * @template T The params shape (e.g. `{ code: string; filePath: string }`).
 */
export type TransformResult<T> = T & { __signal?: ChainSignal }

/**
 * Enriched params passed to `transformSource` and `transformMdx`. The `code`
 * and `filePath` fields are always present. The optional `frontmatter` and
 * `route` fields are populated when available (they are `undefined` in the
 * early pipeline where frontmatter hasn't been parsed yet).
 */
export interface TransformSourceParams {
  /** The raw or compiled code (source before MDX / JS after MDX). */
  code: string
  /** Absolute file path of the source document. */
  filePath: string
  /** Parsed frontmatter, if available. `undefined` in very early pipeline. */
  frontmatter?: Record<string, unknown>
}

/**
 * Enriched params passed to `transformHtml`. The `html` and `path` fields
 * are always present. The optional `route` carries the generated `RouteMeta`
 * for richer context (locale, version, collection, etc.).
 */
export interface TransformHtmlParams {
  /** The rendered HTML string for this page. */
  html: string
  /** The route path (e.g. `/docs/guides/start`). */
  path: string
  /** The route metadata for the page, if available. */
  route?: RouteMeta
}

/**
 * Plugin transform middleware. Each middleware runs in the transform
 * pipeline alongside lifecycle hooks. The `name` field is optional —
 * when omitted, the owning plugin's name is used as context.
 * Middleware runs in `enforce` order (pre → normal → post) and supports
 * `__signal: 'skip'` / `__signal: 'break'` for chain control.
 */
export interface PluginTransformMiddleware {
  /** Optional name. Defaults to the owning plugin's name for diagnostics. */
  name?: string
  enforce?: 'pre' | 'post'
  transformSource?: (
    ctx: PluginContext,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  transformMdx?: (
    ctx: PluginContext,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  transformHtml?: (
    ctx: PluginContext,
    params: TransformHtmlParams,
  ) =>
    | TransformResult<{ html: string }>
    | Promise<TransformResult<{ html: string }>>
}

/**
 * Plugin middleware registry API exposed through `PluginContext.middleware`.
 * Plugins can register named middleware entries from lifecycle hooks.
 */
export interface PluginMiddlewareAPI {
  add(middleware: PluginTransformMiddleware): void
  remove(name: string): void
  has(name: string): boolean
  list(): readonly PluginTransformMiddleware[]
}

/**
 * HMR event types plugins can listen to.
 */
export type PluginHmrEvent = 'add' | 'change' | 'unlink'

/**
 * Plugin HMR API — hook into file-watching events and send custom
 * HMR messages to connected clients.
 */
export interface PluginHmrAPI {
  /**
   * Register a callback for file events scoped to the docs directory.
   * The callback receives the normalized file path and event type.
   */
  onFileEvent(
    eventType: PluginHmrEvent,
    handler: (filePath: string) => void | Promise<void>,
  ): void
  /** Shorthand for `onFileEvent('add', handler)`. */
  onFileAdd(handler: (filePath: string) => void | Promise<void>): void
  /** Shorthand for `onFileEvent('change', handler)`. */
  onFileChange(handler: (filePath: string) => void | Promise<void>): void
  /** Shorthand for `onFileEvent('unlink', handler)`. */
  onFileUnlink(handler: (filePath: string) => void | Promise<void>): void
  /**
   * Send a custom HMR event to all connected clients.
   * The client can listen with `import.meta.hot.on('boltdocs:plugin:<name>', ...)`.
   */
  send(event: string, data?: unknown): void
}

/**
 * Plugin Server API — register HTTP middleware and lifecycle hooks
 * for the dev server and preview server, without writing a Vite plugin.
 */
export interface PluginServerAPI {
  /**
   * Register a Connect-style middleware function.
   * Runs on both dev and preview servers.
   */
  use(middleware: PluginServerMiddleware): void
  /**
   * Register a middleware scoped to a specific path prefix.
   * Only requests starting with `path` trigger the handler.
   */
  useAt(path: string, handler: PluginServerMiddleware): void
  /** Called when the dev/preview server starts (once per process). */
  onStart(callback: () => void | Promise<void>): void
  /** Called when the server shuts down (cleanup). */
  onEnd(callback: () => void | Promise<void>): void
}

/**
 * Connect-style middleware signature.
 */
export type PluginServerMiddleware = (
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  next: (err?: unknown) => void,
) => void | Promise<void>

/**
 * Public API surface of the core plugin lifecycle manager.
 *
 * This is exposed as an interface so that plugin authors and internal
 * subsystems can receive a reference to the lifecycle manager without
 * pulling in the concrete class (which has private members and is not
 * stable across source/dist boundaries during development).
 */
export interface IPluginLifecycleManager {
  runHook(
    hookName: keyof PluginLifecycleHooks,
    ...args: unknown[]
  ): Promise<void>
  runChain<TParams extends Record<string, unknown>>(
    hookName: keyof PluginLifecycleHooks,
    initialParams: TParams,
  ): Promise<TParams>
  runMiddlewareChain<TParams extends Record<string, unknown>>(
    hookName: 'transformSource' | 'transformMdx' | 'transformHtml',
    initialParams: TParams,
  ): Promise<TParams>
  hasHook(
    hookName:
      | keyof PluginLifecycleHooks
      | 'transformSource'
      | 'transformMdx'
      | 'transformHtml',
  ): boolean
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
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  transformMdx?: (
    ctx: PluginContext,
    params: TransformSourceParams,
  ) =>
    | TransformResult<{ code: string }>
    | Promise<TransformResult<{ code: string }>>
  transformHtml?: (
    ctx: PluginContext,
    params: TransformHtmlParams,
  ) =>
    | TransformResult<{ html: string }>
    | Promise<TransformResult<{ html: string }>>
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
  : Omit<Record<string, ComponentType<any>>, 'Frontmatter'> & {
      Frontmatter: Record<string, ComponentType<any>>
    }
