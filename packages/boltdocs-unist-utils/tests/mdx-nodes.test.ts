import { describe, it, expect } from 'vitest'
import { MDX_NODES, SKIP, EXIT } from '../src'

describe('MDX_NODES', () => {
  it('exposes the canonical unist node types', () => {
    expect(MDX_NODES.ROOT).toBe('root')
    expect(MDX_NODES.ELEMENT).toBe('element')
    expect(MDX_NODES.TEXT).toBe('text')
    expect(MDX_NODES.CODE).toBe('code')
    expect(MDX_NODES.INLINE_CODE).toBe('inlineCode')
    expect(MDX_NODES.HEADING).toBe('heading')
    expect(MDX_NODES.LINK).toBe('link')
    expect(MDX_NODES.JSX_FLOW_ELEMENT).toBe('mdxJsxFlowElement')
    expect(MDX_NODES.JSX_TEXT_ELEMENT).toBe('mdxJsxTextElement')
    expect(MDX_NODES.JSX_ATTRIBUTE).toBe('mdxJsxAttribute')
    expect(MDX_NODES.FLOW_EXPRESSION).toBe('mdxFlowExpression')
    expect(MDX_NODES.TEXT_EXPRESSION).toBe('mdxTextExpression')
    expect(MDX_NODES.ESM).toBe('mdxjsEsm')
  })

  it('SKIP and EXIT are re-exported from unist-util-visit', () => {
    // unist-util-visit@5 exports SKIP as the string `'skip'` and EXIT as the
    // boolean `false`. We pin the runtime contract so plugin authors can
    // rely on it.
    expect(typeof SKIP).toBe('string')
    expect(SKIP).toBe('skip')
    expect(typeof EXIT).toBe('boolean')
    expect(EXIT).toBe(false)
  })
})
