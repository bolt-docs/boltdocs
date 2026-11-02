import { describe, it, expect } from 'vitest'
import {
  addNodeClass,
  removeNodeClass,
  hasNodeClass,
  type ElementNode,
} from '../src'

describe('class-list helpers', () => {
  it('addNodeClass appends to empty node', () => {
    const node: ElementNode = { type: 'element', tagName: 'pre' }
    addNodeClass(node, 'shiki')
    expect(node.properties?.className).toEqual(['shiki'])
  })

  it('addNodeClass appends to existing list', () => {
    const node: ElementNode = {
      type: 'element',
      tagName: 'pre',
      properties: { className: ['a'] },
    }
    addNodeClass(node, 'b')
    expect(node.properties?.className).toEqual(['a', 'b'])
  })

  it('addNodeClass is idempotent', () => {
    const node: ElementNode = {
      type: 'element',
      tagName: 'pre',
      properties: { className: ['a'] },
    }
    addNodeClass(node, 'a')
    expect(node.properties?.className).toEqual(['a'])
  })

  it('addNodeClass normalises a string className', () => {
    const node: ElementNode = {
      type: 'element',
      tagName: 'pre',
      properties: { className: 'a b' },
    }
    addNodeClass(node, 'c')
    expect(node.properties?.className).toEqual(['a', 'b', 'c'])
  })

  it('removeNodeClass deletes the class when present', () => {
    const node: ElementNode = {
      type: 'element',
      tagName: 'pre',
      properties: { className: ['a', 'b'] },
    }
    removeNodeClass(node, 'a')
    expect(node.properties?.className).toEqual(['b'])
  })

  it('removeNodeClass removes the key when list becomes empty', () => {
    const node: ElementNode = {
      type: 'element',
      tagName: 'pre',
      properties: { className: ['only'] },
    }
    removeNodeClass(node, 'only')
    expect(node.properties).not.toHaveProperty('className')
  })

  it('hasNodeClass reflects membership', () => {
    expect(
      hasNodeClass(
        { type: 'element', tagName: 'pre', properties: { className: ['a'] } },
        'a',
      ),
    ).toBe(true)
    expect(hasNodeClass({ type: 'element', tagName: 'pre' }, 'a')).toBe(false)
    expect(hasNodeClass(null, 'a')).toBe(false)
  })
})
