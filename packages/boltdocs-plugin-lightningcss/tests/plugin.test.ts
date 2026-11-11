import { describe, expect, it } from 'vitest'
import lightningcssPlugin from '../src/node/index'

describe('Lightning CSS plugin', () => {
  it('contributes a Vite plugin that enables the lightningcss transformer', () => {
    const plugin = lightningcssPlugin({ drafts: { customMedia: true } })
    expect(plugin.vitePlugins).toHaveLength(1)
    const vitePlugin = plugin.vitePlugins![0] as {
      name: string
      config: () => unknown
    }
    expect(vitePlugin.name).toBe('boltdocs:lightningcss')
    expect(vitePlugin.config()).toEqual({
      css: {
        transformer: 'lightningcss',
        lightningcss: { drafts: { customMedia: true } },
      },
    })
  })
})
