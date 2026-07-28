import type { BoltdocsConfig } from '../config'
import type { RouteMeta } from '../routes/types'
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
import {
  createPluginCachesAPI,
  createPluginDiagnosticsAPI,
  createPluginHmrAPI,
  createPluginMiddlewareAPI,
  createPluginPathsAPI,
  createPluginServerAPI,
  createPluginVirtualModulesAPI,
  middlewareRegistry,
} from './plugin-context'
import type {
  PluginTransformMiddleware,
  IPluginLifecycleManager,
} from '../../shared/types'

export class PluginLifecycleManager implements IPluginLifecycleManager {
  private plugins: SecureBoltdocsPlugin[]
  private config: BoltdocsConfig
  private store: BoltdocsPluginStore
  private docsDir: string
  private rootDir: string
  private routes: RouteMeta[]
  private outDir: string

  constructor(
    plugins: SecureBoltdocsPlugin[],
    config: BoltdocsConfig,
    docsDir?: string,
    rootDir?: string,
    routes?: RouteMeta[],
    outDir?: string,
  ) {
    this.plugins = plugins
    this.config = config
    this.store = new BoltdocsPluginStore()
    this.docsDir = docsDir || process.cwd()
    this.rootDir = rootDir || process.cwd()
    this.routes = routes || []
    this.outDir = outDir || 'dist'
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

  public async runChain<TParams extends Record<string, unknown>>(
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
          // Check for chain control signals (backwards-compatible — hooks
          // that don't set __signal behave exactly as before).
          const signal: string | undefined = (result as any).__signal
          if (signal === 'break') {
            // Stop the chain immediately, discard the final plugin's
            // result so transformations from earlier plugins are kept.
            break
          }
          if (signal === 'skip') {
            // The hook signals that no more plugins should process
            // this item. The current plugin's result is kept.
            params = result as TParams
            break
          }
          // Normal pass-through: update params and continue.
          params = result as TParams
        }
      } catch (error) {
        const hookError = new PluginHookError(
          plugin.name,
          hookName,
          error instanceof Error ? error : new Error(String(error)),
        )
        context.logger.error(hookError)
        // Report to diagnostics too so dev-server overlays can show it.
        context.diagnostics.report(
          'error',
          `PLUGIN_HOOK_ERROR`,
          hookError.message,
        )
      }
    }

    return params
  }

  /**
   * Run registered transform middleware in `enforce` order over a chain of
   * params. Middleware registered via `ctx.middleware.add()` from lifecycle
   * hooks or declared statically via `BoltdocsPlugin.middleware` are all
   * collected. Execution respects `__signal: 'skip'` and `__signal: 'break'`.
   */
  public hasHook(
    hookName:
      | keyof PluginLifecycleHooks
      | 'transformSource'
      | 'transformMdx'
      | 'transformHtml',
  ): boolean {
    // Lifecycle hooks
    if (
      this.plugins.some(
        (p) => p.hooks?.[hookName as keyof PluginLifecycleHooks],
      )
    ) {
      return true
    }

    // Static middleware declarations
    const staticMiddleware = this.plugins.flatMap((p) => p.middleware ?? [])
    if (
      staticMiddleware.some(
        (m) =>
          m[hookName as 'transformSource' | 'transformMdx' | 'transformHtml'],
      )
    ) {
      return true
    }

    // Programmatic middleware registrations
    if (
      (hookName === 'transformSource' ||
        hookName === 'transformMdx' ||
        hookName === 'transformHtml') &&
      [...middlewareRegistry.values()].some(
        (m) =>
          m[hookName as 'transformSource' | 'transformMdx' | 'transformHtml'],
      )
    ) {
      return true
    }

    return false
  }

  public async runMiddlewareChain<TParams extends Record<string, unknown>>(
    hookName: 'transformSource' | 'transformMdx' | 'transformHtml',
    initialParams: TParams,
  ): Promise<TParams> {
    // Collect middleware: static declarations + programmatic registrations.
    const staticMiddleware = this.plugins.flatMap((p) => p.middleware ?? [])
    const programmaticMiddleware = [...middlewareRegistry.values()]
    const all = [...staticMiddleware, ...programmaticMiddleware]

    // Sort by enforce: pre → normal → post
    const sorted = [
      ...all.filter((m) => m.enforce === 'pre'),
      ...all.filter((m) => !m.enforce),
      ...all.filter((m) => m.enforce === 'post'),
    ]

    let params = initialParams
    for (const mw of sorted) {
      const hookFn = mw[hookName] as Function | undefined
      if (!hookFn) continue

      // Create a minimal context for the middleware. Middleware context
      // doesn't have a single owning plugin, so we use a generic context.
      const context = this.createGenericContext()
      try {
        const result = await hookFn(context, params)
        if (result !== undefined) {
          const signal: string | undefined = (result as any).__signal
          if (signal === 'break') break
          if (signal === 'skip') {
            params = result as TParams
            break
          }
          params = result as TParams
        }
      } catch (error) {
        const mwName = mw.name ?? '<unnamed>'
        context.diagnostics.report(
          'error',
          `MIDDLEWARE_ERROR`,
          `Middleware '${mwName}' threw: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
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
      outDir: this.outDir,
      routes: this.routes,
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
      caches: createPluginCachesAPI(),
      diagnostics: createPluginDiagnosticsAPI(plugin.name),
      paths: createPluginPathsAPI(this.docsDir, this.rootDir),
      virtualModules: createPluginVirtualModulesAPI(),
      middleware: createPluginMiddlewareAPI(),
      hmr: createPluginHmrAPI(),
      server: createPluginServerAPI(),
    }
  }

  private createGenericContext(): PluginContext {
    const name = '<middleware>'
    return {
      config: Object.freeze({ ...this.config }),
      docsDir: this.docsDir,
      rootDir: this.rootDir,
      outDir: this.outDir,
      routes: this.routes,
      meta: { name },
      store: {
        get: (p, k) => this.store.get(p, k),
        set: (p, k, v) => this.store.set(p, k, v),
        has: (p, k) => this.store.has(p, k),
      },
      logger: this.createLogger(name),
      caches: createPluginCachesAPI(),
      diagnostics: createPluginDiagnosticsAPI(name),
      paths: createPluginPathsAPI(this.docsDir, this.rootDir),
      virtualModules: createPluginVirtualModulesAPI(),
      middleware: createPluginMiddlewareAPI(),
      hmr: createPluginHmrAPI(),
      server: createPluginServerAPI(),
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
