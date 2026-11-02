import { describe, expect, it } from 'vitest'
import {
  CONTRACTS_API_VERSION,
  type BoltdocsConfigContract,
  type BuildContext,
  type InvalidationEvent,
  type Manifest,
  type ModuleIdentity,
  type PageCacheEntry,
  type PluginContext,
  type PluginDefinition,
  type PluginLifecycleHooks,
  type PluginServerMiddleware,
  type PluginTransformMiddleware,
  type RenderContext,
  type RenderResult,
  type RouteCacheIdentity,
  type RouteMeta,
  type SearchDocument,
  type SSRManifest,
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

  it('describes a bundle manifest without importing the bundler', () => {
    // The SSG reads exactly these fields. Describing them structurally is what
    // lets the bundler be replaced without changing this contract.
    const manifest: Manifest = {
      app: {
        file: 'assets/app-DVNImGCL.js',
        imports: ['react-vendor'],
        dynamicImports: ['chunk-8'],
        css: ['assets/app-DVNImGCL.css'],
        assets: ['favicon.svg'],
      },
      'react-vendor': { file: 'assets/react-vendor-Ck5lrZEf.js' },
    }

    expect(manifest.app.file).toBe('assets/app-DVNImGCL.js')
    expect(manifest['react-vendor']?.file).toContain('react-vendor')
  })

  it('describes the server surface a route needs', () => {
    const ssrManifest: SSRManifest = {
      app: ['chunk-8', 'react-vendor'],
    }

    expect(ssrManifest.app).toEqual(['chunk-8', 'react-vendor'])
  })

  it('keys a route cache on content, assets and shared identities', () => {
    // Every field is part of the key. That split is what lets a text edit
    // invalidate one page without invalidating the routes that share its CSS
    // or its configuration.
    const identity: RouteCacheIdentity = {
      sourceHash: 'sha256:page',
      frontmatterHash: 'sha256:frontmatter',
      clientIdentity: 'sha256:client',
      cssIdentity: 'sha256:css',
      configIdentity: 'sha256:config',
      pluginIdentities: { search: 'sha256:plugin-search' },
    }

    expect(identity.sourceHash).not.toBe(identity.clientIdentity)
    expect(identity.pluginIdentities?.search).toBe('sha256:plugin-search')
  })

  it('records enough about a cached page to avoid rehashing it', () => {
    // `mtime` is the cheap pre-filter: an unchanged file never reaches the hash.
    const entry: PageCacheEntry = {
      contentHash: 'sha256:page',
      mtime: 1750000000000,
      loaderDataFilePath: '/project/.boltdocs/loader/intro.json',
      assetHash: 'sha256:assets',
    }

    expect(entry.mtime).toBeTypeOf('number')
    expect(entry.assetHash).toBe('sha256:assets')
  })

  it('passes a renderer one route at a time', () => {
    const ctx: RenderContext = {
      route: {
        path: '/docs/intro',
        componentPath: '',
        title: 'Intro',
        filePath: 'intro.mdx',
      },
      outPath: 'docs/intro.html',
      base: '/docs',
    }

    expect(ctx.outPath).toBe('docs/intro.html')
    expect(ctx.base).toBe('/docs')
    expect(ctx.route.title).toBe('Intro')
  })

  it('distinguishes a rendered page from a cached one', () => {
    // Cache reporting is what makes an edited build legible: a build that
    // reuses 250 of 263 pages should say so.
    const result: RenderResult = {
      routePath: '/docs/intro',
      outPath: 'docs/intro.html',
      source: 'cached',
    }

    expect(result.source).toBe('cached')
  })

  it('describes a build stage without exposing the pipeline', () => {
    const ctx: BuildContext = {
      docsDir: '/project/docs',
      rootDir: '/project',
      outDir: '/project/dist',
      mode: 'production',
      routes: [],
      manifest: { app: { file: 'assets/app.js' } },
    }

    expect(ctx.mode).toBe('production')
    expect(ctx.manifest?.app.file).toBe('assets/app.js')
  })
})
