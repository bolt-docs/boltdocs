import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AliasOptions, Plugin as VitePlugin, UserConfig } from 'vite'
import type {
  BoltdocsConfigContract,
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

/**
 * Theme and social-link shapes moved to `@bdocs/contracts`, because the browser
 * reads them: the navbar renders the title, the logo and the social entries.
 * Re-exported here so every existing `from 'shared/types'` import keeps working.
 */
export type { BoltdocsSocialLink, BoltdocsThemeConfig } from '@bdocs/contracts'

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
  RedirectConfig,
  RedirectStatus,
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
  aliases?: AliasOptions
  vite?: UserConfig
}

/**
 * The `Boltdocs` global namespace and the aliases derived from it.
 *
 * The declaration itself moved to `@bdocs/runtime`, and it had to: TypeScript
 * rejects two `declare global` blocks for the same namespace, and this file plus
 * the runtime both need `Boltdocs.Types` and `Boltdocs.RoutePaths`. One home, and
 * it is the package a consumer imports the augmented types through.
 */
export type {
  BoltdocsLocale,
  BoltdocsMdxComponents,
  BoltdocsRoutePath,
  BoltdocsRoutePathWithFallback,
  BoltdocsTypes,
  BoltdocsVersion,
  ExternalRouteReference,
  TransformMdxComponents,
  UnpackMdxComponents,
} from '@bdocs/runtime'
