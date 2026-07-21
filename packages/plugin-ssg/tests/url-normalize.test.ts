import { describe, it, expect, vi } from 'vitest'
import { normalizeUrl } from '../src/node/vite-plugin/index'

describe('normalizeUrl middleware', () => {
  it('decodes percent-encoded UTF-8 paths to canonical form', () => {
    // `input` is derived via `encodeURI` so the test source itself stays
    // ASCII-only and portable. The expected value is derived via
    // `decodeURI(input)` so the assertion stays in sync with the input.
    const input = encodeURI('/blog/Jesús Alcalá')
    const req = {
      url: input,
      originalUrl: input,
    }
    const next = vi.fn()
    normalizeUrl(req, {} as never, next)
    expect(req.url).toBe(decodeURI(input))
    expect(req.originalUrl).toBe(decodeURI(input))
    expect(next).toHaveBeenCalledOnce()
  })

  it('preserves query string verbatim through the decode', () => {
    const req = {
      url: '/blog/Jes%C3%BAs%20Alcal%C3%A1?html-proxy&index=0.js',
    }
    const next = vi.fn()
    normalizeUrl(req, {} as never, next)
    expect(req.url).toBe('/blog/Jesús Alcalá?html-proxy&index=0.js')
    expect(req.originalUrl).toBeUndefined()
    expect(next).toHaveBeenCalledOnce()
  })

  it('no-ops when the path has no percent-encoded bytes', () => {
    const req = {
      url: '/docs/guides/start',
      originalUrl: '/docs/guides/start',
    }
    const originalUrl = req.url
    const originalOriginalUrl = req.originalUrl
    normalizeUrl(req, {} as never, () => {})
    expect(req.url).toBe(originalUrl)
    expect(req.originalUrl).toBe(originalOriginalUrl)
  })

  it('preserves reserved URI characters (does not decode %2F to /)', () => {
    // `decodeURI` does not decode `%2F` so we must keep them literal so
    // that downstream path comparisons treat a literal `%2F` segment
    // as a single segment rather than splitting it.
    const req = { url: '/api/%2Fpath/value' }
    normalizeUrl(req, {} as never, () => {})
    expect(req.url).toBe('/api/%2Fpath/value')
  })

  it('handles malformed URI sequences without throwing', () => {
    // `%E0%A4%A` is an incomplete 3-byte UTF-8 sequence → decodeURI throws.
    const req = { url: '/%E0%A4%A' }
    expect(() => normalizeUrl(req, {} as never, () => {})).not.toThrow()
  })

  it('only rewrites the path, leaving percent-encoded bytes in the query untouched', () => {
    // The `/%[0-9A-Fa-f]{2}/` fast-path regex is bounded to the path
    // component (before `?`), so percent-encoded bytes in the query
    // string are NOT decoded — decoding them would risk corrupting
    // user-supplied query values.
    const req = { url: '/foo%20bar?qs=%20baz' }
    const next = vi.fn()
    normalizeUrl(req, {} as never, next)
    expect(req.url).toBe('/foo bar?qs=%20baz')
    expect(next).toHaveBeenCalledOnce()
  })

  it('always runs next() regardless of rewriting or decoding', () => {
    const next1 = vi.fn()
    normalizeUrl({ url: '/plain' }, {} as never, next1)
    expect(next1).toHaveBeenCalledOnce()

    const next2 = vi.fn()
    normalizeUrl({ url: '/%C3%BAs' }, {} as never, next2)
    expect(next2).toHaveBeenCalledOnce()

    const next3 = vi.fn()
    normalizeUrl({}, {} as never, next3)
    expect(next3).toHaveBeenCalledOnce()
  })
})
