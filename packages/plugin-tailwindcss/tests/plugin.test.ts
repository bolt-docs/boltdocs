import { describe, expect, it } from 'vitest'
import tailwindcssPlugin from '../src/node/index'

describe('Tailwind CSS plugin', () => {
  it('contributes the Tailwind Vite plugins', () => {
    const plugin = tailwindcssPlugin({ optimize: { minify: true } })

    expect(plugin.vitePlugins).toBeDefined()
    expect(plugin.vitePlugins!.length).toBeGreaterThan(0)

    // `tailwindVite()` returns the plugin list itself. Wrapping it in another
    // array produced a nested list — Vite flattens it, so it worked, and the
    // engine received a list of lists instead of a list of plugins.
    for (const vitePlugin of plugin.vitePlugins!) {
      expect(Array.isArray(vitePlugin)).toBe(false)
      expect(typeof vitePlugin).toBe('object')
    }
  })
})
