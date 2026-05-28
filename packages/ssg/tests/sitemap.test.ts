import { describe, it, expect } from 'vitest'
import { generateSitemap } from '../../packages/core/src/node/seo/sitemap'

describe('generateSitemap', () => {
  const defaultConfig: any = { siteUrl: 'https://example.com' }

  it('should generate a valid XML sitemap with default base URL', () => {
    const routes = [{ path: '/docs/intro' }, { path: '/docs/setup' }]
    const sitemap = generateSitemap(routes, defaultConfig)

    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>')
    expect(sitemap).toContain(
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    )
    expect(sitemap).toContain('<loc>https://example.com/docs/intro</loc>')
    expect(sitemap).toContain('<loc>https://example.com/docs/setup</loc>')
  })

  it('should use the provided siteUrl from config', () => {
    const routes = [{ path: '/docs/page' }]
    const config: any = { siteUrl: 'https://docs.litedocs.com/' }
    const sitemap = generateSitemap(routes, config)

    expect(sitemap).toContain('<loc>https://docs.litedocs.com/docs/page</loc>')
    expect(sitemap).not.toContain('https://example.com')
  })

  it('should handle i18n locales in root entries', () => {
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
    const sitemap = generateSitemap(routes, config)

    expect(sitemap).toContain('<loc>https://example.com/docs/en/intro</loc>')
    expect(sitemap).toContain('<loc>https://example.com/docs/es/intro</loc>')
  })

  it('should exclude pages with noindex', () => {
    const routes = [
      { path: '/public' },
      { path: '/private', seo: { noindex: true } },
      { path: '/no-robots', seo: { robots: 'noindex, nofollow' } },
    ]
    const sitemap = generateSitemap(routes, defaultConfig)

    expect(sitemap).toContain('<loc>https://example.com/public</loc>')
    expect(sitemap).not.toContain('<loc>https://example.com/private</loc>')
    expect(sitemap).not.toContain('<loc>https://example.com/no-robots</loc>')
  })

  it('should not allow malicious paths to break XML structure (escaping check)', () => {
    const maliciousRoutes = [
      { path: '/docs/normal' },
      {
        path: '/docs/test</loc><url><loc>https://hacker.com</loc></url><loc>',
      },
    ]
    const sitemap = generateSitemap(maliciousRoutes, defaultConfig)

    expect(sitemap).not.toContain('<loc>https://hacker.com</loc>')
  })
})
