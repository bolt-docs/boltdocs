import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AliasOptions, Plugin as VitePlugin, UserConfig } from 'vite'
import type { ComponentType } from 'react'
import type {
  BoltdocsConfigContract,
  CodeHighlightConfig,
  CodeTheme,
  IPluginLifecycleManager as ContractIPluginLifecycleManager,
  PluginContext as ContractPluginContext,
  PluginCssDefinition as ContractPluginCssDefinition,
  PluginDefinition as ContractPluginDefinition,
  PluginLifecycleHooks as ContractPluginLifecycleHooks,
  PluginMiddlewareAPI as ContractPluginMiddlewareAPI,
  PluginServerAPI as ContractPluginServerAPI,
  PluginServerMiddleware as ContractPluginServerMiddleware,
  PluginTransformMiddleware as ContractPluginTransformMiddleware,
} from '@bdocs/contracts'

export type {
  BadgeValue,
  BoltdocsAlgoliaConfig,
  BoltdocsCollectionsConfig,
  BoltdocsConfigContract,
  BoltdocsCustomFeedbackConfig,
  BoltdocsDraftsConfig,
  BoltdocsExperimentalConfig,
  BoltdocsGA4Config,
  BoltdocsGTMConfig,
  BoltdocsGiscusConfig,
  BoltdocsI18nConfig,
  BoltdocsIntegrationsConfig,
  BoltdocsLocaleConfig,
  BoltdocsMdxConfig,
  BoltdocsPostHogConfig,
  BoltdocsRobotsConfig,
  BoltdocsSecurityConfig,
  BoltdocsSeoConfig,
  BoltdocsSsgConfig,
  BoltdocsUiSlot,
  BoltdocsVercelConfig,
  BoltdocsVerificationConfig,
  BoltdocsVersionConfig,
  BoltdocsVersionsConfig,
  BoltdocsViewTransitionsConfig,
  ChainSignal,
  CodeHighlightConfig,
  CodeHighlighterAdapter,
  CodeHighlighterEngine,
  CodeHighlighterRuntime,
  CodeTheme,
  DiagnosticRecord,
  ExperimentalViewTransitions,
  ExternalFileRoute,
  JsonLdObject,
  JsonLdPrimitive,
  JsonLdValue,
  ParsedMetaLike,
  PluginCachesAPI,
  PluginClientConfig,
  PluginCssDefinition,
  PluginDefinition,
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
  StructuredData,
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
 * Defines a Boltdocs plugin.
 *
 * Use the `definePlugin()` or `createPlugin()` helper from the node API for full
 * type safety and access to lifecycle hooks.
 */
export interface PluginCssConfig extends ContractPluginCssDefinition {}

export interface BoltdocsPlugin
  extends ContractPluginDefinition<
    BoltdocsConfig,
    IncomingMessage,
    ServerResponse
  > {
  vitePlugins?: VitePlugin[]
}

/**
 * The root configuration object for Boltdocs.
 */
export interface BoltdocsConfig extends BoltdocsConfigContract<BoltdocsPlugin> {
  theme?: BoltdocsThemeConfig
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
