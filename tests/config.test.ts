import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { resolveConfig } from '../packages/core/src/node/config'
import fs from 'fs'
import path from 'path'
import os from 'os'

describe('config', () => {
  let tempProjectDir: string

  beforeEach(() => {
    vi.clearAllMocks()
    tempProjectDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'boltdocs-config-test-'),
    )
  })

  afterEach(() => {
    if (fs.existsSync(tempProjectDir)) {
      fs.rmSync(tempProjectDir, { recursive: true, force: true })
    }
  })

  describe('basic configuration', () => {
    it('should return defaults if no user config is found', async () => {
      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.title).toBe('Boltdocs')
    })

    it('should merge user config correctly from a real file', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.js')
      fs.writeFileSync(
        configPath,
        'export default { theme: { title: "Real User Title" } };',
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.title).toBe('Real User Title')
    })

    it('should handle nested themeConfig correctly', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.js')
      fs.writeFileSync(configPath, 'export default { title: "Direct Title" };')

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.title).toBe('Direct Title')
    })

    it('should handle errors during config import gracefully', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.js')
      fs.writeFileSync(configPath, 'throw new Error("Config Error");')

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
      const config = await resolveConfig(tempProjectDir, tempProjectDir)

      expect(config.theme?.title).toBe('Boltdocs')
      expect(warnSpy).toHaveBeenCalled()
    })
  })

  describe('theme configuration', () => {
    it('should accept theme.title', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { theme: { title: 'My Site' } };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.title).toBe('My Site')
    })

    it('should accept theme.description', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { theme: { description: 'My Description' } };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.description).toBe('My Description')
    })

    it('should accept theme.logo as string', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { theme: { logo: '/logo.png' } };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.logo).toBe('/logo.png')
    })

    it('should accept theme.logo as object with light/dark', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          theme: { 
            logo: { 
              light: '/logo-light.svg', 
              dark: '/logo-dark.svg',
              alt: 'My Logo'
            } 
          } 
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.logo).toEqual({
        light: '/logo-light.svg',
        dark: '/logo-dark.svg',
        alt: 'My Logo',
      })
    })

    it('should accept theme.navbar items', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          theme: { 
            navbar: [
              { label: 'Home', href: '/' },
              { label: 'Docs', href: '/docs' },
              { label: 'GitHub', href: 'https://github.com' }
            ]
          } 
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.navbar).toHaveLength(3)
      expect(config.theme?.navbar![0]).toEqual({
        label: 'Home',
        href: '/',
      })
    })

    it('should accept theme.socialLinks', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          theme: { 
            socialLinks: [
              { icon: 'github', link: 'https://github.com' },
              { icon: 'twitter', link: 'https://twitter.com' }
            ]
          } 
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.socialLinks).toHaveLength(2)
    })

    it('should accept theme.codeTheme as string', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { theme: { codeTheme: 'one-dark-pro' } };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.codeTheme).toBe('one-dark-pro')
    })

    it('should accept theme.codeTheme as object', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          theme: { 
            codeTheme: { light: 'github-light', dark: 'github-dark' }
          } 
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.codeTheme).toEqual({
        light: 'github-light',
        dark: 'github-dark',
      })
    })

    it('should accept theme.tabs configuration', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          theme: { 
            tabs: [
              { id: 'api', text: 'API Reference', icon: 'code' },
              { id: 'guide', text: 'User Guide', icon: 'book' }
            ]
          } 
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.tabs).toHaveLength(2)
      expect(config.theme?.tabs![0]).toEqual({
        id: 'api',
        text: 'API Reference',
        icon: 'code',
      })
    })
  })

  describe('i18n configuration', () => {
    it('should accept i18n configuration', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          i18n: {
            defaultLocale: 'en',
            locales: { en: 'English', es: 'Español' }
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.i18n?.defaultLocale).toBe('en')
      expect(Object.keys(config.i18n!.locales)).toEqual(['en', 'es'])
    })

    it('should accept localeConfigs with direction', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          i18n: {
            defaultLocale: 'en',
            locales: { en: 'English', ar: 'العربية' },
            localeConfigs: {
              en: { label: 'English', direction: 'ltr' },
              ar: { label: 'العربية', direction: 'rtl' }
            }
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.i18n?.localeConfigs?.ar?.direction).toBe('rtl')
    })

    it('should normalize locales array to record', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          i18n: {
            defaultLocale: 'en',
            locales: ['en', 'es']
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.i18n?.defaultLocale).toBe('en')
      expect(config.i18n?.locales).toEqual({ en: 'en', es: 'es' })
    })
  })

  describe('versions configuration', () => {
    it('should accept versions configuration', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          versions: {
            defaultVersion: 'v2',
            versions: [
              { label: 'v1', path: 'v1' },
              { label: 'v2', path: 'v2' }
            ]
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.versions?.defaultVersion).toBe('v2')
      expect(config.versions?.versions).toHaveLength(2)
    })

    it('should accept versions with prefix', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          versions: {
            defaultVersion: 'v2',
            prefix: 'v',
            versions: [
              { label: 'v1', path: '1' },
              { label: 'v2', path: '2' }
            ]
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.versions?.prefix).toBe('v')
    })
  })

  describe('security configuration', () => {
    it('should accept security config with CSP enabled', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          security: {
            enableCSP: true
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.security?.enableCSP).toBe(true)
    })

    it('should accept custom headers', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          security: {
            customHeaders: {
              'X-Custom-Header': 'custom-value'
            }
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.security?.customHeaders).toEqual({
        'X-Custom-Header': 'custom-value',
      })
    })
  })

  describe('robots configuration', () => {
    it('should accept robots config', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          robots: {
            rules: [
              { userAgent: '*', allow: '/' }
            ]
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.robots).toBeDefined()
    })
  })

  describe('plugins configuration', () => {
    it('should accept plugins array', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          plugins: []
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.plugins).toEqual([])
    })
  })

  describe('config validation', () => {
    it('should throw error for invalid config', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { 
          theme: { title: 123 }
        };`,
      )

      await expect(
        resolveConfig(tempProjectDir, tempProjectDir),
      ).rejects.toThrow()
    })

    it('should handle TypeScript config files', async () => {
      // Remove .js config if exists
      const jsPath = path.resolve(tempProjectDir, 'boltdocs.config.js')
      if (fs.existsSync(jsPath)) fs.unlinkSync(jsPath)

      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default { theme: { title: 'TS Config' } };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.title).toBe('TS Config')
    })

    it('should handle boltdocs.config.mjs', async () => {
      // Remove other config files
      for (const ext of ['.ts', '.js']) {
        const p = path.resolve(tempProjectDir, `boltdocs.config${ext}`)
        if (fs.existsSync(p)) fs.unlinkSync(p)
      }

      fs.writeFileSync(
        path.resolve(tempProjectDir, 'boltdocs.config.mjs'),
        'export default { theme: { title: "MJS Title" } };',
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.title).toBe('MJS Title')
    })
  })

  describe('complex configuration scenarios', () => {
    it('should handle full configuration with all options', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default {
          siteUrl: 'https://example.com',
          docsDir: 'docs',
          theme: {
            title: 'Full Config Site',
            description: 'A fully configured site',
            logo: {
              light: '/logo-light.svg',
              dark: '/logo-dark.svg',
              alt: 'Logo'
            },
            navbar: [
              { label: 'Home', href: '/' },
              { label: 'Docs', href: '/docs' }
            ],
            socialLinks: [
              { icon: 'github', link: 'https://github.com' }
            ],
            codeTheme: { light: 'github-light', dark: 'github-dark' },
            editLink: 'https://github.com/edit/:path',
            breadcrumbs: true,
            poweredBy: true
          },
          i18n: {
            defaultLocale: 'en',
            locales: { en: 'English', es: 'Español' }
          },
          versions: {
            defaultVersion: 'v2',
            versions: [
              { label: 'v1', path: 'v1' },
              { label: 'v2', path: 'v2' }
            ]
          },
          security: {
            enableCSP: true
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)

      expect(config.siteUrl).toBe('https://example.com')
      expect(config.theme?.title).toBe('Full Config Site')
      expect(config.theme?.description).toBe('A fully configured site')
      expect(config.i18n?.defaultLocale).toBe('en')
      expect(config.versions?.defaultVersion).toBe('v2')
      expect(config.security?.enableCSP).toBe(true)
    })

    it('should merge top-level theme config with theme object', async () => {
      const configPath = path.resolve(tempProjectDir, 'boltdocs.config.ts')
      fs.writeFileSync(
        configPath,
        `export default {
          title: 'Top Level Title',
          theme: {
            description: 'Theme Description'
          }
        };`,
      )

      const config = await resolveConfig(tempProjectDir, tempProjectDir)
      expect(config.theme?.title).toBe('Top Level Title')
      expect(config.theme?.description).toBe('Theme Description')
    })
  })
})
