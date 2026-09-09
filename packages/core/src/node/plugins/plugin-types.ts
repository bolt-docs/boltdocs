import type { Plugin as VitePlugin } from 'vite'
import type {
  PluginContext,
  PluginLogger,
  PluginStore,
  PluginMeta,
  PluginLifecycleHooks,
} from '../../shared/types'

export type {
  PluginContext,
  PluginLogger,
  PluginStore,
  PluginMeta,
  PluginLifecycleHooks,
}

export interface PluginCssConfig {
  /** CSS files to inject automatically into entry bundle */
  cssFiles?: string[]
  /** Inline CSS strings to inject into HTML <head> */
  headStyles?: string[]
  /** PostCSS plugins to append to Vite CSS pipeline */
  postcssPlugins?: unknown[]
  /** Vite CSS preprocessor options (e.g. scss, less, stylus) */
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
  middleware?: import('../../shared/types').PluginTransformMiddleware[]
  hooks?: PluginLifecycleHooks
}
