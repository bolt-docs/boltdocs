import type { Plugin } from 'vite'
import type { BoltdocsConfig } from '../config'
import type { IPluginLifecycleManager } from '../../shared/types'
import { generateLinkTree } from '../cli/doctor'
import { error } from '@bdocs/dui'
import { setupMiddlewares } from './middleware'
import { setupPrewarming } from './prewarm'
import { configureWatcher } from './watcher'
import { setupHmr, createHotUpdateHandler } from './hmr-handler'
import {
  setHmrSender,
  applyPluginServerMiddleware,
  runPluginServerStartCallbacks,
} from '../plugins/plugin-context'

export function createDevServerPlugin(
  docsDir: string,
  normalizedDocsDir: string,
  getConfig: () => BoltdocsConfig,
  _setConfig: (c: BoltdocsConfig) => void,
  getLifecycle: () => IPluginLifecycleManager | undefined,
): Plugin {
  return {
    name: 'vite-plugin-boltdocs-dev-server',
    apply: 'serve',

    configureServer(server) {
      const lifecycle = getLifecycle()
      lifecycle?.runHook('dev:before').catch((e) => {
        error('dev:before hook failed:', e)
      })

      import('../routes').then(({ generateRoutes }) => {
        import('../types-generator').then(({ writeLinkTree }) => {
          generateRoutes(docsDir, getConfig())
            .then((routes) => {
              writeLinkTree(routes.map((r) => r.path))
            })
            .catch(() => {})
        })
      })

      setupPrewarming(server, docsDir, getConfig)
      setupMiddlewares(server, docsDir, getConfig)
      configureWatcher(server, docsDir)
      setupHmr(server, docsDir, normalizedDocsDir, getConfig)

      // Wire plugin HMR sender (ctx.hmr.send())
      setHmrSender((event, data) => {
        server.ws.send(event, data)
      })

      // Apply plugin-registered server middleware (ctx.server.use())
      applyPluginServerMiddleware(server)

      // Fire plugin server start callbacks asynchronously
      runPluginServerStartCallbacks().catch(() => {})
      lifecycle?.runHook('dev:after').catch(() => {})
    },

    hotUpdate: createHotUpdateHandler(normalizedDocsDir),
  }
}
