import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  getHtmlTemplate,
  injectHtmlMeta,
} from '../../packages/core/src/node/plugin/html'
import path from 'path'
import fs from 'fs'
import os from 'os'

describe('plugin html', () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'boltdocs-html-test-'))
  })

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true })
    }
  })

  describe('getHtmlTemplate', () => {
    it('should return default HTML template', () => {
      const config = {}
      const html = getHtmlTemplate(config as any)

      expect(html).toContain('<!doctype html>')
      expect(html).toContain('<html lang="en">')
      expect(html).toContain('<meta charset="UTF-8" />')
      expect(html).toContain('<title>Boltdocs</title>')
      expect(html).toContain('<div id="root"></div>')
    })

    it('should use custom title from config', () => {
      const config = { theme: { title: 'My Custom Site' } }
      const html = getHtmlTemplate(config as any)

      expect(html).toContain('<title>My Custom Site</title>')
    })
  })

  describe('injectHtmlMeta', () => {
    const baseHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Original Title</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`

    it('should inject description meta tag', () => {
      const config = { theme: { description: 'My Description' } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain(
        '<meta name="description" content="My Description">',
      )
    })

    it('should inject OpenGraph meta tags', () => {
      const config = {
        theme: {
          title: 'OG Site',
          description: 'OG Description',
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<meta property="og:title" content="OG Site">')
      expect(result).toContain(
        '<meta property="og:description" content="OG Description">',
      )
      expect(result).toContain('<meta property="og:type" content="website">')
    })

    it('should inject Twitter card meta tags', () => {
      const config = {
        theme: {
          title: 'Twitter Site',
          description: 'Twitter Desc',
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain(
        '<meta name="twitter:card" content="summary_large_image">',
      )
      expect(result).toContain(
        '<meta name="twitter:title" content="Twitter Site">',
      )
      expect(result).toContain(
        '<meta name="twitter:description" content="Twitter Desc">',
      )
    })

    it('should inject favicon from string logo', () => {
      const config = {
        theme: {
          favicon: '/favicon.ico',
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<link rel="icon" href="/favicon.ico">')
    })

    it('should inject favicon from object logo (light)', () => {
      const config = {
        theme: {
          logo: {
            light: '/logo-light.svg',
            dark: '/logo-dark.svg',
          },
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<link rel="icon" href="/logo-light.svg">')
    })

    it('should inject favicon from object logo (dark when light is missing)', () => {
      const config = {
        theme: {
          logo: {
            dark: '/logo-dark.svg',
          },
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<link rel="icon" href="/logo-dark.svg">')
    })

    it('should replace existing title', () => {
      const config = { theme: { title: 'New Title' } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<title>New Title</title>')
      expect(result).not.toContain('<title>Original Title</title>')
    })

    it('should inject virtual:boltdocs-entry script', () => {
      const config = { theme: { title: 'Site' } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('import "virtual:boltdocs-entry"')
    })

    it('should not inject virtual:boltdocs-entry if already present', () => {
      const htmlWithEntry = baseHtml.replace(
        '</body>',
        '<script type="module">import "virtual:boltdocs-entry";</script></body>',
      )
      const config = { theme: { title: 'Site' } }
      const result = injectHtmlMeta(htmlWithEntry, config as any)

      // Should only have one instance
      const matches = result.match(/virtual:boltdocs-entry/g)
      expect(matches).toHaveLength(1)
    })

    it('should inject theme script for theme detection', () => {
      const config = { theme: { title: 'Site' } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('boltdocs-theme')
      expect(result).toContain('prefers-color-scheme')
    })

    it('should handle HTML without title tag', () => {
      const htmlNoTitle = `<!doctype html>
<html>
<head>
  <meta charset="UTF-8" />
</head>
<body></body>
</html>`

      const config = { theme: { title: 'Added Title' } }
      const result = injectHtmlMeta(htmlNoTitle, config as any)

      expect(result).toContain('<title>Added Title</title>')
    })

    it('should inject generator meta tag', () => {
      const config = { theme: { title: 'Site' } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<meta name="generator" content="Boltdocs">')
    })

    it('should handle empty config', () => {
      const config = {}
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<title>Boltdocs</title>')
      expect(result).toContain('<meta name="description" content="">')
    })

    describe('Google Analytics 4', () => {
      const originalEnv = process.env.NODE_ENV

      afterEach(() => {
        process.env.NODE_ENV = originalEnv
      })

      it('should inject GA4 script when configured in production', () => {
        process.env.NODE_ENV = 'production'
        const config = { integrations: { ga4: { measurementId: 'G-TEST123' } } }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).toContain(
          'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
        )
        expect(result).toContain("gtag('config', 'G-TEST123', {});")
      })

      it('should not inject GA4 script in development by default', () => {
        process.env.NODE_ENV = 'development'
        const config = { integrations: { ga4: { measurementId: 'G-TEST123' } } }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).not.toContain('https://www.googletagmanager.com/gtag/js')
      })

      it('should inject GA4 script in development if debug is true', () => {
        process.env.NODE_ENV = 'development'
        const config = {
          integrations: { ga4: { measurementId: 'G-TEST123', debug: true } },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).toContain(
          'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
        )
        expect(result).toContain("gtag('config', 'G-TEST123', {});")
      })
    })

    describe('Google Tag Manager', () => {
      const originalEnv = process.env.NODE_ENV

      afterEach(() => {
        process.env.NODE_ENV = originalEnv
      })

      it('should inject GTM script and noscript when configured in production', () => {
        process.env.NODE_ENV = 'production'
        const config = { integrations: { gtm: { tagId: 'GTM-TEST123' } } }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).toContain('https://www.googletagmanager.com/gtm.js?id=')
        expect(result).toContain("'GTM-TEST123'")
        expect(result).toContain(
          'https://www.googletagmanager.com/ns.html?id=GTM-TEST123',
        )
        expect(result).toContain('<!-- Google Tag Manager -->')
        expect(result).toContain('<!-- Google Tag Manager (noscript) -->')
      })

      it('should not inject GTM script in development', () => {
        process.env.NODE_ENV = 'development'
        const config = { integrations: { gtm: { tagId: 'GTM-TEST123' } } }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).not.toContain('https://www.googletagmanager.com/gtm.js')
        expect(result).not.toContain('https://www.googletagmanager.com/ns.html')
      })
    })
  })
})
