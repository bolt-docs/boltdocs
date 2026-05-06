import type { BoltdocsConfig } from '../config'
import { PluginHookError } from './plugin-errors'
import type {
  PluginLifecycleHooks,
  SecureBoltdocsPlugin,
  PluginContext,
  PluginLogger,
} from './plugin-types'
import { BoltdocsPluginStore } from './plugin-store'
import { PluginSandbox } from './plugin-sandbox'

/**
 * Manages the lifecycle of all loaded plugins, ensuring hooks are executed
 * in the correct order with proper error isolation and context.
 */
export class PluginLifecycleManager {
  private plugins: SecureBoltdocsPlugin[]
  private config: BoltdocsConfig
  private store: BoltdocsPluginStore

  constructor(plugins: SecureBoltdocsPlugin[], config: BoltdocsConfig) {
    this.plugins = plugins
    this.config = config
    this.store = new BoltdocsPluginStore()
  }

  /**
   * Runs a specific hook for all plugins that implement it.
   */
  public async runHook(
    hookName: keyof PluginLifecycleHooks,
    ...args: any[]
  ): Promise<void> {
    const sortedPlugins = this.getSortedPlugins()

    for (const plugin of sortedPlugins) {
      if (!plugin.hooks?.[hookName]) continue

      const context = this.createContext(plugin)
      const isBuildHook = hookName.toLowerCase().includes('build')
      const isDevHook = hookName.toLowerCase().includes('dev')
      const permission = isBuildHook
        ? 'hooks:build'
        : isDevHook
          ? 'hooks:dev'
          : undefined

      try {
        if (permission) {
          await PluginSandbox.executeWithIsolation(
            plugin,
            permission,
            hookName,
            () => (plugin.hooks![hookName] as any)(context, ...args),
          )
        } else {
          // Hooks like configResolved might not require specific permissions or are always allowed
          await (plugin.hooks![hookName] as any)(context, ...args)
        }
      } catch (error) {
        // Isolate error: logging it but allowing other plugins to continue
        const hookError = new PluginHookError(
          plugin.name,
          hookName,
          error instanceof Error ? error : new Error(String(error)),
        )
        context.logger.error(hookError)
      }
    }
  }

  /**
   * Sorts plugins based on their 'enforce' property (pre -> normal -> post).
   */
  private getSortedPlugins(): SecureBoltdocsPlugin[] {
    const pre = this.plugins.filter((p) => p.enforce === 'pre')
    const normal = this.plugins.filter((p) => !p.enforce)
    const post = this.plugins.filter((p) => p.enforce === 'post')
    return [...pre, ...normal, ...post]
  }

  /**
   * Creates a specialized context for a plugin.
   */
  private createContext(plugin: SecureBoltdocsPlugin): PluginContext {
    return {
      config: Object.freeze({ ...this.config }),
      meta: {
        name: plugin.name,
        version: plugin.version,
        boltdocsVersion: plugin.boltdocsVersion,
      },
      store: {
        get: (p, k) => this.store.get(p, k),
        set: (p, k, v) => this.store.set(p, k, v),
        has: (p, k) => this.store.has(p, k),
      },
      logger: this.createLogger(plugin.name),
    }
  }

  /**
   * Creates a namespaced logger for a plugin.
   */
  private createLogger(pluginName: string): PluginLogger {
    const prefix = `[plugin:${pluginName}]`
    return {
      info: (msg) => console.log(`${prefix} INFO: ${msg}`),
      warn: (msg) => console.warn(`${prefix} WARN: ${msg}`),
      error: (msg) => {
        const message = msg instanceof Error ? msg.message : msg
        console.error(`${prefix} ERROR: ${message}`)
      },
      debug: (msg) => console.debug(`${prefix} DEBUG: ${msg}`),
    }
  }
}
