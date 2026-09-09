import { describe, it, expect } from 'vitest'
import { generateSitemap } from '../../../src/node/seo/sitemap'

describe('generateSitemap', () => {
  const defaultConfig: any = { siteUrl: 'https://example.com' }

  it('returns an empty string when no siteUrl is configured', () => {
    expect(generateSitemap([{ path: '/docs/x' } as any], {} as any)).toBe('')
  })

  it('generates a valid XML sitemap with default base URL', () => {
    const routes = [{ path: '/docs/intro' }, { path: '/docs/setup' }]
    const sitemap = generateSitemap(routes as any, defaultConfig)

    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(sitemap).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    )
    expect(sitemap).toContain('<loc>https://example.com/docs/intro</loc>')
    expect(sitemap).toContain('<loc>https://example.com/docs/setup</loc>')
  })

  it('emits URLs in deterministic lexical order', () => {
    const routes = [
      { path: '/docs/zeta' },
      { path: '/docs/alpha' },
      { path: '/docs/middle' },
    ]

    const sitemap = generateSitemap(routes as any, defaultConfig)

    expect(sitemap.indexOf('/docs/alpha')).toBeLessThan(
      sitemap.indexOf('/docs/middle'),
    )
    expect(sitemap.indexOf('/docs/middle')).toBeLessThan(
      sitemap.indexOf('/docs/zeta'),
    )
  })

  it('normalizes paths without a leading slash', () => {
    const sitemap = generateSitemap(
      [{ path: 'docs/page' }] as any,
      defaultConfig,
    )
    expect(sitemap).toContain('<loc>https://example.com/docs/page</loc>')
  })

  it('uses the provided siteUrl from config', () => {
    const routes = [{ path: '/docs/page' }]
    const config: any = { siteUrl: 'https://docs.litedocs.com/' }
    const sitemap = generateSitemap(routes as any, config)

    expect(sitemap).toContain('<loc>https://docs.litedocs.com/docs/page</loc>')
    expect(sitemap).not.toContain('https://example.com')
  })

  it('handles i18n locales in root entries', () => {
    const routes = [{ path: '/docs/en/intro' }, { path: '/docs/es/intro' }]
    const config: any = {
      siteUrl: 'https://example.com',
      i18n: {
        defaultLocale: 'en',
        locales: {
          en: 'English',
          es: 'Español',
        },
      },
    }
    const sitemap = generateSitemap(routes as any, config)

    expect(sitemap).toContain('<loc>https://example.com/docs/en/intro</loc>')
    expect(sitemap).toContain('<loc>https://example.com/docs/es/intro</loc>')
  })

  it('excludes pages with noindex', () => {
    const routes = [
      { path: '/public' },
      { path: '/private', seo: { noindex: true } },
      { path: '/no-robots', seo: { robots: 'noindex, nofollow' } },
    ]
    const sitemap = generateSitemap(routes as any, defaultConfig)

    expect(sitemap).toContain('<loc>https://example.com/public</loc>')
    expect(sitemap).not.toContain('<loc>https://example.com/private</loc>')
    expect(sitemap).not.toContain('<loc>https://example.com/no-robots</loc>')
  })

  it('keeps routes under a private indexing policy unless noindexed', () => {
    const routes = [
      { path: '/docs/secret', seo: { noindex: true } },
      { path: '/docs/public' },
    ]
    const sitemap = generateSitemap(routes as any, {
      siteUrl: 'https://example.com',
      seo: { indexing: 'private' },
    })

    expect(sitemap).toContain('<loc>https://example.com/docs/public</loc>')
    expect(sitemap).not.toContain('<loc>https://example.com/docs/secret</loc>')
  })

  it('does not allow malicious paths to break the XML structure', () => {
    const maliciousRoutes = [
      { path: '/docs/normal' },
      {
        path: '/docs/test</loc><url><loc>https://hacker.com</loc></url><loc>',
      },
    ]
    const sitemap = generateSitemap(maliciousRoutes as any, defaultConfig)

    expect(sitemap).not.toContain('<loc>https://hacker.com</loc>')
  })
})
