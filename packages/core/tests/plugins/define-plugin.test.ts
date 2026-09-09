import { describe, it, expect, vi } from 'vitest'
import {
  definePlugin,
  createPlugin,
} from '../../src/node/plugins/define-plugin'
import { resolveClientRegistry } from '../../src/node/plugins/client-registry'
import {
  createSearchDocuments,
  executeSearchIndexHook,
} from '../../src/node/plugins/search-contract'
import type {
  BoltdocsConfig,
  RouteMeta,
  SearchDocument,
} from '../../src/shared/types'

describe('Next-Gen Boltdocs Plugin API', () => {
  it('defines a static plugin object using definePlugin', () => {
    const plugin = definePlugin({
      name: 'test-plugin',
      version: '1.0.0',
      client: {
        slots: {
          'header:right': './components/HeaderActions.tsx',
        },
      },
    })()

    expect(plugin.name).toBe('test-plugin')
    expect(plugin.version).toBe('1.0.0')
    expect(plugin.client?.slots?.['header:right']).toBe(
      './components/HeaderActions.tsx',
    )
  })

  it('defines an options-factory plugin using definePlugin', () => {
    interface PluginOptions {
      apiKey: string
    }

    const pluginFactory = definePlugin<PluginOptions>((opts) => ({
      name: 'factory-plugin',
      metadata: { apiKey: opts?.apiKey },
    }))

    const instance = pluginFactory({ apiKey: 'secret-123' })
    expect(instance.name).toBe('factory-plugin')
    expect(instance.metadata?.apiKey).toBe('secret-123')
  })

  it('maintains createPlugin backwards compatibility', () => {
    const plugin = createPlugin({
      name: 'legacy-plugin',
    })

    const result = typeof plugin === 'function' ? plugin() : plugin
    expect(result.name).toBe('legacy-plugin')
  })

  it('aggregates UI slots, providers, MDX components, and head entries via resolveClientRegistry', () => {
    const pluginA = definePlugin({
      name: 'plugin-a',
      client: {
        slots: {
          'search:dialog': './SearchA.tsx',
        },
        providers: ['./ProviderA.tsx'],
        mdxComponents: { Callout: './Callout.tsx' },
        head: [{ tag: 'script', attrs: { src: 'a.js' } }],
      },
    })()

    const pluginB = definePlugin({
      name: 'plugin-b',
      client: {
        slots: {
          'search:dialog': './SearchB.tsx',
        },
        providers: ['./ProviderB.tsx'],
        mdxComponents: { Badge: './Badge.tsx' },
      },
    })()

    const registry = resolveClientRegistry([pluginA, pluginB])

    expect(registry.slots['search:dialog']).toEqual([
      './SearchA.tsx',
      './SearchB.tsx',
    ])
    expect(registry.providers).toEqual(['./ProviderA.tsx', './ProviderB.tsx'])
    expect(registry.mdxComponents).toEqual({
      Callout: './Callout.tsx',
      Badge: './Badge.tsx',
    })
    expect(registry.head).toEqual([{ tag: 'script', attrs: { src: 'a.js' } }])
  })

  it('ignores removed footer slots when resolving the client registry', () => {
    const plugin = definePlugin({
      name: 'legacy-footer-plugin',
      client: {
        slots: {
          'footer:top': './Footer.tsx',
          'footer:bottom': './FooterBottom.tsx',
          'page:after': './After.tsx',
        },
      },
    })()

    const registry = resolveClientRegistry([plugin])

    expect(registry.slots).toEqual({ 'page:after': ['./After.tsx'] })
    expect(registry.slots['footer:top']).toBeUndefined()
    expect(registry.slots['footer:bottom']).toBeUndefined()
  })

  it('extracts standardized SearchDocument[] from routes', () => {
    const routes: RouteMeta[] = [
      {
        path: '/docs/getting-started',
        componentPath: '/abs/path/file.md',
        title: 'Getting Started',
        filePath: 'getting-started.md',
        _content: 'Welcome to the documentation',
        headings: [{ level: 1, text: 'Introduction', id: 'intro' }],
        frontmatter: { category: 'guide' },
        locale: 'en',
      },
    ]

    const documents: SearchDocument[] = createSearchDocuments(routes)
    expect(documents).toHaveLength(1)
    expect(documents[0]).toEqual({
      id: '/docs/getting-started',
      path: '/docs/getting-started',
      title: 'Getting Started',
      content: 'Welcome to the documentation',
      headings: [{ level: 1, text: 'Introduction', id: 'intro' }],
      frontmatter: { category: 'guide' },
      locale: 'en',
      version: undefined,
    })
  })

  it('executes search:index hook on search plugins', async () => {
    const mockIndexHook = vi.fn().mockImplementation((_ctx, { documents }) => {
      return { indexedCount: documents.length }
    })

    const searchPlugin = definePlugin({
      name: 'custom-search-plugin',
      hooks: {
        'search:index': mockIndexHook,
      },
    })()

    const config: BoltdocsConfig = {
      docsDir: '/docs',
      plugins: [searchPlugin],
    }

    const routes: RouteMeta[] = [
      {
        path: '/docs/intro',
        componentPath: '/docs/intro.md',
        title: 'Intro',
        filePath: 'intro.md',
      },
    ]

    await executeSearchIndexHook(routes, config, '/docs', '/')
    expect(mockIndexHook).toHaveBeenCalledTimes(1)
  })

  it('supports Astro-style colon hook names in PluginLifecycleManager', async () => {
    const { PluginLifecycleManager } = await import(
      '../../src/node/plugins/plugin-lifecycle'
    )
    const beforeBuildFn = vi.fn()
    const transformMdxFn = vi.fn().mockImplementation((_ctx, params) => ({
      code: params.code + ' // transformed',
    }))

    const plugin = definePlugin({
      name: 'astro-style-plugin',
      hooks: {
        'build:before': beforeBuildFn,
        'transform:mdx': transformMdxFn,
      },
    })()

    const config: BoltdocsConfig = { docsDir: '/docs', plugins: [plugin] }
    const manager = new PluginLifecycleManager([plugin], config)

    await manager.runHook('build:before')
    expect(beforeBuildFn).toHaveBeenCalledTimes(1)

    const res = await manager.runChain('transform:mdx', {
      code: 'const a = 1;',
      filePath: 'a.ts',
    })
    expect(res.code).toBe('const a = 1; // transformed')
  })
})
