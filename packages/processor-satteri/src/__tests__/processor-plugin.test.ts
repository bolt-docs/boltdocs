import { describe, it, expect, vi } from 'vitest'
import { createSatteriProcessorPlugin } from '../node/index'

vi.mock('satteri', () => ({
  defineMdastPlugin: (def: unknown) => def,
  defineHastPlugin: (def: unknown) => def,
}))

describe('createSatteriProcessorPlugin', () => {
  it('returns a plugin with correct metadata', () => {
    const plugin = createSatteriProcessorPlugin()
    expect(plugin.name).toBe('boltdocs-processor-satteri')
    expect(plugin.version).toBe('0.1.0')
    expect(plugin.boltdocsVersion).toBe('>=3.0.0')
  })

  it('includes 1 mdast plugin (remark-meta)', () => {
    const plugin = createSatteriProcessorPlugin()
    expect(plugin.mdastPlugins).toHaveLength(1)
    const metaPlugin = plugin.mdastPlugins[0]
    expect(metaPlugin).toHaveProperty('name', 'boltdocs-remark-meta')
    expect(metaPlugin).toHaveProperty('code')
  })

  it('includes 2 hast plugins (slug + shiki)', () => {
    const plugin = createSatteriProcessorPlugin()
    expect(plugin.hastPlugins).toHaveLength(2)
    const names = plugin.hastPlugins.map((p) => (p as { name: string }).name)
    expect(names).toContain('boltdocs-rehype-slug')
    expect(names).toContain('boltdocs-rehype-shiki')
  })

  it('returns plugins with proper structure for compilation', () => {
    const plugin = createSatteriProcessorPlugin()

    // Each mdast plugin should have a callable code visitor
    for (const p of plugin.mdastPlugins) {
      const plugin = p as { name: string; code?: unknown }
      expect(typeof plugin.code).toBe('function')
    }

    // Each hast plugin should have element visitors
    for (const p of plugin.hastPlugins) {
      const plugin = p as { name: string; element?: unknown }
      expect(plugin.element).toBeDefined()
      expect(plugin.element).toHaveProperty('filter')
      expect(plugin.element).toHaveProperty('visit')
    }
  })
})
