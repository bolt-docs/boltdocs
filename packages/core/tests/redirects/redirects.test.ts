import { describe, expect, it } from 'vitest'
import {
  normalizeRedirectPath,
  resolveRedirects,
  toConfigPath,
} from '../../src/node/redirects'

describe('resolveRedirects', () => {
  it('normalizes redirect paths', () => {
    expect(normalizeRedirectPath('old')).toBe('/old')
    expect(normalizeRedirectPath('//old//page//')).toBe('/old/page')
    expect(normalizeRedirectPath('/')).toBe('/')
    expect(normalizeRedirectPath('/old#frag')).toBe('/old')
    expect(normalizeRedirectPath('/old?x=1#frag')).toBe('/old?x=1')
  })

  it('resolves a simple redirect and defaults to a permanent status', () => {
    const redirects = resolveRedirects({
      config: { redirects: [{ from: '/old', to: '/new' }] },
    })

    expect(redirects).toHaveLength(1)
    expect(redirects[0]).toMatchObject({
      from: '/old',
      to: '/new',
      external: false,
      status: 301,
      permanent: true,
    })
  })

  it('applies the configured base to internal targets', () => {
    const redirects = resolveRedirects({
      config: {
        base: '/docs',
        redirects: [{ from: '/old', to: '/guides/start' }],
      },
    })

    expect(redirects[0].to).toBe('/docs/guides/start')
  })

  it('keeps external targets untouched', () => {
    const redirects = resolveRedirects({
      config: {
        redirects: [{ from: '/docs', to: 'https://example.com' }],
      },
    })

    expect(redirects[0].external).toBe(true)
    expect(redirects[0].to).toBe('https://example.com')
  })

  it('collapses redirect chains into a single hop', () => {
    const redirects = resolveRedirects({
      config: {
        redirects: [
          { from: '/a', to: '/b' },
          { from: '/b', to: '/c' },
        ],
      },
    })

    expect(redirects.find((r) => r.from === '/a')?.to).toBe('/c')
  })

  it('rejects redirect loops', () => {
    expect(() =>
      resolveRedirects({
        config: {
          redirects: [
            { from: '/a', to: '/b' },
            { from: '/b', to: '/a' },
          ],
        },
      }),
    ).toThrow(/loop/i)
  })

  it('rejects duplicate sources', () => {
    expect(() =>
      resolveRedirects({
        config: {
          redirects: [
            { from: '/a', to: '/b' },
            { from: '/a', to: '/c' },
          ],
        },
      }),
    ).toThrow(/duplicate/i)
  })

  it('rejects a redirect that shadows an existing route', () => {
    expect(() =>
      resolveRedirects({
        config: { redirects: [{ from: '/docs/intro', to: '/other' }] },
        knownPaths: ['/docs/intro'],
      }),
    ).toThrow(/conflicts with an existing route/i)
  })

  it('mirrors redirects across locales when requested', () => {
    const redirects = resolveRedirects({
      config: {
        i18n: { defaultLocale: 'en', locales: ['en', 'es'] },
        redirects: [{ from: '/old', to: '/new', locale: true }],
      },
    })

    expect(redirects.map((r) => r.from)).toEqual(['/en/old', '/es/old'])
  })

  it('maps a public path back to the configured path', () => {
    expect(toConfigPath('/docs/old/', '/docs')).toBe('/old')
    expect(toConfigPath('/docs', '/docs')).toBe('/')
  })

  it('returns an empty list when no redirects are configured', () => {
    expect(resolveRedirects({ config: {} })).toEqual([])
    expect(resolveRedirects({})).toEqual([])
  })
})
