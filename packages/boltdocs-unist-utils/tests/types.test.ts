import { describe, it, expect } from 'vitest'
import {
  isMdxJsxElement,
  isMdxJsxTextElement,
  isMdxJsxLike,
  isElementNode,
  isTextNode,
  type CodeNode,
  type ElementNode,
  type MdxJsxElement,
} from '../src'

describe('type guards', () => {
  it('isMdxJsxElement', () => {
    const flow: MdxJsxElement = {
      type: 'mdxJsxFlowElement',
      name: 'Foo',
    }
    expect(isMdxJsxElement(flow)).toBe(true)
    expect(isMdxJsxElement({ type: 'mdxJsxTextElement', name: 'A' })).toBe(
      false,
    )
    expect(isMdxJsxElement(null)).toBe(false)
    expect(isMdxJsxElement(undefined)).toBe(false)
    expect(isMdxJsxElement('foo')).toBe(false)
  })

  it('isMdxJsxTextElement', () => {
    const inline: MdxJsxElement = {
      type: 'mdxJsxTextElement',
      name: 'A',
    }
    expect(isMdxJsxTextElement(inline)).toBe(true)
    expect(isMdxJsxTextElement({ type: 'mdxJsxFlowElement', name: 'A' })).toBe(
      false,
    )
  })

  it('isMdxJsxLike', () => {
    expect(isMdxJsxLike({ type: 'mdxJsxFlowElement', name: 'A' })).toBe(true)
    expect(isMdxJsxLike({ type: 'mdxJsxTextElement', name: 'B' })).toBe(true)
    expect(isMdxJsxLike({ type: 'element', tagName: 'div' })).toBe(false)
  })

  it('isElementNode', () => {
    const el: ElementNode = { type: 'element', tagName: 'div' }
    expect(isElementNode(el)).toBe(true)
    expect(isElementNode({ type: 'element', tagName: 123 })).toBe(false)
    expect(isElementNode({ type: 'root' })).toBe(false)
  })

  it('isTextNode', () => {
    expect(isTextNode({ type: 'text', value: 'hello' })).toBe(true)
    expect(isTextNode({ type: 'text', value: 1 })).toBe(false)
    expect(isTextNode({ type: 'element', tagName: 'p' })).toBe(false)
  })

  it('CodeNode is structurally assignable', () => {
    const c: CodeNode = {
      type: 'code',
      lang: 'ts',
      value: 'const x = 1',
    }
    expect(c.lang).toBe('ts')
  })
})
