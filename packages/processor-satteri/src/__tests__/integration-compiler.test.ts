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

vi.mock('satteri', () => ({
  defineMdastPlugin: (def: unknown) => def,
  defineHastPlugin: (def: unknown) => def,
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
        {
          name: 'satteri-rehype-shiki',
          element: { filter: ['pre'], visit: () => {} },
        } as never,
      ],
    )
    mockCacheInstance.getAsync.mockReset()
    mockCacheInstance.set.mockReset()
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
            expect.objectContaining({ name: 'satteri-rehype-shiki' }),
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

    it('throws when satteri returns empty code', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockResolvedValue({
        code: '',
        frontmatter: null,
        data: {},
      } as never)

      await expect(compiler.compile('# Hello', 'test.mdx')).rejects.toThrow(
        'Sätteri compilation returned no output for test.mdx',
      )
    })
  })

  describe('error scenarios', () => {
    it('throws when satteri fails', async () => {
      mockCacheInstance.getAsync.mockResolvedValue(null)
      vi.mocked(satteriMdxToJs).mockRejectedValue(new Error('satteri crash'))

      await expect(compiler.compile('# Hello', 'test.mdx')).rejects.toThrow(
        'satteri crash',
      )
    })
  })
})
