import { describe, it, expect } from 'vitest'
import mermaidPlugin from '../node/index'

interface AliasVitePlugin {
  name: string
  config: (
    config: unknown,
    env: { command: string },
  ) => { resolve: { alias: Record<string, string> } } | undefined
}

describe('mermaidPlugin factory shape', () => {
  it('exposes a stable name and version', () => {
    const plugin = mermaidPlugin()
    expect(plugin.name).toBe('boltdocs-plugin-mermaid')
    expect(plugin.version).toBe('0.1.0')
  })

  it('registers the Mermaid component', () => {
    const plugin = mermaidPlugin()
    expect(plugin.components?.Mermaid).toBe('@bdocs/plugin-mermaid/client')
  })

  it('registers a build alias vite plugin that maps to static during build', () => {
    const plugin = mermaidPlugin()
    const vitePlugins = plugin.vitePlugins ?? []
    expect(vitePlugins.length).toBeGreaterThanOrEqual(1)
    const aliasPlugin = vitePlugins.find(
      (p) =>
        p &&
        typeof p === 'object' &&
        'name' in p &&
        p.name === 'boltdocs-mermaid-build-alias',
    ) as AliasVitePlugin | undefined
    if (!aliasPlugin) throw new Error('alias plugin not registered')
    const result = aliasPlugin.config({}, { command: 'build' })
    if (!result) throw new Error('alias plugin config returned nothing')
    expect(result.resolve.alias['@bdocs/plugin-mermaid/client']).toBe(
      '@bdocs/plugin-mermaid/client/static',
    )
  })

  it('skips the build alias when pre-render is disabled', () => {
    const plugin = mermaidPlugin({ preRender: false })
    const vitePlugins = plugin.vitePlugins ?? []
    const aliasPlugin = vitePlugins.find(
      (p) =>
        p &&
        typeof p === 'object' &&
        'name' in p &&
        p.name === 'boltdocs-mermaid-build-alias',
    ) as AliasVitePlugin | undefined
    if (!aliasPlugin) throw new Error('alias plugin not registered')
    // When preRender:false the alias must not rewrite the component.
    const result = aliasPlugin.config({}, { command: 'build' })
    expect(result).toBeUndefined()
  })
})
