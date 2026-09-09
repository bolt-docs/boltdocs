import { describe, it, expect } from 'vitest'
import { transformSource } from '../src/node/source-transform'

const run = (code: string) =>
  transformSource(null as any, { code, filePath: 'x.mdx' })

describe('preprocessMath', () => {
  it('converts block math to BlockMath components', () => {
    const { code } = run('Before\n$$\nE = mc^2\n$$\nAfter')
    expect(code).toContain('<BlockMath>')
    expect(code).not.toContain('$$')
  })

  it('converts inline math to MathComponent', () => {
    const { code } = run('Use $x + 1$ here')
    expect(code).toContain('<MathComponent>')
    expect(code).not.toContain('$x')
  })

  it('protects fenced and inline code but converts real inline math', () => {
    const code = '```\n$$\nnot math\n$$\n```\nand `$literal$`\nInline $a$ here'
    const { code: out } = run(code)
    // Explicit fenced block must be preserved untouched.
    expect(out).toContain('```\n$$\nnot math\n$$\n```')
    // Inline code placeholder must not be converted.
    expect(out).toContain('`$literal$`')
    // Real inline math outside code still converts.
    expect(out).toContain('<MathComponent>{"a"}</MathComponent>')
  })

  it('protects frontmatter from math replacement', () => {
    const code = '---\ntitle: "$$\n---\n\nBody $x$'
    const { code: out } = run(code)
    expect(out).not.toContain('<BlockMath>')
    expect(out).toContain('<MathComponent>')
  })

  it('escapes quotes inside math expressions', () => {
    const { code } = run('$$ x = "quote" $$')
    expect(code).not.toContain('quote"')
    expect(code).toContain('\\"')
  })
})
