import { describe, expect, it, vi } from 'vitest'
import {
  createCriticalCssCacheKey,
  CriticalCssCache,
  extractNewStyleTags,
} from '../src/node/critical-cache'

describe('CriticalCssCache', () => {
  it('ignores text changes while preserving structural differences', () => {
    const css = '.hero{color:red}'
    const first = '<main class="hero"><h1>First page</h1></main>'
    const second = '<main class="hero"><h1>Second page</h1></main>'
    const different = '<main class="hero"><p>Second page</p></main>'

    expect(createCriticalCssCacheKey(first, css, 'zig-critters')).toBe(
      createCriticalCssCacheKey(second, css, 'zig-critters'),
    )
    expect(createCriticalCssCacheKey(first, css, 'zig-critters')).not.toBe(
      createCriticalCssCacheKey(different, css, 'zig-critters'),
    )
  })

  it('separates engines and stylesheet content', () => {
    const html = '<main class="hero">Docs</main>'

    expect(
      createCriticalCssCacheKey(html, '.hero{color:red}', 'zig-critters'),
    ).not.toBe(createCriticalCssCacheKey(html, '.hero{color:red}', 'beasties'))
    expect(
      createCriticalCssCacheKey(html, '.hero{color:red}', 'zig-critters'),
    ).not.toBe(
      createCriticalCssCacheKey(html, '.hero{color:blue}', 'zig-critters'),
    )
  })

  it('extracts only styles added by the critical CSS engine', () => {
    const before = '<head><style>.component{color:blue}</style></head>'
    const after =
      '<head><style>.component{color:blue}</style><style>.hero{color:red}</style></head>'

    expect(extractNewStyleTags(before, after)).toBe(
      '<style>.hero{color:red}</style>',
    )
    expect(extractNewStyleTags(before, before)).toBeNull()
  })

  it('deduplicates concurrent extraction for the same key', async () => {
    const cache = new CriticalCssCache()
    const extract = vi.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5))
      return '<style>.hero{color:red}</style>'
    })

    const results = await Promise.all(
      Array.from({ length: 8 }, () => cache.getOrCreate('same', extract)),
    )

    expect(extract).toHaveBeenCalledOnce()
    expect(results.every((value) => value === results[0])).toBe(true)
    expect(cache.size).toBe(1)
  })

  it('retries when the extractor throws synchronously', async () => {
    const cache = new CriticalCssCache()
    const extract = vi
      .fn<() => string | null>()
      .mockImplementationOnce(() => {
        throw new Error('temporary failure')
      })
      .mockReturnValueOnce('<style>.hero{color:red}</style>')

    await expect(cache.getOrCreate('sync-retry', extract)).rejects.toThrow(
      'temporary failure',
    )
    await expect(cache.getOrCreate('sync-retry', extract)).resolves.toBe(
      '<style>.hero{color:red}</style>',
    )
    expect(extract).toHaveBeenCalledTimes(2)
  })

  it('evicts settled entries after an in-flight entry completes', async () => {
    const cache = new CriticalCssCache(1)
    let release: (() => void) | undefined
    const pending = new Promise<string>((resolve) => {
      release = () => resolve('first')
    })

    const first = cache.getOrCreate('first', () => pending)
    cache.getOrCreate('second', async () => 'second')
    expect(cache.size).toBe(2)

    release?.()
    await first
    await Promise.resolve()
    cache.getOrCreate('third', async () => 'third')
    expect(cache.size).toBe(1)
  })

  it('removes rejected entries so a later route can retry', async () => {
    const cache = new CriticalCssCache()
    const extract = vi
      .fn<() => Promise<string | null>>()
      .mockRejectedValueOnce(new Error('temporary failure'))
      .mockResolvedValueOnce('<style>.hero{color:red}</style>')

    await expect(cache.getOrCreate('retry', extract)).rejects.toThrow(
      'temporary failure',
    )
    await expect(cache.getOrCreate('retry', extract)).resolves.toBe(
      '<style>.hero{color:red}</style>',
    )
    expect(extract).toHaveBeenCalledTimes(2)
  })
})
