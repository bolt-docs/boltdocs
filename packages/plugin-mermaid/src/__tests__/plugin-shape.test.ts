import { describe, it, expect } from 'vitest'
import mermaidPlugin from '../node/index'

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
    const aliasPlugin: any = vitePlugins.find(
      (p: any) => p?.name === 'boltdocs-mermaid-build-alias',
    )
    expect(aliasPlugin).toBeDefined()
    const result = aliasPlugin.config({}, { command: 'build' })
    expect(result.resolve.alias['@bdocs/plugin-mermaid/client']).toBe(
      '@bdocs/plugin-mermaid/client/static',
    )
  })

  it('skips the build alias when pre-render is disabled', () => {
    const plugin = mermaidPlugin({ preRender: false })
    const vitePlugins = plugin.vitePlugins ?? []
    const aliasPlugin: any = vitePlugins.find(
      (p) => p.name === 'boltdocs-mermaid-build-alias',
    )
    expect(aliasPlugin).toBeDefined()
    // When preRender:false the alias must not rewrite the component.
    const result = aliasPlugin.config({}, { command: 'build' })
    expect(result).toBeUndefined()
  })
})
