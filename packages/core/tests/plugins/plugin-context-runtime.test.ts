import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  __resetPluginContextStateForTests,
  createPluginDiagnosticsAPI,
  createPluginHmrAPI,
  createPluginMiddlewareAPI,
  createPluginRuntimeState,
  createPluginServerAPI,
  createPluginVirtualModulesAPI,
  resetPluginRuntimeRegistries,
  runPluginHmrHandlers,
  virtualModuleRegistry,
} from '../../src/node/plugins/plugin-context'
import {
  createVirtualModuleState,
  createVirtualModulesPlugin,
} from '../../src/node/plugin/virtual-modules'

describe('plugin runtime registries', () => {
  afterEach(() => {
    __resetPluginContextStateForTests()
    vi.restoreAllMocks()
  })

  it('isolates failing HMR handlers so later plugins still run', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const first = vi.fn(async () => {
      throw new Error('first failed')
    })
    const second = vi.fn(async () => {})

    const hmr = createPluginHmrAPI()
    hmr.onFileChange(first)
    hmr.onFileChange(second)

    await runPluginHmrHandlers('change', '/docs/intro.mdx')

    expect(first).toHaveBeenCalledWith('/docs/intro.mdx')
    expect(second).toHaveBeenCalledWith('/docs/intro.mdx')
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Plugin HMR handler failed'),
      expect.any(Error),
    )
  })

  it('isolates all registries between two runtime instances', async () => {
    const firstRuntime = createPluginRuntimeState()
    const secondRuntime = createPluginRuntimeState()
    const firstFileHandler = vi.fn()
    const secondFileHandler = vi.fn()
    const firstStart = vi.fn()
    const secondStart = vi.fn()

    createPluginVirtualModulesAPI(firstRuntime).add(
      'virtual:test-plugin/data',
      () => 'export default 1',
    )
    createPluginVirtualModulesAPI(secondRuntime).add(
      'virtual:test-plugin/data',
      () => 'export default 2',
    )
    createPluginHmrAPI(firstRuntime).onFileChange(firstFileHandler)
    createPluginHmrAPI(secondRuntime).onFileChange(secondFileHandler)
    createPluginDiagnosticsAPI('first', firstRuntime).report(
      'info',
      'FIRST',
      'first diagnostic',
    )
    createPluginDiagnosticsAPI('second', secondRuntime).report(
      'info',
      'SECOND',
      'second diagnostic',
    )
    createPluginMiddlewareAPI(firstRuntime).add({
      name: 'first-middleware',
      transformMdx: () => ({ code: 'first' }),
    })
    createPluginMiddlewareAPI(secondRuntime).add({
      name: 'second-middleware',
      transformMdx: () => ({ code: 'second' }),
    })
    createPluginServerAPI(firstRuntime).onStart(firstStart)
    createPluginServerAPI(secondRuntime).onStart(secondStart)

    await runPluginHmrHandlers('change', '/docs/first.mdx', firstRuntime)
    await runPluginHmrHandlers('change', '/docs/second.mdx', secondRuntime)

    expect(firstFileHandler).toHaveBeenCalledWith('/docs/first.mdx')
    expect(firstFileHandler).not.toHaveBeenCalledWith('/docs/second.mdx')
    expect(secondFileHandler).toHaveBeenCalledWith('/docs/second.mdx')
    expect(secondFileHandler).not.toHaveBeenCalledWith('/docs/first.mdx')
    expect(
      createPluginVirtualModulesAPI(firstRuntime).has(
        'virtual:test-plugin/data',
      ),
    ).toBe(true)
    expect(
      createPluginVirtualModulesAPI(secondRuntime).has(
        'virtual:test-plugin/data',
      ),
    ).toBe(true)
    expect(createPluginDiagnosticsAPI('first', firstRuntime).list()).toEqual([
      expect.objectContaining({ code: 'FIRST' }),
    ])
    expect(createPluginDiagnosticsAPI('second', secondRuntime).list()).toEqual([
      expect.objectContaining({ code: 'SECOND' }),
    ])
    expect(createPluginMiddlewareAPI(firstRuntime).list()).toHaveLength(1)
    expect(createPluginMiddlewareAPI(secondRuntime).list()).toHaveLength(1)

    await resetPluginRuntimeRegistries(firstRuntime)
    expect(
      createPluginVirtualModulesAPI(firstRuntime).has(
        'virtual:test-plugin/data',
      ),
    ).toBe(false)
    expect(
      createPluginVirtualModulesAPI(secondRuntime).has(
        'virtual:test-plugin/data',
      ),
    ).toBe(true)
    expect(createPluginMiddlewareAPI(firstRuntime).list()).toHaveLength(0)
    expect(createPluginMiddlewareAPI(secondRuntime).list()).toHaveLength(1)
    expect(firstStart).not.toHaveBeenCalled()
    expect(secondStart).not.toHaveBeenCalled()
  })

  it('resolves and loads the isolated virtual module for each instance', async () => {
    const firstRuntime = createPluginRuntimeState()
    const secondRuntime = createPluginRuntimeState()
    const firstPlugin = createVirtualModulesPlugin(
      {},
      () => ({}) as never,
      () => undefined,
      '/first/docs',
      firstRuntime,
      createVirtualModuleState(),
    )
    const secondPlugin = createVirtualModulesPlugin(
      {},
      () => ({}) as never,
      () => undefined,
      '/second/docs',
      secondRuntime,
      createVirtualModuleState(),
    )

    createPluginVirtualModulesAPI(firstRuntime).add(
      'virtual:test-plugin/data',
      () => 'export default "first"',
    )
    createPluginVirtualModulesAPI(secondRuntime).add(
      'virtual:test-plugin/data',
      () => 'export default "second"',
    )

    const firstResolve = await firstPlugin.resolveId?.(
      'virtual:test-plugin/data',
      undefined,
      {} as never,
    )
    const secondResolve = await secondPlugin.resolveId?.(
      'virtual:test-plugin/data',
      undefined,
      {} as never,
    )
    const firstCode = await firstPlugin.load?.(firstResolve as string)
    const secondCode = await secondPlugin.load?.(secondResolve as string)

    expect(firstResolve).toBe('\0virtual:test-plugin/data')
    expect(secondResolve).toBe('\0virtual:test-plugin/data')
    expect(firstCode).toBe('export default "first"')
    expect(secondCode).toBe('export default "second"')
  })

  it('clears runtime registrations at a server lifecycle boundary', () => {
    const virtualModules = createPluginVirtualModulesAPI()
    virtualModules.add('virtual:test-plugin/data', () => 'export default 1')

    expect(virtualModuleRegistry.has('virtual:test-plugin/data')).toBe(true)

    resetPluginRuntimeRegistries()

    expect(virtualModuleRegistry.has('virtual:test-plugin/data')).toBe(false)
  })
})
