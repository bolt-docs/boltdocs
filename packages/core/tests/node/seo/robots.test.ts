import { describe, it, expect } from 'vitest'
import { generateRobotsTxt } from '../../../src/node/seo/robots'

describe('generateRobotsTxt', () => {
  it('returns a string robots config directly', () => {
    const config = {
      robots: 'User-agent: *\nDisallow: /private/',
    }

    const result = generateRobotsTxt(config as any)

    expect(result).toBe('User-agent: *\nDisallow: /private/')
  })

  it('generates a default robots.txt with no config', () => {
    const result = generateRobotsTxt({} as any)

    expect(result).toContain('User-agent: *')
    expect(result).toContain('Allow: /')
  })

  it('disallows everything for private indexing', () => {
    const result = generateRobotsTxt({ seo: { indexing: 'private' } } as any)

    expect(result).toContain('User-agent: *')
    expect(result).toContain('Disallow: /')
    expect(result).not.toContain('Allow:')
  })

  it('handles rules with disallow arrays', () => {
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

    const result = generateRobotsTxt(config as any)

    expect(result).toContain('User-agent: *')
    expect(result).toContain('Disallow: /admin/')
    expect(result).toContain('Disallow: /private/')
  })

  it('handles rules with allow and disallow', () => {
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

    const result = generateRobotsTxt(config as any)

    expect(result).toContain('User-agent: Googlebot')
    expect(result).toContain('Allow: /public/')
    expect(result).toContain('Disallow: /private/')
  })

  it('handles multiple user-agent rules', () => {
    const config = {
      robots: {
        rules: [
          { userAgent: '*', allow: '/' },
          { userAgent: 'BadBot', disallow: '/' },
        ],
      },
    }

    const result = generateRobotsTxt(config as any)

    expect(result).toContain('User-agent: *')
    expect(result).toContain('User-agent: BadBot')
    expect(result).toContain('Disallow: /')
  })

  it('adds sitemap from siteUrl', () => {
    const config = {
      siteUrl: 'https://example.com',
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
      },
    }

    const result = generateRobotsTxt(config as any)

    expect(result).toContain('Sitemap: https://example.com/sitemap.xml')
  })

  it('adds custom sitemaps', () => {
    const config = {
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
        sitemaps: [
          'https://example.com/sitemap1.xml',
          'https://example.com/sitemap2.xml',
        ],
      },
    }

    const result = generateRobotsTxt(config as any)

    expect(result).toContain('Sitemap: https://example.com/sitemap1.xml')
    expect(result).toContain('Sitemap: https://example.com/sitemap2.xml')
  })

  it('does not add a sitemap when no siteUrl', () => {
    const config = {
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
      },
    }

    const result = generateRobotsTxt(config as any)

    expect(result).not.toContain('Sitemap:')
  })

  it('handles allow as a string', () => {
    const config = {
      robots: {
        rules: [{ userAgent: '*', allow: '/public/' }],
      },
    }

    const result = generateRobotsTxt(config as any)

    expect(result).toContain('Allow: /public/')
  })

  it('handles disallow as a string', () => {
    const config = {
      robots: {
        rules: [{ userAgent: '*', disallow: '/admin/' }],
      },
    }

    const result = generateRobotsTxt(config as any)

    expect(result).toContain('Disallow: /admin/')
  })

  it('trims trailing whitespace', () => {
    const config = {
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
      },
    }

    const result = generateRobotsTxt(config as any)

    expect(result.endsWith('\n')).toBe(false)
    expect(result).toBe(result.trim())
  })

  it('handles siteUrl with a trailing slash', () => {
    const config = {
      siteUrl: 'https://example.com/',
      robots: {
        rules: [{ userAgent: '*', allow: '/' }],
      },
    }

    const result = generateRobotsTxt(config as any)

    expect(result).toContain('Sitemap: https://example.com/sitemap.xml')
    expect(result).not.toContain('https://example.com//sitemap.xml')
  })
})
