import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'

/**
 * The wrappers resolve their dependency lazily and cache the result, so the
 * mock has to be in place before the module is loaded — and the module has to
 * be loaded *again* for the mock to apply.
 *
 * `vi.resetModules()` is what makes the second part true. Without it the
 * dynamic import returns the module another test file in the same worker
 * already loaded, the mock never applies, and the test fails depending on
 * which file ran first — which is a flake, not a failure.
 */
beforeEach(() => {
  vi.resetModules()
})

afterEach(() => {
  vi.doUnmock('beasties')
  vi.doUnmock('@bdocs/zig-critters')
  vi.resetModules()
})

describe('critical dependency wrappers', () => {
  it('returns undefined when beastsies cannot be imported', async () => {
    vi.doMock('beasties', () => {
      throw new Error('missing')
    })
    const { getBeasties } = await import('../src/node/critical')
    expect(await getBeasties('/out')).toBeUndefined()
  })

  it('returns undefined when zig-critters exposes no processHtml', async () => {
    vi.doMock('@bdocs/zig-critters', () => ({}))
    const { getZigCritters } = await import('../src/node/critical')
    expect(await getZigCritters()).toBeUndefined()
  })
})
