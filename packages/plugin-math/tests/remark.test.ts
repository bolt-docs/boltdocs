import { describe, it, expect } from 'vitest'
import mathPlugin from '../src/node/index'

describe('remarkMathToMdx', () => {
  it('transform $$...$$ to BlockMath mdxJsxFlowElement', () => {
    const plugin = mathPlugin()
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
              value: '$$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$',
            },
          ],
        },
      ],
    }

    transform(tree)

    expect(tree.children[0]).toMatchObject({
      type: 'mdxJsxFlowElement',
      name: 'BlockMath',
    })
    expect(tree.children[0].children[0].value).toBe(
      '\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}',
    )
  })

  it('transform $...$ to Math mdxJsxTextElement', () => {
    const plugin = mathPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'The equation $E = mc^2$ is famous.' },
          ],
        },
      ],
    }

    transform(tree)

    const children = tree.children[0].children
    expect(children).toHaveLength(3)
    expect(children[0]).toMatchObject({ type: 'text', value: 'The equation ' })
    expect(children[1]).toMatchObject({
      type: 'mdxJsxTextElement',
      name: 'Math',
    })
    expect(children[1].children[0].value).toBe('E = mc^2')
    expect(children[2]).toMatchObject({ type: 'text', value: ' is famous.' })
  })

  it('handle multiple inline math in same text', () => {
    const plugin = mathPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '$a$ and $b$ are numbers' }],
        },
      ],
    }

    transform(tree)

    const children = tree.children[0].children
    expect(children).toHaveLength(4)
    expect(children[0].children[0].value).toBe('a')
    expect(children[2].children[0].value).toBe('b')
  })

  it('handle multiple block math in same tree', () => {
    const plugin = mathPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '$$\\alpha$$' }],
        },
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '$$\\beta$$' }],
        },
      ],
    }

    transform(tree)

    expect(tree.children[0]).toMatchObject({
      type: 'mdxJsxFlowElement',
      name: 'BlockMath',
    })
    expect(tree.children[1]).toMatchObject({
      type: 'mdxJsxFlowElement',
      name: 'BlockMath',
    })
  })

  it('not transform double dollar as inline math', () => {
    const plugin = mathPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            { type: 'text', value: 'Inline $a$ and block $$b$$ are different' },
          ],
        },
      ],
    }

    transform(tree)

    const children = tree.children[0].children
    const mathCount = children.filter((c: any) => c.name === 'Math').length
    expect(mathCount).toBe(1)
    expect(children.some((c: any) => c.value?.includes('$$b$$'))).toBe(true)
  })

  it('handle undefined or null tree gracefully', () => {
    const plugin = mathPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    expect(() => transform(undefined)).not.toThrow()
    expect(() => transform(null)).not.toThrow()
  })

  it('leave paragraph without math unchanged', () => {
    const plugin = mathPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: 'Normal text without math.' }],
        },
      ],
    }

    const original = JSON.parse(JSON.stringify(tree))
    transform(tree)
    expect(tree).toEqual(original)
  })

  it('handle block math with multiline content', () => {
    const plugin = mathPlugin()
    const transform = plugin.remarkPlugins?.[0]
    expect(transform).toBeDefined()

    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', value: '$$\n\\sum_{i=1}^{n} i\n$$' }],
        },
      ],
    }

    transform(tree)

    expect(tree.children[0]).toMatchObject({
      type: 'mdxJsxFlowElement',
      name: 'BlockMath',
    })
    expect(tree.children[0].children[0].value).toBe('\\sum_{i=1}^{n} i')
  })
})
