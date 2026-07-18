import { describe, it, expect } from 'vitest'
import {
  MDX_NODES,
  createMdxAttribute,
  createMdxElement,
  createRehypeElement,
} from '../src'

describe('createMdxAttribute', () => {
  it('emits plain string for string values', () => {
    const attr = createMdxAttribute('chart', 'A')
    expect(attr.type).toBe(MDX_NODES.JSX_ATTRIBUTE)
    expect(attr.name).toBe('chart')
    expect(attr.value).toBe('A')
  })

  it('passes object values through under the attrs.value field', () => {
    // For Phase 1 we preserve the long-standing behaviour: object/array
    // values are stored verbatim under `value` so plugin authors can
    // wrap them in `mdxJsxAttributeValueExpression` themselves. A future
    // Phase will introduce a stricter builder that always wraps.
    const attr = createMdxAttribute('config', { foo: 'bar' })
    expect(attr.type).toBe(MDX_NODES.JSX_ATTRIBUTE)
    expect(attr.name).toBe('config')
    expect(attr.value).toEqual({ foo: 'bar' })
  })

  it('emits plain string for arrays', () => {
    const attr = createMdxAttribute('items', [1, 2])
    expect(typeof attr.value).toBe('string')
  })
})

describe('createMdxElement', () => {
  it('defaults to flow element', () => {
    const el = createMdxElement('Foo', { chart: 'x' })
    expect(el.type).toBe(MDX_NODES.JSX_FLOW_ELEMENT)
    expect(el.name).toBe('Foo')
    expect(el.attributes?.[0]?.name).toBe('chart')
    expect(el.attributes?.[0]?.value).toBe('x')
  })

  it('emits text element when isFlow=false', () => {
    const el = createMdxElement('A', {}, [], false)
    expect(el.type).toBe(MDX_NODES.JSX_TEXT_ELEMENT)
  })

  it('preserves children array reference', () => {
    const el = createMdxElement('Foo', {})
    expect(el.children).toEqual([])
  })
})

describe('createRehypeElement', () => {
  it('builds an element with given properties and children', () => {
    const el = createRehypeElement('pre', { className: ['sh'] }, [])
    expect(el.type).toBe(MDX_NODES.ELEMENT)
    expect(el.tagName).toBe('pre')
    expect(el.properties).toEqual({ className: ['sh'] })
  })

  it('defaults properties and children', () => {
    const el = createRehypeElement('div')
    expect(el.tagName).toBe('div')
    expect(el.properties).toEqual({})
    expect(el.children).toEqual([])
  })
})
