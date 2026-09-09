import { describe, expect, it } from 'vitest'
import tailwindcssPlugin from '../src/node/index'

describe('Tailwind CSS plugin', () => {
  it('creates the Vite plugin with the requested optimization mode', () => {
    const plugin = tailwindcssPlugin({ optimize: { minify: true } })

    expect(plugin.vitePlugins).toHaveLength(1)
    expect(plugin.vitePlugins?.[0]).toBeDefined()
    expect(typeof plugin.vitePlugins?.[0]).toBe('object')
  })
})
