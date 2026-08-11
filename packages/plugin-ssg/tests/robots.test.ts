import { describe, it, expect } from 'vitest'
import { generateRobotsTxt } from '../../../packages/core/src/node/seo/robots'

describe('ssg robots.txt', () => {
  it('should return string robots config directly', () => {
    const config = {
      robots: 'User-agent: *\nDisallow: /private/',
    }

    const result = generateRobotsTxt(config)

    expect(result).toBe('User-agent: *\nDisallow: /private/')
  })

  it('should generate default robots.txt with no config', () => {
    const config = {}

    const result = generateRobotsTxt(config)

    expect(result).toContain('User-agent: *')
    expect(result).toContain('Allow: /')
  })

  it('should handle rules with disallow', () => {
    const config = {
      robots: {
        rules: [
          {
            userAgent: '*',
            disallow: ['/admin/', '/private/'],
          },
        ],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).toContain('User-agent: *')
    expect(result).toContain('Disallow: /admin/')
    expect(result).toContain('Disallow: /private/')
  })

  it('should handle rules with allow and disallow', () => {
    const config = {
      robots: {
        rules: [
          {
            userAgent: 'Googlebot',
            allow: '/public/',
            disallow: '/private/',
          },
        ],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).toContain('User-agent: Googlebot')
    expect(result).toContain('Allow: /public/')
    expect(result).toContain('Disallow: /private/')
  })

  it('should handle multiple user-agent rules', () => {
    const config = {
      robots: {
        rules: [
          { userAgent: '*', allow: '/' },
          { userAgent: 'BadBot', disallow: '/' },
        ],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).toContain('User-agent: *')
    expect(result).toContain('User-agent: BadBot')
    expect(result).toContain('Disallow: /')
  })

  it('should add sitemap from siteUrl', () => {
    const config = {
      siteUrl: 'https://example.com',
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('should add custom sitemaps', () => {
    const config = {
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
        sitemaps: [
          'https://example.com/sitemap1.xml',
          'https://example.com/sitemap2.xml',
        ],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).toContain('Sitemap: https://example.com/sitemap1.xml')
    expect(result).toContain('Sitemap: https://example.com/sitemap2.xml')
  })

  it('should not add sitemap when no siteUrl', () => {
    const config = {
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).not.toContain('Sitemap:')
  })

  it('should handle allow as string', () => {
    const config = {
      robots: {
        rules: [
          {
            userAgent: '*',
            allow: '/public/',
          },
        ],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).toContain('Allow: /public/')
  })

  it('should handle disallow as string', () => {
    const config = {
      robots: {
        rules: [
          {
            userAgent: '*',
            disallow: '/admin/',
          },
        ],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).toContain('Disallow: /admin/')
  })

  it('should trim trailing whitespace', () => {
    const config = {
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result.endsWith('\n')).toBe(false)
    expect(result).toBe(result.trim())
  })

  it('should handle siteUrl with trailing slash', () => {
    const config = {
      siteUrl: 'https://example.com/',
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
      },
    }

    const result = generateRobotsTxt(config)

    expect(result).toContain('Sitemap: https://example.com/sitemap.xml')
    expect(result).not.toContain('https://example.com//sitemap.xml')
  })
})
