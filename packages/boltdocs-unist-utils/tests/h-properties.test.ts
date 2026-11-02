import { describe, it, expect } from 'vitest'
import {
  setNodeProperty,
  getNodeProperty,
  type NodeWithHProperties,
} from '../src'

describe('h-properties helpers', () => {
  it('setNodeProperty creates data on a fresh node', () => {
    const node: NodeWithHProperties = { type: 'foo' }
    setNodeProperty(node, 'id', 'my-id')
    expect(node.data?.hProperties).toEqual({ id: 'my-id' })
  })

  it('setNodeProperty preserves prior hProperties', () => {
    const node: NodeWithHProperties = {
      type: 'foo',
      data: { hProperties: { id: 'before' } },
    }
    setNodeProperty(node, 'className', 'a')
    expect(node.data?.hProperties).toEqual({ id: 'before', className: 'a' })
  })

  it('setNodeProperty no-ops on null/undefined', () => {
    expect(() => setNodeProperty(null, 'x', 1)).not.toThrow()
    expect(() => setNodeProperty(undefined, 'x', 1)).not.toThrow()
  })

  it('getNodeProperty returns the value', () => {
    const node: NodeWithHProperties = {
      type: 'foo',
      data: { hProperties: { id: '42' } },
    }
    expect(getNodeProperty(node, 'id')).toBe('42')
  })

  it('getNodeProperty returns undefined for missing bag/key', () => {
    expect(getNodeProperty({}, 'id')).toBeUndefined()
    expect(getNodeProperty({ data: {} }, 'id')).toBeUndefined()
  })
})
