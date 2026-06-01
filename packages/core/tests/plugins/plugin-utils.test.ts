import { describe, it, expect } from 'vitest'
import {
  createMdxElement,
  createMdxAttribute,
  addNodeClass,
  removeNodeClass,
  hasNodeClass,
} from '../../src/node/plugins/plugin-utils'
import { MDX_NODES } from '../../src/node/mdx/constants'

describe('Plugin Utilities', () => {
  describe('createMdxAttribute', () => {
    it('should create a string attribute', () => {
      const attr = createMdxAttribute('title', 'Hello')
      expect(attr.type).toBe(MDX_NODES.JSX_ATTRIBUTE)
      expect(attr.name).toBe('title')
      expect(attr.value).toBe('Hello')
    })

    it('should create an expression attribute for object values', () => {
      const attr = createMdxAttribute('style', { color: 'red' })
      expect(attr.type).toBe(MDX_NODES.JSX_ATTRIBUTE)
      expect(attr.name).toBe('style')
    })
  })

  describe('createMdxElement', () => {
    it('should create a flow element by default', () => {
      const el = createMdxElement('MyComponent', { title: 'test' })
      expect(el.type).toBe(MDX_NODES.JSX_FLOW_ELEMENT)
      expect(el.name).toBe('MyComponent')
      expect(el.attributes).toHaveLength(1)
      expect(el.children).toEqual([])
    })

    it('should create a text element when isFlow is false', () => {
      const el = createMdxElement('Inline', {}, [], false)
      expect(el.type).toBe(MDX_NODES.JSX_TEXT_ELEMENT)
    })

    it('should include children nodes', () => {
      const child = { type: 'text', value: 'hello' } as any
      const el = createMdxElement('Wrapper', {}, [child])
      expect(el.children).toHaveLength(1)
      expect(el.children[0]).toBe(child)
    })
  })

  describe('addNodeClass / removeNodeClass / hasNodeClass', () => {
    it('should add a class to an element', () => {
      const node: any = { type: 'element', tagName: 'div', properties: {} }
      addNodeClass(node, 'my-class')
      expect(node.properties.className).toEqual(['my-class'])
    })

    it('should not duplicate classes', () => {
      const node: any = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['my-class'] },
      }
      addNodeClass(node, 'my-class')
      expect(node.properties.className).toEqual(['my-class'])
    })

    it('should check class existence', () => {
      const node: any = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['a', 'b'] },
      }
      expect(hasNodeClass(node, 'a')).toBe(true)
      expect(hasNodeClass(node, 'c')).toBe(false)
    })

    it('should remove a class', () => {
      const node: any = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['a', 'b', 'c'] },
      }
      removeNodeClass(node, 'b')
      expect(node.properties.className).toEqual(['a', 'c'])
    })
  })
})
