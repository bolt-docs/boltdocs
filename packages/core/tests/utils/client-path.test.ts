import { describe, expect, it } from 'vitest'
import { resolvePublicAssetUrl } from '../../src/client/utils/path'
import { resolveUrlReference } from '../../src/client/router/url-contract'

describe('client public asset paths', () => {
  it('prefixes root-relative assets with the configured base', () => {
    expect(resolvePublicAssetUrl('/dark.svg', '/docs')).toBe('/docs/dark.svg')
    expect(resolvePublicAssetUrl('/images/logo.svg', '/docs/')).toBe(
      '/docs/images/logo.svg',
    )
  })

  it('does not rewrite already based, external, or relative URLs', () => {
    expect(resolvePublicAssetUrl('/docs/dark.svg', '/docs')).toBe(
      '/docs/dark.svg',
    )
    expect(resolvePublicAssetUrl('https://example.com/logo.svg', '/docs')).toBe(
      'https://example.com/logo.svg',
    )
    expect(resolvePublicAssetUrl('../logo.svg', '/docs')).toBe('../logo.svg')
    expect(resolvePublicAssetUrl('//cdn.example.com/logo.svg', '/docs')).toBe(
      '//cdn.example.com/logo.svg',
    )
  })
})

describe('resolveUrlReference collection routes', () => {
  const baseConfig = {
    base: '/docs',
    collections: ['blog'],
  }

  it('prefixes known collection routes with the configured base', () => {
    expect(
      resolveUrlReference('/blog/boltdocs-3.3.0', baseConfig, {
        kind: 'collection',
        collection: 'blog',
      }),
    ).toBe('/docs/blog/boltdocs-3.3.0')
  })

  it('resolves site: collection references under the base (blog card links)', () => {
    expect(
      resolveUrlReference('site:/blog/boltdocs-3.3.0', baseConfig, {
        kind: 'collection',
        routes: [{ path: '/blog/boltdocs-3.3.0', collection: 'blog' }],
      }),
    ).toBe('/docs/blog/boltdocs-3.3.0')
  })

  it('does not duplicate the base when already present', () => {
    expect(
      resolveUrlReference('/docs/blog/boltdocs-3.3.0', baseConfig, {
        kind: 'collection',
        collection: 'blog',
        routes: [{ path: '/docs/blog/boltdocs-3.3.0', collection: 'blog' }],
      }),
    ).toBe('/docs/blog/boltdocs-3.3.0')
  })

  it('resolves site: collection references without route hints (banner/hero links)', () => {
    // SSR renders these before the route index is available, so no hint is
    // passed and the family falls back to `external`. The collection name is
    // still derivable from the path and must upgrade the URL to the based
    // collection form instead of dropping the base.
    expect(
      resolveUrlReference('site:/blog/boltdocs-3.3.0', baseConfig, {
        kind: 'external',
      }),
    ).toBe('/docs/blog/boltdocs-3.3.0')
    expect(resolveUrlReference('site:/blog', baseConfig)).toBe('/docs/blog')
  })

  it('keeps the base when a based collection path is re-resolved', () => {
    expect(
      resolveUrlReference('/docs/blog/boltdocs-3.3.0', baseConfig, {
        kind: 'external',
      }),
    ).toBe('/docs/blog/boltdocs-3.3.0')
  })
})
