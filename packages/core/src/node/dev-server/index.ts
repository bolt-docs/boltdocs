import type { Plugin } from 'vite'
import type { BoltdocsConfig } from '../config'
import type { IPluginLifecycleManager } from '../../shared/types'
import {
  disposeRouteCacheContext,
  type RouteCacheContext,
} from '../routes/cache'
import {
  invalidateDirectoryMetaCache,
  type VirtualModuleState,
} from '../plugin/virtual-modules'
import { error } from '@bdocs/dui'
import { setupMiddlewares } from './middleware'
import { setupPrewarming } from './prewarm'
import { configureWatcher } from './watcher'
import { setupHmr, createHotUpdateHandler } from './hmr-handler'
import {
  setHmrSender,
  applyPluginServerMiddleware,
  runPluginServerStartCallbacks,
  resetPluginRuntimeRegistries,
  type PluginRuntimeState,
} from '../plugins/plugin-context'

export function createDevServerPlugin(
  docsDir: string,
  normalizedDocsDir: string,
  getConfig: () => BoltdocsConfig,
  _setConfig: (c: BoltdocsConfig) => void,
  getLifecycle: () => IPluginLifecycleManager | undefined,
  runtime?: PluginRuntimeState,
  virtualModuleState?: VirtualModuleState,
  routeCacheContext?: RouteCacheContext,
): Plugin {
  return {
    name: 'vite-plugin-boltdocs-dev-server',
    apply: 'serve',

    async configureServer(server) {
      // Vite may restart the dev server in the same process. Clear runtime
      // registrations before plugins run again, but never during document HMR.
      resetPluginRuntimeRegistries(runtime)
      invalidateDirectoryMetaCache(virtualModuleState)

      const lifecycle = getLifecycle()
      await lifecycle?.runHook('dev:before').catch((e) => {
        error('dev:before hook failed:', e)
      })

      const routesPromise = import('../routes').then(({ generateRoutes }) =>
        generateRoutes(docsDir, getConfig()),
      )

      routesPromise
        .then((routes) =>
          import('../types-generator').then(({ writeLinkTree }) =>
            writeLinkTree(routes.map((r) => r.path)),
          ),
        )
        .catch(() => {})

      const cacheContext =
        routeCacheContext && !routeCacheContext.disposed
          ? routeCacheContext
          : virtualModuleState?.routeCacheContext

      setupPrewarming(server, docsDir, getConfig, routesPromise)
      setupMiddlewares(server, docsDir, getConfig)
      configureWatcher(server, docsDir)
      setupHmr(
        server,
        docsDir,
        normalizedDocsDir,
        getConfig,
        runtime,
        virtualModuleState,
        cacheContext,
      )
      if (cacheContext) {
        server.httpServer?.once('close', () => {
          disposeRouteCacheContext(docsDir, cacheContext)
        })
      }

      // Wire plugin HMR sender (ctx.hmr.send())
      setHmrSender((event, data) => {
        server.ws.send(event, data)
      }, runtime)

      // Apply plugin-registered server middleware (ctx.server.use()) only
      // after beforeDev has had a chance to register it.
      applyPluginServerMiddleware(server, runtime)
      await runPluginServerStartCallbacks(runtime).catch(() => {})
      await lifecycle?.runHook('dev:after').catch(() => {})
    },

    hotUpdate: createHotUpdateHandler(normalizedDocsDir),
  }
}
