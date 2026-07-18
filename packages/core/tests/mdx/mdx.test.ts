import { describe, it, expect, vi, beforeEach } from 'vitest'
import { boltdocsMdxPlugin } from '../../src/node/mdx'
import {
  MDX_NODES,
  visitNodes,
  visitRehypeElements,
  visitMdxElements,
  setNodeProperty,
  getNodeProperty,
  createMdxAttribute,
  createRehypeElement,
  createMdxElement,
  addNodeClass,
  removeNodeClass,
  hasNodeClass,
} from '@bdocs/unist-utils'
import { rehypeShiki } from '../../src/node/mdx/rehype-shiki'

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

describe('Plugin Utilities', () => {
  it('should visit nodes using general visitNodes with string type', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'code', lang: 'typescript', value: 'const x = 1' }],
    }
    let called = false
    visitNodes<any>(tree, MDX_NODES.CODE, (node) => {
      expect(node.lang).toBe('typescript')
      expect(node.value).toBe('const x = 1')
      called = true
    })
    expect(called).toBe(true)
  })

  it('should visit nodes using general visitNodes with array of types', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'code', lang: 'typescript', value: 'const x = 1' },
        {
          type: 'heading',
          depth: 2,
          children: [{ type: 'text', value: 'Title' }],
        },
      ],
    }
    const visitedTypes: string[] = []
    visitNodes<any>(tree, [MDX_NODES.CODE, MDX_NODES.HEADING], (node) => {
      visitedTypes.push(node.type)
    })
    expect(visitedTypes).toEqual(['code', 'heading'])
  })

  it('should visit nodes using general visitNodes with predicate function', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'code', lang: 'typescript', value: 'const x = 1' },
        {
          type: 'heading',
          depth: 2,
          children: [{ type: 'text', value: 'Title' }],
        },
      ],
    }
    const visitedTypes: string[] = []
    visitNodes<any>(
      tree,
      (node) => node.type === 'code' || (node as any).depth === 2,
      (node) => {
        visitedTypes.push(node.type)
      },
    )
    expect(visitedTypes).toEqual(['code', 'heading'])
  })

  it('should visit Rehype elements by tag name', () => {
    const tree = {
      type: 'root',
      children: [
        { type: 'element', tagName: 'div' },
        { type: 'element', tagName: 'span' },
      ],
    }
    let visitedDiv = false
    visitRehypeElements(tree, 'div', (node) => {
      expect(node.tagName).toBe('div')
      visitedDiv = true
    })
    expect(visitedDiv).toBe(true)
  })

  it('should visit MDX components', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'mdxJsxFlowElement', name: 'Mermaid' }],
    }
    let visitedMermaid = false
    visitMdxElements(tree, 'Mermaid', (node) => {
      expect(node.name).toBe('Mermaid')
      visitedMermaid = true
    })
    expect(visitedMermaid).toBe(true)
  })

  it('should set and get node properties correctly', () => {
    const node: any = {}
    setNodeProperty(node, 'testKey', 'testVal')
    expect(getNodeProperty(node, 'testKey')).toBe('testVal')
    expect(node.data.hProperties.testKey).toBe('testVal')
  })

  it('should create MDX attributes correctly', () => {
    const attr1 = createMdxAttribute('title', 'Hello')
    expect(attr1).toEqual({
      type: 'mdxJsxAttribute',
      name: 'title',
      value: 'Hello',
    })

    const expr = { type: 'expression', value: '{}' }
    const attr2 = createMdxAttribute('config', expr)
    expect(attr2).toEqual({
      type: 'mdxJsxAttribute',
      name: 'config',
      value: expr,
    })
  })

  it('should create Rehype elements correctly', () => {
    const el = createRehypeElement('div', { id: 'test' }, [
      { type: 'text', value: 'hello' },
    ])
    expect(el).toEqual({
      type: 'element',
      tagName: 'div',
      properties: { id: 'test' },
      children: [{ type: 'text', value: 'hello' }],
    })
  })

  it('should create MDX elements correctly', () => {
    const el = createMdxElement('Mermaid', { chart: 'graph TD' }, [], true)
    expect(el).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        {
          type: 'mdxJsxAttribute',
          name: 'chart',
          value: 'graph TD',
        },
      ],
      children: [],
    })
  })

  it('should handle node class manipulation', () => {
    const node: any = {
      type: 'element',
      tagName: 'div',
      properties: {},
    }
    expect(hasNodeClass(node, 'foo')).toBe(false)

    addNodeClass(node, 'foo')
    expect(hasNodeClass(node, 'foo')).toBe(true)
    expect(node.properties.className).toEqual(['foo'])

    addNodeClass(node, 'bar')
    expect(hasNodeClass(node, 'bar')).toBe(true)
    expect(node.properties.className).toEqual(['foo', 'bar'])

    removeNodeClass(node, 'foo')
    expect(hasNodeClass(node, 'foo')).toBe(false)
    expect(hasNodeClass(node, 'bar')).toBe(true)

    removeNodeClass(node, 'bar')
    expect(hasNodeClass(node, 'bar')).toBe(false)
  })
})

describe('Rehype Shiki with HAST injection', () => {
  it('should highlight code block and inject HAST tree nodes directly', async () => {
    const plugin = rehypeShiki()
    const tree = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-js'] },
              children: [{ type: 'text', value: 'const a = 123;' }],
            },
          ],
        },
      ],
    }

    await plugin(tree)

    const preNode = tree.children[0] as any
    expect(preNode.properties['data-highlighted']).toBe('true')
    expect(preNode.properties['data-lang']).toBe('js')
    expect(preNode.properties['data-highlighted-html']).toBeUndefined()

    expect(preNode.children.length).toBeGreaterThan(0)
    const codeNode = preNode.children[0]
    expect(codeNode.tagName).toBe('code')
    expect(codeNode.children.length).toBeGreaterThan(0)
  })
})
