import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import rssPlugin from '../src/node/index'
import type { RouteMeta } from 'boltdocs'

const routes: RouteMeta[] = [
  {
    path: '/docs/start',
    title: 'Get Started',
    date: '2026-01-15T10:00:00.000Z',
    locale: 'en',
  } as RouteMeta,
  {
    path: '/docs/legacy',
    title: 'Old Page',
    lastUpdated: '2025-12-01T00:00:00.000Z',
    locale: 'en',
  } as RouteMeta,
  {
    path: '/docs/draft',
    title: 'Hidden Draft',
    date: '2026-02-01T00:00:00.000Z',
    draft: true,
    locale: 'en',
  } as RouteMeta,
]

function createContext(
  outDir: string,
  overrides: Partial<Record<string, unknown>> = {},
) {
  const store = new Map<string, string>()
  const report = vi.fn()
  return {
    config: {
      siteUrl: 'https://example.com',
      theme: { title: 'Docs', description: 'Docs desc' },
      i18n: { defaultLocale: 'en', locales: { en: 'English', es: 'Español' } },
    },
    outDir,
    routes,
    diagnostics: { report },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
    caches: {
      memory: () => ({
        get: (k: string) => store.get(k),
        set: (k: string, v: string) => {
          store.set(k, v)
        },
        has: (k: string) => store.has(k),
      }),
    },
    ...overrides,
  } as any
}

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-rss-'))
})

afterEach(() => {
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

describe('rssPlugin afterBuild', () => {
  it('reports a warning and writes nothing when siteUrl is missing', async () => {
    const ctx = createContext(tempDir, {
      config: { theme: { title: 'Docs' } },
    })
    const plugin = rssPlugin()

    await plugin.hooks!.afterBuild!(ctx)

    expect(ctx.diagnostics.report).toHaveBeenCalledWith(
      'warn',
      'RSS_MISSING_SITE_URL',
      expect.stringContaining('siteUrl'),
    )
    expect(fs.existsSync(path.join(tempDir, 'rss'))).toBe(false)
  })

  it('writes an RSS feed per locale, excluding drafts', async () => {
    const plugin = rssPlugin()
    await plugin.hooks!.afterBuild!(createContext(tempDir))

    const enXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-en.xml'),
      'utf-8',
    )
    expect(enXml).toContain('<title><![CDATA[Get Started]]></title>')
    expect(enXml).toContain('<title><![CDATA[Old Page]]></title>')
    expect(enXml).not.toContain('Hidden Draft')

    const esXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-es.xml'),
      'utf-8',
    )
    expect(esXml).not.toContain('<item>')
  })

  it('sorts items newest-first by date', async () => {
    const plugin = rssPlugin()
    await plugin.hooks!.afterBuild!(createContext(tempDir))
    const enXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-en.xml'),
      'utf-8',
    )
    expect(enXml.indexOf('Get Started')).toBeLessThan(enXml.indexOf('Old Page'))
  })

  it('filters by paths option', async () => {
    const plugin = rssPlugin({ paths: ['/docs/start'] })
    await plugin.hooks!.afterBuild!(createContext(tempDir))
    const enXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-en.xml'),
      'utf-8',
    )
    expect(enXml).toContain('Get Started')
    expect(enXml).not.toContain('Old Page')
  })

  it('filters by collections option', async () => {
    const ctx = createContext(tempDir, {
      routes: [
        ...routes,
        {
          path: '/blog/post',
          title: 'Blog Post',
          collection: 'blog',
          locale: 'en',
        } as RouteMeta,
      ],
    })
    const plugin = rssPlugin({ collections: ['blog'] })
    await plugin.hooks!.afterBuild!(ctx)
    const enXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-en.xml'),
      'utf-8',
    )
    expect(enXml).toContain('Blog Post')
    expect(enXml).not.toContain('Get Started')
  })

  it('applies the limit to the combined route list', async () => {
    const plugin = rssPlugin({ limit: 1 })
    await plugin.hooks!.afterBuild!(createContext(tempDir))
    const enXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-en.xml'),
      'utf-8',
    )
    expect(enXml).toContain('Get Started')
    expect(enXml).not.toContain('Old Page')
  })

  it('writes atom feeds when format is atom', async () => {
    const plugin = rssPlugin({ format: 'atom' })
    await plugin.hooks!.afterBuild!(createContext(tempDir))
    expect(fs.existsSync(path.join(tempDir, 'rss', 'atom-en.xml'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'rss', 'rss-en.xml'))).toBe(false)
  })

  it('writes both formats when format is both', async () => {
    const plugin = rssPlugin({ format: 'both' })
    await plugin.hooks!.afterBuild!(createContext(tempDir))
    expect(fs.existsSync(path.join(tempDir, 'rss', 'rss-en.xml'))).toBe(true)
    expect(fs.existsSync(path.join(tempDir, 'rss', 'atom-en.xml'))).toBe(true)
  })
})

describe('rssPlugin transformHtml', () => {
  it('injects the alternate feed link before the closing head tag', () => {
    const plugin = rssPlugin()
    const html = '<html><head><title>x</title></head><body></body></html>'
    const { html: result } = plugin.hooks!.transformHtml!(
      createContext(tempDir),
      { html, route: {} as RouteMeta },
    )
    expect(result).toContain(
      '<link rel="alternate" type="application/rss+xml" title="RSS Feed" href="https://example.com/rss/rss-en.xml"/>',
    )
    expect(result).toMatch(/<link rel="alternate"[\s\S]*<\/head>/)
    expect(result.match(/<\/head>/g)).toHaveLength(1)
  })

  it('uses the route locale for the feed file name', () => {
    const plugin = rssPlugin()
    const { html } = plugin.hooks!.transformHtml!(createContext(tempDir), {
      html: '<html><head></head></html>',
      route: { locale: 'es' } as RouteMeta,
    })
    expect(html).toContain('href="https://example.com/rss/rss-es.xml"')
  })

  it('emits an atom link when format is atom', () => {
    const plugin = rssPlugin({ format: 'atom' })
    const { html } = plugin.hooks!.transformHtml!(createContext(tempDir), {
      html: '<html><head></head></html>',
      route: {} as RouteMeta,
    })
    expect(html).toContain(
      '<link rel="alternate" type="application/atom+xml" title="RSS Feed" href="https://example.com/rss/atom-en.xml"/>',
    )
  })

  it('derives the feed locale from the page path when no route is provided', () => {
    const plugin = rssPlugin()
    const { html } = plugin.hooks!.transformHtml!(createContext(tempDir), {
      html: '<html><head></head></html>',
      path: '/es/docs/guides',
    } as any)
    expect(html).toContain('href="https://example.com/rss/rss-es.xml"')

    const { html: defaultHtml } = plugin.hooks!.transformHtml!(
      createContext(tempDir),
      { html: '<html><head></head></html>', path: '/docs/guides' } as any,
    )
    expect(defaultHtml).toContain('href="https://example.com/rss/rss-en.xml"')

    // Translated docs pages live under the shared `/docs` base, so the
    // locale segment is not the first one. It must still be resolved.
    const { html: sharedBaseHtml } = plugin.hooks!.transformHtml!(
      createContext(tempDir),
      {
        html: '<html><head></head></html>',
        path: '/docs/es/plugins/content/plugin-rss',
      } as any,
    )
    expect(sharedBaseHtml).toContain(
      'href="https://example.com/rss/rss-es.xml"',
    )
  })

  it('leaves the html untouched when siteUrl is not configured', () => {
    const plugin = rssPlugin()
    const ctx = createContext(tempDir, {
      config: { theme: { title: 'Docs' } },
    })
    const html = '<html><head></head></html>'
    const result = plugin.hooks!.transformHtml!(ctx, {
      html,
      route: {} as RouteMeta,
    })
    expect(result.html).toBe(html)
  })
})
describe('rssPlugin build:generate', () => {
  it('writes feeds using the absolute outDir from the pipeline params', async () => {
    const plugin = rssPlugin()
    await plugin.hooks!['build:generate']!(createContext(tempDir), {
      routes,
      outDir: tempDir,
      siteUrl: 'https://example.com',
    })

    const enXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-en.xml'),
      'utf-8',
    )
    expect(enXml).toContain('Get Started')
  })

  it('does not rewrite identical output when both build:generate and afterBuild run', async () => {
    const ctx = createContext(tempDir)
    const plugin = rssPlugin()

    await plugin.hooks!['build:generate']!(ctx, { routes, outDir: tempDir })
    const writesAfterGenerate = (ctx.logger.info as any).mock.calls.length

    await plugin.hooks!.afterBuild!(ctx)
    const writesAfterCompat = (ctx.logger.info as any).mock.calls.length

    expect(writesAfterGenerate).toBeGreaterThan(0)
    expect(writesAfterCompat).toBe(writesAfterGenerate)
  })

  it('rewrites when the route set changes between hook invocations', async () => {
    const ctx = createContext(tempDir)
    const plugin = rssPlugin()

    await plugin.hooks!['build:generate']!(ctx, {
      routes: routes.slice(0, 1),
      outDir: tempDir,
    })
    const writesAfterGenerate = (ctx.logger.info as any).mock.calls.length

    await plugin.hooks!.afterBuild!(ctx)
    const writesAfterCompat = (ctx.logger.info as any).mock.calls.length

    expect(writesAfterCompat).toBeGreaterThan(writesAfterGenerate)
  })

  it('buckets default-locale routes (locale: undefined) into the default feed', async () => {
    const plugin = rssPlugin()
    const ctx = createContext(tempDir, {
      routes: [
        {
          path: '/docs/start',
          title: 'No Locale Route',
          date: '2026-01-15T10:00:00.000Z',
        } as RouteMeta,
        {
          path: '/es/docs/start',
          title: 'Spanish Route',
          locale: 'es',
        } as RouteMeta,
      ],
    })
    await plugin.hooks!['build:generate']!(ctx, {
      routes: ctx.routes,
      outDir: tempDir,
    })

    const enXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-en.xml'),
      'utf-8',
    )
    expect(enXml).toContain('No Locale Route')

    const esXml = fs.readFileSync(
      path.join(tempDir, 'rss', 'rss-es.xml'),
      'utf-8',
    )
    expect(esXml).toContain('Spanish Route')
    expect(esXml).not.toContain('No Locale Route')
  })

  it('afterBuild resolves a relative ctx.outDir against ctx.rootDir', async () => {
    const plugin = rssPlugin()
    const ctx = createContext(tempDir, {
      outDir: 'dist',
      rootDir: tempDir,
    })
    await plugin.hooks!.afterBuild!(ctx)

    expect(fs.existsSync(path.join(tempDir, 'dist', 'rss', 'rss-en.xml'))).toBe(
      true,
    )
  })
})
