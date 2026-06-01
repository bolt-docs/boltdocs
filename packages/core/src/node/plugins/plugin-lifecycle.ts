import type { BoltdocsConfig } from '../config'
import { PluginHookError } from './plugin-errors'
import type {
  PluginLifecycleHooks,
  SecureBoltdocsPlugin,
  PluginContext,
  PluginLogger,
} from './plugin-types'
import { BoltdocsPluginStore } from './plugin-store'
import { Pipeline, type PipelineStep } from '../pipeline'
import * as dui from '@bdocs/dui'

export class PluginLifecycleManager {
  private plugins: SecureBoltdocsPlugin[]
  private config: BoltdocsConfig
  private store: BoltdocsPluginStore
  private docsDir: string
  private rootDir: string

  constructor(
    plugins: SecureBoltdocsPlugin[],
    config: BoltdocsConfig,
    docsDir?: string,
    rootDir?: string,
  ) {
    this.plugins = plugins
    this.config = config
    this.store = new BoltdocsPluginStore()
    this.docsDir = docsDir || process.cwd()
    this.rootDir = rootDir || process.cwd()
  }

  public async runHook(
    hookName: keyof PluginLifecycleHooks,
    ...args: unknown[]
  ): Promise<void> {
    const sortedPlugins = this.getSortedPlugins()
    const pipeline = new Pipeline<Record<string, unknown>>()

    for (const plugin of sortedPlugins) {
      if (!plugin.hooks?.[hookName]) continue

      pipeline.addStep(this.createStep(plugin, hookName, args))
    }

    await pipeline.run({})
  }

  public async runChain<TParams>(
    hookName: keyof PluginLifecycleHooks,
    initialParams: TParams,
  ): Promise<TParams> {
    const sortedPlugins = this.getSortedPlugins()
    let params = initialParams

    for (const plugin of sortedPlugins) {
      if (!plugin.hooks?.[hookName]) continue

      const context = this.createContext(plugin)
      try {
        const hookFn = plugin.hooks[hookName] as Function
        const result = await hookFn(context, params)
        if (result !== undefined) {
          params = result as TParams
        }
      } catch (error) {
        const hookError = new PluginHookError(
          plugin.name,
          hookName,
          error instanceof Error ? error : new Error(String(error)),
        )
        context.logger.error(hookError)
      }
    }

    return params
  }

  private getSortedPlugins(): SecureBoltdocsPlugin[] {
    const pre = this.plugins.filter((p) => p.enforce === 'pre')
    const normal = this.plugins.filter((p) => !p.enforce)
    const post = this.plugins.filter((p) => p.enforce === 'post')
    return [...pre, ...normal, ...post]
  }

  private createStep(
    plugin: SecureBoltdocsPlugin,
    hookName: keyof PluginLifecycleHooks,
    args: unknown[],
  ): PipelineStep {
    return {
      name: `${plugin.name}:${String(hookName)}`,
      execute: async () => {
        const context = this.createContext(plugin)
        try {
          const hookFn = plugin.hooks![hookName] as Function
          await hookFn(context, ...args)
        } catch (error) {
          const hookError = new PluginHookError(
            plugin.name,
            hookName,
            error instanceof Error ? error : new Error(String(error)),
          )
          context.logger.error(hookError)
        }
      },
      rollback: async () => {
        const rollbackHook = plugin.hooks?.buildEnd
        if (rollbackHook) {
          const context = this.createContext(plugin)
          try {
            await rollbackHook(context)
          } catch {
            // Silently ignore rollback errors
          }
        }
      },
    }
  }

  private createContext(plugin: SecureBoltdocsPlugin): PluginContext {
    return {
      config: Object.freeze({ ...this.config }),
      docsDir: this.docsDir,
      rootDir: this.rootDir,
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

  private createLogger(pluginName: string): PluginLogger {
    const prefix = `[plugin:${pluginName}]`
    return {
      info: (msg) => dui.info(`${prefix} ${msg}`),
      warn: (msg) => dui.warn(`${prefix} ${msg}`),
      error: (msg) => {
        dui.error(`${prefix} ${msg instanceof Error ? msg.message : msg}`)
      },
      debug: (msg) => dui.debug(`${prefix} ${msg}`),
    }
  }
}
