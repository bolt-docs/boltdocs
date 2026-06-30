import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getHtmlTemplate, injectHtmlMeta } from '../../src/node/plugin/html'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

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
      expect(html).toContain('<div id="root"></div>')
    })

    it('should not include title tag (handled by Helmet per-page)', () => {
      const config = { theme: { title: 'My Custom Site' } }
      const html = getHtmlTemplate(config as any)

      expect(html).not.toContain('<title>')
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

    it('should not inject description meta tag (handled by Helmet per-page)', () => {
      const config = { theme: { description: 'My Description' } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).not.toContain(
        '<meta name="description" content="My Description">',
      )
    })

    it('should not inject OpenGraph meta tags (handled by Helmet per-page)', () => {
      const config = {
        theme: {
          title: 'OG Site',
          description: 'OG Description',
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).not.toContain('<meta property="og:title"')
      expect(result).not.toContain('<meta property="og:description"')
      expect(result).not.toContain('<meta property="og:type"')
    })

    it('should not inject Twitter card meta tags (handled by Helmet per-page)', () => {
      const config = {
        theme: {
          title: 'Twitter Site',
          description: 'Twitter Desc',
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).not.toContain('<meta name="twitter:card"')
      expect(result).not.toContain('<meta name="twitter:title"')
      expect(result).not.toContain('<meta name="twitter:description"')
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

    it('should not inject title (handled by Helmet per-page)', () => {
      const config = { theme: { title: 'New Title' } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).not.toContain('<title>New Title</title>')
      expect(result).toContain('<title>Original Title</title>')
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

      expect(result).not.toContain('<title>Added Title</title>')
    })

    it('should inject generator meta tag', () => {
      const config = { theme: { title: 'Site' } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<meta name="generator" content="Boltdocs">')
    })

    it('should handle empty config', () => {
      const config = {}
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain('<title>Original Title</title>')
      expect(result).not.toContain('<meta name="description"')
    })

    describe('Google Analytics 4', () => {
      const originalEnv = process.env.NODE_ENV

      afterEach(() => {
        process.env.NODE_ENV = originalEnv
      })

      it('should inject GA4 script when configured in production', () => {
        process.env.NODE_ENV = 'production'
        const config = {
          integrations: { analytics: { ga4: { measurementId: 'G-TEST123' } } },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).toContain(
          'https://www.googletagmanager.com/gtag/js?id=G-TEST123',
        )
        expect(result).toContain("gtag('config', 'G-TEST123', {});")
      })

      it('should not inject GA4 script in development by default', () => {
        process.env.NODE_ENV = 'development'
        const config = {
          integrations: { analytics: { ga4: { measurementId: 'G-TEST123' } } },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).not.toContain('https://www.googletagmanager.com/gtag/js')
      })

      it('should inject GA4 script in development if debug is true', () => {
        process.env.NODE_ENV = 'development'
        const config = {
          integrations: {
            analytics: { ga4: { measurementId: 'G-TEST123', debug: true } },
          },
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
        const config = {
          integrations: { analytics: { gtm: { tagId: 'GTM-TEST123' } } },
        }
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
        const config = {
          integrations: { analytics: { gtm: { tagId: 'GTM-TEST123' } } },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).not.toContain('https://www.googletagmanager.com/gtm.js')
        expect(result).not.toContain('https://www.googletagmanager.com/ns.html')
      })
    })

    describe('PostHog', () => {
      const originalEnv = process.env.NODE_ENV

      afterEach(() => {
        process.env.NODE_ENV = originalEnv
      })

      it('should inject PostHog script when configured in production', () => {
        process.env.NODE_ENV = 'production'
        const config = {
          integrations: {
            analytics: { posthog: { apiKey: 'phc_test123' } },
          },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).toContain('posthog.init("phc_test123"')
        expect(result).toContain('https://us.i.posthog.com')
        expect(result).toContain('<!-- PostHog -->')
      })

      it('should not inject PostHog script in development', () => {
        process.env.NODE_ENV = 'development'
        const config = {
          integrations: {
            analytics: { posthog: { apiKey: 'phc_test123' } },
          },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).not.toContain('posthog.init')
        expect(result).not.toContain('<!-- PostHog -->')
      })

      it('should use custom host when provided', () => {
        process.env.NODE_ENV = 'production'
        const config = {
          integrations: {
            analytics: {
              posthog: {
                apiKey: 'phc_test123',
                host: 'https://eu.i.posthog.com',
              },
            },
          },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).toContain('https://eu.i.posthog.com')
      })

      it('should disable pageview capture when set to false', () => {
        process.env.NODE_ENV = 'production'
        const config = {
          integrations: {
            analytics: {
              posthog: { apiKey: 'phc_test123', capturePageview: false },
            },
          },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).toContain('capture_pageview: false')
      })

      it('should enable session recording when set to true', () => {
        process.env.NODE_ENV = 'production'
        const config = {
          integrations: {
            analytics: {
              posthog: { apiKey: 'phc_test123', sessionRecording: true },
            },
          },
        }
        const result = injectHtmlMeta(baseHtml, config as any)

        expect(result).toContain(
          'session_recording: { recordCrossOriginPages: true }',
        )
      })
    })
  })

  describe('Verification meta tags (Google, Bing, Yandex, Pinterest, Facebook)', () => {
    const baseHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Test</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`

    it('should inject all verification tags when fully configured', () => {
      const config = {
        seo: {
          verification: {
            google: 'google123',
            bing: 'bing456',
            yandex: 'yandex789',
            pinterest: 'pinterest012',
            facebook: 'facebook345',
          },
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain(
        '<meta name="google-site-verification" content="google123">',
      )
      expect(result).toContain('<meta name="msvalidate.01" content="bing456">')
      expect(result).toContain(
        '<meta name="yandex-verification" content="yandex789">',
      )
      expect(result).toContain(
        '<meta name="p:domain_verify" content="pinterest012">',
      )
      expect(result).toContain(
        '<meta name="facebook-domain-verification" content="facebook345">',
      )
    })

    it('should only inject configured providers (single)', () => {
      const config = {
        seo: {
          verification: {
            google: 'google-only',
          },
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).toContain(
        '<meta name="google-site-verification" content="google-only">',
      )
      expect(result).not.toContain('msvalidate.01')
      expect(result).not.toContain('yandex-verification')
      expect(result).not.toContain('p:domain_verify')
      expect(result).not.toContain('facebook-domain-verification')
    })

    it('should not inject any verification tags when config is empty', () => {
      const config = {}
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).not.toContain('google-site-verification')
      expect(result).not.toContain('msvalidate.01')
      expect(result).not.toContain('yandex-verification')
      expect(result).not.toContain('p:domain_verify')
      expect(result).not.toContain('facebook-domain-verification')
    })

    it('should not inject any verification tags when verification is empty object', () => {
      const config = { seo: { verification: {} } }
      const result = injectHtmlMeta(baseHtml, config as any)

      expect(result).not.toContain('google-site-verification')
      expect(result).not.toContain('msvalidate.01')
      expect(result).not.toContain('yandex-verification')
      expect(result).not.toContain('p:domain_verify')
      expect(result).not.toContain('facebook-domain-verification')
    })

    it('should not duplicate verification tags', () => {
      const config = {
        seo: {
          verification: {
            google: 'nodup',
            bing: 'nodup',
          },
        },
      }
      const result = injectHtmlMeta(baseHtml, config as any)

      const googleMatches = result.match(/google-site-verification/g)
      expect(googleMatches).toHaveLength(1)

      const bingMatches = result.match(/msvalidate\.01/g)
      expect(bingMatches).toHaveLength(1)
    })
  })
})
