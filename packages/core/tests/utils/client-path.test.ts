import { describe, expect, it } from 'vitest'
import { resolvePublicAssetUrl } from '../../src/client/utils/path'

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
