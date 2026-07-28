import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock crypto (must use inline factory — vi.mock is hoisted so external vars aren't accessible)
vi.mock('node:crypto', () => {
  const hashFn = () => ({
    update: () => ({
      digest: () => 'mocked-hash',
    }),
  })
  return {
    default: { createHash: hashFn },
    createHash: hashFn,
  }
})

// Mock dynamic imports for cache
const mockCacheInstance = {
  load: vi.fn().mockResolvedValue(undefined),
  save: vi.fn(),
  getAsync: vi.fn(),
  set: vi.fn(),
  flush: vi.fn(),
}

vi.mock('boltdocs/node/cache', () => ({
  TransformCache: vi.fn(() => mockCacheInstance),
}))

vi.mock('satteri', () => ({
  defineMdastPlugin: (def: unknown) => def,
  mdxToJs: vi.fn(),
}))

import { MdxCompiler } from '../node/compiler'
const { mdxToJs: satteriMdxToJs } = await import('satteri')

describe('MdxCompiler', () => {
  let compiler: MdxCompiler

  beforeEach(() => {
    vi.clearAllMocks()
    compiler = new MdxCompiler([], [])
    mockCacheInstance.getAsync.mockReset()
    mockCacheInstance.set.mockReset()
    mockCacheInstance.save.mockReset()
    mockCacheInstance.flush.mockReset()
    vi.mocked(satteriMdxToJs).mockReset()
  })

  describe('compile', () => {
    it('returns cached result when available', async () => {
      mockCacheInstance.getAsync.mockResolvedValue('cached-code')
      const result = await compiler.compile('# Hello', 'test.mdx')
      expect(result).toBe('cached-code')
      expect(satteriMdxToJs).not.toHaveBeenCalled()
    })

    it('compiles with satteri on cache miss', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: 'export default function MDXContent() { return null }',
      } as never)

      const result = await compiler.compile('# Hello', 'test.mdx')
      expect(result).toContain('MDXContent')
      expect(satteriMdxToJs).toHaveBeenCalledWith('# Hello', {
        jsxRuntime: 'automatic',
        jsxImportSource: 'react',
        outputFormat: 'program',
        mdastPlugins: [],
        hastPlugins: [],
        features: { gfm: true, frontmatter: true },
      })
    })

    it('caches compiled result', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: 'export default function MDXContent() {}',
      } as never)

      await compiler.compile('# Hello', 'test.mdx')
      expect(mockCacheInstance.set).toHaveBeenCalled()
    })

    it('throws when satteri compilation fails', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockRejectedValue(new Error('compile error'))

      await expect(compiler.compile('# Hello', 'test.mdx')).rejects.toThrow(
        'compile error',
      )
    })

    it('throws when satteri returns no code', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({ code: '' } as never)

      await expect(compiler.compile('# Hello', 'test.mdx')).rejects.toThrow(
        'Sätteri compilation returned no output for test.mdx',
      )
    })
  })

  describe('flushCache', () => {
    it('persists cache to disk (P2-22: flush ensures cross-process persistence)', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: 'export default function MDXContent() {}',
      } as never)

      await compiler.compile('# Hello', 'test.mdx')
      await compiler.flushCache()

      expect(mockCacheInstance.save).toHaveBeenCalled()
      // P2-22: flush is now called to persist the cache between processes.
      // Without it, cold-dist builds lose all cached entries (~1-2s penalty).
      expect(mockCacheInstance.flush).toHaveBeenCalledTimes(1)
    })

    it('handles flush when cache was never initialized', async () => {
      await expect(compiler.flushCache()).resolves.toBeUndefined()
    })
  })
})
