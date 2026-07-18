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

// Mock dynamic imports for cache and fallback
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

const mockFallbackCompiler = {
  transform: vi.fn(),
}

vi.mock('@mdx-js/rollup', () => ({
  default: vi.fn(() => mockFallbackCompiler),
}))

vi.mock('remark-gfm', () => ({ default: 'remark-gfm-plugin' }))
vi.mock('remark-frontmatter', () => ({ default: 'remark-frontmatter-plugin' }))
vi.mock('rehype-slug', () => ({ default: 'rehype-slug-plugin' }))

// Mock satteri
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
    mockFallbackCompiler.transform.mockReset()
    vi.mocked(satteriMdxToJs).mockReset()
  })

  describe('satteriCompile', () => {
    it('returns cached result when available', async () => {
      mockCacheInstance.getAsync.mockResolvedValue('cached-code')
      const result = await compiler.satteriCompile('# Hello', 'test.mdx')
      expect(result).toBe('cached-code')
      expect(satteriMdxToJs).not.toHaveBeenCalled()
    })

    it('compiles with satteri on cache miss', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: 'export default function MDXContent() { return null }',
      } as never)

      const result = await compiler.satteriCompile('# Hello', 'test.mdx')
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

      await compiler.satteriCompile('# Hello', 'test.mdx')
      expect(mockCacheInstance.set).toHaveBeenCalled()
    })

    it('returns null when satteri compilation fails', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockRejectedValue(new Error('compile error'))

      const result = await compiler.satteriCompile('# Hello', 'test.mdx')
      expect(result).toBeNull()
    })
  })

  describe('fallbackCompile', () => {
    it('falls back to @mdx-js/rollup when fallback is available', async () => {
      mockFallbackCompiler.transform.mockResolvedValue({
        code: 'export default function FallbackContent() {}',
      })

      // First call loads the fallback compiler async
      const result = await compiler.fallbackCompile('# Hello', 'test.mdx')
      expect(result).toContain('FallbackContent')
    })

    it('returns null when fallback transform fails', async () => {
      mockFallbackCompiler.transform.mockRejectedValue(
        new Error('transform error'),
      )
      const result = await compiler.fallbackCompile('# Hello', 'test.mdx')
      expect(result).toBeNull()
    })
  })

  describe('compile', () => {
    it('returns satteri result when satteri succeeds', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: 'export default function MDXContent() {}',
      } as never)

      const result = await compiler.compile('# Hello', 'test.mdx')
      expect(result).toContain('MDXContent')
    })

    it('returns null when both compilers fail', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockRejectedValue(new Error('satteri fail'))

      const result = await compiler.compile('# Hello', 'test.mdx')
      expect(result).toBeNull()
    })
  })

  describe('flushCache', () => {
    it('saves and flushes cache when initialized', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: 'export default function MDXContent() {}',
      } as never)

      await compiler.satteriCompile('# Hello', 'test.mdx')
      await compiler.flushCache()

      expect(mockCacheInstance.save).toHaveBeenCalled()
      expect(mockCacheInstance.flush).toHaveBeenCalled()
    })

    it('handles flush when cache was never initialized', async () => {
      await expect(compiler.flushCache()).resolves.toBeUndefined()
    })
  })
})
