import type { Plugin } from 'vite'
import type { BoltdocsConfig } from '../config'
import type { PluginLifecycleManager } from '../plugins'
import { generateLinkTree } from '../cli/doctor'
import { error } from '@bdocs/dui'
import { setupMiddlewares } from './middleware'
import { setupPrewarming } from './prewarm'
import { configureWatcher } from './watcher'
import { setupHmr, createHotUpdateHandler } from './hmr-handler'

export function createDevServerPlugin(
  docsDir: string,
  normalizedDocsDir: string,
  getConfig: () => BoltdocsConfig,
  _setConfig: (c: BoltdocsConfig) => void,
  getLifecycle: () => PluginLifecycleManager | undefined,
): Plugin {
  return {
    name: 'vite-plugin-boltdocs-dev-server',
    apply: 'serve',

    async configureServer(server) {
      const lifecycle = getLifecycle()
      await lifecycle?.runHook('beforeDev')

      generateLinkTree(docsDir, process.cwd(), getConfig()).catch((e) => {
        error('Failed to generate initial link tree:', e)
      })

      setupPrewarming(server, docsDir, getConfig)
      setupMiddlewares(server, getConfig)
      configureWatcher(server, docsDir)
      setupHmr(server, docsDir, normalizedDocsDir, getConfig)

      await lifecycle?.runHook('afterDev')
    },

    hotUpdate: createHotUpdateHandler(normalizedDocsDir),
  }
}
