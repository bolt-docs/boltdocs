import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  validatePlugins,
  PluginLifecycleManager,
  PluginSandbox,
  PluginValidationError,
  PluginCompatibilityError,
  PluginPermissionError,
} from '@/node/plugins'
import type { SecureBoltdocsPlugin } from '@/node/plugins/plugin-types'
import type { BoltdocsConfig } from '@/node/config'

describe('Plugin System', () => {
  const boltdocsVersion = '1.0.0'

  describe('Validation', () => {
    it('should accept a valid plugin', () => {
      const plugins = [{ name: 'test-plugin' }]
      const validated = validatePlugins(plugins, boltdocsVersion)
      expect(validated).toHaveLength(1)
      expect(validated[0].name).toBe('test-plugin')
    })

    it('should reject a plugin without a name', () => {
      const plugins = [{ enforce: 'pre' }]
      expect(() => validatePlugins(plugins, boltdocsVersion)).toThrow(
        PluginValidationError,
      )
    })

    it('should reject duplicate plugin names', () => {
      const plugins = [{ name: 'dup' }, { name: 'dup' }]
      expect(() => validatePlugins(plugins, boltdocsVersion)).toThrow(
        'Duplicate plugin name',
      )
    })

    it('should reject incompatible boltdocs version', () => {
      const plugins = [{ name: 'new-plugin', boltdocsVersion: '^2.0.0' }]
      expect(() => validatePlugins(plugins, boltdocsVersion)).toThrow(
        PluginCompatibilityError,
      )
    })

    it('should reject path traversal in component paths', () => {
      const plugins = [
        {
          name: 'evil',
          permissions: ['components'],
          components: { Evil: '../../etc/passwd' },
        },
      ]
      expect(() => validatePlugins(plugins, boltdocsVersion)).toThrow(
        'traversal sequences are not allowed',
      )
    })
  })

  describe('Sandbox & Permissions', () => {
    const plugin: SecureBoltdocsPlugin = {
      name: 'restricted',
      remarkPlugins: [() => {}],
      vitePlugins: [{} as any],
      permissions: ['mdx:remark'], // Missing 'vite:config'
    }

    it('should filter capabilities based on permissions', () => {
      const caps = PluginSandbox.getSanitizedCapabilities(plugin)
      expect(caps.remarkPlugins).toHaveLength(1)
      expect(caps.vitePlugins).toHaveLength(0)
    })

    it('should throw on missing permission check', () => {
      expect(() =>
        PluginSandbox.checkPermission(plugin, 'vite:config'),
      ).toThrow(PluginPermissionError)
    })
  })

  describe('Lifecycle Manager', () => {
    const config: BoltdocsConfig = { docsDir: 'docs' }

    it('should run hooks in correct order (enforce pre/post)', async () => {
      const callOrder: string[] = []
      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'normal',
          hooks: {
            beforeBuild: () => {
              callOrder.push('normal')
            },
          },
          permissions: ['hooks:build'],
        },
        {
          name: 'pre',
          enforce: 'pre',
          hooks: {
            beforeBuild: () => {
              callOrder.push('pre')
            },
          },
          permissions: ['hooks:build'],
        },
        {
          name: 'post',
          enforce: 'post',
          hooks: {
            beforeBuild: () => {
              callOrder.push('post')
            },
          },
          permissions: ['hooks:build'],
        },
      ]

      const manager = new PluginLifecycleManager(plugins, config)
      await manager.runHook('beforeBuild')
      expect(callOrder).toEqual(['pre', 'normal', 'post'])
    })

    it('should isolate errors in hooks', async () => {
      const logs: string[] = []
      // Mock console.error to avoid spamming the test output but still check it
      const spy = vi
        .spyOn(console, 'error')
        .mockImplementation((msg) => logs.push(msg))

      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'broken',
          hooks: {
            beforeBuild: () => {
              throw new Error('BOOM')
            },
          },
          permissions: ['hooks:build'],
        },
        {
          name: 'working',
          hooks: {
            beforeBuild: () => {
              logs.push('working')
            },
          },
          permissions: ['hooks:build'],
        },
      ]

      const manager = new PluginLifecycleManager(plugins, config)
      await manager.runHook('beforeBuild')

      expect(logs).toContain('working')
      expect(logs.some((l) => l.includes('BOOM'))).toBe(true)

      spy.mockRestore()
    })

    it('should inject correct context (config, meta, store)', async () => {
      let capturedCtx: any = null
      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'ctx-test',
          hooks: {
            beforeBuild: (ctx) => {
              capturedCtx = ctx
            },
          },
          permissions: ['hooks:build'],
        },
      ]

      const manager = new PluginLifecycleManager(plugins, config)
      await manager.runHook('beforeBuild')

      expect(capturedCtx.config).toBeDefined()
      expect(capturedCtx.meta.name).toBe('ctx-test')
      expect(capturedCtx.store).toBeDefined()
      expect(capturedCtx.logger).toBeDefined()
    })
  })

  describe('Shared Store (Dependency Injection)', () => {
    it('should allow plugins to share state', async () => {
      const config: BoltdocsConfig = { docsDir: 'docs' }
      const plugins: SecureBoltdocsPlugin[] = [
        {
          name: 'provider',
          hooks: {
            beforeBuild: (ctx) => {
              ctx.store.set('provider', 'api', { url: 'https://api.com' })
            },
          },
          permissions: ['hooks:build'],
        },
        {
          name: 'consumer',
          hooks: {
            beforeBuild: (ctx) => {
              const api = ctx.store.get<{ url: string }>('provider', 'api')
              ctx.store.set('consumer', 'done', api?.url === 'https://api.com')
            },
          },
          permissions: ['hooks:build'],
        },
      ]

      const manager = new PluginLifecycleManager(plugins, config)
      await manager.runHook('beforeBuild')

      expect(manager['store'].get('consumer', 'done')).toBe(true)
    })
  })
})
