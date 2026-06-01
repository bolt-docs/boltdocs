import { describe, it, expect } from 'vitest'
import { BoltdocsPluginStore } from '../../src/node/plugins/plugin-store'

describe('BoltdocsPluginStore', () => {
  it('should store and retrieve values by plugin and key', () => {
    const store = new BoltdocsPluginStore()
    store.set('plugin-a', 'api', { url: 'https://api.com' })
    expect(store.get('plugin-a', 'api')).toEqual({ url: 'https://api.com' })
  })

  it('should namespace keys per plugin', () => {
    const store = new BoltdocsPluginStore()
    store.set('plugin-a', 'key', 'value-a')
    store.set('plugin-b', 'key', 'value-b')
    expect(store.get('plugin-a', 'key')).toBe('value-a')
    expect(store.get('plugin-b', 'key')).toBe('value-b')
  })

  it('should return deep clones for object values', () => {
    const store = new BoltdocsPluginStore()
    const original = { nested: { value: 1 } }
    store.set('test', 'data', original)

    const retrieved = store.get<typeof original>('test', 'data')!
    retrieved.nested.value = 2

    const retrievedAgain = store.get<typeof original>('test', 'data')!
    expect(retrievedAgain.nested.value).toBe(1)
  })

  it('should return undefined for missing keys', () => {
    const store = new BoltdocsPluginStore()
    expect(store.get('any-plugin', 'nonexistent')).toBeUndefined()
  })

  it('should check key existence with has()', () => {
    const store = new BoltdocsPluginStore()
    store.set('p', 'x', 1)
    expect(store.has('p', 'x')).toBe(true)
    expect(store.has('p', 'y')).toBe(false)
    expect(store.has('other', 'x')).toBe(false)
  })

  it('should store primitive values directly (no clone)', () => {
    const store = new BoltdocsPluginStore()
    store.set('p', 'num', 42)
    store.set('p', 'str', 'hello')
    store.set('p', 'bool', true)

    expect(store.get('p', 'num')).toBe(42)
    expect(store.get('p', 'str')).toBe('hello')
    expect(store.get('p', 'bool')).toBe(true)
  })
})
