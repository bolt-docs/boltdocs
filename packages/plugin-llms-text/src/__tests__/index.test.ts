import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import llmsTextPlugin from '../node/index'

// Mock createPlugin to inspect what it receives
vi.mock('boltdocs', () => ({
  createPlugin: vi.fn((config: unknown) => config),
  default: {},
}))

describe('llmsTextPlugin', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('CI', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns a plugin object with name and version', () => {
    const plugin = llmsTextPlugin()
    expect(plugin).toHaveProperty('name', 'boltdocs-plugin-llms-text')
    expect(plugin).toHaveProperty('version', '0.1.0')
  })

  it('includes transformHtml hook when addLinkTag is true', () => {
    const plugin = llmsTextPlugin()
    expect(plugin.hooks).toHaveProperty('transformHtml')
  })

  it('includes afterBuild hook only when devMode is true', () => {
    const pluginDev = llmsTextPlugin({ devMode: true })
    expect(pluginDev.hooks).toHaveProperty('afterBuild')

    const pluginProd = llmsTextPlugin({ devMode: false })
    expect(pluginProd.hooks).not.toHaveProperty('afterBuild')
  })

  it('includes afterBuild hook when NODE_ENV=production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const plugin = llmsTextPlugin()
    expect(plugin.hooks).toHaveProperty('afterBuild')
  })

  it('includes afterBuild hook when CI is set', () => {
    vi.stubEnv('NODE_ENV', 'test')
    vi.stubEnv('CI', 'true')
    const plugin = llmsTextPlugin()
    expect(plugin.hooks).toHaveProperty('afterBuild')
  })

  it('transformHtml injects link tag when siteUrl is present', () => {
    const plugin = llmsTextPlugin()
    const ctx = { config: { siteUrl: 'https://example.com/' } }
    const params = { html: '<html><head></head><body></body></html>' }

    const result = (plugin.hooks!.transformHtml as Function)(ctx, params)
    expect(result.html).toContain(
      '<link rel="llms-txt" href="https://example.com/llms.txt"/>',
    )
  })

  it('transformHtml returns unchanged html when no siteUrl', () => {
    const plugin = llmsTextPlugin()
    const ctx = { config: {} }
    const params = { html: '<html><head></head><body></body></html>' }

    const result = (plugin.hooks!.transformHtml as Function)(ctx, params)
    expect(result.html).toBe(params.html)
  })

  it('transformHtml returns unchanged html when addLinkTag is false', () => {
    const plugin = llmsTextPlugin({ addLinkTag: false })
    const ctx = { config: { siteUrl: 'https://example.com/' } }
    const params = { html: '<html><head></head><body></body></html>' }

    const result = (plugin.hooks!.transformHtml as Function)(ctx, params)
    expect(result.html).toBe(params.html)
  })

  it('uses baseUrl option when siteUrl is not configured', () => {
    const plugin = llmsTextPlugin({ baseUrl: 'https://custom.dev' })
    const ctx = { config: {} }
    const params = { html: '<html><head></head><body></body></html>' }

    const result = (plugin.hooks!.transformHtml as Function)(ctx, params)
    expect(result.html).toContain(
      '<link rel="llms-txt" href="https://custom.dev/llms.txt"/>',
    )
  })

  it('transformHtml without afterBuild in dev mode still injects link tag', () => {
    const plugin = llmsTextPlugin({ devMode: false })
    expect(plugin.hooks).not.toHaveProperty('afterBuild')
    expect(plugin.hooks).toHaveProperty('transformHtml')
  })

  it('afterBuild with devMode=true generates llms.txt content', async () => {
    const plugin = llmsTextPlugin({ devMode: true })
    expect(plugin.hooks).toHaveProperty('afterBuild')

    const ctx = {
      config: {
        siteUrl: 'https://example.com',
        theme: {
          title: 'My Docs',
          description: 'My description.',
        },
      },
      routes: [
        { path: '/docs/guide', title: 'Guide', filePath: 'docs/guide.mdx' },
        { path: '/', title: 'Home', filePath: 'index.mdx' },
      ],
      outDir: '/tmp/test-out',
      logger: { info: vi.fn() },
    }

    // Should not throw
    await (plugin.hooks!.afterBuild as Function)(ctx)
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('llms.txt generated'),
    )
  })

  it('afterBuild handles missing siteUrl gracefully', async () => {
    const plugin = llmsTextPlugin({ devMode: true })
    const ctx = {
      config: {},
      routes: [],
      outDir: '/tmp/test-out',
      logger: { info: vi.fn() },
    }

    await (plugin.hooks!.afterBuild as Function)(ctx)
    expect(ctx.logger.info).toHaveBeenCalledWith(
      expect.stringContaining('no siteUrl configured'),
    )
  })
})
