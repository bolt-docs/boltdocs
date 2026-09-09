import type { BoltdocsConfig } from '../config'
import type { RouteMeta } from '../routes/types'
import {
  getRouteGenerationFingerprint,
  getRouteCacheContext,
  getRouteCacheVariant,
  type RouteCacheContext,
  type RouteCacheVariant,
} from '../routes/cache'
import { PluginHookError } from './plugin-errors'
import type {
  PluginLifecycleHooks,
  BoltdocsPlugin,
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
  createPluginRuntimeState,
  getDefaultPluginRuntimeState,
  type PluginRuntimeState,
} from './plugin-context'
import type { IPluginLifecycleManager } from '../../shared/types'

const HOOK_ALIASES: Record<string, string> = {
  'build:before': 'beforeBuild',
  'build:after': 'afterBuild',
  'build:end': 'buildEnd',
  'dev:before': 'beforeDev',
  'dev:after': 'afterDev',
  'transform:source': 'transformSource',
  'transform:mdx': 'transformMdx',
  'transform:html': 'transformHtml',
  beforeBuild: 'build:before',
  afterBuild: 'build:after',
  buildEnd: 'build:end',
  beforeDev: 'dev:before',
  afterDev: 'dev:after',
  transformSource: 'transform:source',
  transformMdx: 'transform:mdx',
  transformHtml: 'transform:html',
}

export function resolvePluginHook(
  plugin: BoltdocsPlugin,
  hookName: keyof PluginLifecycleHooks | string,
): Function | undefined {
  if (!plugin.hooks) return undefined
  const direct = plugin.hooks[hookName as keyof PluginLifecycleHooks]
  if (typeof direct === 'function') return direct as Function
  const alias = HOOK_ALIASES[hookName]
  if (alias) {
    const aliasFn = plugin.hooks[alias as keyof PluginLifecycleHooks]
    if (typeof aliasFn === 'function') return aliasFn as Function
  }
  return undefined
}

export class PluginLifecycleManager implements IPluginLifecycleManager {
  private plugins: BoltdocsPlugin[]
  private config: BoltdocsConfig
  private store: BoltdocsPluginStore
  private docsDir: string
  private rootDir: string
  private routes: RouteMeta[]
  private outDir: string
  private runtime: PluginRuntimeState
  private routeCacheContext: RouteCacheContext
  private routeCacheVariant: RouteCacheVariant

  constructor(
    plugins: BoltdocsPlugin[],
    config: BoltdocsConfig,
    docsDir?: string,
    rootDir?: string,
    routes?: RouteMeta[],
    outDir?: string,
    runtime?: PluginRuntimeState,
    routeCacheContext?: RouteCacheContext,
    routeCacheVariant?: RouteCacheVariant,
  ) {
    this.plugins = plugins
    this.config = config
    this.store = new BoltdocsPluginStore()
    this.docsDir = docsDir || process.cwd()
    this.rootDir = rootDir || process.cwd()
    this.routes = routes || []
    this.outDir = outDir || 'dist'
    this.runtime = runtime ?? getDefaultPluginRuntimeState()
    this.routeCacheContext =
      routeCacheContext ?? getRouteCacheContext(this.docsDir)
    this.routeCacheVariant =
      routeCacheVariant ??
      getRouteCacheVariant(
        this.routeCacheContext,
        getRouteGenerationFingerprint(config, config.base),
      )
  }

  public async runHook(
    hookName: keyof PluginLifecycleHooks,
    ...args: unknown[]
  ): Promise<void> {
    const sortedPlugins = this.getSortedPlugins()
    const pipeline = new Pipeline<Record<string, unknown>>()

    for (const plugin of sortedPlugins) {
      if (!resolvePluginHook(plugin, hookName)) continue

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
      const hookFn = resolvePluginHook(plugin, hookName)
      if (!hookFn) continue

      const context = this.createContext(plugin)
      try {
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
    if (this.plugins.some((p) => resolvePluginHook(p, hookName))) {
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
      [...this.runtime.middlewareRegistry.values()].some(
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
    const programmaticMiddleware = [...this.runtime.middlewareRegistry.values()]
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
        const message = `Middleware '${mwName}' threw: ${
          error instanceof Error ? error.message : String(error)
        }`
        context.logger.error(message)
        context.diagnostics.report('error', 'MIDDLEWARE_ERROR', message)
      }
    }

    return params
  }

  private getSortedPlugins(): BoltdocsPlugin[] {
    const pre = this.plugins.filter((p) => p.enforce === 'pre')
    const normal = this.plugins.filter((p) => !p.enforce)
    const post = this.plugins.filter((p) => p.enforce === 'post')
    return [...pre, ...normal, ...post]
  }

  private createStep(
    plugin: BoltdocsPlugin,
    hookName: keyof PluginLifecycleHooks,
    args: unknown[],
  ): PipelineStep {
    return {
      name: `${plugin.name}:${String(hookName)}`,
      execute: async () => {
        const context = this.createContext(plugin)
        try {
          const hookFn = resolvePluginHook(plugin, hookName)
          if (hookFn) {
            await hookFn(context, ...args)
          }
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
        const rollbackHook = resolvePluginHook(plugin, 'build:end')
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

  private createContext(plugin: BoltdocsPlugin): PluginContext {
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
      caches: createPluginCachesAPI(
        this.routeCacheContext,
        this.rootDir,
        this.routeCacheVariant,
      ),
      diagnostics: createPluginDiagnosticsAPI(plugin.name, this.runtime),
      paths: createPluginPathsAPI(this.docsDir, this.rootDir),
      virtualModules: createPluginVirtualModulesAPI(this.runtime),
      middleware: createPluginMiddlewareAPI(this.runtime),
      hmr: createPluginHmrAPI(this.runtime),
      server: createPluginServerAPI(this.runtime),
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
      caches: createPluginCachesAPI(
        this.routeCacheContext,
        this.rootDir,
        this.routeCacheVariant,
      ),
      diagnostics: createPluginDiagnosticsAPI(name, this.runtime),
      paths: createPluginPathsAPI(this.docsDir, this.rootDir),
      virtualModules: createPluginVirtualModulesAPI(this.runtime),
      middleware: createPluginMiddlewareAPI(this.runtime),
      hmr: createPluginHmrAPI(this.runtime),
      server: createPluginServerAPI(this.runtime),
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
