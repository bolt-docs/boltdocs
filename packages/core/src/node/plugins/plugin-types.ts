import type { Plugin as VitePlugin } from 'vite'
import type { BoltdocsConfig } from '../config'

export interface PluginContext {
  readonly config: BoltdocsConfig
  readonly logger: PluginLogger
  readonly store: PluginStore
  readonly meta: PluginMeta
  readonly docsDir: string
  readonly rootDir: string
}

export interface PluginLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string | Error): void
  debug(message: string): void
}

export interface PluginStore {
  get<T = unknown>(pluginName: string, key: string): T | undefined
  set(pluginName: string, key: string, value: unknown): void
  has(pluginName: string, key: string): boolean
}

export interface PluginMeta {
  name: string
  version?: string
  boltdocsVersion?: string
}

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

export interface SecureBoltdocsPlugin {
  name: string
  enforce?: 'pre' | 'post'
  version?: string
  boltdocsVersion?: string
  remarkPlugins?: unknown[]
  rehypePlugins?: unknown[]
  vitePlugins?: VitePlugin[]
  components?: Record<string, string>
  hooks?: PluginLifecycleHooks
}
