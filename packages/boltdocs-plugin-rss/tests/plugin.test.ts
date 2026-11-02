import { describe, it, expect } from 'vitest'
import { RssPluginOptionsSchema } from '../src/node/feed-schema'
import {
  getSiteTitle,
  getLocales,
  getLocalizedTitle,
  getLocalizedDescription,
} from '../src/node/helpers'

describe('RssPluginOptionsSchema', () => {
  it('defaults format to rss and devMode to false', () => {
    expect(RssPluginOptionsSchema.parse({})).toMatchObject({
      format: 'rss',
      devMode: false,
    })
  })

  it('rejects an invalid format', () => {
    expect(() => RssPluginOptionsSchema.parse({ format: 'xml' })).toThrow()
  })

  it('enforces the limit bounds', () => {
    expect(() => RssPluginOptionsSchema.parse({ limit: 0 })).toThrow()
    expect(() => RssPluginOptionsSchema.parse({ limit: 501 })).toThrow()
    expect(RssPluginOptionsSchema.parse({ limit: 10 }).limit).toBe(10)
  })
})

describe('helpers', () => {
  it('getSiteTitle handles string, localized object and missing title', () => {
    expect(getSiteTitle({ theme: { title: 'Docs' } } as any)).toBe('Docs')
    expect(
      getSiteTitle({ theme: { title: { en: 'Docs', es: 'Docs' } } } as any),
    ).toBe('Docs')
    expect(getSiteTitle({} as any)).toBe('Documentation')
  })

  it('getLocales handles array, object and missing i18n config', () => {
    expect(getLocales({} as any)).toEqual(['en'])
    expect(getLocales({ i18n: { locales: ['en', 'es'] } } as any)).toEqual([
      'en',
      'es',
    ])
    expect(
      getLocales({
        i18n: { locales: { en: 'English', es: 'Spanish' } },
      } as any),
    ).toEqual(['en', 'es'])
  })

  it('getLocalizedTitle resolves locale, then default locale, then fallback', () => {
    const config = {
      theme: { title: { es: 'Docs ES', en: 'Docs EN' } },
      i18n: { defaultLocale: 'en' },
    } as any
    expect(getLocalizedTitle(config, 'es', 'Docs')).toBe('Docs ES')
    expect(getLocalizedTitle(config, 'fr', 'Docs')).toBe('Docs EN')
    expect(getLocalizedTitle(config, 'fr', 'Fallback')).toBe('Docs EN')
    expect(
      getLocalizedTitle({ theme: { title: 'Flat' } } as any, 'es', 'D'),
    ).toBe('Flat')
    expect(getLocalizedTitle({} as any, 'es', 'D')).toBe('D')
  })

  it('getLocalizedDescription resolves locale then default locale', () => {
    const config = {
      theme: { description: { es: 'Desc ES', en: 'Desc EN' } },
      i18n: { defaultLocale: 'en' },
    } as any
    expect(getLocalizedDescription(config, 'es')).toBe('Desc ES')
    expect(getLocalizedDescription(config, 'fr')).toBe('Desc EN')
    expect(getLocalizedDescription({} as any, 'fr')).toBe('')
  })
})
