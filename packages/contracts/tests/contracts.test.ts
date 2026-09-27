import { describe, expect, it } from 'vitest'
import {
  CONTRACTS_API_VERSION,
  type BoltdocsConfigContract,
  type InvalidationEvent,
  type ModuleIdentity,
  type PluginContext,
  type PluginDefinition,
  type PluginLifecycleHooks,
  type PluginServerMiddleware,
  type PluginTransformMiddleware,
  type RouteMeta,
  type SearchDocument,
} from '../src'

describe('@bdocs/contracts', () => {
  it('exposes a versioned contract surface', () => {
    expect(CONTRACTS_API_VERSION).toBe(1)
  })

  it('describes a route without framework dependencies', () => {
    const route: RouteMeta = {
      path: '/docs/intro',
      componentPath: '/project/docs/intro.mdx',
      title: 'Intro',
      filePath: 'intro.mdx',
      headings: [{ level: 2, text: 'Install', id: 'install' }],
    }

    expect(route.path).toBe('/docs/intro')
    expect(route.headings?.[0]?.id).toBe('install')
  })

  it('describes plugin lifecycle and server contracts generically', () => {
    type Config = { siteName: string }
    const getSiteName = (ctx: PluginContext<Config>) => ctx.config.siteName
    const transformMdx: PluginLifecycleHooks<Config>['transform:mdx'] = (
      _ctx,
      params,
    ) => ({
      code: params.code.toUpperCase(),
    })
    const middleware: PluginTransformMiddleware<Config> = {
      name: 'content-source',
      transformMdx,
    }
    const serverMiddleware: PluginServerMiddleware<
      { url: string },
      { statusCode: number }
    > = (req, res) => {
      res.statusCode = req.url === '/health' ? 200 : 404
    }
    const searchDocument: SearchDocument = {
      id: 'intro',
      path: '/docs/intro',
      title: 'Intro',
      content: 'Content',
      headings: [],
      frontmatter: {},
    }

    expect(
      getSiteName({
        config: { siteName: 'Boltdocs' },
      } as PluginContext<Config>),
    ).toBe('Boltdocs')
    expect(middleware.name).toBe('content-source')
    expect(serverMiddleware).toBeTypeOf('function')
    expect(searchDocument.id).toBe('intro')
  })

  it('describes a framework-neutral plugin definition', () => {
    const definition: PluginDefinition<{ siteName: string }> = {
      name: 'example',
      version: '1.0.0',
      metadata: { category: 'content' },
      css: { headStyles: ['.example { color: red; }'] },
      hooks: {
        'build:before': () => undefined,
      },
    }

    expect(definition.name).toBe('example')
    expect(definition.css?.headStyles).toHaveLength(1)
  })

  it('describes framework-neutral configuration contracts', () => {
    const config: BoltdocsConfigContract<PluginDefinition> = {
      siteUrl: 'https://boltdocs.dev',
      base: '/docs',
      mdx: { processor: 'satteri' },
      plugins: [{ name: 'search' }],
      seo: {
        indexing: 'public',
        structuredData: {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
        },
      },
      i18n: {
        defaultLocale: 'en',
        locales: ['en', 'es'],
      },
    }

    expect(config.plugins?.[0]?.name).toBe('search')
    expect(config.seo?.structuredData).toBeTypeOf('object')
  })

  it('supports incremental module identities and invalidation events', () => {
    const identity: ModuleIdentity = {
      sourceHash: 'sha256:page',
      routePath: '/docs/intro',
      clientDeps: ['client:intro'],
      serverDeps: ['server:intro'],
      cssDeps: ['css:site'],
      pluginDeps: ['plugin:search'],
    }
    const event: InvalidationEvent = {
      kind: 'content',
      filePath: '/project/docs/intro.mdx',
      routePath: '/docs/intro',
      moduleIds: ['client:intro'],
    }

    expect(identity.clientDeps).toEqual(['client:intro'])
    expect(event.kind).toBe('content')
  })
})
