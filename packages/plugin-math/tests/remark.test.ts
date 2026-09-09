import { describe, it, expect } from 'vitest'
import mathPlugin from '../src/node/index'
import { transformSource } from '../src/node/source-transform'

describe('mathPlugin', () => {
  it('exposes the plugin contract', () => {
    const plugin = mathPlugin()
    expect(plugin.name).toBe('boltdocs-plugin-math')
    expect(plugin.version).toBe('0.1.0')
    expect(typeof plugin.hooks?.transformSource).toBe('function')
  })

  it('registers the Math, MathComponent and BlockMath components', () => {
    const plugin = mathPlugin()
    expect(plugin.components).toMatchObject({
      Math: '@bdocs/plugin-math/client',
      MathComponent: '@bdocs/plugin-math/client',
      BlockMath: '@bdocs/plugin-math/client',
    })
  })

  it('wires the shared transformSource hook', () => {
    const plugin = mathPlugin()
    expect(plugin.hooks?.transformSource).toBe(transformSource)
  })
})

describe('mathPlugin transformSource end-to-end', () => {
  it('transforms block math to BlockMath mdxJsxFlowElement-style output', () => {
    const plugin = mathPlugin()
    const { code } = plugin.hooks!.transformSource!(null as any, {
      code: '$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$',
      filePath: 'math.mdx',
    })
    expect(code).toContain('<BlockMath>')
    expect(code).not.toContain('$$')
  })

  it('transforms inline math to MathComponent output', () => {
    const plugin = mathPlugin()
    const { code } = plugin.hooks!.transformSource!(null as any, {
      code: 'The value $x$ is positive.',
      filePath: 'math.mdx',
    })
    expect(code).toContain('<MathComponent>{"x"}</MathComponent>')
  })

  it('handles multiple inline math occurrences in the same source', () => {
    const plugin = mathPlugin()
    const { code } = plugin.hooks!.transformSource!(null as any, {
      code: 'A $a$ and B $b$ and C $c$.',
      filePath: 'math.mdx',
    })
    const matches = code.match(/<MathComponent>/g) || []
    expect(matches).toHaveLength(3)
  })

  it('handles multiple block math blocks in the same source', () => {
    const plugin = mathPlugin()
    const { code } = plugin.hooks!.transformSource!(null as any, {
      code: '$$\nA\n$$\n\ntext\n\n$$\nB\n$$',
      filePath: 'math.mdx',
    })
    const matches = code.match(/<BlockMath>/g) || []
    expect(matches).toHaveLength(2)
  })

  it('treats a double dollar as block math, not inline math', () => {
    const plugin = mathPlugin()
    const { code } = plugin.hooks!.transformSource!(null as any, {
      code: 'Cost: $$50$$ is display math.',
      filePath: 'math.mdx',
    })
    expect(code).toContain('<BlockMath>{"50"}</BlockMath>')
    expect(code).not.toContain('<MathComponent>')
  })

  it('leaves source without math unchanged', () => {
    const plugin = mathPlugin()
    const input = 'Just plain text with no math here.'
    const { code } = plugin.hooks!.transformSource!(null as any, {
      code: input,
      filePath: 'math.mdx',
    })
    expect(code).toBe(input)
  })

  it('handles multiline block math content', () => {
    const plugin = mathPlugin()
    const { code } = plugin.hooks!.transformSource!(null as any, {
      code: '$$\n\\begin{aligned}\nx &= 1 \\\\\ny &= 2\n\\end{aligned}\n$$',
      filePath: 'math.mdx',
    })
    expect(code).toContain('<BlockMath>')
    expect(code).toContain('x &= 1')
  })
})
