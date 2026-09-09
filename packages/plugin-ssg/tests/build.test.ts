import { describe, it, expect } from 'vitest'
import {
  serializeStaticLoaderDataManifest,
  getNormalizedPathKey,
} from '../src/node/build'

describe('serializeStaticLoaderDataManifest', () => {
  it('sorts keys deterministically regardless of insertion order', () => {
    const first = serializeStaticLoaderDataManifest({
      '/docs/zeta': 'static-loader-data/zeta.json',
      '/docs/alpha': 'static-loader-data/alpha.json',
      '/docs/middle': 'static-loader-data/middle.json',
    })
    const second = serializeStaticLoaderDataManifest({
      '/docs/middle': 'static-loader-data/middle.json',
      '/docs/zeta': 'static-loader-data/zeta.json',
      '/docs/alpha': 'static-loader-data/alpha.json',
    })
    expect(first).toBe(second)
    expect(first.indexOf('/docs/alpha')).toBeLessThan(
      first.indexOf('/docs/middle'),
    )
    expect(first.indexOf('/docs/middle')).toBeLessThan(
      first.indexOf('/docs/zeta'),
    )
  })

  it('returns valid JSON', () => {
    const json = serializeStaticLoaderDataManifest({ '/docs/x': 'x.json' })
    expect(JSON.parse(json)).toEqual({ '/docs/x': 'x.json' })
  })
})

describe('getNormalizedPathKey', () => {
  it('strips a single trailing slash', () => {
    expect(getNormalizedPathKey('/docs/')).toBe('/docs')
    expect(getNormalizedPathKey('/docs/api/')).toBe('/docs/api')
  })

  it('keeps the root path unchanged', () => {
    expect(getNormalizedPathKey('/')).toBe('/')
  })

  it('normalizes a missing leading slash', () => {
    expect(getNormalizedPathKey('docs/')).toBe('/docs')
  })

  it('does not alias an external or localized route to the base', () => {
    // Regression: prepending the base here used to alias `/es` to `/docs/es`
    // and made the loader-data manifest depend on parallel completion order.
    expect(getNormalizedPathKey('/es')).toBe('/es')
    expect(getNormalizedPathKey('/showcase')).toBe('/showcase')
    expect(getNormalizedPathKey('/es/docs/')).toBe('/es/docs')
  })
})
