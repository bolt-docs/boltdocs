import { describe, it, expect, vi, beforeEach } from 'vitest'
import { boltdocsMdxPlugin } from '../packages/core/src/node/mdx'

describe('mdx', () => {
  const mockMdxPlugin = {
    name: 'mdx',
    isMock: true,
    buildStart: vi.fn().mockResolvedValue(undefined),
    transform: vi
      .fn()
      .mockImplementation((code: string) => ({ code: `compiled: ${code}` })),
    buildEnd: vi.fn().mockResolvedValue(undefined),
  }

  const mockCompiler = vi.fn(() => mockMdxPlugin)

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should create an mdx plugin using the injected compiler', () => {
    const plugin: any = boltdocsMdxPlugin({}, mockCompiler as any)
    expect(mockCompiler).toHaveBeenCalled()
    expect(plugin.isMock).toBe(true)
    expect(plugin.name).toBe('vite-plugin-boltdocs-mdx')
  })

  it('should transform valid files and use cache', async () => {
    const plugin: any = boltdocsMdxPlugin({}, mockCompiler as any)
    const expected = 'compiled: # h1\nif (import.meta.hot) {\n  import.meta.hot.accept();\n}\n'

    // 1. Transform (cache miss)
    const result1 = await plugin.transform('# h1', 'test.md')
    expect(result1?.code).toBe(expected)
    expect(mockMdxPlugin.transform).toHaveBeenCalledTimes(1)

    // 2. Transform (cache hit)
    const result2 = await plugin.transform('# h1', 'test.md')
    expect(result2?.code).toBe(expected)
    expect(mockMdxPlugin.transform).toHaveBeenCalledTimes(1) // Hits cache
  })

  it('should bypass non-md files but still call base transform', async () => {
    const plugin: any = boltdocsMdxPlugin({}, mockCompiler as any)
    const result = await plugin.transform('const x = 1', 'test.ts')
    expect(result?.code).toBe('compiled: const x = 1')
  })

  it('should call buildStart and buildEnd hooks', async () => {
    const plugin: any = boltdocsMdxPlugin({}, mockCompiler as any)
    await plugin.buildStart()
    expect(mockMdxPlugin.buildStart).toHaveBeenCalled()
    await plugin.buildEnd()
    expect(mockMdxPlugin.buildEnd).toHaveBeenCalled()
  })
})
