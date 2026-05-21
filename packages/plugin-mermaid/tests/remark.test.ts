import { describe, it, expect } from 'vitest'
import mermaidPlugin from '../src/node/index'

describe('mermaidPlugin remark compiler', () => {
  it('should transform mermaid code blocks to Mermaid MDX components', () => {
    const plugin = mermaidPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'Some text before',
            },
          ],
        },
        {
          type: 'code',
          lang: 'mermaid',
          value: 'graph TD\n  A --> B',
        },
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              value: 'Some text after',
            },
          ],
        },
      ],
    }

    // Run the transform
    transform(tree)

    // Check that the code block has been transformed
    expect(tree.children[1]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        {
          type: 'mdxJsxAttribute',
          name: 'chart',
          value: 'graph TD\n  A --> B',
        },
      ],
      children: [],
    })
  })

  it('should handle multiple mermaid blocks in the same tree', () => {
    const plugin = mermaidPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'mermaid',
          value: 'chart 1',
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'intermediate text' }],
        },
        {
          type: 'code',
          lang: 'mermaid',
          value: 'chart 2',
        },
      ],
    }

    transform(tree)

    expect(tree.children[0]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'chart', value: 'chart 1' },
      ],
      children: [],
    })
    expect(tree.children[2]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'chart', value: 'chart 2' },
      ],
      children: [],
    })
  })

  it('should handle nested mermaid blocks in blockquotes or lists', () => {
    const plugin = mermaidPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'blockquote',
          children: [
            {
              type: 'code',
              lang: 'mermaid',
              value: 'nested chart',
            },
          ],
        },
      ],
    }

    transform(tree)

    expect(tree.children[0].children[0]).toEqual({
      type: 'mdxJsxFlowElement',
      name: 'Mermaid',
      attributes: [
        { type: 'mdxJsxAttribute', name: 'chart', value: 'nested chart' },
      ],
      children: [],
    })
  })

  it('should gracefully handle undefined or null tree', () => {
    const plugin = mermaidPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    expect(() => transform(undefined)).not.toThrow()
    expect(() => transform(null)).not.toThrow()
  })
})
