import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock all external dependencies
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

const mockFallbackCompiler = { transform: vi.fn() }
vi.mock('@mdx-js/rollup', () => ({
  default: vi.fn(() => mockFallbackCompiler),
}))
vi.mock('remark-gfm', () => ({ default: 'remark-gfm-plugin' }))
vi.mock('remark-frontmatter', () => ({ default: 'remark-frontmatter-plugin' }))
vi.mock('rehype-slug', () => ({ default: 'rehype-slug-plugin' }))
vi.mock('satteri', () => ({
  defineMdastPlugin: (d: unknown) => d,
  mdxToJs: vi.fn(),
}))

import { MdxCompiler } from '../node/compiler'

const { mdxToJs: satteriMdxToJs } = await import('satteri')

describe('MdxCompiler — integration scenarios', () => {
  let compiler: MdxCompiler

  beforeEach(() => {
    vi.clearAllMocks()
    compiler = new MdxCompiler(
      [
        {
          name: 'satteri-remark-meta',
          code: () => {},
        } as never,
      ],
      [
        {
          name: 'satteri-rehype-slug',
          element: { filter: ['h1', 'h2'], visit: () => {} },
        } as never,
      ],
    )
    mockCacheInstance.getAsync.mockReset()
    mockCacheInstance.set.mockReset()
    mockFallbackCompiler.transform.mockReset()
    vi.mocked(satteriMdxToJs).mockReset()
  })

  describe('full compile flow', () => {
    it('compiles MDX with plugins end-to-end', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: 'export default function MDXContent() { return <h1>Hello</h1> }',
        frontmatter: null,
        data: {},
      } as never)
      mockFallbackCompiler.transform.mockResolvedValue(null as never)

      const result = await compiler.compile('# Hello World', 'test.mdx')
      expect(result).toContain('MDXContent')
      // Verify plugins were passed correctly
      expect(satteriMdxToJs).toHaveBeenCalledWith(
        '# Hello World',
        expect.objectContaining({
          mdastPlugins: [
            expect.objectContaining({ name: 'satteri-remark-meta' }),
          ],
          hastPlugins: [
            expect.objectContaining({ name: 'satteri-rehype-slug' }),
          ],
        }),
      )
    })

    it('caches and returns cached result on subsequent calls', async () => {
      mockCacheInstance.getAsync
        .mockResolvedValueOnce(null) // first call: cache miss
        .mockResolvedValueOnce('cached output') // second call: cache hit

      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: 'export default function MDXContent() { return null }',
      } as never)

      // First compile — should compile and cache
      const first = await compiler.compile('# Hello', 'test.mdx')
      expect(first).toContain('MDXContent')
      expect(mockCacheInstance.set).toHaveBeenCalled()

      // Second compile — should return cached
      const second = await compiler.compile('# Hello', 'test.mdx')
      expect(second).toBe('cached output')
      // satteri should only be called once (first compile, second was cached)
      expect(satteriMdxToJs).toHaveBeenCalledTimes(1)
    })

    it('falls back when satteri returns null code', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: '',
        frontmatter: null,
        data: {},
      } as never)

      const result = await compiler.compile('# Hello', 'test.mdx')
      expect(result).toBeNull()
    })
  })

  describe('fallback scenarios', () => {
    it('handles satteri failure and falls back', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockRejectedValue(new Error('satteri crash'))
      mockFallbackCompiler.transform.mockResolvedValue({
        code: 'fallback output',
      })

      const result = await compiler.compile('# Hello', 'test.mdx')
      expect(result).toBe('fallback output')
    })

    it('returns null when both satteri and fallback fail', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockRejectedValue(new Error('satteri crash'))
      mockFallbackCompiler.transform.mockRejectedValue(
        new Error('fallback crash'),
      )

      const result = await compiler.compile('# Hello', 'test.mdx')
      expect(result).toBeNull()
    })
  })
})
