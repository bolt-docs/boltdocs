import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PluginLifecycleManager } from '../../packages/core/src/node/plugins/plugin-lifecycle'
import type {
  SecureBoltdocsPlugin,
  PluginLogger,
} from '../../packages/core/src/node/plugins/plugin-types'

describe('plugin lifecycle', () => {
  const mockConfig: any = {
    theme: { title: 'Test' },
  }

  describe('PluginLifecycleManager', () => {
    it('should execute hooks in order (pre, normal, post)', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'normal-plugin',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async () => {
              executionOrder.push('normal-beforeBuild')
            },
          },
        },
        {
          name: 'pre-plugin',
          enforce: 'pre',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async () => {
              executionOrder.push('pre-beforeBuild')
            },
          },
        },
        {
          name: 'post-plugin',
          enforce: 'post',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async () => {
              executionOrder.push('post-beforeBuild')
            },
          },
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('beforeBuild')

      expect(executionOrder).toEqual([
        'pre-beforeBuild',
        'normal-beforeBuild',
        'post-beforeBuild',
      ])
    })

    it('should isolate errors from failing plugins', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'failing-plugin',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async () => {
              throw new Error('Plugin error')
            },
          },
        },
        {
          name: 'working-plugin',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async () => {
              executionOrder.push('working-beforeBuild')
            },
          },
        },
      ]

      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('beforeBuild')

      expect(executionOrder).toContain('working-beforeBuild')
      expect(errorSpy).toHaveBeenCalled()

      errorSpy.mockRestore()
    })

    it('should skip plugins without the hook', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'plugin-with-hook',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async () => {
              executionOrder.push('with-hook')
            },
          },
        },
        {
          name: 'plugin-without-hook',
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('beforeBuild')

      expect(executionOrder).toEqual(['with-hook'])
    })

    it('should execute configResolved hook', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'config-plugin',
          hooks: {
            configResolved: async (ctx, config) => {
              executionOrder.push('configResolved')
              expect(config.theme?.title).toBe('Test')
            },
          },
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('configResolved', mockConfig)

      expect(executionOrder).toEqual(['configResolved'])
    })

    it('should execute beforeDev hook', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'dev-plugin',
          permissions: ['hooks:dev'],
          hooks: {
            beforeDev: async () => {
              executionOrder.push('beforeDev')
            },
          },
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('beforeDev')

      expect(executionOrder).toContain('beforeDev')
    })

    it('should execute afterDev hook', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'dev-plugin',
          permissions: ['hooks:dev'],
          hooks: {
            afterDev: async () => {
              executionOrder.push('afterDev')
            },
          },
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('afterDev')

      expect(executionOrder).toContain('afterDev')
    })

    it('should execute afterBuild hook', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'build-plugin',
          permissions: ['hooks:build'],
          hooks: {
            afterBuild: async () => {
              executionOrder.push('afterBuild')
            },
          },
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('afterBuild')

      expect(executionOrder).toContain('afterBuild')
    })

    it('should execute buildEnd hook', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'build-plugin',
          permissions: ['hooks:build'],
          hooks: {
            buildEnd: async () => {
              executionOrder.push('buildEnd')
            },
          },
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('buildEnd')

      expect(executionOrder).toContain('buildEnd')
    })

    it('should provide context with logger to hooks', async () => {
      let receivedContext: any = null

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'context-plugin',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async (ctx) => {
              receivedContext = ctx
              expect(ctx.logger).toBeDefined()
              expect(ctx.logger.error).toBeDefined()
              expect(ctx.logger.warn).toBeDefined()
              expect(ctx.logger.info).toBeDefined()
            },
          },
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)
      await manager.runHook('beforeBuild')

      expect(receivedContext).not.toBeNull()
    })

    it('should handle multiple plugins with different hooks', async () => {
      const executionOrder: string[] = []

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'plugin1',
          enforce: 'pre',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async () => executionOrder.push('plugin1-beforeBuild'),
            afterBuild: async () => executionOrder.push('plugin1-afterBuild'),
          },
        },
        {
          name: 'plugin2',
          permissions: ['hooks:build'],
          hooks: {
            beforeBuild: async () => executionOrder.push('plugin2-beforeBuild'),
          },
        },
      ]

      const manager = new PluginLifecycleManager(plugins, mockConfig)

      await manager.runHook('beforeBuild')
      expect(executionOrder).toEqual([
        'plugin1-beforeBuild',
        'plugin2-beforeBuild',
      ])

      executionOrder.length = 0
      await manager.runHook('afterBuild')
      expect(executionOrder).toEqual(['plugin1-afterBuild'])
    })
  })
})
