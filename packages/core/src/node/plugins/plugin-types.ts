import type { Plugin as VitePlugin } from 'vite'
import type {
  PluginContext,
  PluginLogger,
  PluginStore,
  PluginMeta,
  PluginLifecycleHooks,
  SlotDeclaration,
} from '../../shared/types'

export type {
  PluginContext,
  PluginLogger,
  PluginStore,
  PluginMeta,
  PluginLifecycleHooks,
  SlotDeclaration,
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
  slots?: SlotDeclaration[]
  metadata?: Record<string, unknown>
  hooks?: PluginLifecycleHooks
}
