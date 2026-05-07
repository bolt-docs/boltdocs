import { describe, it, expect, vi, beforeEach } from 'vitest'
import { boltdocsMdxPlugin } from '../../packages/core/src/node/mdx'

describe('MDX Compiler Plugin', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should initialize MDX plugin with default options', () => {
    const plugin = boltdocsMdxPlugin()
    expect(plugin).toBeDefined()
    expect(plugin.name).toBe('vite-plugin-boltdocs-mdx')
  })

  it('should compile basic markdown content to react components', async () => {
    const plugin = boltdocsMdxPlugin()
    const code = '# Hello World'
    const id = 'test.mdx'

    // Mock transform function
    const result = await (plugin as any).transform(code, id)
    expect(result).toBeDefined()
    expect(typeof result.code).toBe('string')
    expect(result.code).toContain('import')
  })

  it('should extract frontmatter metadata correctly during compile', async () => {
    const plugin = boltdocsMdxPlugin()
    const code = '---\ntitle: Document Title\n---\n# Document Title'
    const id = 'test.mdx'

    const result = await (plugin as any).transform(code, id)
    expect(result.code).toContain('Document Title')
  })

  it('should support MDX compilation cache', async () => {
    const plugin = boltdocsMdxPlugin()
    const code = '# Cached Content'
    const id = 'test.mdx'

    const result1 = await (plugin as any).transform(code, id)
    const result2 = await (plugin as any).transform(code, id)

    expect(result1.code).toBe(result2.code)
  })
})
