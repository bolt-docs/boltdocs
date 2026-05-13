import { describe, it, expect } from 'vitest'
import { generateSitemap } from '../../packages/core/src/node/seo/sitemap'

describe('SSG Security Tests', () => {
  describe('Sitemap Path Injection', () => {
    it('should not allow malicious paths to break XML structure (escaping check)', () => {
      const maliciousRoutes = [
        { path: '/docs/normal' },
        {
          path: '/docs/test</loc><url><loc>https://hacker.com</loc></url><loc>',
        },
      ]
      const config: any = { siteUrl: 'https://example.com' }
      const sitemap = generateSitemap(maliciousRoutes, config)

      expect(sitemap).not.toContain('<loc>https://hacker.com</loc>')
    })
  })
})
