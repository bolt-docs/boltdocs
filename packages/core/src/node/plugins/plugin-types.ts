import type { Plugin as VitePlugin } from 'vite'
import type { BoltdocsConfig } from '../config'

/**
 * Permissions that a plugin can request to access specific Boltdocs capabilities.
 */
export type PluginPermission =
  | 'fs:read' // Read filesystem
  | 'fs:write' // Write filesystem
  | 'vite:config' // Modify Vite config
  | 'mdx:remark' // Add remark plugins
  | 'mdx:rehype' // Add rehype plugins
  | 'components' // Register MDX components
  | 'hooks:build' // Access build lifecycle hooks
  | 'hooks:dev' // Access dev lifecycle hooks
  | 'analytics:track' // Track analytics events client-side
  | 'analytics:config' // Access analytics configuration

/**
 * Shared context injected into every plugin lifecycle hook.
 */
export interface PluginContext {
  /** The full, resolved Boltdocs configuration (Readonly) */
  readonly config: BoltdocsConfig
  /** A plugin-specific logger */
  readonly logger: PluginLogger
  /** A shared store for dependency injection and state sharing between plugins */
  readonly store: PluginStore
  /** Metadata about the current plugin */
  readonly meta: PluginMeta
}

/**
 * Simple logger interface for plugins.
 */
export interface PluginLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string | Error): void
  debug(message: string): void
}

/**
 * A shared key-value store that allows plugins to share state and configuration.
 */
export interface PluginStore {
  /** Get a value from the store. Keys are namespaced by plugin internally. */
  get<T = unknown>(pluginName: string, key: string): T | undefined
  /** Set a value in the store. */
  set(pluginName: string, key: string, value: unknown): void
  /** Check if a key exists in the store. */
  has(pluginName: string, key: string): boolean
}

/**
 * Metadata for a plugin, used for identification and compatibility checks.
 */
export interface PluginMeta {
  /** Unique identifier for the plugin */
  name: string
  /** Version of the plugin itself (semver) */
  version?: string
  /** Minimum required version of Boltdocs (semver range) */
  boltdocsVersion?: string
}

/**
 * Lifecycle hooks that a plugin can implement to hook into the build and dev processes.
 */
export interface PluginLifecycleHooks {
  /** Called before the build process starts */
  beforeBuild?: (ctx: PluginContext) => Promise<void> | void
  /** Called after the build process finishes successfully */
  afterBuild?: (ctx: PluginContext) => Promise<void> | void
  /** Called before the dev server starts */
  beforeDev?: (ctx: PluginContext) => Promise<void> | void
  /** Called after the dev server is ready (configureServer) */
  afterDev?: (ctx: PluginContext) => Promise<void> | void
  /** Called when the final Boltdocs config is resolved */
  configResolved?: (ctx: PluginContext, config: BoltdocsConfig) => void
  /** Called when the build is closing */
  buildEnd?: (ctx: PluginContext) => Promise<void> | void
}

/**
 * The extended, secure Boltdocs plugin interface.
 */
export interface SecureBoltdocsPlugin {
  /** A unique name for the plugin (e.g., 'boltdocs-plugin-mermaid') */
  name: string
  /** Whether to run this plugin before or after default ones */
  enforce?: 'pre' | 'post'
  /** Version of the plugin (optional, but recommended for security) */
  version?: string
  /** Minimum compatible Boltdocs version (optional, semver range) */
  boltdocsVersion?: string
  /** List of permissions this plugin requires to operate */
  permissions?: PluginPermission[]
  /** Optional remark plugins to add to the MDX pipeline (requires 'mdx:remark' permission) */
  remarkPlugins?: unknown[]
  /** Optional rehype plugins to add to the MDX pipeline (requires 'mdx:rehype' permission) */
  rehypePlugins?: unknown[]
  /** Optional Vite plugins to inject into the build process (requires 'vite:config' permission) */
  vitePlugins?: VitePlugin[]
  /** Optional custom React components to register in MDX. Map of Name -> Module Path. (requires 'components' permission) */
  components?: Record<string, string>
  /** Implementation of lifecycle hooks (requires 'hooks:build' or 'hooks:dev' permissions) */
  hooks?: PluginLifecycleHooks
}
