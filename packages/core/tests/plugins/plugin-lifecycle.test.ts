import { describe, it, expect, vi } from 'vitest'
import { PluginLifecycleManager } from '../../src/node/plugins/plugin-lifecycle'
import type { SecureBoltdocsPlugin } from '../../src/node/plugins/plugin-types'

describe('PluginLifecycleManager', () => {
  const mockConfig: any = { theme: { title: 'Test' } }

  it('should execute hooks in order (pre, normal, post)', async () => {
    const executionOrder: string[] = []

    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'normal-plugin',
        hooks: {
          beforeBuild: async () => {
            executionOrder.push('normal-beforeBuild')
          },
        },
      },
      {
        name: 'pre-plugin',
        enforce: 'pre',
        hooks: {
          beforeBuild: async () => {
            executionOrder.push('pre-beforeBuild')
          },
        },
      },
      {
        name: 'post-plugin',
        enforce: 'post',
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
        hooks: {
          beforeBuild: async () => {
            throw new Error('Plugin error')
          },
        },
      },
      {
        name: 'working-plugin',
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
        hooks: {
          beforeBuild: async () => {
            executionOrder.push('with-hook')
          },
        },
      },
      { name: 'plugin-without-hook' },
    ]

    const manager = new PluginLifecycleManager(plugins, mockConfig)
    await manager.runHook('beforeBuild')
    expect(executionOrder).toEqual(['with-hook'])
  })

  it('should execute beforeDev hook', async () => {
    const executionOrder: string[] = []

    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'dev-plugin',
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

  it('should provide context with logger, docsDir, and rootDir to hooks', async () => {
    let receivedContext: any = null

    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'context-plugin',
        hooks: {
          beforeBuild: async (ctx) => {
            receivedContext = ctx
          },
        },
      },
    ]

    const manager = new PluginLifecycleManager(
      plugins,
      mockConfig,
      '/test/docs',
      '/test',
    )
    await manager.runHook('beforeBuild')

    expect(receivedContext).not.toBeNull()
    expect(receivedContext.logger).toBeDefined()
    expect(receivedContext.logger.error).toBeDefined()
    expect(receivedContext.docsDir).toBe('/test/docs')
    expect(receivedContext.rootDir).toBe('/test')
  })

  it('should run transformMdx chain across plugins', async () => {
    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'plugin-a',
        hooks: {
          transformMdx: async (_ctx, params) => ({
            code: params.code + '/* A */',
          }),
        },
      },
      {
        name: 'plugin-b',
        hooks: {
          transformMdx: async (_ctx, params) => ({
            code: params.code + '/* B */',
          }),
        },
      },
    ]

    const manager = new PluginLifecycleManager(plugins, mockConfig)
    const result = await manager.runChain('transformMdx', {
      code: 'original',
      filePath: 'test.mdx',
    })

    expect(result.code).toBe('original/* A *//* B */')
  })

  it('should isolate errors in transformMdx chain and report to diagnostics', async () => {
    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'failing',
        hooks: {
          transformMdx: async () => {
            throw new Error('Fail')
          },
        },
      },
      {
        name: 'working',
        hooks: {
          transformMdx: async (_ctx, params) => ({
            code: params.code + '/* OK */',
          }),
        },
      },
    ]

    const manager = new PluginLifecycleManager(plugins, mockConfig)
    const result = await manager.runChain('transformMdx', {
      code: 'start',
      filePath: 'test.mdx',
    })

    expect(result.code).toBe('start/* OK */')
  })

  it('should respect __signal: "skip" in transform chain', async () => {
    const executionOrder: string[] = []

    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'first',
        hooks: {
          transformMdx: async (_ctx, params) => {
            executionOrder.push('first')
            return {
              code: params.code + '/* first */',
              __signal: 'skip' as const,
            }
          },
        },
      },
      {
        name: 'second',
        hooks: {
          transformMdx: async (_ctx, params) => {
            executionOrder.push('second')
            return { code: params.code + '/* second */' }
          },
        },
      },
    ]

    const manager = new PluginLifecycleManager(plugins, mockConfig)
    const result = await manager.runChain('transformMdx', {
      code: 'start',
      filePath: 'test.mdx',
    })

    // Only first ran (second skipped), but first's transformation is kept.
    expect(executionOrder).toEqual(['first'])
    expect(result.code).toBe('start/* first */')
  })

  it('should respect __signal: "break" in transform chain', async () => {
    const executionOrder: string[] = []

    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'first',
        hooks: {
          transformMdx: async (_ctx, params) => {
            executionOrder.push('first')
            return { code: params.code + '/* first */' }
          },
        },
      },
      {
        name: 'breaker',
        hooks: {
          transformMdx: async (_ctx, params) => {
            executionOrder.push('breaker')
            // Return __signal: 'break' — this plugin's result is discarded,
            // and the chain stops. Earlier plugins' results are preserved.
            return {
              code: params.code + '/* breaker */',
              __signal: 'break' as const,
            }
          },
        },
      },
      {
        name: 'third',
        hooks: {
          transformMdx: async (_ctx, params) => {
            executionOrder.push('third')
            return { code: params.code + '/* third */' }
          },
        },
      },
    ]

    const manager = new PluginLifecycleManager(plugins, mockConfig)
    const result = await manager.runChain('transformMdx', {
      code: 'start',
      filePath: 'test.mdx',
    })

    // First and breaker ran. Third never runs. The breaker's result is
    // discarded — only first's transformation survives.
    expect(executionOrder).toEqual(['first', 'breaker'])
    expect(result.code).toBe('start/* first */')
  })

  it('should run transformHtml chain across plugins', async () => {
    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'seo-plugin',
        hooks: {
          transformHtml: async (_ctx, params) => ({
            html: params.html.replace(
              '</head>',
              '<meta name="seo" content="ok"></head>',
            ),
          }),
        },
      },
    ]

    const manager = new PluginLifecycleManager(plugins, mockConfig)
    const result = await manager.runChain('transformHtml', {
      html: '<html><head></head><body></body></html>',
      path: '/docs/test',
    })

    expect(result.html).toContain('<meta name="seo" content="ok">')
  })

  it('should handle multiple plugins with different hooks', async () => {
    const executionOrder: string[] = []

    const plugins: SecureBoltdocsPlugin[] = [
      {
        name: 'plugin1',
        enforce: 'pre',
        hooks: {
          beforeBuild: async () => executionOrder.push('plugin1-beforeBuild'),
          afterBuild: async () => executionOrder.push('plugin1-afterBuild'),
        },
      },
      {
        name: 'plugin2',
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
