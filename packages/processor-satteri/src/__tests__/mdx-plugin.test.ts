import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../node/index', () => ({
  createSatteriProcessorPlugin: () => ({
    name: 'boltdocs-processor-satteri',
    version: '0.1.0',
    boltdocsVersion: '>=3.0.0',
    mdastPlugins: [{ name: 'mock-meta-plugin', code: vi.fn() }],
    hastPlugins: [
      {
        name: 'mock-slug-plugin',
        element: { filter: ['h1'], visit: vi.fn() },
      },
      {
        name: 'mock-shiki-plugin',
        element: { filter: ['pre'], visit: vi.fn() },
      },
    ],
  }),
}))

vi.mock('../node/user-plugins', () => ({
  collectUserPlugins: () => ({
    remarkPlugins: [{ name: 'user-remark-plugin', code: vi.fn() }],
    rehypePlugins: [
      {
        name: 'user-rehype-plugin',
        element: { filter: ['div'], visit: vi.fn() },
      },
    ],
  }),
}))

vi.mock('../node/compiler', () => ({
  MdxCompiler: vi.fn().mockImplementation(() => ({
    compile: vi.fn(),
    flushCache: vi.fn(),
  })),
}))

vi.mock('node:fs', () => ({
  default: {
    readFileSync: vi.fn(),
  },
  readFileSync: vi.fn(),
}))

vi.mock('satteri', () => ({
  defineMdastPlugin: (def: unknown) => def,
  defineHastPlugin: (def: unknown) => def,
}))

import { createSatteriMdxPlugin } from '../node/satteri-mdx-plugin'
import { MdxCompiler } from '../node/compiler'
import fs from 'node:fs'

describe('createSatteriMdxPlugin', () => {
  let plugin: ReturnType<typeof createSatteriMdxPlugin>
  const mockConfig = { plugins: [] } as never
  const mockGetLifecycle = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    mockGetLifecycle.mockReturnValue(undefined)
    plugin = createSatteriMdxPlugin(mockConfig, mockGetLifecycle)
  })

  it('returns a Vite plugin with correct name and enforce', () => {
    expect(plugin.name).toBe('vite-plugin-boltdocs-satteri-mdx')
    expect(plugin.enforce).toBe('pre')
    expect(plugin).toHaveProperty('load')
    expect(plugin).toHaveProperty('transform')
    expect(plugin).toHaveProperty('buildEnd')
  })

  it('creates MdxCompiler with combined plugins', () => {
    expect(MdxCompiler).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: 'mock-meta-plugin' }),
        expect.objectContaining({ name: 'user-remark-plugin' }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ name: 'mock-slug-plugin' }),
        expect.objectContaining({ name: 'mock-shiki-plugin' }),
        expect.objectContaining({ name: 'user-rehype-plugin' }),
      ]),
    )
  })

  describe('load hook', () => {
    it('returns null for non-MDX files', async () => {
      const result = await (
        plugin as { load: (id: string) => Promise<unknown> }
      ).load('test.js')
      expect(result).toBeNull()
    })

    it('returns null when file cannot be read', async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error('ENOENT')
      })
      const result = await (
        plugin as { load: (id: string) => Promise<unknown> }
      ).load('test.mdx')
      expect(result).toBeNull()
    })

    it('reads file and compiles', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('# Hello World')
      const mockCompile = vi.mocked(MdxCompiler).mock.results[0]?.value?.compile
      mockCompile.mockResolvedValue('export default function MDXContent() {}')

      const result = await (
        plugin as { load: (id: string) => Promise<unknown> }
      ).load('test.mdx')
      expect(fs.readFileSync).toHaveBeenCalledWith('test.mdx', 'utf-8')
      expect(result).toContain('MDXContent')
    })

    it('runs lifecycle transformSource chain when available', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('# Hello World')
      const lifecycleMock = {
        runChain: vi.fn().mockResolvedValue({ code: '# modified content' }),
      }
      mockGetLifecycle.mockReturnValue(lifecycleMock)
      const mockCompile = vi.mocked(MdxCompiler).mock.results[0]?.value?.compile
      mockCompile.mockResolvedValue(
        'export default function MDXContent() { return <h1>Modified</h1> }',
      )

      await (plugin as { load: (id: string) => Promise<unknown> }).load(
        'test.mdx',
      )

      expect(lifecycleMock.runChain).toHaveBeenCalledWith('transformSource', {
        code: '# Hello World',
        filePath: 'test.mdx',
      })
    })

    it('falls back to raw source when compile returns null', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('# Hello World')
      const mockCompile = vi.mocked(MdxCompiler).mock.results[0]?.value?.compile
      mockCompile.mockResolvedValue(null)

      const result = await (
        plugin as { load: (id: string) => Promise<unknown> }
      ).load('test.mdx')
      expect(result).toBe('# Hello World')
    })

    it('handles lifecycle runChain error gracefully in load hook', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('# Hello World')
      const lifecycleMock = {
        runChain: vi.fn().mockRejectedValue(new Error('lifecycle error')),
      }
      mockGetLifecycle.mockReturnValue(lifecycleMock)
      const mockCompile = vi.mocked(MdxCompiler).mock.results[0]?.value?.compile
      mockCompile.mockResolvedValue(null)

      const result = await (
        plugin as { load: (id: string) => Promise<unknown> }
      ).load('test.mdx')
      // Should fall through to raw source without propagating the error
      expect(result).toBe('# Hello World')
    })

    it('falls back to lifecycle-modified source when compile returns null', async () => {
      vi.mocked(fs.readFileSync).mockReturnValue('# Hello World')
      const lifecycleMock = {
        runChain: vi.fn().mockResolvedValue({ code: '# modified content' }),
      }
      mockGetLifecycle.mockReturnValue(lifecycleMock)
      const mockCompile = vi.mocked(MdxCompiler).mock.results[0]?.value?.compile
      mockCompile.mockResolvedValue(null)

      const result = await (
        plugin as { load: (id: string) => Promise<unknown> }
      ).load('test.mdx')
      // When compile fails, the plugin returns sourceCode (which was modified by lifecycle)
      expect(result).toBe('# modified content')
    })
  })

  describe('transform hook', () => {
    it('returns null for non-MDX files', async () => {
      const result = await (
        plugin as {
          transform: (code: string, id: string) => Promise<unknown>
        }
      ).transform('console.log("hello")', 'test.js')
      expect(result).toBeNull()
    })

    it('does not recompile already-compiled code', async () => {
      const mockCompile = vi.mocked(MdxCompiler).mock.results[0]?.value?.compile
      const alreadyCompiled =
        'function _createMdxContent() { return null } export default function MDXContent() {}'

      const result = await (
        plugin as {
          transform: (code: string, id: string) => Promise<unknown>
        }
      ).transform(alreadyCompiled, 'test.mdx')
      expect(mockCompile).not.toHaveBeenCalled()
      expect(result).toEqual({ code: alreadyCompiled, map: null })
    })

    it('compiles raw code that is not yet compiled', async () => {
      const mockCompile = vi.mocked(MdxCompiler).mock.results[0]?.value?.compile
      const rawCode = 'const x = 1'
      mockCompile.mockResolvedValue(
        'export default function MDXContent() { return null }',
      )

      const result = await (
        plugin as {
          transform: (code: string, id: string) => Promise<unknown>
        }
      ).transform(rawCode, 'test.mdx')
      expect(mockCompile).toHaveBeenCalledWith(rawCode, 'test.mdx')
    })

    it('handles lifecycle transformMdx chain', async () => {
      const mockCompile = vi.mocked(MdxCompiler).mock.results[0]?.value?.compile
      mockCompile.mockResolvedValue(
        'export default function MDXContent() { return null }',
      )
      const lifecycleMock = {
        runChain: vi.fn().mockResolvedValue({
          code: 'export default function MDXContent() { return <h1>Modified</h1> }',
        }),
      }
      mockGetLifecycle.mockReturnValue(lifecycleMock)

      const result = await (
        plugin as {
          transform: (code: string, id: string) => Promise<unknown>
        }
      ).transform('const x = 1', 'test.mdx')
      expect(lifecycleMock.runChain).toHaveBeenCalledWith('transformMdx', {
        code: expect.any(String),
        filePath: 'test.mdx',
      })
    })
  })

  describe('buildEnd hook', () => {
    it('flushes cache on build end', async () => {
      const mockFlushCache =
        vi.mocked(MdxCompiler).mock.results[0]?.value?.flushCache
      await (plugin as { buildEnd: () => Promise<void> }).buildEnd()
      expect(mockFlushCache).toHaveBeenCalled()
    })
  })
})
