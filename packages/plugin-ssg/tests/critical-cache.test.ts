import { describe, it, expect } from 'vitest'
import crypto from 'node:crypto'
import {
  createCriticalCssCacheKey,
  CriticalCssCache,
  extractNewStyleTags,
} from '../src/node/critical-cache'

/**
 * A digest the cache key accepts.
 *
 * `@types/node` rejects a `Buffer` as `crypto.BinaryLike` — the
 * `SharedArrayBuffer` variance — so the digest is copied into a plain
 * `Uint8Array`, which is what the source does with file contents for the
 * same reason.
 */
function digest(algorithm: string, input: string): Uint8Array {
  const buffer = crypto.createHash(algorithm).update(input).digest()
  return new Uint8Array(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ),
  )
}

describe('criticalCssCacheKey', () => {
  it('produces stable keys for identical inputs', () => {
    const html = '<div class="a"><p>text</p></div>'
    const css = '.a{color:red}'
    const cssHash = digest('sha256', css)
    expect(createCriticalCssCacheKey(html, cssHash, css, 'zig-critters')).toBe(
      createCriticalCssCacheKey(html, cssHash, css, 'zig-critters'),
    )
  })

  it('changes when the engine changes', () => {
    const html = '<div class="a"><p>text</p></div>'
    const css = '.a{color:red}'
    const cssHash = digest('sha256', css)
    expect(
      createCriticalCssCacheKey(html, cssHash, css, 'zig-critters'),
    ).not.toBe(createCriticalCssCacheKey(html, cssHash, css, 'beasties'))
  })

  it('changes when the CSS changes', () => {
    const html = '<div class="a"><p>text</p></div>'
    const cssHashA = digest('sha256', '.a{color:red}')
    const cssHashB = digest('sha256', '.a{color:blue}')
    expect(
      createCriticalCssCacheKey(
        html,
        cssHashA,
        '.a{color:red}',
        'zig-critters',
      ),
    ).not.toBe(
      createCriticalCssCacheKey(
        html,
        cssHashB,
        '.a{color:blue}',
        'zig-critters',
      ),
    )
  })

  it('ignores text content but reacts to structure changes', () => {
    const htmlA = '<div class="a"><p>one</p></div>'
    const htmlB = '<div class="a"><p>two</p></div>'
    const htmlC = '<div class="a"><span>one</span></div>'
    const css = '.a{color:red}'
    const cssHash = digest('sha256', css)
    expect(createCriticalCssCacheKey(htmlA, cssHash, css, 'zig-critters')).toBe(
      createCriticalCssCacheKey(htmlB, cssHash, css, 'zig-critters'),
    )
    expect(
      createCriticalCssCacheKey(htmlA, cssHash, css, 'zig-critters'),
    ).not.toBe(createCriticalCssCacheKey(htmlC, cssHash, css, 'zig-critters'))
  })
})

describe('CriticalCssCache', () => {
  it('deduplicates concurrent extractions for the same key', async () => {
    const cache = new CriticalCssCache()
    let calls = 0
    const extract = async () => {
      calls++
      await new Promise((resolve) => setTimeout(resolve, 10))
      return 'style'
    }
    const [a, b] = await Promise.all([
      cache.getOrCreate('k', extract),
      cache.getOrCreate('k', extract),
    ])
    expect(calls).toBe(1)
    expect(a).toBe('style')
    expect(b).toBe('style')
  })

  it('retries after a failure (failure removes the entry)', async () => {
    const cache = new CriticalCssCache()
    let shouldFail = true
    const extract = async () => {
      if (shouldFail) throw new Error('boom')
      return 'ok'
    }
    await expect(cache.getOrCreate('k', extract)).rejects.toThrow('boom')
    shouldFail = false
    await expect(cache.getOrCreate('k', extract)).resolves.toBe('ok')
  })
})

describe('extractNewStyleTags', () => {
  it('returns only newly added style tags', () => {
    const before = '<head><style>existing</style></head>'
    const after = '<head><style>existing</style><style>new</style></head>'
    expect(extractNewStyleTags(before, after)).toBe('<style>new</style>')
  })

  it('returns null when nothing was added', () => {
    const before = '<head><style>existing</style></head>'
    expect(extractNewStyleTags(before, before)).toBeNull()
  })
})
