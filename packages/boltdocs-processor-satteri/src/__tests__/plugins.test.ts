import { describe, it, expect, vi } from 'vitest'
import { satteriRemarkMetaPlugin } from '../node/satteri-plugins/remark-meta-plugin'
import { satteriRehypeSlugPlugin } from '../node/satteri-plugins/rehype-slug-plugin'

// These plugins use defineMdastPlugin/defineHastPlugin from satteri.
// The mocks are hoisted by vitest so the actual imports see the mocked versions.
vi.mock('satteri', () => ({
  defineMdastPlugin: (def: unknown) => def,
  defineHastPlugin: (def: unknown) => def,
}))

describe('satteriRemarkMetaPlugin', () => {
  it('returns a plugin with correct name', () => {
    const plugin = satteriRemarkMetaPlugin() as unknown as Record<
      string,
      unknown
    >
    expect(plugin.name).toBe('boltdocs-remark-meta')
    expect(typeof plugin.code).toBe('function')
  })

  it('sets hProperties.metastring when node has meta', () => {
    const plugin = satteriRemarkMetaPlugin() as {
      code: (node: unknown, ctx: unknown) => void
    }
    const setProperty = vi.fn()
    plugin.code({ meta: 'lineNumbers', data: {} }, { setProperty })
    expect(setProperty).toHaveBeenCalledTimes(1)
    expect(setProperty).toHaveBeenCalledWith(
      { meta: 'lineNumbers', data: {} },
      'data',
      {
        hProperties: { metastring: 'lineNumbers' },
      },
    )
  })

  it('merges existing data with new hProperties', () => {
    const plugin = satteriRemarkMetaPlugin() as {
      code: (node: unknown, ctx: unknown) => void
    }
    const setProperty = vi.fn()
    plugin.code(
      { meta: 'lineNumbers', data: { existingKey: 'value' } },
      { setProperty },
    )
    expect(setProperty).toHaveBeenCalledWith(
      expect.anything(),
      'data',
      expect.objectContaining({
        existingKey: 'value',
        hProperties: { metastring: 'lineNumbers' },
      }),
    )
  })

  it('does nothing when node has no meta', () => {
    const plugin = satteriRemarkMetaPlugin() as {
      code: (node: unknown, ctx: unknown) => void
    }
    const setProperty = vi.fn()
    plugin.code({ type: 'code', value: 'test' }, { setProperty })
    expect(setProperty).not.toHaveBeenCalled()
  })
})

describe('satteriRehypeSlugPlugin', () => {
  it('returns a plugin with correct name', () => {
    const plugin = satteriRehypeSlugPlugin() as {
      name: string
      element: { filter: string[] }
    }
    expect(plugin.name).toBe('boltdocs-rehype-slug')
    expect(plugin.element).toBeDefined()
  })

  it('filters heading elements', () => {
    const plugin = satteriRehypeSlugPlugin() as unknown as {
      element: { filter: string[]; visit: (...args: unknown[]) => void }
    }
    expect(plugin.element.filter).toEqual(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])
  })

  it('sets id from text content', () => {
    const plugin = satteriRehypeSlugPlugin() as unknown as {
      element: {
        filter: string[]
        visit: (node: unknown, ctx: unknown) => void
      }
    }
    const setProperty = vi.fn()
    const textContent = () => 'Hello World'
    plugin.element.visit({ tagName: 'h1' }, { textContent, setProperty })
    expect(setProperty).toHaveBeenCalledWith(
      { tagName: 'h1' },
      'id',
      'hello-world',
    )
  })

  it('does nothing when text content is empty', () => {
    const plugin = satteriRehypeSlugPlugin() as unknown as {
      element: {
        filter: string[]
        visit: (node: unknown, ctx: unknown) => void
      }
    }
    const setProperty = vi.fn()
    const textContent = () => ''
    plugin.element.visit({ tagName: 'h1' }, { textContent, setProperty })
    expect(setProperty).not.toHaveBeenCalled()
  })
})
