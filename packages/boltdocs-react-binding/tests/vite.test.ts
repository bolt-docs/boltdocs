import type { Plugin } from 'vite'
import { describe, expect, it } from 'vitest'
import { PREWARM_ENTRIES, reactBindingVitePlugin } from '../src/vite'

function runConfig(
  plugin: Plugin,
  userConfig: Record<string, unknown> = {},
): Record<string, unknown> {
  const hook = plugin.config
  if (typeof hook !== 'function') return hook ?? {}
  return (hook as (config: Record<string, unknown>) => Record<string, unknown>)(
    userConfig,
  )
}

function bindingPlugin(plugins: Plugin[]): Plugin {
  const plugin = plugins.find((p) => p.name === 'boltdocs-react-binding')
  if (!plugin) throw new Error('binding plugin not registered')
  return plugin
}

describe('reactBindingVitePlugin', () => {
  it('only adds @vitejs/plugin-react when fast refresh is enabled', () => {
    const withoutRefresh = reactBindingVitePlugin({
      isProd: true,
      fastRefresh: false,
    })
    expect(withoutRefresh).toHaveLength(1)
    expect(withoutRefresh.some((p) => p.name?.startsWith('vite:react'))).toBe(
      false,
    )

    const plugins = reactBindingVitePlugin({ isProd: false, fastRefresh: true })
    expect(plugins.map((p) => p.name)).toContain('boltdocs-react-binding')
    expect(plugins.some((p) => p.name?.startsWith('vite:react'))).toBe(true)
  })

  it('configures automatic JSX with the right development mode', () => {
    for (const [isProd, development] of [
      [true, false],
      [false, true],
    ] as const) {
      const config = runConfig(
        bindingPlugin(reactBindingVitePlugin({ isProd, fastRefresh: false })),
      )
      expect(config.oxc).toMatchObject({
        jsx: { runtime: 'automatic', importSource: 'react', development },
      })
    }
  })

  it('prewarms React, dedupes it and externalizes it for SSR', () => {
    const config = runConfig(
      bindingPlugin(
        reactBindingVitePlugin({ isProd: false, fastRefresh: false }),
      ),
      {
        optimizeDeps: { include: ['existing'] },
        ssr: { external: ['existing-ssr'] },
        resolve: { dedupe: ['existing-dedupe'] },
      },
    )

    expect(config.optimizeDeps).toMatchObject({
      include: expect.arrayContaining(['react', 'react-dom', 'existing']),
    })
    expect(config.ssr).toMatchObject({
      external: expect.arrayContaining(['react', 'react-dom', 'existing-ssr']),
    })
    expect(config.resolve).toMatchObject({
      dedupe: expect.arrayContaining(['react', 'react-dom', 'existing-dedupe']),
    })
    expect(PREWARM_ENTRIES).toEqual(
      expect.arrayContaining(['react', 'react-dom', 'react-router-dom']),
    )
  })
})
